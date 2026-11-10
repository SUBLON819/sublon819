'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Search, User } from 'lucide-react';

// 📌 นำเข้า Component กลางสำหรับแสดงประวัติลูกค้า
import CustomerDetail from '@/components/CustomerDetail';

// 📌 ฟังก์ชันดึงวันที่ปัจจุบัน (YYYY-MM-DD) ตามเวลาประเทศไทย
function getThaiTodayString() {
  const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

// 📌 ฟังก์ชันคำนวณดอกเบี้ยสะสม + รวมค่าปรับเรียลไทม์ (นับรวมวันทำรายการด้วยเสมอ)
function calculateAccruedInterest(loan) {
  if (!loan || loan.status !== 'อนุมัติแล้ว') return 0;
  
  const currentFine = Number(loan.fine_amount || 0);

  if (loan.loan_type === 'จบต้นดอก') {
    return Number(loan.total_interest || 0) + currentFine;
  }

  if (loan.loan_type !== 'ดอกลอย' && (!loan.loan_type || !loan.loan_type.includes('รอเคลียร์'))) {
    return currentFine;
  }
  
  const oldRemainingInterest = Number(loan.remaining_interest || 0);
  const startDateStr = loan.interest_start_date || loan.loan_date || loan.created_at;
  if (!startDateStr) return oldRemainingInterest + currentFine;

  const cleanStartDate = startDateStr.split('T')[0];
  const [startYear, startMonth, startDay] = cleanStartDate.split('-').map(Number);
  const startDate = new Date(startYear, startMonth - 1, startDay);

  const thaiTodayStr = getThaiTodayString();
  const [todayYear, todayMonth, todayDay] = thaiTodayStr.split('-').map(Number);
  const today = new Date(todayYear, todayMonth - 1, todayDay);
  
  const diffTime = today - startDate;
  let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 🔍 บังคับนับรวมวันทำรายการด้วยเสมอ (บวก 1 วัน) เพื่อให้ยอดตรงกัน
  diffDays += 1;
  
  const days = Math.max(0, diffDays);
  const origPrin = Number(loan.principal_amount || 0);
  const currentPrin = Number(loan.remaining_principal ?? origPrin);
  let dailyRate = Number(loan.daily_interest || 0);

  if (origPrin > 0 && loan.loan_type === 'ดอกลอย') {
    const originalDailyInt = Number(loan.daily_interest || 0);
    dailyRate = (originalDailyInt * currentPrin) / origPrin;
  }

  const newlyAccrued = days * dailyRate;

  return newlyAccrued + oldRemainingInterest + currentFine;
}

export default function CustomersPage() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // State สำหรับเปิด-ปิด Modal ดูประวัติรายบุคคล
  const [customerProfileModalOpen, setCustomerProfileModalOpen] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // 📌 State สำหรับ Modal รับชำระเงินแบบ 3 เงื่อนไข
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState(null);
  const [paymentMode, setPaymentMode] = useState('ชำระยอดปกติ'); // 'ชำระยอดปกติ' | 'ส่วนลด' | 'เพิ่มปรับ'
  const [actionAmount, setActionAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // State สำหรับ Modal แก้ไขข้อมูลลูกค้า
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');

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

  const filteredCustomers = customersList.filter((cust) => {
    return (
      cust.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.phone.includes(searchQuery)
    );
  });

  const customerLoans = loans.filter(l => l.full_name === selectedCustomerName && l.status !== 'ปฏิเสธคำขอ');
  
  const customerLoanIds = customerLoans.map(l => l.id);
  const customerPayments = payments.filter(p => customerLoanIds.includes(p.loan_id));
  const customerInfo = customerLoans[0] || {};

  // 📌 ฟังก์ชันบันทึกการแก้ไขข้อมูลลูกค้า
  const handleSaveCustomerInfo = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('loans')
        .update({
          full_name: editName.trim(),
          phone: String(editPhone || '').trim(),
          facebook_link: editFacebook.trim(),
          bank_name: editBankName,
          account_number: String(editAccountNumber || '').trim()
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

  const handleDeleteLoan = async (loanId, billCode) => {
    if (!confirm(`คุณต้องการลบบิลรหัส "${billCode}" นี้ออกจากระบบใช่หรือไม่?\n(การลบจะไม่สามารถกู้คืนได้)`)) {
      return;
    }

    try {
      await supabase.from('payments').delete().eq('loan_id', loanId);
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;

      alert('ลบบิลรายการเรียบร้อยแล้ว!');
      fetchData();

      const remainingForThisCustomer = customerLoans.filter(l => l.id !== loanId);
      if (remainingForThisCustomer.length === 0) {
        setCustomerProfileModalOpen(false);
      }
    } catch (err) {
      console.error('Error deleting loan:', err.message);
      alert('เกิดข้อผิดพลาดในการลบบิล: ' + err.message);
    }
  };

  // 📌 ฟังก์ชันจัดการบันทึกรับชำระตาม 3 เงื่อนไข
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentLoan) return;

    const val = Number(actionAmount || 0);
    if (val <= 0) {
      alert('กรุณากรอกจำนวนเงินให้มากกว่า 0');
      return;
    }

    try {
      const currentPrin = Number(selectedPaymentLoan.remaining_principal ?? selectedPaymentLoan.principal_amount ?? 0);
      const totalAccruedBefore = calculateAccruedInterest(selectedPaymentLoan);
      const currentFine = Number(selectedPaymentLoan.fine_amount || 0);

      let finePaid = 0;
      let interestPaid = 0;
      let principalPaid = 0;
      
      let newRemPrin = currentPrin;
      let newRemainingInterest = totalAccruedBefore - currentFine;
      let newTotalFine = currentFine;

      let recordAmount = 0;
      let noteText = paymentNote;

      if (paymentMode === 'ชำระยอดปกติ') {
        recordAmount = val;
        let rem = val;

        // ลำดับตัดหนี้: 1. ค่าปรับ -> 2. ดอกสะสม -> 3. ต้นคงค้าง
        if (currentFine > 0 && rem > 0) {
          finePaid = Math.min(currentFine, rem);
          rem -= finePaid;
          newTotalFine -= finePaid;
        }

        if (newRemainingInterest > 0 && rem > 0) {
          if (selectedPaymentLoan.loan_type && selectedPaymentLoan.loan_type.includes('รอเคลียร์')) {
            interestPaid = 0;
          } else {
            interestPaid = Math.min(newRemainingInterest, rem);
            rem -= interestPaid;
            newRemainingInterest = Math.max(0, newRemainingInterest - interestPaid);
          }
        }

        if (rem > 0) {
          principalPaid = Math.min(currentPrin, rem);
          newRemPrin = Math.max(0, currentPrin - principalPaid);
        }

        if (!noteText) noteText = 'รับชำระปกติ (ตัด ค่าปรับ/ดอกเบี้ย/ต้น)';

      } else if (paymentMode === 'ส่วนลด') {
        recordAmount = 0; 
        let remDiscount = val;

        if (currentFine > 0 && remDiscount > 0) {
          const discFine = Math.min(currentFine, remDiscount);
          remDiscount -= discFine;
          newTotalFine -= discFine;
        }

        if (newRemainingInterest > 0 && remDiscount > 0) {
          const discInt = Math.min(newRemainingInterest, remDiscount);
          remDiscount -= discInt;
          newRemainingInterest -= discInt;
          interestPaid = discInt;
        }

        if (remDiscount > 0) {
          principalPaid = Math.min(newRemPrin, remDiscount);
          newRemPrin = Math.max(0, newRemPrin - principalPaid);
        }

        if (!noteText) noteText = `ให้ส่วนลด -${val}`;

      } else if (paymentMode === 'เพิ่มปรับ') {
        recordAmount = val;
        finePaid = val;
        newTotalFine += val;

        if (!noteText) noteText = `เพิ่มค่าปรับ +${val}`;
      }

      let newDailyInterest = Number(selectedPaymentLoan.daily_interest || 0);
      const origPrin = Number(selectedPaymentLoan.principal_amount || 0);
      if (selectedPaymentLoan.loan_type === 'ดอกลอย' && origPrin > 0) {
        const originalDailyInt = Number(selectedPaymentLoan.daily_interest || 0);
        const ratio = originalDailyInt / origPrin;
        newDailyInterest = newRemPrin * ratio;
      }

      const { error: paymentError } = await supabase.from('payments').insert([{
        loan_id: selectedPaymentLoan.id,
        bill_code: selectedPaymentLoan.bill_code,
        full_name: selectedPaymentLoan.full_name,
        amount: recordAmount,
        payment_amount: paymentMode === 'ชำระยอดปกติ' ? recordAmount : 0,
        interest_paid: interestPaid,
        principal_paid: principalPaid,
        fine_amount: finePaid,
        discount_amount: paymentMode === 'ส่วนลด' ? val : 0,
        note: noteText,
        created_at: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString(),
      }]);

      if (paymentError) throw paymentError;

      const isPaidOff = newRemPrin === 0 && newRemainingInterest === 0 && newTotalFine === 0;

      const nextInterestStartDate = newRemainingInterest > 0 
        ? (selectedPaymentLoan.interest_start_date || selectedPaymentLoan.loan_date || selectedPaymentLoan.created_at?.split('T')[0] || getThaiTodayString())
        : getThaiTodayString();

      const { error: loanErr } = await supabase.from('loans').update({
        remaining_principal: newRemPrin,
        daily_interest: newDailyInterest,
        remaining_interest: newRemainingInterest,
        fine_amount: newTotalFine,
        interest_start_date: nextInterestStartDate,
        calc_next_day: false,
        status: isPaidOff ? 'ชำระแล้ว' : 'อนุมัติแล้ว'
      }).eq('id', selectedPaymentLoan.id);

      if (loanErr) throw loanErr;

      alert('บันทึกข้อมูลและทำรายการเรียบร้อยแล้ว!');
      setPaymentModalOpen(false);
      setActionAmount('');
      setPaymentNote('');
      fetchData();
    } catch (err) {
      console.error('Error saving payment:', err.message);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-2 sm:p-4 lg:p-6 font-sans text-slate-800 text-base box-border overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 border border-purple-300/50 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 border border-white/30 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-2xl font-black text-white drop-shadow-sm">รายชื่อลูกหนี้ทั้งหมด (รายบุคคล)</h1>
              <p className="text-[10px] sm:text-xs text-purple-100">คลิกที่ชื่อลูกค้าเพื่อดูประวัติและรายละเอียดทั้งหมด</p>
            </div>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-purple-200 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อ, เบอร์โทร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-purple-950/40 border border-purple-300/40 rounded-xl pl-9 pr-3 py-2.5 sm:py-2 text-base sm:text-sm text-white outline-none focus:border-white placeholder:text-purple-200/70"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl space-y-4">
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
                <div key={idx} className="bg-purple-50/40 border border-purple-200 hover:border-purple-400 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all">
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-700" />
                      <span 
                        onClick={() => {
                          setSelectedCustomerName(cust.full_name);
                          setCustomerProfileModalOpen(true);
                        }}
                        className="text-sm sm:text-base font-black text-slate-900 hover:text-purple-700 underline cursor-pointer transition-colors"
                        title="คลิกเพื่อดูประวัติ"
                      >
                        {cust.full_name} 🔍
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      เบอร์โทร: <span className="font-mono font-bold text-slate-700">{cust.phone || '-'}</span> | ธนาคาร: {cust.bank_name || '-'} ({cust.account_number || '-'})
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-white px-3 sm:px-4 py-2.5 rounded-xl border border-purple-100 w-full sm:w-auto justify-between sm:justify-end text-xs">
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

      {/* ================= 📌 เรียกใช้งาน Component กลาง CustomerDetail ================= */}
      {customerProfileModalOpen && (
        <CustomerDetail
          selectedCustomerName={selectedCustomerName}
          customerLoans={customerLoans}
          customerPayments={customerPayments}
          customerInfo={customerInfo}
          onClose={() => setCustomerProfileModalOpen(false)}
          onOpenEditModal={() => {
            setEditName(selectedCustomerName);
            setEditPhone(customerInfo.phone || '');
            setEditFacebook(customerInfo.facebook_link || '');
            setEditBankName(customerInfo.bank_name || '');
            setEditAccountNumber(customerInfo.account_number || '');
            setEditCustomerModalOpen(true);
          }}
          onDeleteLoan={(loanId, billCode) => handleDeleteLoan(loanId, billCode)}
          onOpenPaymentModal={(l) => {
            setSelectedPaymentLoan(l);
            setPaymentMode('ชำระยอดปกติ');
            setActionAmount('');
            setPaymentNote('');
            setPaymentModalOpen(true);
          }}
        />
      )}

      {/* ================= MODAL แก้ไขข้อมูลลูกค้า ================= */}
      {editCustomerModalOpen && (
        <div className="fixed inset-0 bg-sky-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-sky-50 border-2 border-sky-600 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 text-slate-800 text-xs max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-1">
              <h3 className="font-black text-sky-900 text-sm flex items-center gap-1.5">
                <span>✏️</span> แก้ไขข้อมูลลูกค้า
              </h3>
              <button 
                type="button"
                onClick={() => setEditCustomerModalOpen(false)} 
                className="w-7 h-7 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-3">
              <div>
                <label className="block text-sky-900 font-bold mb-1">ชื่อ-นามสกุล *</label>
                <input 
                  type="text" 
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-sky-300 rounded-xl px-3.5 py-2.5 text-base sm:text-xs outline-none focus:border-sky-600 text-slate-900 font-bold shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sky-900 font-bold mb-1">เบอร์โทรศัพท์</label>
                <input 
                  type="text" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-white border border-sky-300 rounded-xl px-3.5 py-2.5 text-base sm:text-xs outline-none focus:border-sky-600 font-mono text-slate-900 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sky-900 font-bold mb-1">ลิงก์ Facebook</label>
                <input 
                  type="text" 
                  value={editFacebook}
                  onChange={(e) => setEditFacebook(e.target.value)}
                  placeholder="facebook.com/username"
                  className="w-full bg-white border border-sky-300 rounded-xl px-3.5 py-2.5 text-base sm:text-xs outline-none focus:border-sky-600 text-slate-900 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sky-900 font-bold mb-1">ธนาคาร</label>
                <select
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full bg-white border border-sky-300 rounded-xl px-3.5 py-2.5 text-base sm:text-xs outline-none focus:border-sky-600 text-slate-900 font-bold shadow-sm"
                >
                  <option value="">-- เลือกธนาคาร --</option>
                  <option value="ธนาคารทหารไทยธนชาติ (TTB)">ธนาคารทหารไทยธนชาติ (TTB)</option>
                  <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                  <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                  <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                  <option value="ธนาคารกรุงศรีอยุธยา (Krungsri)">ธนาคารกรุงศรีอยุธยา (Krungsri)</option>
                  <option value="ธนาคารเกียรตินาคินภัทร (KKP)">ธนาคารเกียรตินาคินภัทร (KKP)</option>
                  <option value="ธนาคารออมสิน (GSB)">ธนาคารออมสิน (GSB)</option>
                  <option value="ธ.ก.ส. (BAAC)">ธ.ก.ส. (BAAC)</option>
                  <option value="ธนาคารกรุงเทพ (BBL)">ธนาคารกรุงเทพ (BBL)</option>
                  <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                  <option value="วอเลต">วอเลต (TrueMoney Wallet)</option>
                </select>
              </div>

              <div>
                <label className="block text-sky-900 font-bold mb-1">เลขบัญชี / พร้อมเพย์</label>
                <input 
                  type="text" 
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  placeholder="เช่น 1234567890 หรือเบอร์โทรพร้อมเพย์"
                  className="w-full bg-white border border-sky-300 rounded-xl px-3.5 py-2.5 text-base sm:text-xs outline-none focus:border-sky-600 font-mono text-slate-900 shadow-sm"
                />
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditCustomerModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer text-xs"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL บันทึกรับชำระเงินแบบ 3 เงื่อนไข ================= */}
      {paymentModalOpen && selectedPaymentLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-[92%] max-w-sm p-4 sm:p-5 shadow-2xl space-y-3 animate-in fade-in zoom-in duration-150 max-h-[85vh] overflow-y-auto text-xs">
            
            <div className="flex justify-between items-center border-b border-purple-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs">💵</span>
                <h3 className="font-black text-purple-900 text-xs sm:text-sm">
                  บันทึกรับชำระ: <span className="font-mono text-purple-700">{selectedPaymentLoan.bill_code}</span>
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 space-y-1 font-medium text-slate-700 text-[11px]">
              <div>ลูกค้า: <span className="font-bold text-slate-900">{selectedPaymentLoan.full_name}</span></div>
              <div>ประเภท: <span className="font-bold text-purple-700">{selectedPaymentLoan.loan_type || '-'}</span></div>
              <div className="flex justify-between items-center border-t border-purple-200/60 pt-1 mt-1">
                <span>ยอดคงเหลือ: <span className="font-mono font-bold text-amber-600">฿{Number(selectedPaymentLoan.remaining_principal || selectedPaymentLoan.principal_amount || 0).toLocaleString()}</span></span>
                <span>ดอกเบี้ยสะสม: <span className="font-mono font-bold text-[color:#ff007f]">฿{calculateAccruedInterest(selectedPaymentLoan).toLocaleString()}</span></span>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">1. เลือกฟังก์ชันการใช้งาน</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-purple-300 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-white font-bold text-purple-900"
                >
                  <option value="ชำระยอดปกติ">ชำระยอดปกติ</option>
                  <option value="ส่วนลด">ส่วนลด</option>
                  <option value="เพิ่มปรับ">เพิ่มปรับ</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  2. {paymentMode === 'ส่วนลด' ? 'ยอดส่วนลด (บาท)' : paymentMode === 'เพิ่มปรับ' ? 'ยอดค่าปรับที่ต้องการเพิ่ม (บาท)' : 'ยอดเงินที่รับชำระ (บาท)'}
                </label>
                <input 
                  type="number" 
                  step="any"
                  required
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  placeholder="0"
                  className="w-full border border-purple-200 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-purple-50/20 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">3. หมายเหตุ</label>
                <input 
                  type="text" 
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder={paymentMode === 'ส่วนลด' ? 'ให้ส่วนลดพิเศษ...' : paymentMode === 'เพิ่มปรับ' ? 'ปรับค่าปรับล่าช้า...' : 'ชำระงวดประจำวัน...'}
                  className="w-full border border-purple-200 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-purple-50/20 text-slate-900"
                />
              </div>

              <div className="pt-2 border-t border-purple-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  ยืนยันทำรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}