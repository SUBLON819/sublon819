'use client';

import { useState } from 'react';
import { User, Edit3, Trash2, ExternalLink, FileText, Clock } from 'lucide-react';

// 📌 ฟังก์ชันดึงวันที่ปัจจุบัน (YYYY-MM-DD) ตามเวลาประเทศไทย
function getThaiTodayString() {
  const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

// 📌 ฟังก์ชันแปลง Date เป็น YYYY-MM-DD ตามเวลาไทย
function formatThaiDate(dateInput) {
  if (!dateInput) return '';
  const dateObj = new Date(dateInput);
  const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
}

// 📌 ฟังก์ชันคำนวณดอกเบี้ยสะสม + รวมค่าปรับเรียลไทม์ (ตรงกับหน้าแดชบอร์ด 100%)
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

  if (!loan.calc_next_day) {
    diffDays += 1;
  }
  
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

export default function CustomerDetail({
  selectedCustomerName,
  customerLoans = [],
  customerPayments = [],
  customerInfo = {},
  onClose,
  onOpenEditModal,
  onDeleteLoan,
  onOpenPaymentModal,
  onOpenNoticeModal // 📌 เพิ่มพรอพสำหรับเปิด Modal ออกบิล Notice (ถ้ามีในแดชบอร์ด)
}) {
  const totalCustomerRemaining = customerLoans
    .filter(l => l.status === 'อนุมัติแล้ว')
    .reduce((sum, l) => sum + Number((l.remaining_principal ?? l.principal_amount) || 0), 0);
  
  const totalCustomerAccruedInterest = customerLoans.reduce((sum, l) => sum + calculateAccruedInterest(l), 0);
  
  const totalCustomerPaid = customerPayments.reduce((sum, p) => sum + Number(p.payment_amount ?? p.amount ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden animate-in fade-in duration-200 text-slate-800 touch-pan-y">
      
      {/* Header ของ Modal ประวัติลูกค้า */}
      <div className="bg-purple-900 text-white px-4 sm:px-8 py-4 flex justify-between items-start sm:items-center gap-2.5 shadow-md shrink-0 relative">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-16 sm:pr-0">
          <div className="w-9 h-9 bg-purple-800 rounded-xl flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-purple-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-base font-black flex flex-wrap items-center gap-2">
              <span className="truncate">ประวัติข้อมูลลูกค้า: {selectedCustomerName}</span>
              <button
                type="button"
                onClick={onOpenEditModal}
                className="px-2.5 py-1 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-md cursor-pointer transition-colors shrink-0"
              >
                <Edit3 className="w-3 h-3" />
                <span>แก้ไขข้อมูล</span>
              </button>
            </h2>
            <p className="text-[10px] text-purple-300/80">ระบบแสดงข้อมูลสัญญาและประวัติการชำระเงินแบบเต็มหน้าจอ</p>
          </div>
        </div>

        <button 
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 sm:static px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs flex flex-col items-center justify-center leading-tight shadow-lg transition-all cursor-pointer shrink-0 border border-purple-500/50"
        >
          <span className="text-sm font-black">✕ ปิด</span>
          <span className="text-[9px] text-purple-200">หน้าจอ</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 max-w-4xl mx-auto w-full box-border text-xs">
        
        {/* ข้อมูลติดต่อ */}
        <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-sm">
          <div>
            <span className="text-slate-500 block text-[10px]">เบอร์โทรศัพท์:</span> 
            <span className="font-mono font-bold text-slate-900 text-sm">{customerInfo.phone || 'ไม่มีข้อมูล'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">บัญชีธนาคาร:</span> 
            <span className="font-mono font-bold text-slate-900 text-sm">{customerInfo.bank_name || '-'} ({customerInfo.account_number || '-'})</span>
          </div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <span className="text-slate-500 text-[10px]">Facebook:</span> 
            {customerInfo.facebook_link ? (
              <a 
                href={customerInfo.facebook_link.startsWith('http') ? customerInfo.facebook_link : `https://${customerInfo.facebook_link}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <span>🔗 ไปที่ Facebook ลูกค้า</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-slate-400">ไม่มีข้อมูล</span>
            )}
          </div>
        </div>

        {/* ยอดสรุปตัวเลข 3 ช่อง */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 justify-items-center py-2">
          
          <div className="w-28 h-28 sm:w-36 sm:h-36 bg-white border-2 border-purple-400 shadow-md rounded-full flex flex-col items-center justify-center text-center p-2">
            <div className="text-[10px] text-slate-500">ดอกเบี้ยสะสม (+ค่าปรับ)</div>
            <div className="font-mono font-bold text-[color:#ff007f] text-sm sm:text-lg mt-0.5 animate-pulse">฿{totalCustomerAccruedInterest.toLocaleString()}</div>
          </div>

          <div className="w-28 h-28 sm:w-36 sm:h-36 bg-white border-2 border-purple-400 shadow-md rounded-full flex flex-col items-center justify-center text-center p-2">
            <div className="text-[10px] text-slate-500">ยอดหนี้คงเหลือ</div>
            <div className="font-mono font-bold text-amber-600 text-sm sm:text-lg mt-0.5">฿{totalCustomerRemaining.toLocaleString()}</div>
          </div>

          <div className="w-28 h-28 sm:w-36 sm:h-36 bg-white border-2 border-purple-400 shadow-md rounded-full flex flex-col items-center justify-center text-center p-2">
            <div className="text-[10px] text-slate-500">ยอดชำระแล้ว</div>
            <div className="font-mono font-bold text-teal-600 text-sm sm:text-lg mt-0.5">฿{totalCustomerPaid.toLocaleString()}</div>
          </div>

        </div>

        {/* 📌 รายการสัญญาของลูกค้า (ดีไซน์เดียวกับหน้าแดชบอร์ดหลัก) */}
        <div className="space-y-3 bg-white p-4 rounded-2xl border border-purple-200 shadow-sm">
          <h4 className="font-bold text-slate-800 border-b border-purple-100 pb-2 text-xs">รายการสัญญาของลูกค้ารายนี้ ({customerLoans.length} บิล)</h4>
          
          {customerLoans.length === 0 ? (
            <div className="text-slate-400 text-center py-6 text-[11px]">ไม่พบประวัติสัญญา</div>
          ) : (
            <div className="space-y-3">
              {customerLoans.map((loan) => {
                const accrued = calculateAccruedInterest(loan);
                const currentRemaining = Number(loan.remaining_principal ?? loan.principal_amount ?? 0);
                const hasFine = Number(loan.fine_amount || 0) > 0;

                const loanPayments = customerPayments.filter(p => String(p.loan_id) === String(loan.id));
                const latestPayment = loanPayments.length > 0 ? loanPayments[0] : null;

                return (
                  <div key={loan.id} className="bg-purple-50/40 border border-purple-200 hover:border-purple-400 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3 transition-all">
                    
                    {/* ส่วนหัวของการ์ดบิล */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-purple-800">บิล: {loan.bill_code}</span>
                          <span className="text-xs font-bold text-slate-800">- {loan.full_name}</span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[10px] text-slate-500 mt-1 flex-wrap">
                          <span>ประเภท: {loan.loan_type}</span> | 
                          <span>รอบจ่าย: <strong className="text-purple-800">{loan.payment_schedule || 'จ่ายทุกวัน'}</strong></span> | 
                          <span className="flex items-center gap-0.5 text-emerald-700 font-mono font-bold">
                            <Clock className="w-3 h-3" />
                            สร้าง: {loan.loan_date || (loan.created_at ? formatThaiDate(loan.created_at) : '-')}
                          </span>
                          | ครบกำหนด: <span className="text-amber-700 font-mono font-bold">{loan.cycle_date || '-'}</span>
                          
                          {latestPayment && (
                            <span className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                              🟢 ตัดล่าสุด: {formatThaiDate(latestPayment.created_at)} (฿{Number(latestPayment.payment_amount || latestPayment.amount || 0).toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {hasFine && (
                          <span className="bg-rose-100 border border-rose-300 text-rose-800 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] shadow-sm animate-pulse">
                            🚨 ค่าปรับ: ฿{Number(loan.fine_amount || 0).toLocaleString()}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          loan.status === 'อนุมัติแล้ว' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          loan.status === 'ชำระแล้ว' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                          'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {loan.status || 'อนุมัติแล้ว'}
                        </span>
                      </div>
                    </div>

                    {/* กล่องแสดงตัวเลข 4 ช่อง (เงินต้น, คงเหลือ, ดอกเบี้ย/วัน, ดอกสะสมเรียลไทม์) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-2.5 sm:p-3 rounded-xl border border-purple-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">เงินต้น / ยอดขอกู้:</span>
                        <span className="font-mono font-bold text-emerald-600">฿{Number(loan.principal_amount || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">คงเหลือ:</span>
                        <span className="font-mono font-bold text-amber-600">฿{currentRemaining.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">ดอกเบี้ย/วัน:</span>
                        <span className="font-mono font-bold text-teal-700">฿{Number(loan.daily_interest || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">ดอกสะสมเรียลไทม์:</span>
                        <span className="font-mono font-bold text-purple-800">฿{accrued.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* ปุ่มจัดการด้านล่างการ์ดบิล */}
                    <div className="flex gap-2 pt-1 flex-wrap sm:flex-nowrap justify-between items-center">
                      <button
                        type="button"
                        onClick={() => onDeleteLoan(loan.id, loan.bill_code)}
                        className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                        title="ลบรายการบิลนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบบิลนี้</span>
                      </button>

                      <div className="flex gap-2 flex-1 sm:justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenPaymentModal(loan)}
                          className="flex-1 sm:flex-initial px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                        >
                          บันทึกรับชำระ
                        </button>
                        {onOpenNoticeModal && (
                          <button
                            type="button"
                            onClick={() => onOpenNoticeModal(loan)}
                            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>ออกบิลแจ้งยอด (NOTICE)</span>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ประวัติการชำระเงินย้อนหลัง */}
        <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-purple-200 shadow-sm">
          <h4 className="font-bold text-slate-800 border-b border-purple-100 pb-1.5 text-xs">ประวัติการชำระเงินย้อนหลัง ({customerPayments.length} รายการ)</h4>
          {customerPayments.length === 0 ? (
            <div className="text-slate-400 text-center py-4 text-[11px]">ยังไม่มีประวัติการชำระเงิน</div>
          ) : (
            <div className="space-y-1.5">
              {customerPayments.map((p) => (
                <div key={p.id} className="bg-purple-50/20 p-2.5 rounded-xl border border-purple-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded text-[10px] border border-purple-300">
                      บิล: {p.bill_code || '-'}
                    </span>

                    <span className="font-mono font-bold text-purple-800 text-xs">฿{Number(p.payment_amount ?? p.amount ?? 0).toLocaleString()}</span>
                    <span className="text-slate-600 bg-purple-100 px-1.5 py-0.5 rounded text-[10px]">หมายเหตุ: {p.note || 'รับชำระปกติ'}</span>
                    {Number(p.fine_amount || 0) > 0 && <span className="text-rose-600 font-bold">(ค่าปรับ +{p.fine_amount})</span>}
                    {Number(p.discount_amount || 0) > 0 && <span className="text-blue-600 font-bold">(ส่วนลด -{p.discount_amount})</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(p.created_at).toLocaleString('th-TH')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}