'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Search, Calendar, Plus, Wallet, Printer, User, Download, Share2, Trash2, ExternalLink, Clock
} from 'lucide-react';
import html2canvas from 'html2canvas';

// 📌 นำเข้า Component กลางสำหรับแสดงประวัติลูกค้า
import CustomerDetail from '@/components/CustomerDetail';

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

// 📌 ฟังก์ชันดึงเวลา (HH:mm) ตามเวลาไทย
function formatThaiTime(dateInput) {
  if (!dateInput) return '';
  const dateObj = new Date(dateInput);
  const options = { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false };
  return new Intl.DateTimeFormat('en-GB', options).format(dateObj);
}

// 📌 ฟังก์ชันตรวจสอบรอบวันที่เก็บเงิน
function isTodayInSchedule(scheduleStr) {
  if (!scheduleStr) return false;
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

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
  
  const startDateStr = loan.interest_start_date || loan.loan_date || loan.created_at;
  if (!startDateStr) return 0;

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
  const oldRemainingInterest = Number(loan.remaining_interest || 0);

  return newlyAccrued + oldRemainingInterest;
}

export default function AdminDashboard() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');

  // 📌 จัดเรียงลำดับแท็บใหม่ตามที่กำหนด
  const [filterTab, setFilterTab] = useState('บิลรอเก็บ');

  const [statModalOpen, setStatModalOpen] = useState(false);
  const [statModalTitle, setStatModalTitle] = useState('');
  const [statModalData, setStatModalData] = useState([]);

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

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [customerProfileModalOpen, setCustomerProfileModalOpen] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  const [dailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const reportRef = useRef(null);

  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeLoan, setNoticeLoan] = useState(null);
  const [customNoticeAmount, setCustomNoticeAmount] = useState('');
  const [adminBankList, setAdminBankList] = useState([]);
  const [noticeForm, setNoticeForm] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    qr_code_image: ''
  });
  
  const noticePrintRef = useRef(null);
  const hiddenCaptureRef = useRef(null);

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
    setNewLoanData(prev => ({ ...prev, loan_date: todayStrThai, cycle_date: todayStrThai }));
    
    const savedBanks = localStorage.getItem('admin_saved_banks');
    if (savedBanks) {
      try {
        const parsed = JSON.parse(savedBanks);
        setAdminBankList(parsed);
        if (parsed.length > 0) {
          setNoticeForm(parsed[0]);
        }
      } catch (e) { console.error(e); }
    }

    fetchData();
  }, []);

  const handleNameChange = (val) => {
    setNewLoanData(prev => ({ ...prev, full_name: val }));
    const found = customerSuggestions.find(c => c.full_name.toLowerCase() === val.toLowerCase());
    if (found) {
      setNewLoanData(prev => ({
        ...prev,
        phone: found.phone,
        facebook_link: found.facebook_link,
        bank_name: found.bank_name || prev.bank_name,
        account_number: found.account_number
      }));
    }
  };

  const calculateInterestStartDate = (txDate, isNextDay) => {
    if (!txDate) return txDate;
    const dateObj = new Date(txDate);
    if (isNextDay) {
      dateObj.setDate(dateObj.getDate() + 1);
    }
    return dateObj.toISOString().split('T')[0];
  };

  const todayPayments = payments.filter(p => {
    const payDate = formatThaiDate(p.created_at);
    return payDate === todayStr;
  });
  const todayCollectedCash = todayPayments.reduce((sum, p) => sum + Number(p.amount || p.payment_amount || 0), 0);
  
  const totalAccruedInterestAll = loans.reduce((sum, l) => sum + calculateAccruedInterest(l), 0);
  const totalActivePrincipal = loans
    .filter(l => (l.loan_type === 'ดอกลอย' || l.loan_type === 'จบต้นดอก') && l.status === 'อนุมัติแล้ว')
    .reduce((sum, l) => sum + Number(l.remaining_principal ?? l.principal_amount ?? 0), 0);
  
  const totalPendingBalance = loans
    .filter(l => l.loan_type && l.loan_type.includes('รอเคลียร์') && l.status !== 'ปฏิเสธคำขอ')
    .reduce((sum, l) => sum + Number(l.remaining_principal ?? l.principal_amount ?? 0), 0);
  
  const totalInterestCollected = payments.reduce((sum, p) => {
    const targetLoan = loans.find(l => l.id === p.loan_id);
    const isPendingClear = targetLoan && targetLoan.loan_type && targetLoan.loan_type.includes('รอเคลียร์');
    
    const profitFromThisPayment = isPendingClear 
      ? Number(p.payment_amount || p.amount || 0) 
      : (Number(p.interest_paid || 0) + Number(p.fine_amount || 0));

    return sum + profitFromThisPayment;
  }, 0);

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

  const handleDownloadNoticeImage = async () => {
    const element = hiddenCaptureRef.current;
    if (!element) return;

    if (noticeForm.bank_name || noticeForm.account_number) {
      const existing = [...adminBankList];
      const index = existing.findIndex(b => b.account_number === noticeForm.account_number && b.bank_name === noticeForm.bank_name);
      if (index >= 0) {
        existing[index] = noticeForm;
      } else {
        existing.unshift(noticeForm);
      }
      setAdminBankList(existing);
      localStorage.setItem('admin_saved_banks', JSON.stringify(existing));
    }

    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 450,
        height: 540,
        windowWidth: 450,
        ignoreElements: (node) => {
          return node.tagName === 'LINK' && node.rel === 'stylesheet';
        },
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Notice-${noticeLoan?.bill_code || 'Bill'}.png`;
      link.click();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดภาพ: ' + err.message);
    }
  };

  const handleShareNoticeImage = async () => {
    const element = hiddenCaptureRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        width: 450,
        height: 540,
        windowWidth: 450,
        ignoreElements: (node) => {
          return node.tagName === 'LINK' && node.rel === 'stylesheet';
        },
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Notice-${noticeLoan?.bill_code || 'Bill'}.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'แจ้งยอดค้างชำระ (NOTICE)',
              text: `รหัสบิล: ${noticeLoan?.bill_code} ยอดชำระ: ${customNoticeAmount} บาท`,
            });
          } catch (error) {
            if (error.name !== 'AbortError') console.log('Share error:', error);
          }
        } else {
          alert('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง แนะนำให้กดดาวน์โหลดรูปภาพแทนครับ');
        }
      });
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการสร้างภาพสำหรับแชร์: ' + err.message);
    }
  };

  const handleSaveNewLoan = async (e) => {
    e.preventDefault();
    try {
      const interestStartDate = calculateInterestStartDate(newLoanData.loan_date, newLoanData.calc_next_day);
      const principal = Number(newLoanData.principal_amount || 0);
      const scheduleStr = newLoanData.payment_schedule === 'กำหนดช่วงวัน' 
        ? `${newLoanData.schedule_start}-${newLoanData.schedule_end}` 
        : newLoanData.payment_schedule;

      const { error } = await supabase.from('loans').insert([{
        bill_code: 'LN-' + Math.floor(10000 + Math.random() * 90000),
        full_name: newLoanData.full_name,
        phone: String(newLoanData.phone || '').trim(),
        facebook_link: newLoanData.facebook_link,
        loan_type: newLoanData.loan_type,
        principal_amount: principal,
        remaining_principal: principal,
        status: 'อนุมัติแล้ว',
        bank_name: newLoanData.bank_name,
        account_number: newLoanData.account_number,
        loan_date: newLoanData.loan_date || todayStr,
        cycle_date: newLoanData.cycle_date || null,
        interest_start_date: interestStartDate,
        calc_next_day: newLoanData.calc_next_day,
        daily_interest: newLoanData.loan_type === 'ดอกลอย' ? Number(newLoanData.daily_interest || 0) : 0,
        total_interest: newLoanData.loan_type === 'จบต้นดอก' ? Number(newLoanData.total_interest || 0) : 0,
        installment_amount: Number(newLoanData.installment_amount || 0),
        total_installments: Number(newLoanData.installment_count || 0),
        payment_schedule: scheduleStr,
        created_at: new Date().toISOString(),
      }]);

      if (error) throw error;
      alert('บันทึกรายการปล่อยกู้ใหม่เรียบร้อยแล้ว!');
      setNewLoanModalOpen(false);
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  };

  const handleSaveCustomerInfo = async (e) => {
    e.preventDefault();
    if (!editingLoanId) return;
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
        .eq('id', editingLoanId);

      if (error) throw error;

      alert('อัปเดตข้อมูลลูกค้าสำเร็จ!');
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

      alert('ลบบิลรายการออกจากระบบเรียบร้อยแล้ว!');
      fetchData();
    } catch (err) {
      console.error('Error deleting loan:', err.message);
      alert('เกิดข้อผิดพลาดในการลบบิล: ' + err.message);
    }
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentLoan) return;

    const basePayVal = Number(paymentAmount || 0);
    const fineVal = Number(fineAmount || 0);
    const discountVal = Number(discountAmount || 0);

    if (basePayVal <= 0 && fineVal <= 0 && discountVal <= 0) {
      alert('กรุณากรอกจำนวนเงินที่ชำระ, ค่าปรับ หรือส่วนลดอย่างน้อย 1 อย่าง');
      return;
    }

    try {
      const currentPrin = Number(selectedPaymentLoan.remaining_principal ?? selectedPaymentLoan.principal_amount ?? 0);

      let interestPaid = 0;
      let principalPaid = 0;
      let newRemPrin = currentPrin;

      if (selectedPaymentLoan.loan_type && selectedPaymentLoan.loan_type.includes('รอเคลียร์')) {
        interestPaid = basePayVal;   
        principalPaid = basePayVal;  
        newRemPrin = Math.max(0, currentPrin - basePayVal);
      } else if (selectedPaymentLoan.loan_type === 'จบต้นดอก') {
        const totalInt = Number(selectedPaymentLoan.total_interest || 0);
        const origPrin = Number(selectedPaymentLoan.principal_amount || 0);
        const totalPayable = origPrin + totalInt;
        
        const netPrincipalPay = Math.max(0, basePayVal);
        const interestRatio = totalPayable > 0 ? (totalInt / totalPayable) : 0;
        interestPaid = netPrincipalPay > 0 ? netPrincipalPay * interestRatio : 0; 
        principalPaid = netPrincipalPay > 0 ? netPrincipalPay - interestPaid : 0; 
        
        newRemPrin = Math.max(0, currentPrin - principalPaid);
      } else {
        const accruedInterest = calculateAccruedInterest(selectedPaymentLoan);
        if (basePayVal >= accruedInterest) {
          interestPaid = accruedInterest; 
          principalPaid = basePayVal - accruedInterest; 
          newRemPrin = Math.max(0, currentPrin - principalPaid);
        } else {
          interestPaid = basePayVal; 
          principalPaid = 0;
          newRemPrin = Math.max(0, currentPrin);
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
        amount: basePayVal + fineVal,
        payment_amount: basePayVal,
        interest_paid: interestPaid,
        principal_paid: principalPaid,
        fine_amount: fineVal,
        discount_amount: discountVal,
        note: paymentNote || (discountVal > 0 ? `ให้ส่วนลด -${discountVal}` : 'รับชำระปกติ'),
        created_at: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString(),
      }]);

      if (payErr) throw payErr;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const isPaidOff = newRemPrin === 0;

      const { error: loanErr } = await supabase.from('loans').update({
        remaining_principal: newRemPrin,
        daily_interest: newDailyInterest,
        remaining_interest: 0,
        interest_start_date: tomorrowStr,
        calc_next_day: true,
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

  const matchingSuggestions = searchQuery.trim() === '' ? [] : customerSuggestions.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  ).slice(0, 5);

  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const targetDate = dateStr.split('T')[0];
    if (startDate && targetDate < startDate) return false;
    if (endDate && targetDate > endDate) return false;
    return true;
  };

  // 📌 ลอจิกการกรองข้อมูลและจัดเรียงตามเงื่อนไขใหม่
  const filteredLoans = loans.filter((loan) => {
    const matchQuery = (loan.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (loan.phone || '').includes(searchQuery) ||
                       (loan.bill_code || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchQuery) return false;

    const status = loan.status || 'รออนุมัติ';

    if (filterTab === 'บิลรอเก็บ') {
      if (status !== 'อนุมัติแล้ว') return false;
      const schedule = loan.payment_schedule || 'จ่ายทุกวัน';
      const isDueToday = schedule === 'จ่ายทุกวัน' || isTodayInSchedule(schedule);
      if (!isDueToday) return false;

      // ตรวจสอบว่าวันนี้ชำระเงินไปแล้วหรือยัง (ถ้าชำระแล้วให้ตัดออก)
      const paidToday = payments.some(p => String(p.loan_id) === String(loan.id) && formatThaiDate(p.created_at) === todayStr);
      return !paidToday;
    } 
    
    if (filterTab === 'รออนุมัติ') {
      return status === 'รออนุมัติ' || status === 'รอตรวจสอบ';
    } 
    
    if (filterTab === 'อนุมัติวันนี้') {
      return status === 'อนุมัติแล้ว' && loan.created_at && formatThaiDate(loan.created_at) === todayStr;
    } 
    
    if (filterTab === 'ตัดยอดแล้ว') {
      // แสดงเฉพาะบิลที่มีการบันทึกรับชำระแล้วของวันนี้เท่านั้น
      const hasPaidToday = payments.some(p => String(p.loan_id) === String(loan.id) && formatThaiDate(p.created_at) === todayStr);
      return hasPaidToday || status === 'ชำระแล้ว';
    }

    if (filterTab === 'ทั้งหมด') {
      // เฉพาะรายการที่ทำธุรกรรมหรือสร้างในวันนี้เท่านั้น (เทียบจาก created_at)
      if (status === 'ปฏิเสธคำขอ') return false;
      return loan.created_at && formatThaiDate(loan.created_at) === todayStr;
    }

    return true;
  }).sort((a, b) => {
    // หากอยู่แท็บทั้งหมด หรือแท็บทั่วไป ให้เรียงจากล่าสุด (เวลาใหม่สุด) ไว้บนสุด
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  const customerLoans = loans.filter(l => l.full_name === selectedCustomerName && l.status !== 'ปฏิเสธคำขอ');
  const customerLoanIds = new Set(customerLoans.map(l => l.id));
  const customerPayments = payments.filter(p => customerLoanIds.has(p.loan_id));
  const customerInfo = customerLoans[0] || {};
  const totalCustomerBorrowed = customerLoans.reduce((sum, l) => sum + Number(l.principal_amount || 0), 0);
  const totalCustomerRemaining = customerLoans
    .filter(l => l.status === 'อนุมัติแล้ว')
    .reduce((sum, l) => sum + Number(l.remaining_principal || l.principal_amount || 0), 0);
  
  const totalCustomerAccruedInterest = customerLoans.reduce((sum, l) => sum + calculateAccruedInterest(l), 0);
  const totalCustomerPaid = customerPayments.reduce((sum, p) => sum + Number(p.amount || 0) + Number(p.fine_amount || 0), 0);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex font-sans text-slate-800 text-base box-border overflow-x-hidden">
      
      <div className="flex-1 flex flex-col min-w-0 p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-6">

        {/* Header Control Panel */}
        <div className="bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 border border-purple-300/50 p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 relative w-full box-border text-white">
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

            <button 
              onClick={() => setNewLoanModalOpen(true)}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-purple-700" />
              <span>บันทึกรายการใหม่</span>
            </button>
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
              className="bg-white/95 backdrop-blur-md border border-purple-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-600 text-[11px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ยอดเก็บสดวันนี้</span>
                <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดูรายการ 🔍</span>
              </div>
              <div className="text-lg sm:text-2xl font-black font-mono text-emerald-600 truncate">฿{todayCollectedCash.toLocaleString()}</div>
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
              className="bg-white/95 backdrop-blur-md border border-purple-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-600 text-[11px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ดอกเบี้ยสะสมรอเก็บ</span>
                <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดูรายการ 🔍</span>
              </div>
              <div className="text-lg sm:text-2xl font-black font-mono text-[color:#ff007f] truncate animate-pulse">฿{totalAccruedInterestAll.toLocaleString()}</div>
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
              className="bg-white/95 backdrop-blur-md border border-purple-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-600 text-[10px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ทุนใหม่รอเก็บ</span>
                <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดู 🔍</span>
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-amber-600 truncate">฿{totalActivePrincipal.toLocaleString()}</div>
            </div>

            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ยอดค้างรอเคลียร์');
                const pendingLoans = loans.filter(l => l.loan_type && l.loan_type.includes('รอเคลียร์') && (l.status === 'อนุมัติแล้ว' || l.status === 'รอเคลียร์') && Number(l.remaining_principal ?? l.principal_amount ?? 0) > 0);
                setStatModalData(pendingLoans);
                setStatModalOpen(true);
              }}
              className="bg-white/95 backdrop-blur-md border border-purple-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group"
            >
              <div className="text-slate-600 text-[10px] sm:text-xs font-semibold flex items-center justify-between">
                <span>ยอดค้างรอเคลียร์</span>
                <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดู 🔍</span>
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-rose-800 truncate">฿{totalPendingBalance.toLocaleString()}</div>
            </div>

            <div 
              onClick={() => {
                setStatModalTitle('ที่มาของยอด: ประวัติการเก็บดอกเบี้ยและค่าปรับทั้งหมด');
                setStatModalData(payments);
                setStatModalOpen(true);
              }}
              className="bg-white/95 backdrop-blur-md border border-purple-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 shadow-md cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all group col-span-2 sm:col-span-1"
              title="รวมดอกเบี้ยเก็บแล้ว + ค่าปรับ"
            >
              <div className="text-slate-600 text-[10px] sm:text-xs font-semibold flex items-center justify-between">
                <span>กำไรสะสม</span>
                <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">คลิกดู 🔍</span>
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-pink-600 truncate">฿{totalInterestCollected.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Loan List Section (Tabs Reordered) */}
        <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl space-y-4 w-full box-border">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-purple-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-700" />
              <span>รายการสินเชื่อและสัญญา ({filteredLoans.length})</span>
            </h3>

            {/* 📌 จัดเรียงลำดับแท็บใหม่ตามที่กำหนด: บิลรอเก็บ - รออนุมัติ - อนุมัติวันนี้ - ตัดยอดแล้ว - ทั้งหมด */}
            <div className="flex items-center gap-1 bg-purple-50 p-1 rounded-xl border border-purple-200 text-xs overflow-x-auto w-full lg:w-auto pb-1 sm:pb-1">
              {['บิลรอเก็บ', 'รออนุมัติ', 'อนุมัติวันนี้', 'ตัดยอดแล้ว', 'ทั้งหมด'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-xs shrink-0 ${
                    filterTab === tab ? 'bg-purple-700 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">ไม่พบรายการสินเชื่อในระบบสำหรับแท็บนี้</div>
            ) : (
              filteredLoans.map((loan) => {
                const accrued = calculateAccruedInterest(loan);
                const currentRemaining = Number(loan.remaining_principal || loan.principal_amount || 0);
                const isPending = loan.status === 'รออนุมัติ' || loan.status === 'รอตรวจสอบ';
                
                return (
                  <div key={loan.id} className="bg-purple-50/40 border border-purple-200 hover:border-purple-400 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3 transition-all">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-purple-800">บิล: {loan.bill_code}</span>
                          <span 
                            onClick={() => {
                              setSelectedCustomerName(loan.full_name);
                              setCustomerProfileModalOpen(true);
                            }}
                            className="text-xs font-bold text-slate-800 hover:text-purple-700 underline cursor-pointer truncate"
                            title="คลิกเพื่อดูประวัติลูกค้าแบบเต็มจอ"
                          >
                            - {loan.full_name} 🔍
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>ประเภท: {loan.loan_type}</span> | 
                          <span>รอบจ่าย: <strong className="text-purple-800">{loan.payment_schedule || 'จ่ายทุกวัน'}</strong></span> | 
                          <span className="flex items-center gap-0.5 text-emerald-700 font-mono font-bold">
                            <Clock className="w-3 h-3" />
                            {loan.created_at ? `${formatThaiDate(loan.created_at)} ${formatThaiTime(loan.created_at)}` : (loan.loan_date || '-')}
                          </span>
                          {!isPending && <>| ครบกำหนด: <span className="text-amber-700 font-mono font-bold">{loan.cycle_date || '-'}</span></>}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        loan.status === 'อนุมัติแล้ว' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        loan.status === 'ชำระแล้ว' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {loan.status || 'รออนุมัติ'}
                      </span>
                    </div>

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

                    <div className="flex gap-2 pt-1 flex-wrap sm:flex-nowrap justify-between items-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteLoan(loan.id, loan.bill_code)}
                        className="px-3 py-2.5 sm:py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                        title="ลบรายการบิลนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบบิลนี้</span>
                      </button>

                      <div className="flex gap-2 flex-1 sm:justify-end">
                        {isPending ? (
                          <button
                            type="button"
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
                            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                          >
                            🔍 ตรวจสอบ & อนุมัติคำขอจากลูกค้า
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPaymentLoan(loan);
                                setPaymentAmount('');
                                setFineAmount('');
                                setDiscountAmount('');
                                setPaymentNote('');
                                setPaymentModalOpen(true);
                              }}
                              className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                            >
                              บันทึกรับชำระ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNoticeLoan(loan);
                                setCustomNoticeAmount(currentRemaining);
                                setNoticeModalOpen(true);
                              }}
                              className="px-4 py-2.5 sm:py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>ออกบิลแจ้งยอด (NOTICE)</span>
                            </button>
                          </>
                        )}
                      </div>
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white border border-purple-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-xl w-full space-y-3 shadow-2xl relative my-auto text-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-purple-100 pb-2.5 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-purple-900 flex items-center gap-2">
                <span>📊 {statModalTitle}</span>
              </h3>
              <button onClick={() => setStatModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {statModalData.length === 0 ? (
                <div className="text-center py-8 text-slate-400">ไม่พบรายการข้อมูลในส่วนนี้</div>
              ) : (
                statModalData.map((item, idx) => (
                  <div key={idx} className="bg-purple-50/50 border border-purple-100 p-2.5 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-purple-700">{item.bill_code}</span>
                        <span>- {item.full_name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {item.loan_type ? `ประเภท: ${item.loan_type}` : `หมายเหตุ: ${item.note || 'รับชำระปกติ'}`} | เบอร์: {item.phone || '-'}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-xs sm:text-sm text-purple-800">
                      {item.calculated_accrued !== undefined ? `฿${item.calculated_accrued.toLocaleString()}` :
                       item.remaining_principal !== undefined ? `฿${Number(item.remaining_principal || item.principal_amount || 0).toLocaleString()}` :
                       `฿${Number(item.payment_amount || item.amount || 0).toLocaleString()}`}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 pt-2 border-t border-purple-100">
              <button 
                onClick={() => setStatModalOpen(false)}
                className="w-full py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Report Print Modal */}
      {dailyReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white border border-purple-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-2xl w-full space-y-3 shadow-2xl relative my-auto text-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-purple-100 pb-2.5 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-purple-700" />
                <span>รายงานสรุปยอดประจำวัน</span>
              </h3>
              <button onClick={() => setDailyReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs" ref={reportRef}>
              <div className="text-center border-b-2 border-purple-700 pb-2.5">
                <h2 className="text-sm sm:text-base font-black text-purple-900">วังทองล้น (ระบบจัดการสินเชื่อ)</h2>
                <p className="text-[10px] sm:text-xs text-slate-600">รายงานสรุปผลการดำเนินงานและยอดการจัดเก็บประจำวัน</p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">วันที่ออกรายงาน: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ยอดเก็บสดวันนี้:</div>
                  <div className="font-mono font-bold text-emerald-600 text-sm sm:text-base">฿{todayCollectedCash.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ดอกเบี้ยเก็บแล้ว (+ค่าปรับ):</div>
                  <div className="font-mono font-bold text-purple-700 text-sm sm:text-base">฿{totalInterestCollected.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ทุนใหม่รอเก็บ:</div>
                  <div className="font-mono font-bold text-amber-600 text-sm sm:text-base">฿{totalActivePrincipal.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ยอดค้างรอเคลียร์:</div>
                  <div className="font-mono font-bold text-teal-600 text-sm sm:text-base">฿{totalPendingBalance.toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 mb-1.5 text-[11px]">รายการรับชำระเงินสดวันนี้ ({todayPayments.length} รายการ)</h4>
                {todayPayments.length === 0 ? (
                  <div className="text-slate-400 text-center py-3 bg-white rounded-lg border border-slate-200 text-[11px]">ยังไม่มีรายการรับชำระในวันนี้</div>
                ) : (
                  <table className="w-full border-collapse bg-white text-[11px]">
                    <thead>
                      <tr className="bg-purple-800 text-white">
                        <th className="p-1.5 border">บิล</th>
                        <th className="p-1.5 border">ลูกค้า</th>
                        <th className="p-1.5 border text-right">ยอดรับ</th>
                        <th className="p-1.5 border text-right">ดอกเบี้ย/ค่าปรับ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayPayments.map((p, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-1.5 border font-mono">{p.bill_code}</td>
                          <td className="p-1.5 border">{p.full_name}</td>
                          <td className="p-1.5 border text-right font-mono font-bold text-emerald-700">฿{Number(p.payment_amount || p.amount || 0).toLocaleString()}</td>
                          <td className="p-1.5 border text-right font-mono text-slate-600">฿{(Number(p.interest_paid || 0) + Number(p.fine_amount || 0)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex gap-2 shrink-0 pt-1">
              <button 
                onClick={handlePrintReport}
                className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ / บันทึก PDF</span>
              </button>
              <button 
                onClick={() => setDailyReportModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice Bill Modal */}
      {noticeModalOpen && noticeLoan && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white border border-rose-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-xl w-full space-y-3 shadow-2xl relative my-auto text-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-rose-100 pb-2.5 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-rose-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" />
                <span>ออกบิลแจ้งยอดค้างชำระ (NOTICE)</span>
              </h3>
              <button onClick={() => setNoticeModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-2.5 shadow-inner w-full max-w-[420px] mx-auto box-border" ref={noticePrintRef}>
                <div className="text-center border-b border-rose-200 pb-2">
                  <h2 className="text-sm sm:text-base font-black text-rose-900">แจ้งยอดค้างชำระ (NOTICE)</h2>
                  <p className="text-[9px] text-slate-500">ระบบบริหารจัดการสินเชื่อออนไลน์</p>
                </div>

                <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500 font-semibold">รหัสบิล:</span> <span className="font-mono font-bold text-slate-900">{noticeLoan.bill_code}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-semibold">ชื่อลูกค้า:</span> <span className="font-bold text-slate-900">{noticeLoan.full_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-semibold">เบอร์โทร:</span> <span className="font-mono text-slate-900">{noticeLoan.phone || '-'}</span></div>
                  
                  <div className="border-t border-rose-200 pt-1 flex justify-between items-center">
                    <span className="text-slate-700 font-bold text-xs">ยอดค้างชำระคงเหลือ:</span>
                    <input 
                      type="number"
                      value={customNoticeAmount}
                      onChange={(e) => setCustomNoticeAmount(e.target.value)}
                      className="w-28 text-right font-mono font-black text-rose-600 text-sm sm:text-base bg-white border border-rose-300 rounded-lg p-1 outline-none"
                    />
                  </div>
                </div>

                {adminBankList.length > 0 && (
                  <div className="space-y-1 bg-purple-50 p-2 rounded-xl border border-purple-200">
                    <label className="text-[10px] text-purple-900 font-bold block">📁 เลือกบัญชีแอดมินที่เคยกรอกไว้:</label>
                    <select
                      onChange={(e) => {
                        const idx = e.target.value;
                        if (idx !== '') {
                          setNoticeForm(adminBankList[idx]);
                        }
                      }}
                      className="w-full border border-purple-300 rounded-lg p-1.5 text-xs bg-white font-semibold outline-none text-slate-800"
                    >
                      <option value="">-- คลิกเพื่อเลือกบัญชีเดิม --</option>
                      {adminBankList.map((b, i) => (
                        <option key={i} value={i}>
                          {b.bank_name} ({b.account_number}) - {b.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5 bg-white border border-slate-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-slate-700">ข้อมูลบัญชีสำหรับโอนชำระ / สแกนจ่าย</div>
                  
                  <div className="flex flex-col sm:flex-row gap-2.5 items-center">
                    <div className="flex-1 space-y-1 w-full text-xs">
                      <div>
                        <label className="text-[9px] text-slate-500 font-semibold">ธนาคาร:</label>
                        <select
                          value={noticeForm.bank_name}
                          onChange={(e) => setNoticeForm({...noticeForm, bank_name: e.target.value})}
                          className="w-full border border-slate-300 rounded-lg p-1 font-bold text-xs bg-slate-50 outline-none text-slate-800"
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
                        <label className="text-[9px] text-slate-500 font-semibold">เลขบัญชี:</label>
                        <input 
                          type="text" placeholder="xxx-x-xxxxx-x"
                          value={noticeForm.account_number}
                          onChange={(e) => setNoticeForm({...noticeForm, account_number: e.target.value})}
                          className="w-full border border-slate-300 rounded-lg p-1 font-mono font-bold text-xs bg-slate-50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-semibold">ชื่อบัญชี:</label>
                        <input 
                          type="text" placeholder="ชื่อ-นามสกุลเจ้าของบัญชี"
                          value={noticeForm.account_name}
                          onChange={(e) => setNoticeForm({...noticeForm, account_name: e.target.value})}
                          className="w-full border border-slate-300 rounded-lg p-1 font-bold text-xs bg-slate-50 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-20 h-20 border border-dashed border-slate-300 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center relative">
                        {noticeForm.qr_code_image ? (
                          <img src={noticeForm.qr_code_image} alt="QR Code" className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-center p-1 text-[8px] text-slate-400">อัปโหลด QR</div>
                        )}
                      </div>
                      <label className="text-[9px] text-rose-700 font-bold hover:underline cursor-pointer">
                        เปลี่ยนไฟล์
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
              </div>
            </div>

            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
              <div ref={hiddenCaptureRef} style={{ width: '450px', height: '540px', background: '#ffffff', padding: '16px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#1e293b' }}>
                <div style={{ textAlign: 'center', borderBottom: '1px solid #f43f5e', paddingBottom: '10px', marginBottom: '12px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#881337', margin: 0 }}>แจ้งยอดค้างชำระ (NOTICE)</h2>
                  <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0 0' }}>ระบบบริหารจัดการสินเชื่อออนไลน์</p>
                </div>

                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px', marginBottom: '12px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>รหัสบิล:</span> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>{noticeLoan.bill_code}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>ชื่อลูกค้า:</span> <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{noticeLoan.full_name}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 'bold' }}>เบอร์โทร:</span> <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{noticeLoan.phone || '-'}</span></div>
                  
                  <div style={{ borderTop: '1px solid #fecdd3', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '12px' }}>ยอดค้างชำระคงเหลือ:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#e11d48', fontSize: '16px' }}>฿{Number(customNoticeAmount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: '11px' }}>
                    <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>ข้อมูลบัญชีสำหรับโอนชำระ / สแกนจ่าย</div>
                    <div style={{ marginBottom: '4px' }}><span style={{ color: '#64748b' }}>ธนาคาร:</span> <strong style={{ color: '#0f172a' }}>{noticeForm.bank_name || '-'}</strong></div>
                    <div style={{ marginBottom: '4px' }}><span style={{ color: '#64748b' }}>เลขบัญชี:</span> <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{noticeForm.account_number || '-'}</strong></div>
                    <div><span style={{ color: '#64748b' }}>ชื่อบัญชี:</span> <strong style={{ color: '#0f172a' }}>{noticeForm.account_name || '-'}</strong></div>
                  </div>

                  <div style={{ width: '90px', height: '90px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {noticeForm.qr_code_image ? (
                      <img src={noticeForm.qr_code_image} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '9px', color: '#94a3b8' }}>ไม่มี QR</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0 pt-1">
              <button 
                onClick={handleDownloadNoticeImage}
                className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>📥 ดาวน์โหลด</span>
              </button>
              <button 
                onClick={handleShareNoticeImage}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>📤 แชร์</span>
              </button>
              <button 
                onClick={() => setNoticeModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📌 เรียกใช้งาน Component กลาง CustomerDetail */}
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
            setPaymentAmount('');
            setFineAmount('');
            setDiscountAmount('');
            setPaymentNote('');
            setPaymentModalOpen(true);
          }}
        />
      )}

      {/* New Loan Modal */}
      {newLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 z-50 overflow-y-auto">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 sm:p-4 max-w-sm w-full space-y-2.5 text-slate-800 my-auto shadow-2xl max-h-[85vh] overflow-y-auto relative text-xs">
            
            <div className="flex justify-between items-center border-b border-emerald-200 pb-1.5">
              <h3 className="font-black text-emerald-900 text-sm">📝 บันทึกรายการปล่อยกู้ใหม่</h3>
              <button type="button" onClick={() => setNewLoanModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveNewLoan} className="space-y-2">
              <div className="relative">
                <label className="font-semibold text-emerald-900 text-[11px]">ชื่อ-นามสกุลลูกค้า</label>
                <input 
                  type="text" required placeholder="พิมพ์ชื่อลูกค้า..."
                  value={newLoanData.full_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => setShowSearchSuggestions(true)}
                  className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-bold outline-none bg-white text-base sm:text-xs"
                />
                {showSearchSuggestions && customerSuggestions.filter(c => c.full_name.toLowerCase().includes((newLoanData.full_name || '').toLowerCase())).length > 0 && newLoanData.full_name.trim() !== '' && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-emerald-300 rounded-xl shadow-lg z-50 max-h-36 overflow-y-auto">
                    {customerSuggestions
                      .filter(c => c.full_name.toLowerCase().includes(newLoanData.full_name.toLowerCase()))
                      .map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setNewLoanData(prev => ({
                              ...prev,
                              full_name: item.full_name,
                              phone: item.phone || '',
                              facebook_link: item.facebook_link || '',
                              bank_name: item.bank_name || 'ธนาคารกสิกรไทย (KBANK)',
                              account_number: item.account_number || ''
                            }));
                            setShowSearchSuggestions(false);
                          }}
                          className="px-2.5 py-1.5 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex justify-between items-center text-[11px]"
                        >
                          <span className="font-bold text-emerald-950">{item.full_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{item.phone || 'ไม่มีเบอร์'}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="font-semibold text-emerald-900 text-[11px]">เบอร์โทร</label>
                  <input 
                    type="text" placeholder="08x-xxx-xxxx" 
                    value={newLoanData.phone} 
                    onChange={(e) => setNewLoanData({...newLoanData, phone: e.target.value})} 
                    className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-mono bg-white text-base sm:text-xs" 
                  />
                </div>
                <div>
                  <label className="font-semibold text-emerald-900 text-[11px]">Facebook</label>
                  <input 
                    type="text" placeholder="ลิงก์เฟสบุ๊ค..." 
                    value={newLoanData.facebook_link} 
                    onChange={(e) => setNewLoanData({...newLoanData, facebook_link: e.target.value})} 
                    className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-mono bg-white text-base sm:text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-200">
                <div className="space-y-0.5">
                  <label className="font-semibold text-emerald-900 text-[11px]">ธนาคารรับเงิน</label>
                  <select
                    value={newLoanData.bank_name} 
                    onChange={(e) => setNewLoanData({...newLoanData, bank_name: e.target.value})}
                    className="w-full border border-emerald-300 rounded-lg p-2 text-base sm:text-xs bg-white outline-none font-bold text-slate-900"
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
                <div className="space-y-0.5">
                  <label className="font-semibold text-emerald-900 text-[11px]">เลขบัญชี / พร้อมเพย์</label>
                  <input 
                    type="text" placeholder="เลขบัญชี..."
                    value={newLoanData.account_number} 
                    onChange={(e) => setNewLoanData({...newLoanData, account_number: e.target.value})}
                    className="w-full border border-emerald-300 rounded-lg p-2 text-base sm:text-xs font-mono font-bold outline-none bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-200">
                <div className="space-y-0.5">
                  <label className="font-semibold text-emerald-800 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3 h-3 text-emerald-600" /> วันที่กู้ / เริ่มสัญญา
                  </label>
                  <input 
                    type="date" required
                    value={newLoanData.loan_date}
                    onChange={(e) => setNewLoanData({...newLoanData, loan_date: e.target.value})}
                    className="w-full border border-emerald-400 bg-emerald-50/80 rounded-lg p-2 font-mono text-base sm:text-xs outline-none font-bold text-emerald-900"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="font-semibold text-amber-800 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3 h-3 text-amber-600" /> วันที่คาดว่าจะคืน
                  </label>
                  <input 
                    type="date" required
                    value={newLoanData.cycle_date}
                    onChange={(e) => setNewLoanData({...newLoanData, cycle_date: e.target.value})}
                    className="w-full border border-amber-300 bg-amber-50/60 rounded-lg p-2 font-mono text-base sm:text-xs outline-none font-bold text-amber-900"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-white/70 p-2 rounded-xl border border-emerald-200">
                <label className="font-semibold text-emerald-900 block text-[11px]">รอบการจ่าย / นัดเก็บเงิน</label>
                <select
                  value={['จ่ายทุกวัน', 'จ่ายทุกสิ้นเดือน'].includes(newLoanData.payment_schedule) ? newLoanData.payment_schedule : 'กำหนดช่วงวัน'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'กำหนดช่วงวัน') {
                      setNewLoanData({...newLoanData, payment_schedule: '1-10', schedule_start: '1', schedule_end: '10'});
                    } else {
                      setNewLoanData({...newLoanData, payment_schedule: val, schedule_start: '', schedule_end: ''});
                    }
                  }}
                  className="w-full border border-emerald-300 rounded-lg p-2 text-base sm:text-xs bg-white outline-none font-bold"
                >
                  <option value="จ่ายทุกวัน">จ่ายทุกวัน</option>
                  <option value="กำหนดช่วงวัน">กำหนดช่วงวัน (เช่น วันที่ 1 ถึง 10)</option>
                  <option value="จ่ายทุกสิ้นเดือน">จ่ายทุกสิ้นเดือน</option>
                </select>

                {!['จ่ายทุกวัน', 'จ่ายทุกสิ้นเดือน'].includes(newLoanData.payment_schedule) && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <input 
                      type="number" min="1" max="31" placeholder="เริ่ม"
                      value={newLoanData.schedule_start || ''}
                      onChange={(e) => {
                        const start = e.target.value;
                        const end = newLoanData.schedule_end || '';
                        setNewLoanData({...newLoanData, schedule_start: start, payment_schedule: `${start}-${end}`});
                      }}
                      className="w-1/2 border border-emerald-300 rounded-lg p-2 text-base sm:text-xs bg-white font-mono"
                    />
                    <span className="text-slate-500">ถึง</span>
                    <input 
                      type="number" min="1" max="31" placeholder="ถึง"
                      value={newLoanData.schedule_end || ''}
                      onChange={(e) => {
                        const start = newLoanData.schedule_start || '';
                        const end = e.target.value;
                        setNewLoanData({...newLoanData, schedule_end: end, payment_schedule: `${start}-${end}`});
                      }}
                      className="w-1/2 border border-emerald-300 rounded-lg p-2 text-base sm:text-xs bg-white font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="font-semibold text-emerald-900 text-[11px]">ประเภทรายการ</label>
                  <select
                    value={newLoanData.loan_type}
                    onChange={(e) => setNewLoanData({...newLoanData, loan_type: e.target.value})}
                    className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-bold bg-white text-base sm:text-xs"
                  >
                    <option value="ดอกลอย">ดอกลอย</option>
                    <option value="จบต้นดอก">จบต้นดอก</option>
                    <option value="ยอดค้างรอเคลียร์">ยอดค้างรอเคลียร์</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-emerald-900 text-[11px]">ยอดเงินต้น (บาท)</label>
                  <input 
                    type="number" required placeholder="เช่น 1000" 
                    value={newLoanData.principal_amount} 
                    onChange={(e) => setNewLoanData({...newLoanData, principal_amount: e.target.value})} 
                    className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-mono font-bold text-emerald-900 bg-white text-base sm:text-xs" 
                  />
                </div>
              </div>

              {newLoanData.loan_type === 'ดอกลอย' && (
                <div className="space-y-1.5">
                  <div>
                    <label className="font-semibold text-emerald-900 text-[11px]">ดอกเบี้ย (บาทต่อวัน)</label>
                    <input type="number" step="0.01" placeholder="เช่น 40" value={newLoanData.daily_interest || ''} onChange={(e) => setNewLoanData({...newLoanData, daily_interest: e.target.value})} className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-mono font-bold text-emerald-900 bg-white text-base sm:text-xs" />
                  </div>
                  <div className="bg-emerald-100/60 p-2 rounded-lg border border-emerald-200 flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="calc_next_day_checkbox"
                      checked={newLoanData.calc_next_day}
                      onChange={(e) => setNewLoanData({...newLoanData, calc_next_day: e.target.checked})}
                      className="w-4 h-4 text-emerald-600 rounded border-emerald-300 cursor-pointer shrink-0"
                    />
                    <label htmlFor="calc_next_day_checkbox" className="font-semibold text-emerald-950 cursor-pointer text-[11px]">
                      เริ่มนับดอกเบี้ย <span className="text-emerald-800 font-bold">"วันพรุ่งนี้"</span>
                    </label>
                  </div>
                </div>
              )}

              {newLoanData.loan_type === 'จบต้นดอก' && (
                <div className="grid grid-cols-2 gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-200">
                  <div>
                    <label className="font-semibold text-emerald-900 text-[11px]">ดอกเบี้ยรวม (บาท)</label>
                    <input type="number" placeholder="ดอกเบี้ยรวม..." value={newLoanData.total_interest} onChange={(e) => setNewLoanData({...newLoanData, total_interest: e.target.value})} className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-mono font-bold text-emerald-900 bg-white text-base sm:text-xs" />
                  </div>
                  <div>
                    <label className="font-semibold text-emerald-900 text-[11px]">จำนวนงวด</label>
                    <input type="number" placeholder="เช่น 10" value={newLoanData.installment_count} onChange={(e) => setNewLoanData({...newLoanData, installment_count: e.target.value})} className="w-full border border-emerald-300 rounded-lg p-2 mt-0.5 font-mono font-bold text-slate-700 bg-white text-base sm:text-xs" />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1.5 sticky bottom-0 bg-emerald-50 py-1">
                <button type="submit" className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-colors">
                  บันทึกข้อมูลเข้าสู่ระบบ
                </button>
                <button type="button" onClick={() => setNewLoanModalOpen(false)} className="px-4 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-colors">
                  ปิด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
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
                <label className="block text-slate-700 font-bold mb-1">ยอดเงินที่ชำระ (บาท)</label>
                <input 
                  type="number" 
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                  className="w-full border border-purple-200 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-purple-50/20 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ค่าปรับ</label>
                  <input 
                    type="number" 
                    step="any"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-purple-200 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-purple-50/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ส่วนลด</label>
                  <input 
                    type="number" 
                    step="any"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-purple-200 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-purple-50/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">หมายเหตุ</label>
                <input 
                  type="text" 
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="ชำระงวดประจำวัน..."
                  className="w-full border border-purple-200 rounded-xl px-3 py-2 text-base sm:text-xs outline-none focus:border-purple-600 bg-purple-50/20"
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
                  ยืนยันรับชำระ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editCustomerModalOpen && (
        <div className="fixed inset-0 bg-sky-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-sky-50 border-2 border-sky-600 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 text-slate-800 text-xs max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-sky-200 pb-2.5">
              <h3 className="font-black text-sky-900 text-sm flex items-center gap-1.5">
                <span>✏️</span> แก้ไขข้อมูลลูกค้าประจำบิล
              </h3>
              <button 
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

              <div className="pt-3 border-t border-sky-200 flex gap-2 justify-end">
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

      {/* Approval Modal */}
      {approvalModalOpen && selectedLoanForApproval && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 max-w-md w-full space-y-3 text-slate-900 relative shadow-2xl max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="font-bold text-xs sm:text-sm text-purple-800 truncate">อนุมัติคำขอกู้: {selectedLoanForApproval.full_name}</h3>
              <button type="button" onClick={() => setApprovalModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-[11px] space-y-1.5 text-slate-800">
              <p>📱 เบอร์โทร: <span className="text-purple-700 font-mono font-bold">{selectedLoanForApproval.phone || '-'}</span></p>
              
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-semibold">Facebook:</span>
                {selectedLoanForApproval.facebook_link ? (
                  <a 
                    href={selectedLoanForApproval.facebook_link.startsWith('http') ? selectedLoanForApproval.facebook_link : `https://${selectedLoanForApproval.facebook_link}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[10px] inline-flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  >
                    <span>🔗 ไปที่ Facebook ลูกค้า</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400">ไม่มีข้อมูล</span>
                )}
              </div>

              <p>💰 ยอดขอกู้: <span className="text-pink-600 font-bold font-mono">฿{Number(selectedLoanForApproval.principal_amount || 0).toLocaleString()}</span></p>
              <p>🏦 ธนาคาร: <span className="text-purple-900 font-semibold">{selectedLoanForApproval.bank_name} ({selectedLoanForApproval.account_number})</span></p>
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-purple-200 font-mono text-[10px]">
                <p>📅 วันกู้: <span className="font-bold text-slate-900">{selectedLoanForApproval.loan_date || selectedLoanForApproval.created_at?.split('T')[0] || '-'}</span></p>
                <p>📅 วันคืน: <span className="font-bold text-amber-700">{selectedLoanForApproval.cycle_date || '-'}</span></p>
              </div>
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
                    total_installments: approvalData.installment_count ? Number(approvalData.installment_count) : null,
                    payment_schedule: scheduleStr,
                    calc_next_day: approvalData.calc_next_day,
                    loan_date: selectedLoanForApproval.loan_date || new Date().toISOString().split('T')[0],
                    interest_start_date: new Date().toISOString().split('T')[0],
                  })
                  .eq('id', selectedLoanForApproval.id);

                if (error) throw error;
                alert('อนุมัติบิลและบันทึกเข้าสู่ระบบหลักสำเร็จ!');
                setApprovalModalOpen(false);
                if (typeof fetchData === 'function') fetchData();
              } catch (err) {
                alert('เกิดข้อผิดพลาด: ' + err.message);
              }
            }} className="space-y-2.5">
              
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">ประเภทรายการ</label>
                <select
                  value={approvalData.loan_type}
                  onChange={(e) => setApprovalData({...approvalData, loan_type: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 outline-none text-base sm:text-xs"
                >
                  <option value="ดอกลอย">ดอกลอย</option>
                  <option value="จบต้นดอก">จบต้นดอก</option>
                </select>
              </div>

              <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <label className="font-semibold text-slate-700 block">รอบการจ่าย / นัดเก็บเงิน</label>
                <select
                  value={['จ่ายทุกวัน', 'จ่ายทุกสิ้นเดือน'].includes(approvalData.payment_schedule) ? approvalData.payment_schedule : 'กำหนดช่วงวัน'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'กำหนดช่วงวัน') {
                      setApprovalData({...approvalData, payment_schedule: '1-10', schedule_start: '1', schedule_end: '10'});
                    } else {
                      setApprovalData({...approvalData, payment_schedule: val, schedule_start: '', schedule_end: ''});
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs text-slate-900 outline-none font-bold"
                >
                  <option value="จ่ายทุกวัน">จ่ายทุกวัน</option>
                  <option value="กำหนดช่วงวัน">กำหนดช่วงวัน (เช่น 1 ถึง 10)</option>
                  <option value="จ่ายทุกสิ้นเดือน">จ่ายทุกสิ้นเดือน</option>
                </select>

                {!['จ่ายทุกวัน', 'จ่ายทุกสิ้นเดือน'].includes(approvalData.payment_schedule) && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <input 
                      type="number" min="1" max="31" placeholder="เริ่ม"
                      value={approvalData.schedule_start || ''}
                      onChange={(e) => {
                        const start = e.target.value;
                        const end = approvalData.schedule_end || '';
                        setApprovalData({...approvalData, schedule_start: start, payment_schedule: `${start}-${end}`});
                      }}
                      className="w-1/2 bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs text-slate-900 font-mono"
                    />
                    <span className="text-slate-500">ถึง</span>
                    <input 
                      type="number" min="1" max="31" placeholder="ถึง"
                      value={approvalData.schedule_end || ''}
                      onChange={(e) => {
                        const start = approvalData.schedule_start || '';
                        const end = e.target.value;
                        setApprovalData({...approvalData, schedule_end: end, payment_schedule: `${start}-${end}`});
                      }}
                      className="w-1/2 bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs text-slate-900 font-mono"
                    />
                  </div>
                )}
              </div>

              {approvalData.loan_type === 'ดอกลอย' && (
                <>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-0.5">ดอกเบี้ย (บาทต่อวัน)</label>
                    <input 
                      type="number" step="0.01" required placeholder="เช่น 40" 
                      value={approvalData.daily_interest} 
                      onChange={(e) => setApprovalData({...approvalData, daily_interest: e.target.value})} 
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono font-bold text-purple-700 outline-none text-base sm:text-xs" 
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input 
                      type="checkbox"
                      id="admin_calc_next_day"
                      checked={approvalData.calc_next_day}
                      onChange={(e) => setApprovalData({...approvalData, calc_next_day: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 cursor-pointer shrink-0"
                    />
                    <label htmlFor="admin_calc_next_day" className="font-semibold text-slate-700 cursor-pointer text-[11px]">
                      เริ่มนับดอกเบี้ย <span className="text-pink-600 font-bold">"วันพรุ่งนี้"</span>
                    </label>
                  </div>
                </>
              )}

              {approvalData.loan_type === 'จบต้นดอก' && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-0.5">ดอกเบี้ยรวม</label>
                    <input type="number" placeholder="ดอกเบี้ยรวม..." value={approvalData.total_interest} onChange={(e) => setApprovalData({...approvalData, total_interest: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-base sm:text-xs text-slate-900 outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-0.5">จำนวนงวด</label>
                    <input type="number" placeholder="เช่น 10" value={approvalData.installment_count} onChange={(e) => setApprovalData({...approvalData, installment_count: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-base sm:text-xs text-slate-900 outline-none" />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                >
                  ✅ อนุมัติ
                </button>
                
                <button 
                  type="button"
                  onClick={async () => {
                    if (confirm(`คุณต้องการปฏิเสธและลบคำขอกู้ของ ${selectedLoanForApproval.full_name} ออกจากระบบใช่หรือไม่?`)) {
                      try {
                        await supabase.from('payments').delete().eq('loan_id', selectedLoanForApproval.id);
                        const { error } = await supabase
                          .from('loans')
                          .delete()
                          .eq('id', selectedLoanForApproval.id);

                        if (error) throw error;
                        alert('ลบคำขอกู้เรียบร้อยแล้ว');
                        setApprovalModalOpen(false);
                        if (typeof fetchData === 'function') fetchData();
                      } catch (err) {
                        alert('เกิดข้อผิดพลาด: ' + err.message);
                      }
                    }
                  }}
                  className="px-3.5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                >
                  ❌ ปฏิเสธ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}