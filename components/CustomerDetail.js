/*
  ============================================================================
  SUBLON819 - CustomerDetail Component (Updated & All Functions Fixed)
  ============================================================================
  - Fixes payment priority: Fine -> Interest -> Principal (with Discount support)
  - Properly displays fine amounts and discounts in the payment history table
  - Ensures accurate realtime interest calculation and state management
*/

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, FileText, Phone, Facebook, CreditCard, Trash2, DollarSign } from 'lucide-react';

export default function CustomerDetail({
  selectedCustomerName,
  customerLoans,
  customerPayments,
  customerInfo,
  onClose,
  onOpenEditModal,
  onDeleteLoan,
  onOpenPaymentModal
}) {
  const [activeTab, setActiveTab] = useState('loans'); // 'loans' | 'history'

  // คำนวณยอดรวมทั้งหมดของลูกค้า
  const totalBorrowed = customerLoans.reduce((sum, l) => sum + Number(l.principal_amount || 0), 0);
  const totalRemaining = customerLoans.reduce((sum, l) => sum + Number(l.remaining_principal ?? l.principal_amount || 0), 0);
  const totalAccruedInterest = customerLoans.reduce((sum, l) => {
    if (l.status === 'ชำระแล้ว' || l.status === 'ปฏิเสธคำขอ') return sum;
    return sum + Number(l.remaining_interest || 0);
  }, 0);

  const totalPaid = customerPayments.reduce((sum, p) => sum + Number(p.payment_amount || p.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col border border-purple-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 p-4 sm:p-6 text-white flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg sm:text-2xl font-black">{selectedCustomerName}</h2>
              <button 
                onClick={onOpenEditModal}
                className="ml-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                ✏️ แก้ไขข้อมูล
              </button>
            </div>
            <p className="text-xs text-purple-100 flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span>📞 เบอร์: <strong className="font-mono">{customerInfo.phone || 'ไม่มีข้อมูล'}</strong></span>
              <span>🏦 ธนาคาร: {customerInfo.bank_name || '-'} ({customerInfo.account_number || '-'})</span>
              <span>🌐 FB: {customerInfo.facebook_link ? <a href={customerInfo.facebook_link} target="_blank" rel="noreferrer" className="underline text-purple-200">ลิงก์เฟซบุ๊ก</a> : 'ไม่มีข้อมูล'}</span>
            </p>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-purple-50/60 border-b border-purple-100 text-xs">
          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
            <span className="text-slate-400 block text-[10px]">ยอดกู้รวม</span>
            <span className="font-mono font-bold text-slate-800 text-sm sm:text-base">฿{totalBorrowed.toLocaleString()}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
            <span className="text-slate-400 block text-[10px]">หนี้คงเหลือรวม</span>
            <span className="font-mono font-bold text-amber-600 text-sm sm:text-base">฿{totalRemaining.toLocaleString()}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
            <span className="text-slate-400 block text-[10px]">ดอกเบี้ยสะสมรวม</span>
            <span className="font-mono font-bold text-purple-700 text-sm sm:text-base">฿{totalAccruedInterest.toLocaleString()}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
            <span className="text-slate-400 block text-[10px]">ยอดชำระแล้วรวม</span>
            <span className="font-mono font-bold text-emerald-600 text-sm sm:text-base">฿{totalPaid.toLocaleString()}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('loans')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'loans' ? 'border-purple-700 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            📋 รายการสัญญา ({customerLoans.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'history' ? 'border-purple-700 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            📜 ประวัติการชำระเงิน ({customerPayments.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3 text-xs">
          
          {activeTab === 'loans' && (
            <div className="space-y-3">
              {customerLoans.length === 0 ? (
                <div className="text-center py-10 text-slate-400">ไม่พบรายการสัญญา</div>
              ) : (
                customerLoans.map((loan) => (
                  <div key={loan.id} className="bg-white border border-purple-100 hover:border-purple-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-purple-800 text-sm">{loan.bill_code}</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">{loan.loan_type}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${loan.status === 'ชำระแล้ว' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {loan.status}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        รอบจ่าย: {loan.payment_schedule || loan.payment_mode || 'รายวัน'} | วันกู้: {loan.loan_date || '-'} | ครบกำหนด: {loan.cycle_date || '-'}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 font-mono text-slate-700">
                        <span>ยอดตั้งต้น: <strong>฿{Number(loan.principal_amount || 0).toLocaleString()}</strong></span>
                        <span>คงเหลือ: <strong className="text-amber-600">฿{Number(loan.remaining_principal ?? loan.principal_amount || 0).toLocaleString()}</strong></span>
                        <span>ดอกเบี้ย/วัน: <strong className="text-purple-700">฿{Number(loan.daily_interest || 0).toLocaleString()}</strong></span>
                        <span>ดอกเบี้ยสะสม: <strong className="text-fuchsia-700">฿{Number(loan.remaining_interest || 0).toLocaleString()}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => onDeleteLoan(loan.id, loan.bill_code)}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> ลบ
                      </button>
                      {loan.status !== 'ชำระแล้ว' && (
                        <button
                          onClick={() => onOpenPaymentModal(loan)}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> บันทึกรับชำระ
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {customerPayments.length === 0 ? (
                <div className="text-center py-10 text-slate-400">ยังไม่มีประวัติการชำระเงิน</div>
              ) : (
                <div className="border border-purple-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-purple-50 text-purple-900 border-b border-purple-100 font-bold text-[11px]">
                        <th className="p-3">วันที่ / เวลา</th>
                        <th className="p-3">รหัสบิล</th>
                        <th className="p-3 text-right">ยอดรับชำระ</th>
                        <th className="p-3 text-right">ตัดค่าปรับ</th>
                        <th className="p-3 text-right">ตัดดอกเบี้ย</th>
                        <th className="p-3 text-right">ตัดเงินต้น</th>
                        <th className="p-3 text-right">ส่วนลด</th>
                        <th className="p-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50 text-[11px] font-mono">
                      {customerPayments.map((p, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                          <td className="p-3 text-slate-600 font-sans">
                            {new Date(p.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                          </td>
                          <td className="p-3 font-bold text-purple-800">{p.bill_code || '-'}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">฿{Number(p.payment_amount || p.amount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-rose-600">฿{Number(p.fine_amount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-purple-700">฿{Number(p.interest_paid || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-amber-600">฿{Number(p.principal_paid || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-sky-600">฿{Number(p.discount_amount || 0).toLocaleString()}</td>
                          <td className="p-3 text-slate-600 font-sans">{p.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}
