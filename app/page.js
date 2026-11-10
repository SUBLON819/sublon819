'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Search, Calendar, Plus, Wallet, Printer, User, Download, Share2, Trash2, ExternalLink, Clock, Bell, RotateCcw
} from 'lucide-react';
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

// 📌 ฟังก์ชันแปลงเวลาตามเวลาไทย
function formatThaiTime(dateInput) {
  if (!dateInput) return '';
  const dateObj = new Date(dateInput);
  return dateObj.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
}

// 📌 ฟังก์ชันตรวจสอบรอบวันที่เก็บเงิน
function isDateInSchedule(scheduleStr, targetDateStr) {
  if (!scheduleStr) return false;
  const targetDate = new Date(targetDateStr);
  const day = targetDate.getDate();
  const month = targetDate.getMonth() + 1;
  const year = targetDate.getFullYear();

  if (scheduleStr === 'จ่ายทุกสิ้นเดือน') {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    return day === lastDayOfMonth;
  }

  if (!scheduleStr.includes('-')) {
    return Number(scheduleStr) === day;
  }

  const [startStr, endStr] = scheduleStr.split('-');
  const startDay = Number(startStr);
  const endDay = Number(endStr);

  if (startDay <= endDay) {
    return day >= startDay && day <= endDay;
  } else {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    return (day >= startDay && day <= lastDayOfMonth) || (day >= 1 && day <= endDay);
  }
}

// 📌 ฟังก์ชันคำนวณดอกเบี้ยสะสมเรียลไทม์
function calculateAccruedInterest(loan) {
  if (!loan || loan.status !== 'อนุมัติแล้ว') return 0;
  
  if (loan.loan_type === 'จบต้นดอก') {
    return Number(loan.total_interest || 0);
  }

  if (loan.loan_type !== 'ดอกลอย' && (!loan.loan_type || !loan.loan_type.includes('รอเคลียร์'))) return 0;
  
  const oldRemainingInterest = Number(loan.remaining_interest || 0);
  
  const startDateStr = loan.interest_start_date || loan.loan_date || loan.created_at;
  if (!startDateStr) return oldRemainingInterest;

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

  return newlyAccrued + oldRemainingInterest;
}

