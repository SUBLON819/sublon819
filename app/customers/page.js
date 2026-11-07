'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Search, User, Edit3 } from 'lucide-react';

export default function CustomersPage() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // State สำหรับเปิด-ปิด Modal ดูประวัติรายบุคคล
  const [customerProfileModalOpen, setCustomerProfileModalOpen] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // State สำหรับเปิด Modal รับชำระเงิน
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // State สำหรับ Modal แก้ไขข้อมูลลูกค้า
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFacebook, setEditFacebook] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loansRes, paymentsRes] = await Promise.all([
        supabase.from('loans').select('*').order('id', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false })
      ]);

      if (loansRes.error) throw loansRes.error;
      setLoans(loansRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 📌 จัดกลุ่มข้อมูลตามชื่อลูกค้า (Group by Full Name)
  const customerMap = {};
  loans.forEach((loan) => {
    const name = loan.full_name || 'ไม่ระบุชื่อ';
    
    // 🛑 ข้ามบิลที่ถูกปฏิเสธคำขอทันที ไม่ให้นำมาจัดกลุ่มและไม่แสดงรายชื่อ
    if (loan.status === 'ปฏิเสธคำขอ') return;

    if (!customerMap[name]) {
      customerMap[name] = {
        full_name: name,
        phone: loan.phone || '',
        bank_name: loan.bank_name || '',
        account_number: loan.account_number || '',
        facebook_link: loan.facebook_link || '',
        loans: [],
        totalBorrowed: 0,
        totalRemaining: 0,
      };
    }
    customerMap[name].loans.push(loan);
    customerMap[name].totalBorrowed += Number(loan.principal_amount || 0);
    customerMap[name].totalRemaining += Number((loan.remaining_principal ?? loan.principal_amount) || 0);
  });

  const customersList = Object.values(customerMap);

  // กรองรายชื่อลูกค้าตามคำค้นหา
  const filteredCustomers = customersList.filter((cust) => {
    return (
      cust.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.phone.includes(searchQuery)
    );
  });

  // ข้อมูลสำหรับ Modal ประวัติลูกค้า
  const customerLoans = loans.filter(l => l.full_name === selectedCustomerName && l.status !== 'ปฏิเสธคำขอ');
  
  const customerLoanIds = customerLoans.map(l => l.id);
  const customerPayments = payments.filter(p => customerLoanIds.includes(p.loan_id));

  const totalCustomerBorrowed = customerLoans.reduce((sum, l) => sum + Number(l.principal_amount || 0), 0);
  const totalCustomerRemaining = customerLoans
    .filter(l => l.status === 'อนุมัติแล้ว')
    .reduce((sum, l) => sum + Number(l.remaining_principal || l.principal_amount || 0), 0);
  
  // 🟢 รวมยอดเงินหลัก + ค่าปรับ เพื่อแสดงยอดชำระแล้วทั้งหมดที่ถูกต้องตรงกันทุกหน้า
  const totalCustomerPaid = customerPayments.reduce((sum, p) => sum + Number(p.amount || 0) + Number(p.fine_amount || 0), 0);
  const customerInfo = customerLoans[0] || {};

  // ฟังก์ชันบันทึกการแก้ไขข้อมูลลูกค้า (อัปเดตทุกสัญญาที่มีชื่อเดิมนี้)
  const handleSaveCustomerInfo = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('loans')
        .update({
          full_name: editName.trim(),
          phone: String(editPhone || '').trim(),
          facebook_link: editFacebook.trim()
        })
        .eq('full_name', selectedCustomerName);

      if (error) throw error;

      alert('อัปเดตข้อมูลลูกค้าสำเร็จ!');
      setSelectedCustomerName(editName.trim());
      setEditCustomerModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error updating customer:', err.message);
      alert('เกิดข้อผิดพลาดในการอัปเดต: ' + err.message);
    }
  };

  // ฟังก์ชันบันทึกรับชำระเงิน (รองรับการกรอกเฉพาะค่าปรับ หรือยอดจ่ายหลัก โดยค่าปรับแยกเป็นกำไรไม่นำมาหักต้น)
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentLoan) return;

    try {
      const payAmount = Number(paymentAmount || 0);
      const fine = Number(fineAmount || 0);
      const discount = Number(discountAmount || 0);

      if (payAmount <= 0 && fine <= 0) {
        alert('กรุณากรอกจำนวนเงินที่ชำระ หรือระบุค่าปรับอย่างน้อย 1 อย่าง');
        return;
      }

      // 1. บันทึกประวัติการชำระเงินลงตาราง payments พร้อมค่าปรับและส่วนลด
      const { error: paymentError } = await supabase.from('payments').insert([{
        loan_id: selectedPaymentLoan.id,
        bill_code: selectedPaymentLoan.bill_code,
        full_name: selectedPaymentLoan.full_name,
        amount: payAmount,
        fine_amount: fine,
        discount_amount: discount,
        note: paymentNote || (payAmount > 0 ? 'รับชำระปกติ' : 'บันทึกค่าปรับ')
      }]);

      if (paymentError) throw paymentError;

      // 2. ถ้ายอดจ่ายหลัก (payAmount) มากกว่า 0 เท่านั้น ถึงจะนำไปตัดลดต้น ส่วนค่าปรับจะไม่นำมาหักต้น
      if (payAmount > 0) {
        const currentRemaining = Number(selectedPaymentLoan.remaining_principal || selectedPaymentLoan.principal_amount || 0);
        const newRemaining = Math.max(0, currentRemaining - payAmount);
        const newStatus = newRemaining === 0 ? 'ชำระแล้ว' : selectedPaymentLoan.status;

        const { error: updateError } = await supabase
          .from('loans')
          .update({
            remaining_principal: newRemaining,
            status: newStatus
          })
          .eq('id', selectedPaymentLoan.id);

        if (updateError) throw updateError;
      }

      alert('บันทึกรับชำระเงินสำเร็จ!');
      setPaymentModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving payment:', err.message);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 sm:p-6 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">รายชื่อลูกหนี้ทั้งหมด (รายบุคคล)</h1>
              <p className="text-xs text-purple-100">คลิกที่ชื่อลูกค้าเพื่อดูประวัติและรายละเอียดทั้งหมด</p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-purple-200 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อ, เบอร์โทร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-purple-950/40 border border-purple-300/40 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-white placeholder:text-purple-200/70"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-purple-100 pb-3">
            <FileText className="w-4 h-4 text-purple-700" />
            <span>รายชื่อลูกค้าทั้งหมด ({filteredCustomers.length} คน)</span>
          </h3>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">ไม่พบข้อมูลลูกค้าในระบบ</div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((cust, idx) => (
                <div key={idx} className="bg-purple-50/40 border border-purple-200 hover:border-purple-400 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all">
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-700" />
                      <span 
                        onClick={() => {
                          setSelectedCustomerName(cust.full_name);
                          setCustomerProfileModalOpen(true);
                        }}
                        className="text-base font-black text-slate-900 hover:text-purple-700 underline cursor-pointer transition-colors"
                        title="คลิกเพื่อดูประวัติ"
                      >
                        {cust.full_name} 🔍
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      เบอร์โทร: <span className="font-mono font-bold text-slate-700">{cust.phone || '-'}</span> | ธนาคาร: {cust.bank_name || '-'} ({cust.account_number || '-'})
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-xl border border-purple-100 w-full sm:w-auto justify-between sm:justify-end">
                    <div>
                      <span className="text-[10px] text-slate-400 block">ยอดกู้รวม:</span>
                      <span className="font-mono font-bold text-purple-700 text-sm">฿{cust.totalBorrowed.toLocaleString()}</span>
                    </div>
                    <div className="border-l pl-4 border-slate-200">
                      <span className="text-[10px] text-slate-400 block">หนี้คงเหลือรวม:</span>
                      <span className="font-mono font-bold text-amber-600 text-sm">฿{cust.totalRemaining.toLocaleString()}</span>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL ประวัติลูกค้าแบบเต็มจอ ================= */}
      {customerProfileModalOpen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="bg-purple-900 text-white px-4 sm:px-8 py-4 flex justify-between items-center shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-800 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-black flex flex-wrap items-center gap-3">
                  <span>ประวัติข้อมูลลูกค้า: {selectedCustomerName}</span>
                  <button
                    onClick={() => {
                      setEditName(selectedCustomerName);
                      setEditPhone(customerInfo.phone || '');
                      setEditFacebook(customerInfo.facebook_link || '');
                      setEditCustomerModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>แก้ไขข้อมูล</span>
                  </button>
                </h2>
                <p className="text-xs text-purple-300/80">ระบบแสดงข้อมูลสัญญาและประวัติการชำระเงินแบบเต็มหน้าจอ</p>
              </div>
            </div>
            <button 
              onClick={() => setCustomerProfileModalOpen(false)}
              className="px-4 py-2 bg-purple-800 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>✕ ปิดหน้าจอ</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-5xl mx-auto w-full box-border">
            
            {/* ข้อมูลการติดต่อ */}
            <div className="bg-purple-50 p-4 sm:p-6 rounded-2xl border border-purple-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm shadow-sm relative">
              <div>
                <span className="text-slate-500 block text-xs">เบอร์โทรศัพท์:</span> 
                <span className="font-mono font-bold text-slate-900 text-base">{customerInfo.phone || 'ไม่มีข้อมูล'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">บัญชีธนาคาร:</span> 
                <span className="font-mono font-bold text-slate-900 text-base">{customerInfo.bank_name || '-'} ({customerInfo.account_number || '-'})</span>
              </div>
              <div className="sm:col-span-3 truncate">
                <span className="text-slate-500 block text-xs">Facebook:</span> 
                {customerInfo.facebook_link ? (
                  <a 
                    href={customerInfo.facebook_link.startsWith('http') ? customerInfo.facebook_link : `https://${customerInfo.facebook_link}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-purple-700 font-bold underline truncate hover:text-purple-900 inline-block text-sm"
                  >
                    {customerInfo.facebook_link} 🔗
                  </a>
                ) : (
                  <span className="text-slate-400 text-xs">ไม่มีข้อมูล</span>
                )}
              </div>
            </div>

            {/* กล่องสรุปยอดรวม 3 ช่อง */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm">
                <div className="text-xs text-slate-500">ยอดกู้สะสมทั้งหมด</div>
                <div className="font-mono font-bold text-purple-600 text-lg sm:text-xl mt-1">฿{totalCustomerBorrowed.toLocaleString()}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm">
                <div className="text-xs text-slate-500">ยอดหนี้คงเหลือปัจจุบัน</div>
                <div className="font-mono font-bold text-amber-600 text-lg sm:text-xl mt-1">฿{totalCustomerRemaining.toLocaleString()}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm">
                <div className="text-xs text-slate-500">ยอดชำระแล้วทั้งหมด</div>
                <div className="font-mono font-bold text-teal-600 text-lg sm:text-xl mt-1">฿{totalCustomerPaid.toLocaleString()}</div>
              </div>
            </div>

            {/* รายการสัญญา พร้อมปุ่มรับชำระ */}
            <div className="space-y-3 bg-white p-4 sm:p-6 rounded-2xl border border-purple-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-800 border-b border-purple-100 pb-2">รายการสัญญาของลูกค้ารายนี้ ({customerLoans.length} บิล)</h4>
              {customerLoans.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">ไม่พบประวัติสัญญา</div>
              ) : (
                <div className="space-y-3">
                  {customerLoans.map((l) => (
                    <div key={l.id} className="bg-purple-50/40 p-4 rounded-xl border border-purple-100 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-purple-700 text-base">{l.bill_code}</span> 
                          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold">{l.loan_type}</span>
                          <div className="text-xs text-slate-500 mt-1">
                            รอบจ่าย: {l.payment_schedule || 'จ่ายทุกวัน'} | สถานะ: <span className="text-emerald-700 font-bold">{l.status}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-slate-900 text-sm">ยอดตั้งต้น: ฿{Number(l.principal_amount || 0).toLocaleString()}</div>
                          <div className="text-xs text-amber-600 mt-0.5">คงเหลือ: ฿{Number(l.remaining_principal || l.principal_amount || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-purple-200/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPaymentLoan(l);
                            setPaymentAmount('');
                            setFineAmount('');
                            setDiscountAmount('');
                            setPaymentNote('');
                            setPaymentModalOpen(true);
                          }}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <span>💵 บันทึกรับชำระบิลนี้</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ประวัติการชำระเงินย้อนหลัง */}
            <div className="space-y-3 bg-white p-4 sm:p-6 rounded-2xl border border-purple-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-800 border-b border-purple-100 pb-2">ประวัติการชำระเงินย้อนหลัง ({customerPayments.length} รายการ)</h4>
              {customerPayments.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">ยังไม่มีประวัติการชำระเงิน</div>
              ) : (
                <div className="space-y-2">
                  {customerPayments.map((p) => (
                    <div key={p.id} className="bg-purple-50/20 p-3 rounded-xl border border-purple-100 flex justify-between items-center text-xs sm:text-sm">
                      <div>
                        <span className="font-mono font-bold text-purple-800 text-base">฿{Number(p.amount || 0).toLocaleString()}</span>
                        <span className="text-xs text-slate-600 ml-3 bg-purple-100 px-2 py-0.5 rounded">หมายเหตุ: {p.note || 'รับชำระปกติ'}</span>
                        {Number(p.fine_amount || 0) > 0 && <span className="text-xs text-rose-600 ml-2 font-bold">(ค่าปรับ +{p.fine_amount})</span>}
                        {Number(p.discount_amount || 0) > 0 && <span className="text-xs text-blue-600 ml-2 font-bold">(ส่วนลด -{p.discount_amount})</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {new Date(p.created_at).toLocaleString('th-TH')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL แก้ไขข้อมูลลูกค้า ================= */}
      {editCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-[92%] max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-purple-100 pb-3">
              <h3 className="text-base font-bold text-purple-900">
                ✏️ แก้ไขข้อมูลลูกค้า
              </h3>
              <button 
                onClick={() => setEditCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ชื่อ-นามสกุล *</label>
                <input 
                  type="text" 
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">เบอร์โทรศัพท์</label>
                <input 
                  type="text" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">ลิงก์ Facebook</label>
                <input 
                  type="text" 
                  value={editFacebook}
                  onChange={(e) => setEditFacebook(e.target.value)}
                  placeholder="เช่น facebook.com/username"
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600"
                />
              </div>

              <div className="pt-3 border-t border-purple-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditCustomerModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL บันทึกรับชำระเงิน ================= */}
      {paymentModalOpen && selectedPaymentLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-[92%] max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">💵</span>
                <h3 className="text-sm sm:text-base font-black text-purple-900">
                  บันทึกรับชำระ: <span className="font-mono text-purple-700">{selectedPaymentLoan.bill_code}</span>
                </h3>
              </div>
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 🟢 เพิ่มกล่องแสดงประเภท, ยอดคงเหลือ, และดอกเบี้ยปัจจุบัน */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 space-y-1 text-xs font-medium text-slate-700">
              <div>ลูกค้า: <span className="font-bold text-slate-900">{selectedPaymentLoan.full_name}</span></div>
              <div>ประเภท: <span className="font-bold text-purple-700">{selectedPaymentLoan.loan_type || '-'}</span></div>
              <div>ยอดคงเหลือปัจจุบัน: <span className="font-mono font-bold text-amber-600">฿{Number(selectedPaymentLoan.remaining_principal || selectedPaymentLoan.principal_amount || 0).toLocaleString()}</span></div>
              <div>ดอกเบี้ย / รายละเอียด: <span className="font-mono font-bold text-slate-900">{selectedPaymentLoan.interest_amount ? `฿${Number(selectedPaymentLoan.interest_amount).toLocaleString()}` : (selectedPaymentLoan.note || '-')}</span></div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">ยอดเงินที่ชำระ (บาท)</label>
                <input 
                  type="number" 
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0 (หรือระบุยอดชำระ...)"
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/20 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">ค่าปรับ (ถ้ามี)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">ส่วนลด (ถ้ามี)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">หมายเหตุ</label>
                <input 
                  type="text" 
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="เช่น ชำระงวดประจำวัน..."
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/20"
                />
              </div>

              <div className="pt-3 border-t border-purple-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  ยืนยันบันทึกรับชำระ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}