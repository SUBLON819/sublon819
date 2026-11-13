'use client';

import { useState, useRef } from 'react';
import { User, Edit3, Trash2, ExternalLink, FileText, Clock, Download, Share2, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';

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

export default function CustomerDetail({
  selectedCustomerName,
  customerLoans = [],
  customerPayments = [],
  customerInfo = {},
  onClose,
  onOpenEditModal,
  onDeleteLoan,
  onOpenPaymentModal,
  adminBankList = []
}) {
  // 📌 State สำหรับ Notice Modal
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeLoan, setNoticeLoan] = useState(null);
  const [customNoticeAmount, setCustomNoticeAmount] = useState('');
  const [noticeForm, setNoticeForm] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    qr_code_image: ''
  });
  const hiddenCaptureRef = useRef(null);

  // 📌 State สำหรับ Receipt Modal (ใบเสร็จรับเงิน)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [latestPaymentRecord, setLatestPaymentRecord] = useState(null);
  const receiptCaptureRef = useRef(null);

  const totalCustomerRemaining = customerLoans
    .filter(l => l.status === 'อนุมัติแล้ว')
    .reduce((sum, l) => sum + Number((l.remaining_principal ?? l.principal_amount) || 0), 0);
  
  const totalCustomerAccruedInterest = customerLoans.reduce((sum, l) => sum + calculateAccruedInterest(l), 0);
  
  const totalCustomerPaid = customerPayments.reduce((sum, p) => sum + Number(p.payment_amount ?? p.amount ?? 0), 0);

  // 📌 ฟังก์ชันดาวน์โหลดรูปภาพบิล Notice
  const handleDownloadNoticeImage = async () => {
    if (!hiddenCaptureRef.current) return;

    if (noticeForm.bank_name || noticeForm.account_number) {
      const existing = [...adminBankList];
      const index = existing.findIndex(b => b.account_number === noticeForm.account_number && b.bank_name === noticeForm.bank_name);
      if (index >= 0) {
        existing[index] = noticeForm;
      } else {
        existing.unshift(noticeForm);
      }
      localStorage.setItem('admin_saved_banks', JSON.stringify(existing));
    }

    try {
      const canvas = await html2canvas(hiddenCaptureRef.current, { scale: 2, useCORS: true });
      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `Notice-${noticeLoan?.bill_code || 'Customer'}.png`;
      a.click();
    } catch (err) {
      console.error('Error generating image:', err);
      alert('เกิดข้อผิดพลาดในการสร้างรูปภาพ');
    }
  };

  // 📌 ฟังก์ชันแชร์รูปภาพบิล Notice
  const handleShareNoticeImage = async () => {
    if (!hiddenCaptureRef.current) return;
    try {
      const canvas = await html2canvas(hiddenCaptureRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Notice-${noticeLoan?.bill_code || 'Customer'}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'บิลแจ้งยอดชำระ',
            text: `แจ้งยอดชำระของคุณ ${selectedCustomerName}`,
          });
        } else {
          alert('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง กรุณาใช้ปุ่มดาวน์โหลดรูปภาพแทนครับ');
        }
      });
    } catch (err) {
      console.error('Error sharing image:', err);
    }
  };

  // 📌 ฟังก์ชันดาวน์โหลดใบเสร็จรับเงิน (Receipt)
  const handleDownloadReceiptImage = async () => {
    if (!receiptCaptureRef.current) return;
    try {
      const canvas = await html2canvas(receiptCaptureRef.current, { scale: 2, useCORS: true });
      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `Receipt-${latestPaymentRecord?.bill_code || 'Customer'}.png`;
      a.click();
    } catch (err) {
      console.error('Error generating receipt image:', err);
      alert('เกิดข้อผิดพลาดในการสร้างใบเสร็จ');
    }
  };

  // 📌 ฟังก์ชันแชร์ใบเสร็จรับเงิน (Receipt)
  const handleShareReceiptImage = async () => {
    if (!receiptCaptureRef.current) return;
    try {
      const canvas = await html2canvas(receiptCaptureRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Receipt-${latestPaymentRecord?.bill_code || 'Customer'}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'ใบเสร็จรับเงิน',
            text: `ใบเสร็จรับเงินของคุณ ${selectedCustomerName}`,
          });
        } else {
          alert('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง กรุณาใช้ปุ่มดาวน์โหลดรูปภาพแทนครับ');
        }
      });
    } catch (err) {
      console.error('Error sharing receipt image:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden animate-in fade-in duration-200 text-slate-800 touch-pan-y" style={{ touchAction: 'manipulation' }}>
      
      {/* Header ของ Modal ประวัติลูกค้า */}
      <div className="bg-purple-900 text-white px-4 sm:px-8 py-4 flex justify-between items-start sm:items-center gap-2.5 shadow-md shrink-0 relative">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-16 sm:pr-0">
          <div className="w-10 h-10 bg-purple-800 rounded-xl flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-purple-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-black flex flex-wrap items-center gap-2">
              <span className="truncate">{selectedCustomerName}</span>
              <button
                type="button"
                onClick={() => {
                  const targetLoan = customerLoans[0];
                  if (onOpenEditModal) onOpenEditModal(targetLoan);
                }}
                className="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-md cursor-pointer transition-colors shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>แก้ไขข้อมูล</span>
              </button>
            </h2>
            <p className="text-xs text-purple-300/80">ระบบแสดงข้อมูลสัญญาและประวัติการชำระเงินแบบเต็มหน้าจอ</p>
          </div>
        </div>

        <button 
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 sm:static px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs sm:text-sm flex flex-col items-center justify-center leading-tight shadow-lg transition-all cursor-pointer shrink-0 border border-purple-500/50"
        >
          <span className="text-sm sm:text-base font-black">✕ ปิด</span>
          <span className="text-[10px] text-purple-200">หน้าจอ</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 max-w-4xl mx-auto w-full box-border text-sm">
        
        {/* ข้อมูลติดต่อ + ปุ่มพิมพ์ใบเสร็จ (ซ้าย) และ ออกบิลแจ้งยอด (ขวา) */}
        <div className="bg-purple-50 p-4 sm:p-5 rounded-2xl border border-purple-200 space-y-3 shadow-sm relative">
          
          {customerLoans.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 justify-end sm:absolute sm:right-4 sm:top-4">
              <button
                type="button"
                onClick={() => {
                  if (customerPayments.length === 0) {
                    alert('ยังไม่มีประวัติการชำระเงินสำหรับออกใบเสร็จ');
                    return;
                  }
                  setLatestPaymentRecord(customerPayments[0]);
                  setReceiptModalOpen(true);
                }}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ใบเสร็จ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetLoan = customerLoans[0];
                  setNoticeLoan(targetLoan);
                  const remPrin = Number((targetLoan.remaining_principal ?? targetLoan.principal_amount) || 0);
                  const accInt = calculateAccruedInterest(targetLoan);
                  setCustomNoticeAmount(remPrin + accInt);
                  
                  if (adminBankList.length > 0) {
                    setNoticeForm(adminBankList[0]);
                  } else {
                    setNoticeForm({
                      bank_name: '',
                      account_number: '',
                      account_name: '',
                      qr_code_image: ''
                    });
                  }

                  setNoticeModalOpen(true);
                }}
                className="px-3 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>แจ้งยอด</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-0 sm:pr-[320px]">
            <div>
              <span className="text-slate-500 block text-xs">เบอร์โทรศัพท์:</span> 
              <span className="font-mono font-bold text-slate-900 text-base">{customerInfo.phone || 'ไม่มีข้อมูล'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">บัญชีธนาคาร:</span> 
              <div className="font-mono font-bold text-slate-900 text-base">
                <div>{customerInfo.bank_name || '-'}</div>
                <div>{customerInfo.account_number ? `(${customerInfo.account_number})` : ''}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-purple-200/60 pr-0 sm:pr-[320px]">
            <span className="text-slate-500 text-xs">Facebook:</span> 
            {customerInfo.facebook_link ? (
              <a 
                href={customerInfo.facebook_link.startsWith('http') ? customerInfo.facebook_link : `https://${customerInfo.facebook_link}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <span>🔗 ไปที่ Facebook ลูกค้า</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <span className="text-slate-400">ไม่มีข้อมูล</span>
            )}
          </div>
        </div>

        {/* ยอดสรุปตัวเลข 3 ช่อง */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 my-6 w-full">
          <div className="relative flex flex-col items-center justify-center py-4 px-2 sm:py-6 sm:px-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 transform transition-transform hover:scale-[1.01]">
            <span className="text-xs sm:text-sm font-bold text-purple-100 text-center px-0.5 leading-tight">ดอกเบี้ยสะสม (+ค่าปรับ)</span>
            <span className="text-base sm:text-lg font-mono font-bold text-white text-center px-0.5 mt-2 truncate w-full drop-shadow-sm">฿{totalCustomerAccruedInterest.toLocaleString()}</span>
          </div>

          <div className="relative flex flex-col items-center justify-center py-4 px-2 sm:py-6 sm:px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 transform transition-transform hover:scale-[1.01]">
            <span className="text-xs sm:text-sm font-bold text-amber-100 text-center px-0.5 leading-tight">ยอดหนี้คงเหลือ</span>
            <span className="text-base sm:text-lg font-mono font-bold text-white text-center px-0.5 mt-2 truncate w-full drop-shadow-sm">฿{totalCustomerRemaining.toLocaleString()}</span>
          </div>

          <div className="relative flex flex-col items-center justify-center py-4 px-2 sm:py-6 sm:px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 transform transition-transform hover:scale-[1.01]">
            <span className="text-xs sm:text-sm font-bold text-emerald-100 text-center px-0.5 leading-tight">ยอดชำระแล้ว</span>
            <span className="text-base sm:text-lg font-mono font-bold text-white text-center px-0.5 mt-2 truncate w-full drop-shadow-sm">฿{totalCustomerPaid.toLocaleString()}</span>
          </div>
        </div>

        {/* รายการสัญญาของลูกค้า */}
        <div className="space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-purple-200 shadow-sm">
          <h4 className="font-bold text-slate-800 border-b border-purple-100 pb-2 text-sm sm:text-base">รายการสัญญาของลูกค้ารายนี้ ({customerLoans.length} บิล)</h4>
          
          {customerLoans.length === 0 ? (
            <div className="text-slate-400 text-center py-6 text-xs sm:text-sm">ไม่พบประวัติสัญญา</div>
          ) : (
            <div className="space-y-3">
              {customerLoans.map((loan) => {
                const accrued = calculateAccruedInterest(loan);
                const currentRemaining = Number(loan.remaining_principal ?? loan.principal_amount ?? 0);
                const hasFine = Number(loan.fine_amount || 0) > 0;

                const loanPayments = customerPayments.filter(p => String(p.loan_id) === String(loan.id));
                const latestPayment = loanPayments.length > 0 ? loanPayments[0] : null;

                return (
                  <div key={loan.id} className="bg-purple-50/40 border border-purple-200 hover:border-purple-400 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 space-y-3 transition-all">
                    
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm sm:text-base font-bold text-purple-800">บิล: {loan.bill_code}</span>
                          <span className="text-sm sm:text-base font-bold text-slate-800">{loan.full_name || selectedCustomerName}</span>
                        </div>
                        
                        {/* 📌 ปรับแก้จัดเรียงข้อมูลรายละเอียดและป้ายตัดล่าสุดให้อยู่ในบรรทัดเดียวกันแบบแนวนอน */}
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600 mt-1">
                          <span className="shrink-0">ประเภท: {loan.loan_type}</span> 
                          <span className="text-slate-300 hidden sm:inline">|</span> 
                          <span className="shrink-0">รอบจ่าย: <strong className="text-purple-800">{loan.payment_schedule || 'จ่ายทุกวัน'}</strong></span> 
                          <span className="text-slate-300 hidden sm:inline">|</span> 
                          <span className="flex items-center gap-1 text-emerald-700 font-mono font-bold shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                            สร้าง: {loan.loan_date || (loan.created_at ? formatThaiDate(loan.created_at) : '-')}
                          </span>
                          <span className="text-slate-300 hidden sm:inline">|</span>
                          <span className="shrink-0">ครบกำหนด: <span className="text-amber-700 font-mono font-bold">{loan.cycle_date || '-'}</span></span>

                          {latestPayment && (
                            <>
                              <span className="text-slate-300 hidden sm:inline">|</span>
                              <span className="inline-flex items-center gap-1 bg-emerald-100 border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold text-xs shrink-0">
                                🟢 ตัดล่าสุด: {formatThaiDate(latestPayment.created_at)} (฿{Number(latestPayment.payment_amount || latestPayment.amount || 0).toLocaleString()})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {hasFine && (
                          <span className="bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1 rounded-full font-mono font-bold text-xs shadow-sm animate-pulse">
                            🚨 ค่าปรับ: ฿{Number(loan.fine_amount || 0).toLocaleString()}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded text-xs font-bold shrink-0 ${
                          loan.status === 'อนุมัติแล้ว' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          loan.status === 'ชำระแล้ว' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                          'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {loan.status || 'อนุมัติแล้ว'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm bg-white p-3 sm:p-4 rounded-xl border border-purple-100">
                      <div>
                        <span className="text-slate-400 block text-xs">เงินต้น / ยอดขอกู้:</span>
                        <span className="font-mono font-bold text-emerald-600 text-base">฿{Number(loan.principal_amount || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">คงเหลือ:</span>
                        <span className="font-mono font-bold text-amber-600 text-base">฿{currentRemaining.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">ดอกเบี้ย/วัน:</span>
                        <span className="font-mono font-bold text-teal-700 text-base">฿{Number(loan.daily_interest || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">ดอกสะสมเรียลไทม์:</span>
                        <span className="font-mono font-bold text-purple-800 text-base">฿{accrued.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-1 flex-wrap sm:flex-nowrap justify-between items-center">
                      <button
                        type="button"
                        onClick={() => onDeleteLoan(loan.id, loan.bill_code)}
                        className="px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                        title="ลบรายการบิลนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>ลบบิลนี้</span>
                      </button>

                      <div className="flex gap-2 flex-1 sm:justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenPaymentModal(loan)}
                          className="flex-1 sm:flex-initial px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-colors cursor-pointer"
                        >
                          บันทึกรับชำระ
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ประวัติการชำระเงินย้อนหลัง */}
        <div className="space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-purple-200 shadow-sm">
          <h4 className="font-bold text-slate-800 border-b border-purple-100 pb-2 text-sm sm:text-base">ประวัติการชำระเงินย้อนหลัง ({customerPayments.length} รายการ)</h4>
          {customerPayments.length === 0 ? (
            <div className="text-slate-400 text-center py-6 text-xs sm:text-sm">ยังไม่มีประวัติการชำระเงิน</div>
          ) : (
            <div className="space-y-2">
              {customerPayments.map((p) => (
                <div key={p.id} className="bg-purple-50/20 p-3 rounded-xl border border-purple-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold bg-purple-200 text-purple-900 px-2.5 py-0.5 rounded text-xs border border-purple-300">
                      บิล: {p.bill_code || '-'}
                    </span>

                    <span className="font-mono font-bold text-purple-800 text-sm sm:text-base">฿{Number(p.payment_amount ?? p.amount ?? 0).toLocaleString()}</span>
                    <span className="text-slate-600 bg-purple-100 px-2 py-0.5 rounded text-xs">หมายเหตุ: {p.note || 'รับชำระปกติ'}</span>
                    {Number(p.fine_amount || 0) > 0 && <span className="text-rose-600 font-bold">(ค่าปรับ +{p.fine_amount})</span>}
                    {Number(p.discount_amount || 0) > 0 && <span className="text-blue-600 font-bold">(ส่วนลด -{p.discount_amount})</span>}
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

      {/* ================= 📌 Notice Bill Modal ================= */}
      {noticeModalOpen && noticeLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-[92%] max-w-sm p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in fade-in zoom-in duration-150 max-h-[85vh] overflow-y-auto text-sm">
            
            <div className="flex justify-between items-center border-b border-rose-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-sm">📄</span>
                <h3 className="font-black text-rose-900 text-sm sm:text-base">
                  ออกบิลแจ้งยอด (NOTICE): <span className="font-mono text-rose-700">{noticeLoan.bill_code}</span>
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setNoticeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-2 font-medium text-slate-700 text-xs sm:text-sm">
              <div>ชื่อลูกค้า: <span className="font-bold text-slate-900">{noticeLoan.full_name || selectedCustomerName}</span></div>
              <div className="flex justify-between items-center border-t border-rose-200/60 pt-2 mt-1">
                <span className="font-bold text-slate-800">ยอดค้างชำระ:</span>
                <input 
                  type="number"
                  value={customNoticeAmount}
                  onChange={(e) => setCustomNoticeAmount(e.target.value)}
                  style={{ fontSize: '16px' }}
                  className="w-36 text-right font-mono font-black text-rose-600 bg-white border border-rose-300 rounded-xl p-2.5 outline-none"
                />
              </div>
            </div>

            {adminBankList.length > 0 && (
              <div className="space-y-1.5 bg-purple-50 p-3 rounded-xl border border-purple-200">
                <label className="text-xs text-purple-900 font-bold block">📁 เลือกบัญชีแอดมินเดิม:</label>
                <select
                  onChange={(e) => {
                    const idx = e.target.value;
                    if (idx !== '') {
                      setNoticeForm(adminBankList[idx]);
                    }
                  }}
                  style={{ fontSize: '16px' }}
                  className="w-full border border-purple-300 rounded-xl p-2.5 bg-white font-semibold outline-none text-slate-800"
                >
                  <option value="">-- คลิกเลือกบัญชี --</option>
                  {adminBankList.map((b, i) => (
                    <option key={i} value={i}>
                      {b.bank_name} ({b.account_number})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              <div className="text-xs sm:text-sm font-bold text-slate-700">ข้อมูลบัญชีโอนชำระ / สแกนจ่าย</div>
              
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs text-slate-500 font-semibold">ธนาคาร:</label>
                  <select
                    value={noticeForm.bank_name}
                    onChange={(e) => setNoticeForm({...noticeForm, bank_name: e.target.value})}
                    style={{ fontSize: '16px' }}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-bold bg-white outline-none text-slate-800"
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
                  <label className="text-xs text-slate-500 font-semibold">เลขบัญชี:</label>
                  <input 
                    type="text" placeholder="xxx-x-xxxxx-x"
                    value={noticeForm.account_number}
                    onChange={(e) => setNoticeForm({...noticeForm, account_number: e.target.value})}
                    style={{ fontSize: '16px' }}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-mono font-bold bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold">ชื่อบัญชี:</label>
                  <input 
                    type="text" placeholder="ชื่อเจ้าของบัญชี"
                    value={noticeForm.account_name}
                    onChange={(e) => setNoticeForm({...noticeForm, account_name: e.target.value})}
                    style={{ fontSize: '16px' }}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-bold bg-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <div className="w-12 h-12 border border-dashed border-slate-300 rounded-xl overflow-hidden bg-white flex items-center justify-center relative shrink-0">
                    {noticeForm.qr_code_image ? (
                      <img src={noticeForm.qr_code_image} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center p-0.5 text-[10px] text-slate-400">QR</div>
                    )}
                  </div>
                  <label className="px-3.5 py-2.5 bg-white border border-rose-300 text-rose-700 font-bold rounded-xl text-xs hover:bg-rose-50 cursor-pointer text-center flex-1">
                    📁 อัปโหลด QR Code
                    <input 
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNoticeForm(prev => ({ ...prev, qr_code_image: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
              <div ref={hiddenCaptureRef} style={{ width: '420px', background: '#ffffff', padding: '28px 24px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#1e293b', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #f43f5e', paddingBottom: '14px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#881337', margin: 0 }}>แจ้งยอดค้างชำระ (NOTICE)</h2>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>SUBLON 819</p>
                </div>

                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '14px', marginBottom: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>รหัสบิล:</span> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>{noticeLoan.bill_code}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>ชื่อลูกค้า:</span> <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{noticeLoan.full_name || selectedCustomerName}</span></div>
                  
                  <div style={{ borderTop: '1px solid #fecdd3', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '13px' }}>ยอดชำระสุทธิ:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#e11d48', fontSize: '20px' }}>฿{Number(customNoticeAmount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>ช่องทางการชำระเงิน</div>
                    <div style={{ marginBottom: '6px' }}><span style={{ color: '#64748b' }}>ธนาคาร:</span> <strong style={{ color: '#0f172a' }}>{noticeForm.bank_name || '-'}</strong></div>
                    <div style={{ marginBottom: '6px' }}><span style={{ color: '#64748b' }}>เลขบัญชี:</span> <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{noticeForm.account_number || '-'}</strong></div>
                    <div><span style={{ color: '#64748b' }}>ชื่อบัญชี:</span> <strong style={{ color: '#0f172a' }}>{noticeForm.account_name || '-'}</strong></div>
                  </div>

                  {noticeForm.qr_code_image && (
                    <div style={{ width: '90px', height: '90px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={noticeForm.qr_code_image} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-rose-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setNoticeModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs sm:text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDownloadNoticeImage}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดรูป</span>
              </button>
              <button
                type="button"
                onClick={handleShareNoticeImage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>แชร์ภาพ</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= 📌 Receipt Modal ================= */}
      {receiptModalOpen && latestPaymentRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-[92%] max-w-sm p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in fade-in zoom-in duration-150 max-h-[85vh] overflow-y-auto text-sm">
            
            <div className="flex justify-between items-center border-b border-emerald-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">🧾</span>
                <h3 className="font-black text-emerald-900 text-sm sm:text-base">
                  ใบเสร็จรับเงิน (RECEIPT): <span className="font-mono text-emerald-700">{latestPaymentRecord.bill_code}</span>
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2 text-slate-700 text-xs sm:text-sm font-medium">
              <div className="flex justify-between">
                <span>ชื่อลูกค้า:</span>
                <span className="font-bold text-slate-900">{selectedCustomerName}</span>
              </div>
              <div className="flex justify-between">
                <span>ยอดชำระล่าสุด:</span>
                <span className="font-mono font-bold text-emerald-700 text-base">฿{Number(latestPaymentRecord.payment_amount ?? latestPaymentRecord.amount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>หมายเหตุ:</span>
                <span>{latestPaymentRecord.note || 'รับชำระปกติ'}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 border-t border-emerald-200/60 pt-2">
                <span>วันที่ชำระ:</span>
                <span>{new Date(latestPaymentRecord.created_at).toLocaleString('th-TH')}</span>
              </div>
            </div>

            <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
              <div ref={receiptCaptureRef} style={{ width: '420px', background: '#ffffff', padding: '28px 24px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#1e293b', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #059669', paddingBottom: '14px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46', margin: 0 }}>ใบเสร็จรับเงิน / RECEIPT</h2>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>SUBLON 819</p>
                </div>

                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '14px', marginBottom: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>รหัสบิล:</span> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>{latestPaymentRecord.bill_code}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>ชื่อลูกค้า:</span> <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{selectedCustomerName}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>วันที่ชำระ:</span> <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{new Date(latestPaymentRecord.created_at).toLocaleString('th-TH')}</span></div>
                  
                  <div style={{ borderTop: '1px solid #a7f3d0', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '13px' }}>จำนวนเงินที่ชำระ:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#059669', fontSize: '20px' }}>฿{Number(latestPaymentRecord.payment_amount ?? latestPaymentRecord.amount ?? 0).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
                  <p style={{ margin: 0 }}>ขอบคุณที่ใช้บริการครับ / ขอให้กิจการรุ่งเรือง</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs sm:text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDownloadReceiptImage}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดใบเสร็จ</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptImage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>แชร์ใบเสร็จ</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}