export default function AdminDashboard() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const [filterTab, setFilterTab] = useState('บิลรอเก็บ');
  const [selectedReportDate, setSelectedReportDate] = useState('');

  // Stat Modal State
  const [statModalOpen, setStatModalOpen] = useState(false);
  const [statModalTitle, setStatModalTitle] = useState('');
  const [statModalData, setStatModalData] = useState([]);

  // Approval Modal
  const [selectedLoanForApproval, setSelectedLoanForApproval] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalData, setApprovalData] = useState({
    loan_type: 'ดอกลอย',
    daily_interest: '',
    total_interest: '',
    installment_count: '',
    payment_schedule: 'จ่ายทุกวัน',
    schedule_start: '',
    schedule_end: '',
    calc_next_day: false,
  });

  // New Loan Modal
  const [newLoanModalOpen, setNewLoanModalOpen] = useState(false);
  const [newLoanData, setNewLoanData] = useState({
    full_name: '',
    phone: '',
    facebook_link: '',
    loan_type: 'ดอกลอย',
    principal_amount: '',
    daily_interest: '',
    installment_amount: '',
    installment_count: '',
    payment_schedule: 'จ่ายทุกวัน',
    schedule_start: '',
    schedule_end: '',
    loan_date: '',
    cycle_date: '',
    bank_name: 'ธนาคารกสิกรไทย (KBANK)',
    account_number: '',
    calc_next_day: false,
  });

  const [customerSuggestions, setCustomerSuggestions] = useState([]);

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Notice Bill Modal
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeLoan, setNoticeLoan] = useState(null);
  const [customNoticeAmount, setCustomNoticeAmount] = useState('');
  const [noticeForm, setNoticeForm] = useState({
    bank_name: 'ธนาคารกสิกรไทย (KBANK)',
    account_number: '',
    account_name: '',
    qr_code_image: '',
  });
  const [adminBankList, setAdminBankList] = useState([]);
  const hiddenCaptureRef = useRef(null);

  // Daily Report Modal
  const [dailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const reportRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: loansData, error: loansErr } = await supabase
        .from('loans')
        .select('*')
        .order('id', { ascending: false });
      if (loansErr) throw loansErr;

      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .order('id', { ascending: false });
      if (payErr) throw payErr;
      
      setLoans(loansData || []);
      setPayments(paymentsData || []);

      if (loansData) {
        const uniqueCustomers = [];
        const seenNames = new Set();
        loansData.forEach(l => {
          if (l.full_name && !seenNames.has(l.full_name)) {
            seenNames.add(l.full_name);
            uniqueCustomers.push({
              full_name: l.full_name,
              phone: l.phone || '',
              facebook_link: l.facebook_link || '',
              bank_name: l.bank_name || 'ธนาคารกสิกรไทย (KBANK)',
              account_number: l.account_number || ''
            });
          }
        });
        setCustomerSuggestions(uniqueCustomers);
        
        // ดึงรายการบัญชีแอดมินสำหรับ Notice
        const banks = [];
        const seenBanks = new Set();
        loansData.forEach(l => {
          if (l.bank_name && l.account_number && !seenBanks.has(l.account_number)) {
            seenBanks.add(l.account_number);
            banks.push({
              bank_name: l.bank_name,
              account_number: l.account_number,
              account_name: l.full_name
            });
          }
        });
        setAdminBankList(banks);
      }
    } catch (err) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const todayStrThai = getThaiTodayString();
    setTodayStr(todayStrThai);
    setSelectedReportDate(todayStrThai);
    setNewLoanData(prev => ({ ...prev, loan_date: todayStrThai, cycle_date: todayStrThai }));
    fetchData();
  }, []);

  const handleNameChange = (name) => {
    setNewLoanData(prev => ({ ...prev, full_name: name }));
    setShowSearchSuggestions(true);
    const found = customerSuggestions.find(c => c.full_name.toLowerCase() === name.toLowerCase());
    if (found) {
      setNewLoanData(prev => ({
        ...prev,
        phone: found.phone || prev.phone,
        facebook_link: found.facebook_link || prev.facebook_link,
        bank_name: found.bank_name || prev.bank_name,
        account_number: found.account_number || prev.account_number
      }));
    }
  };

  const todayPayments = payments.filter(p => {
    const payDate = formatThaiDate(p.created_at);
    return payDate === todayStr;
  });
  const todayCollectedCash = todayPayments.reduce((sum, p) => sum + Number(p.amount || p.payment_amount || 0), 0);
  
  const totalAccruedInterestAll = loans
    .filter(l => l.status === 'อนุมัติแล้ว' && (l.loan_type === 'ดอกลอย' || l.loan_type === 'จบต้นดอก' || (l.loan_type && l.loan_type.includes('รอเคลียร์'))))
    .reduce((sum, l) => sum + calculateAccruedInterest(l), 0);

  const totalActivePrincipal = loans
    .filter(l => (!l.loan_type || !l.loan_type.includes('รอเคลียร์')) && l.status === 'อนุมัติแล้ว')
    .reduce((sum, l) => sum + Number(l.remaining_principal ?? l.principal_amount ?? 0), 0);

  const totalPendingBalance = loans
    .filter(l => l.loan_type && l.loan_type.includes('รอเคลียร์') && (l.status === 'อนุมัติแล้ว' || l.status === 'รอเคลียร์'))
    .reduce((sum, l) => sum + Number(l.remaining_principal ?? l.principal_amount ?? 0), 0);

  const totalInterestCollected = payments.reduce((sum, p) => sum + Number(p.interest_paid || 0) + Number(p.fine_amount || 0), 0);

  const pendingApprovalCount = loans.filter(l => l.status === 'รออนุมัติ' || l.status === 'รอตรวจสอบ').length;

  const handlePrintReport = () => {
    const printContent = reportRef.current;
    if (!printContent) return;
    const winPrint = window.open('', '', 'width=900,height=650');
    winPrint.document.write(`
      <html>
        <head>
          <title>รายงานสรุปยอดประจำวัน - วังทองล้น</title>
          <style>
            body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #1e293b; }
            h1, h2, h3 { margin: 0; padding-bottom: 5px; }
            .header { text-align: center; border-bottom: 2px solid #7c3aed; margin-bottom: 20px; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #7c3aed; color: white; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    winPrint.document.close();
    winPrint.focus();
    setTimeout(() => {
      winPrint.print();
      winPrint.close();
    }, 500);
  };

  // 🗑️ ฟังก์ชันลบบิล (Soft Delete / Update Status เป็นถังขยะ)
  const handleDeleteLoan = async (loanId, billCode) => {
    if (!confirm(`คุณต้องการย้ายบิลรหัส "${billCode}" ไปที่ถังขยะใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'ถังขยะ' })
        .eq('id', loanId);

      if (error) throw error;
      alert('ย้ายบิลไปยังถังขยะเรียบร้อยแล้ว!');
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // 📌 ฟังก์ชันรับชำระเงิน
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentLoan) return;

    const basePayVal = Number(paymentAmount || 0);
    const fineInputVal = Number(fineAmount || 0);
    const discountVal = Number(discountAmount || 0);

    if (basePayVal <= 0 && fineInputVal <= 0 && discountVal <= 0) {
      alert('กรุณากรอกจำนวนเงินที่ชำระ, ค่าปรับ หรือส่วนลดอย่างน้อย 1 อย่าง');
      return;
    }

    try {
      const currentPrin = Number(selectedPaymentLoan.remaining_principal ?? selectedPaymentLoan.principal_amount ?? 0);
      const totalAccruedBefore = calculateAccruedInterest(selectedPaymentLoan);

      let remainingDiscount = discountVal;
      let effectiveFine = fineInputVal;
      
      let discountUsedForFine = Math.min(effectiveFine, remainingDiscount);
      effectiveFine -= discountUsedForFine;
      remainingDiscount -= discountUsedForFine;

      let remainingPayment = basePayVal;
      let finePaid = Math.min(effectiveFine, remainingPayment);
      remainingPayment -= finePaid;

      let interestPaid = 0;
      let principalPaid = 0;
      let newRemPrin = currentPrin;
      let newRemainingInterest = totalAccruedBefore;

      if (selectedPaymentLoan.loan_type && selectedPaymentLoan.loan_type.includes('รอเคลียร์')) {
        interestPaid = 0;   
        principalPaid = Math.min(remainingPayment, currentPrin);  
        newRemPrin = Math.max(0, currentPrin - principalPaid);
      } else if (selectedPaymentLoan.loan_type === 'จบต้นดอก') {
        const totalInt = Number(selectedPaymentLoan.total_interest || 0);
        const origPrin = Number(selectedPaymentLoan.principal_amount || 0);
        const totalPayable = origPrin + totalInt;
        
        const netPrincipalPay = Math.max(0, remainingPayment);
        const interestRatio = totalPayable > 0 ? (totalInt / totalPayable) : 0;
        interestPaid = netPrincipalPay > 0 ? netPrincipalPay * interestRatio : 0; 
        principalPaid = netPrincipalPay > 0 ? netPrincipalPay - interestPaid : 0; 
        
        newRemPrin = Math.max(0, currentPrin - principalPaid);
      } else {
        interestPaid = Math.min(totalAccruedBefore, remainingPayment);
        remainingPayment -= interestPaid;
        newRemainingInterest = Math.max(0, totalAccruedBefore - interestPaid);

        principalPaid = Math.min(currentPrin, remainingPayment);
        newRemPrin = Math.max(0, currentPrin - principalPaid);
      }

      if (remainingDiscount > 0) {
        if (newRemainingInterest > 0) {
          const discountForInt = Math.min(newRemainingInterest, remainingDiscount);
          newRemainingInterest -= discountForInt;
          remainingDiscount -= discountForInt;
        }
        if (remainingDiscount > 0) {
          newRemPrin = Math.max(0, newRemPrin - remainingDiscount);
        }
      }

      let newDailyInterest = Number(selectedPaymentLoan.daily_interest || 0);
      const origPrin = Number(selectedPaymentLoan.principal_amount || 0);
      if (selectedPaymentLoan.loan_type === 'ดอกลอย' && origPrin > 0) {
        const originalDailyInt = Number(selectedPaymentLoan.daily_interest || 0);
        const ratio = originalDailyInt / origPrin;
        newDailyInterest = newRemPrin * ratio;
      }

      const { error: payErr } = await supabase.from('payments').insert([{
        loan_id: selectedPaymentLoan.id,
        bill_code: selectedPaymentLoan.bill_code,
        full_name: selectedPaymentLoan.full_name,
        amount: basePayVal + fineInputVal,
        payment_amount: basePayVal,
        interest_paid: interestPaid,
        principal_paid: principalPaid,
        fine_amount: fineInputVal,
        discount_amount: discountVal,
        note: paymentNote || (discountVal > 0 ? `ให้ส่วนลด -${discountVal}` : 'รับชำระปกติ'),
        created_at: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString(),
      }]);

      if (payErr) throw payErr;

      const todayDateStr = getThaiTodayString();
      const isPaidOff = newRemPrin === 0 && newRemainingInterest === 0;

      const getTomorrowDate = (dateStr) => {
        const baseDate = dateStr ? new Date(dateStr) : new Date();
        baseDate.setDate(baseDate.getDate() + 1);
        return baseDate.toISOString().split('T')[0];
      };
      const nextInterestStartDate = getTomorrowDate(todayDateStr);

      const { error: loanErr } = await supabase.from('loans').update({
        remaining_principal: newRemPrin,
        daily_interest: newDailyInterest,
        remaining_interest: newRemainingInterest,
        interest_start_date: nextInterestStartDate,
        calc_next_day: newRemainingInterest > 0 ? (selectedPaymentLoan.calc_next_day ?? false) : false,
        status: isPaidOff ? 'ชำระแล้ว' : 'อนุมัติแล้ว'
      }).eq('id', selectedPaymentLoan.id);

      if (loanErr) throw loanErr;

      setPaymentModalOpen(false);
      setPaymentAmount('');
      setFineAmount('');
      setDiscountAmount('');
      setPaymentNote('');
      fetchData();
      alert('บันทึกข้อมูลและตัดยอดเรียบร้อยแล้ว!');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  };

  // 📌 ฟังก์ชันสร้างบิลปล่อยกู้ใหม่
  const handleSaveNewLoan = async (e) => {
    e.preventDefault();
    if (!newLoanData.full_name || !newLoanData.principal_amount) {
      alert('กรุณากรอกชื่อและยอดเงินต้นให้ครบถ้วน');
      return;
    }

    try {
      const randomCode = 'WL' + Math.floor(1000 + Math.random() * 9000);
      const principal = Number(newLoanData.principal_amount);

      const { error } = await supabase.from('loans').insert([{
        bill_code: randomCode,
        full_name: newLoanData.full_name,
        phone: newLoanData.phone || '',
        facebook_link: newLoanData.facebook_link || '',
        loan_type: newLoanData.loan_type,
        principal_amount: principal,
        remaining_principal: principal,
        daily_interest: newLoanData.daily_interest ? Number(newLoanData.daily_interest) : 0,
        total_interest: newLoanData.total_interest ? Number(newLoanData.total_interest) : 0,
        total_installments: newLoanData.installment_count ? Number(newLoanData.installment_count) : null,
        payment_schedule: newLoanData.payment_schedule,
        loan_date: newLoanData.loan_date,
        cycle_date: newLoanData.cycle_date,
        bank_name: newLoanData.bank_name,
        account_number: newLoanData.account_number,
        calc_next_day: newLoanData.calc_next_day,
        status: 'อนุมัติแล้ว',
        interest_start_date: newLoanData.loan_date,
      }]);

      if (error) throw error;

      alert('บันทึกรายการปล่อยกู้ใหม่สำเร็จ!');
      setNewLoanModalOpen(false);
      setNewLoanData({
        full_name: '',
        phone: '',
        facebook_link: '',
        loan_type: 'ดอกลอย',
        principal_amount: '',
        daily_interest: '',
        installment_amount: '',
        installment_count: '',
        payment_schedule: 'จ่ายทุกวัน',
        schedule_start: '',
        schedule_end: '',
        loan_date: getThaiTodayString(),
        cycle_date: getThaiTodayString(),
        bank_name: 'ธนาคารกสิกรไทย (KBANK)',
        account_number: '',
        calc_next_day: false,
      });
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleDownloadNoticeImage = async () => {
    if (!hiddenCaptureRef.current) return;
    try {
      const canvas = await html2canvas(hiddenCaptureRef.current, { scale: 2, useCORS: true });
      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `Notice-${noticeLoan?.bill_code || 'bill'}.png`;
      a.click();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดรูป: ' + err.message);
    }
  };

  const handleShareNoticeImage = async () => {
    if (!hiddenCaptureRef.current) return;
    try {
      const canvas = await html2canvas(hiddenCaptureRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Notice-${noticeLoan?.bill_code || 'bill'}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'แจ้งยอดค้างชำระ',
            text: `แจ้งยอดค้างชำระบิล ${noticeLoan?.bill_code} ของคุณ ${noticeLoan?.full_name} ยอดรวม ฿${Number(customNoticeAmount || 0).toLocaleString()}`
          });
        } else {
          handleDownloadNoticeImage();
        }
      });
    } catch (err) {
      handleDownloadNoticeImage();
    }
  };

  const matchingSuggestions = searchQuery.trim() === '' ? [] : customerSuggestions.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  ).slice(0, 5);

  const filteredLoans = loans.filter((loan) => {
    const matchQuery = (loan.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (loan.phone || '').includes(searchQuery) ||
                       (loan.bill_code || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchQuery) return false;

    const status = loan.status || 'รออนุมัติ';
    const targetCheckDate = selectedReportDate || todayStr;

    if (filterTab === 'บิลรอเก็บ') {
      if (status !== 'อนุมัติแล้ว') return false;
      const schedule = loan.payment_schedule || 'จ่ายทุกวัน';
      const isDueOnTarget = schedule === 'จ่ายทุกวัน' || isDateInSchedule(schedule, targetCheckDate);
      if (!isDueOnTarget) return false;

      const paidOnTarget = payments.some(p => String(p.loan_id) === String(loan.id) && formatThaiDate(p.created_at) === targetCheckDate);
      return !paidOnTarget;
    } 
    
    if (filterTab === 'ตัดยอดแล้ว') {
      const hasPaidOnTargetDate = payments.some(p => 
        String(p.loan_id) === String(loan.id) && formatThaiDate(p.created_at) === targetCheckDate
      );
      return hasPaidOnTargetDate;
    }

    if (filterTab === 'อนุมัติวันนี้') {
      return status === 'อนุมัติแล้ว' && loan.created_at && formatThaiDate(loan.created_at) === targetCheckDate;
    } 

    if (filterTab === 'รออนุมัติ') {
      return status === 'รออนุมัติ' || status === 'รอตรวจสอบ';
    } 
    
    if (filterTab === 'ทั้งหมด') {
      if (status === 'ปฏิเสธคำขอ') return false;
      return loan.created_at && formatThaiDate(loan.created_at) === targetCheckDate;
    }

    return true;
  }).sort((a, b) => {
    if (filterTab === 'ตัดยอดแล้ว') {
      const targetCheckDate = selectedReportDate || todayStr;
      const payA = payments.find(p => String(p.loan_id) === String(a.id) && formatThaiDate(p.created_at) === targetCheckDate);
      const payB = payments.find(p => String(p.loan_id) === String(b.id) && formatThaiDate(p.created_at) === targetCheckDate);
      const timeA = new Date(payA?.created_at || a.created_at || 0).getTime();
      const timeB = new Date(payB?.created_at || b.created_at || 0).getTime();
      return timeB - timeA;
    }

    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(147,51,234,0.35),rgba(255,255,255,0))] flex font-sans text-base box-border overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0 p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-6">

        {/* Header Control Panel */}
        <div className="bg-gradient-to-r from-purple-900 via-fuchsia-900 to-pink-900 border border-purple-500/40 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 relative w-full box-border text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 border border-white/30 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-2xl font-black text-white drop-shadow-sm">
                แผงควบคุมการบันทึกข้อมูลด่วน
              </h1>
              <p className="text-[10px] sm:text-xs text-purple-100">ระบบจัดการสินเชื่อและบันทึกยอดค้างชำระเรียลไทม์</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-purple-200 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
              <input 
                type="text"
                placeholder="ค้นหารายการ / ชื่อ / เบอร์..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                className="w-full bg-purple-950/40 border border-purple-300/40 rounded-xl pl-9 pr-3 py-2.5 sm:py-2 text-sm text-white outline-none focus:border-white relative z-10 placeholder:text-purple-200/70"
              />

              {showSearchSuggestions && matchingSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-purple-900 border border-purple-400/50 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md">
                  <div className="p-1.5 text-[10px] text-purple-200 border-b border-purple-800 px-3 font-bold">รายชื่อสมาชิกที่ตรงกัน:</div>
                  {matchingSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSearchQuery(item.full_name);
                        setShowSearchSuggestions(false);
                      }}
                      className="px-3 py-2 text-xs hover:bg-purple-800/50 cursor-pointer flex justify-between items-center transition-colors border-b border-purple-800/40 last:border-b-0 text-white"
                    >
                      <span className="font-bold flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 text-purple-200 shrink-0" />
                        <span className="truncate">{item.full_name}</span>
                      </span>
                      <span className="text-[10px] text-purple-200/70 font-mono shrink-0">{item.phone || 'ไม่มีเบอร์'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setDailyReportModalOpen(true)}
                className="px-3.5 py-3 sm:py-2.5 bg-purple-900/60 hover:bg-purple-900 border border-purple-300/40 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                title="พิมพ์รายงานประจำวัน"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">พิมพ์รายงาน</span>
              </button>

              <button 
                onClick={() => setNewLoanModalOpen(true)}
                className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4 text-purple-700" />
                <span>บันทึกรายการใหม่</span>
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="space-y-3 w-full">
          <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full">
            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ยอดเก็บสดวันนี้');
                setStatModalData(todayPayments);
                setStatModalOpen(true);
              }}
              className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-400 text-[11px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ยอดเก็บสดวันนี้</span>
                <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดูรายการ 🔍</span>
              </div>
              <div className="text-sm sm:text-lg font-bold font-mono text-emerald-400 mt-0.5 truncate">฿{todayCollectedCash.toLocaleString()}</div>
            </div>

            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ดอกเบี้ยสะสมรอเก็บ (เรียลไทม์)');
                const activeLoansWithInterest = loans.filter(l => l.status === 'อนุมัติแล้ว' && (l.loan_type === 'ดอกลอย' || l.loan_type === 'จบต้นดอก' || (l.loan_type && l.loan_type.includes('รอเคลียร์')))).map(l => ({
                  ...l,
                  calculated_accrued: calculateAccruedInterest(l)
                })).filter(l => l.calculated_accrued > 0);
                setStatModalData(activeLoansWithInterest);
                setStatModalOpen(true);
              }}
              className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-400 text-[11px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ดอกเบี้ยค้างสะสมรวม</span>
                <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดูรายการ 🔍</span>
              </div>
              <div className="text-sm sm:text-lg font-bold font-mono text-pink-400 mt-0.5 truncate">฿{Math.round(totalAccruedInterestAll).toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 w-full">
            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ทุนใหม่รอเก็บ (เงินต้นคงเหลือ)');
                const principalLoans = loans.filter(l => (!l.loan_type || !l.loan_type.includes('รอเคลียร์')) && l.status === 'อนุมัติแล้ว' && Number(l.remaining_principal ?? l.principal_amount ?? 0) > 0);
                setStatModalData(principalLoans);
                setStatModalOpen(true);
              }}
              className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-400 text-[10px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ทุนใหม่รอเก็บ</span>
                <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดู 🔍</span>
              </div>
              <div className="text-base sm:text-xl font-bold font-mono text-amber-400 truncate">฿{totalActivePrincipal.toLocaleString()}</div>
            </div>

            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ยอดค้างรอเคลียร์');
                const pendingLoans = loans.filter(l => l.loan_type && l.loan_type.includes('รอเคลียร์') && (l.status === 'อนุมัติแล้ว' || l.status === 'รอเคลียร์') && Number(l.remaining_principal ?? l.principal_amount ?? 0) > 0);
                setStatModalData(pendingLoans);
                setStatModalOpen(true);
              }}
              className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-400 text-[10px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ยอดค้างรอเคลียร์</span>
                <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดู 🔍</span>
              </div>
              <div className="text-base sm:text-xl font-bold font-mono text-rose-400 truncate">฿{totalPendingBalance.toLocaleString()}</div>
            </div>

            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ประวัติการเก็บดอกเบี้ยและค่าปรับทั้งหมด');
                setStatModalData(payments);
                setStatModalOpen(true);
              }}
              className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group col-span-2 sm:col-span-1"
            >
              <div className="text-slate-400 text-[10px] sm:text-xs font-semibold flex items-center justify-between">
                <span>กำไรสะสม</span>
                <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดู 🔍</span>
              </div>
              <div className="text-base sm:text-xl font-bold font-mono text-pink-400 truncate">฿{totalInterestCollected.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-bold text-slate-300">วันที่:</span>
            <input 
              type="date"
              value={selectedReportDate}
              onChange={(e) => setSelectedReportDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-purple-300 outline-none"
            />
            {selectedReportDate !== todayStr && (
              <button 
                onClick={() => setSelectedReportDate(todayStr)}
                className="text-[10px] text-purple-400 underline font-bold hover:text-purple-300 ml-1 cursor-pointer"
              >
                (วันนี้)
              </button>
            )}
          </div>

          {['บิลรอเก็บ', 'ตัดยอดแล้ว', 'อนุมัติวันนี้', 'รออนุมัติ', 'ทั้งหมด'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                filterTab === tab 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>{tab}</span>
              {tab === 'รออนุมัติ' && pendingApprovalCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-black bg-rose-600 text-white rounded-full animate-bounce">
                  {pendingApprovalCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loans Table Area */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-xs sm:text-sm text-purple-300">
              รายการสินเชื่อ ({filteredLoans.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">วันที่ตรวจสอบ: {selectedReportDate || todayStr}</span>
          </div>

          <div className="divide-y divide-slate-800">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">กำลังโหลดข้อมูล...</div>
            ) : filteredLoans.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">ไม่พบรายการสินเชื่อในหมวดหมู่นี้</div>
            ) : (
              filteredLoans.map((loan) => {
                const accrued = calculateAccruedInterest(loan);
                const currentPrin = Number(loan.remaining_principal ?? loan.principal_amount ?? 0);
                const isPending = loan.status === 'รออนุมัติ' || loan.status === 'รอตรวจสอบ';
                
                const loanPayments = payments.filter(p => String(p.loan_id) === String(loan.id));
                const latestPayment = loanPayments.length > 0 ? loanPayments[0] : null;

                return (
                  <div key={loan.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-800/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-pink-400 font-mono text-xs">{loan.bill_code}</span>
                        <span className="text-white font-bold text-sm">{loan.full_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-semibold">{loan.loan_type}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          loan.status === 'อนุมัติแล้ว' ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' :
                          loan.status === 'ชำระแล้ว' ? 'bg-blue-950 border border-blue-800 text-blue-300' :
                          'bg-amber-950 border border-amber-800 text-amber-300'
                        }`}>
                          {loan.status || 'รออนุมัติ'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 space-x-3 flex-wrap">
                        <span>📱 โทร: <strong className="text-slate-200">{loan.phone || '-'}</strong></span>
                        <span>💰 ต้นคงเหลือ: <strong className="text-amber-400 font-mono">฿{currentPrin.toLocaleString()}</strong></span>
                        <span>📈 ดอกสะสม: <strong className="text-pink-400 font-mono">฿{Math.round(accrued).toLocaleString()}</strong></span>
                        {latestPayment && (
                          <span className="text-emerald-400 font-mono">
                            | ล่าสุด: ฿{Number(latestPayment.payment_amount || latestPayment.amount || 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                      {isPending ? (
                        <button
                          onClick={() => {
                            setSelectedLoanForApproval(loan);
                            setApprovalData({
                              loan_type: 'ดอกลอย',
                              daily_interest: '',
                              total_interest: '',
                              installment_count: '',
                              payment_schedule: loan.payment_schedule || 'จ่ายทุกวัน',
                              schedule_start: '',
                              schedule_end: '',
                              calc_next_day: false,
                            });
                            setApprovalModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow animate-pulse"
                        >
                          ตรวจสอบ/อนุมัติ
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setSelectedPaymentLoan(loan);
                              setPaymentAmount('');
                              setFineAmount('');
                              setDiscountAmount('');
                              setPaymentNote('');
                              setPaymentModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow"
                          >
                            รับชำระเงิน
                          </button>
                          <button
                            onClick={() => {
                              setNoticeLoan(loan);
                              setCustomNoticeAmount(currentPrin);
                              setNoticeModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Notice</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteLoan(loan.id, loan.bill_code)}
                        className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="ลบรายการบิลนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ================= MODALS ================= */}

      {/* Stat Detail Modal */}
      {statModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-6 max-w-xl w-full space-y-3 shadow-2xl relative my-auto text-white max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-purple-300">📊 {statModalTitle}</h3>
              <button onClick={() => setStatModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {statModalData.length === 0 ? (
                <div className="text-center py-8 text-slate-500">ไม่พบรายการข้อมูลในส่วนนี้</div>
              ) : (
                statModalData.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="font-mono text-pink-400">{item.bill_code}</span>
                        <span>- {item.full_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.loan_type ? `ประเภท: ${item.loan_type}` : `หมายเหตุ: ${item.note || 'รับชำระปกติ'}`} | เบอร์: {item.phone || '-'}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-xs sm:text-sm text-emerald-400">
                      {item.calculated_accrued !== undefined ? `฿${item.calculated_accrued.toLocaleString()}` :
                       item.remaining_principal !== undefined ? `฿${Number(item.remaining_principal || item.principal_amount || 0).toLocaleString()}` :
                       `฿${Number(item.payment_amount || item.amount || 0).toLocaleString()}`}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 pt-2 border-t border-slate-800">
              <button 
                onClick={() => setStatModalOpen(false)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && selectedPaymentLoan && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-pink-400">บันทึกรับชำระเงิน ({selectedPaymentLoan.bill_code})</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="font-bold cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3">
              <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div>ลูกค้า: <span className="font-bold text-white">{selectedPaymentLoan.full_name}</span></div>
                <div>ประเภท: <span className="text-pink-400 font-bold">{selectedPaymentLoan.loan_type}</span></div>
                <div>ยอดต้นคงเหลือ: <span className="font-mono font-bold text-amber-400">฿{Number(selectedPaymentLoan.remaining_principal ?? selectedPaymentLoan.principal_amount ?? 0).toLocaleString()}</span></div>
                <div>ดอกเบี้ยสะสมปัจจุบัน: <span className="font-mono font-bold text-pink-400">฿{Math.round(calculateAccruedInterest(selectedPaymentLoan)).toLocaleString()}</span></div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-xs text-purple-300">ยอดชำระเงินสดหลัก (บาท)</label>
                <input 
                  type="number" placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-mono font-bold text-emerald-400 outline-none focus:border-pink-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-xs text-amber-300">⚡ ค่าปรับ (บาท)</label>
                <input 
                  type="number" placeholder="0"
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-mono font-bold text-amber-400 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-purple-300">ส่วนลด (-) บาท</label>
                  <input 
                    type="number" placeholder="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-pink-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-purple-300">หมายเหตุ</label>
                  <input 
                    type="text" placeholder="ระบุหมายเหตุ..."
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-bold rounded-lg text-xs cursor-pointer shadow-lg mt-2">
                ยืนยันการรับชำระ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Loan Modal */}
      {newLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-5 max-w-sm w-full space-y-3 text-white my-auto shadow-2xl max-h-[85vh] overflow-y-auto text-xs">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-purple-300">📝 บันทึกรายการปล่อยกู้ใหม่</h3>
              <button type="button" onClick={() => setNewLoanModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveNewLoan} className="space-y-2.5">
              <div className="relative">
                <label className="font-semibold text-purple-300 text-[11px]">ชื่อ-นามสกุลลูกค้า</label>
                <input 
                  type="text" required placeholder="พิมพ์ชื่อลูกค้า..."
                  value={newLoanData.full_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-0.5 font-bold outline-none text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-purple-300 text-[11px]">เบอร์โทร</label>
                  <input 
                    type="text" placeholder="08x-xxx-xxxx" 
                    value={newLoanData.phone} 
                    onChange={(e) => setNewLoanData({...newLoanData, phone: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-0.5 font-mono text-white text-xs" 
                  />
                </div>
                <div>
                  <label className="font-semibold text-purple-300 text-[11px]">Facebook</label>
                  <input 
                    type="text" placeholder="ลิงก์เฟสบุ๊ค..." 
                    value={newLoanData.facebook_link} 
                    onChange={(e) => setNewLoanData({...newLoanData, facebook_link: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-0.5 font-mono text-white text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="space-y-0.5">
                  <label className="font-semibold text-purple-300 text-[11px]">ธนาคารรับเงิน</label>
                  <select
                    value={newLoanData.bank_name} 
                    onChange={(e) => setNewLoanData({...newLoanData, bank_name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs outline-none font-bold text-white"
                  >
                    <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                    <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                    <option value="ธนาคารกรุงเทพ (BBL)">ธนาคารกรุงเทพ (BBL)</option>
                    <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="font-semibold text-purple-300 text-[11px]">เลขบัญชี</label>
                  <input 
                    type="text" placeholder="เลขบัญชี..."
                    value={newLoanData.account_number} 
                    onChange={(e) => setNewLoanData({...newLoanData, account_number: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono font-bold outline-none text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="space-y-0.5">
                  <label className="font-semibold text-purple-300 text-[11px]">วันที่กู้</label>
                  <input 
                    type="date" required
                    value={newLoanData.loan_date}
                    onChange={(e) => setNewLoanData({...newLoanData, loan_date: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-xs outline-none font-bold text-white"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="font-semibold text-amber-300 text-[11px]">วันที่คืน</label>
                  <input 
                    type="date" required
                    value={newLoanData.cycle_date}
                    onChange={(e) => setNewLoanData({...newLoanData, cycle_date: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-xs outline-none font-bold text-amber-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-purple-300 text-[11px]">ประเภทรายการ</label>
                  <select
                    value={newLoanData.loan_type}
                    onChange={(e) => setNewLoanData({...newLoanData, loan_type: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-0.5 font-bold text-white text-xs"
                  >
                    <option value="ดอกลอย">ดอกลอย</option>
                    <option value="จบต้นดอก">จบต้นดอก</option>
                    <option value="ยอดค้างรอเคลียร์">ยอดค้างรอเคลียร์</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-purple-300 text-[11px]">ยอดเงินต้น (บาท)</label>
                  <input 
                    type="number" required placeholder="เช่น 1000" 
                    value={newLoanData.principal_amount} 
                    onChange={(e) => setNewLoanData({...newLoanData, principal_amount: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-0.5 font-mono font-bold text-emerald-400 text-xs" 
                  />
                </div>
              </div>

              {newLoanData.loan_type === 'ดอกลอย' && (
                <div className="space-y-1.5">
                  <div>
                    <label className="font-semibold text-purple-300 text-[11px]">ดอกเบี้ย (บาทต่อวัน)</label>
                    <input type="number" step="0.01" placeholder="เช่น 40" value={newLoanData.daily_interest || ''} onChange={(e) => setNewLoanData({...newLoanData, daily_interest: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-0.5 font-mono font-bold text-pink-400 text-xs" />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <input 
                      type="checkbox"
                      id="calc_next_day_checkbox"
                      checked={newLoanData.calc_next_day}
                      onChange={(e) => setNewLoanData({...newLoanData, calc_next_day: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded border-slate-800 cursor-pointer"
                    />
                    <label htmlFor="calc_next_day_checkbox" className="font-semibold text-slate-300 cursor-pointer text-[11px]">
                      เริ่มนับดอกเบี้ย <span className="text-pink-400 font-bold">"วันพรุ่งนี้"</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow">
                  บันทึกข้อมูล
                </button>
                <button type="button" onClick={() => setNewLoanModalOpen(false)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer">
                  ปิด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice Bill Modal */}
      {noticeModalOpen && noticeLoan && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-[92%] max-w-sm p-4 sm:p-5 shadow-2xl space-y-3 text-xs text-white max-h-[85vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-rose-400 text-xs sm:text-sm">
                ออกบิลแจ้งยอด (NOTICE): <span className="font-mono">{noticeLoan.bill_code}</span>
              </h3>
              <button onClick={() => setNoticeModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-[11px]">
              <div>ชื่อลูกค้า: <span className="font-bold text-white">{noticeLoan.full_name}</span></div>
              <div>เบอร์โทร: <span className="font-mono text-slate-300">{noticeLoan.phone || '-'}</span></div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-1 mt-1">
                <span className="font-bold text-slate-300">ยอดค้างชำระ:</span>
                <input 
                  type="number"
                  value={customNoticeAmount}
                  onChange={(e) => setCustomNoticeAmount(e.target.value)}
                  className="w-28 text-right font-mono font-bold text-rose-400 text-sm bg-slate-900 border border-slate-700 rounded-lg p-1 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] font-bold text-purple-300">ข้อมูลบัญชีสำหรับโอนชำระ</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-400">ธนาคาร:</label>
                  <select
                    value={noticeForm.bank_name}
                    onChange={(e) => setNoticeForm({...noticeForm, bank_name: e.target.value})}
                    className="w-full border border-slate-700 rounded-lg p-1.5 text-xs font-bold bg-slate-900 outline-none text-white"
                  >
                    <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                    <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                    <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">เลขบัญชี:</label>
                  <input 
                    type="text" placeholder="xxx-x-xxxxx-x"
                    value={noticeForm.account_number}
                    onChange={(e) => setNoticeForm({...noticeForm, account_number: e.target.value})}
                    className="w-full border border-slate-700 rounded-lg p-1.5 text-xs font-mono font-bold bg-slate-900 outline-none text-white"
                  />
                </div>
              </div>
            </div>

            {/* Hidden capture element for image download */}
            <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
              <div ref={hiddenCaptureRef} style={{ width: '400px', background: '#ffffff', padding: '24px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#1e293b' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #f43f5e', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#881337', margin: 0 }}>แจ้งยอดค้างชำระ (NOTICE)</h2>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>ระบบบริหารจัดการสินเชื่อออนไลน์</p>
                </div>

                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '12px', marginBottom: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>รหัสบิล:</span> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>{noticeLoan.bill_code}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>ชื่อลูกค้า:</span> <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{noticeLoan.full_name}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>เบอร์โทร:</span> <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{noticeLoan.phone || '-'}</span></div>
                  
                  <div style={{ borderTop: '1px solid #fecdd3', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '13px' }}>ยอดค้างชำระคงเหลือ:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#e11d48', fontSize: '18px' }}>฿{Number(customNoticeAmount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>ข้อมูลบัญชีสำหรับโอนชำระ</div>
                    <div style={{ marginBottom: '4px' }}><span style={{ color: '#64748b' }}>ธนาคาร:</span> <strong style={{ color: '#0f172a' }}>{noticeForm.bank_name || '-'}</strong></div>
                    <div><span style={{ color: '#64748b' }}>เลขบัญชี:</span> <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{noticeForm.account_number || '-'}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setNoticeModalOpen(false)}
                className="px-3 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDownloadNoticeImage}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดรูป</span>
              </button>
              <button
                type="button"
                onClick={handleShareNoticeImage}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>แชร์ภาพ</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModalOpen && selectedLoanForApproval && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 max-w-md w-full space-y-3 text-white relative shadow-2xl max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-purple-300">อนุมัติคำขอกู้: {selectedLoanForApproval.full_name}</h3>
              <button type="button" onClick={() => setApprovalModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1">
              <p>📱 เบอร์โทร: <span className="text-purple-300 font-mono font-bold">{selectedLoanForApproval.phone || '-'}</span></p>
              <p>💰 ยอดขอกู้: <span className="text-pink-400 font-bold font-mono">฿{Number(selectedLoanForApproval.principal_amount || 0).toLocaleString()}</span></p>
              <p>🏦 ธนาคาร: <span className="text-white font-semibold">{selectedLoanForApproval.bank_name} ({selectedLoanForApproval.account_number})</span></p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const scheduleStr = approvalData.payment_schedule === 'กำหนดช่วงวัน' 
                  ? `${approvalData.schedule_start}-${approvalData.schedule_end}` 
                  : approvalData.payment_schedule;

                const { error } = await supabase
                  .from('loans')
                  .update({
                    status: 'อนุมัติแล้ว',
                    loan_type: approvalData.loan_type,
                    daily_interest: approvalData.daily_interest ? Number(approvalData.daily_interest) : 0,
                    total_interest: approvalData.total_interest ? Number(approvalData.total_interest) : 0,
                    payment_schedule: scheduleStr,
                    calc_next_day: approvalData.calc_next_day,
                    loan_date: selectedLoanForApproval.loan_date || getThaiTodayString(),
                    interest_start_date: getThaiTodayString(),
                  })
                  .eq('id', selectedLoanForApproval.id);

                if (error) throw error;
                alert('อนุมัติบิลและบันทึกเข้าสู่ระบบหลักสำเร็จ!');
                setApprovalModalOpen(false);
                fetchData();
              } catch (err) {
                alert('เกิดข้อผิดพลาด: ' + err.message);
              }
            }} className="space-y-2.5">
              
              <div>
                <label className="font-semibold text-slate-300 block mb-0.5">ประเภทรายการ</label>
                <select
                  value={approvalData.loan_type}
                  onChange={(e) => setApprovalData({...approvalData, loan_type: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 font-bold text-white outline-none text-xs"
                >
                  <option value="ดอกลอย">ดอกลอย</option>
                  <option value="จบต้นดอก">จบต้นดอก</option>
                </select>
              </div>

              {approvalData.loan_type === 'ดอกลอย' && (
                <>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-0.5">ดอกเบี้ย (บาทต่อวัน)</label>
                    <input 
                      type="number" step="0.01" required placeholder="เช่น 40" 
                      value={approvalData.daily_interest} 
                      onChange={(e) => setApprovalData({...approvalData, daily_interest: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono font-bold text-pink-400 outline-none text-xs" 
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <input 
                      type="checkbox"
                      id="admin_calc_next_day"
                      checked={approvalData.calc_next_day}
                      onChange={(e) => setApprovalData({...approvalData, calc_next_day: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded border-slate-800 cursor-pointer"
                    />
                    <label htmlFor="admin_calc_next_day" className="font-semibold text-slate-300 cursor-pointer text-[11px]">
                      เริ่มนับดอกเบี้ย <span className="text-pink-400 font-bold">"วันพรุ่งนี้"</span>
                    </label>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
                >
                  ✅ อนุมัติ
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    if (confirm(`คุณต้องการปฏิเสธและลบคำขอกู้ของ ${selectedLoanForApproval.full_name} ออกจากระบบใช่หรือไม่?`)) {
                      try {
                        await supabase.from('payments').delete().eq('loan_id', selectedLoanForApproval.id);
                        await supabase.from('loans').delete().eq('id', selectedLoanForApproval.id);
                        alert('ลบคำขอกู้เรียบร้อยแล้ว');
                        setApprovalModalOpen(false);
                        fetchData();
                      } catch (err) {
                        alert('เกิดข้อผิดพลาด: ' + err.message);
                      }
                    }
                  }}
                  className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
                >
                  ❌ ปฏิเสธ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Report Modal */}
      {dailyReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-6 max-w-2xl w-full space-y-3 text-white shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-purple-300 flex items-center gap-2">
                <Printer className="w-4 h-4 text-purple-400" />
                <span>รายงานสรุปยอดประจำวัน</span>
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintReport} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer">พิมพ์รายงาน</button>
                <button onClick={() => setDailyReportModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-white text-slate-900 rounded-xl space-y-3 text-xs" ref={reportRef}>
              <div className="text-center border-b-2 border-purple-700 pb-2.5">
                <h2 className="text-sm sm:text-base font-bold text-purple-900">วังทองล้น (รายงานประจำวัน)</h2>
                <p className="text-[10px] text-slate-500 font-mono">วันที่ออกรายงาน: {selectedReportDate || todayStr}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ยอดเก็บสดวันนี้:</div>
                  <div className="font-mono font-bold text-emerald-600 text-sm">฿{todayCollectedCash.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ดอกเบี้ยเก็บแล้ว (+ค่าปรับ):</div>
                  <div className="font-mono font-bold text-purple-700 text-sm">฿{totalInterestCollected.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}