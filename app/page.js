'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Search, Calendar, Plus, Wallet, Printer, User, Download, Share2, Trash2, ExternalLink, Clock, Bell, RotateCcw, Edit3
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

  // 📌 Modals States
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

  // 📌 Edit Customer Modal States
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');

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
  
  const totalAccruedInterestAll = loans
    .filter(l => l.status !== 'ถังขยะ' && l.status !== 'ปฏิเสธคำขอ')
    .reduce((sum, l) => sum + calculateAccruedInterest(l), 0);

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

  // 🗑️ ฟังก์ชันย้ายบิลไปถังขยะ (Soft Delete)
  const handleMoveToTrash = async (loanId, billCode) => {
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

  // ♻️ ฟังก์ชันกู้คืนบิลจากถังขยะ (Restore)
  const handleRestoreLoan = async (loanId, billCode) => {
    if (!confirm(`คุณต้องการกู้คืนบิลรหัส "${billCode}" กลับมาใช้งานใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'อนุมัติแล้ว' })
        .eq('id', loanId);

      if (error) throw error;
      alert('กู้คืนบิลสำเร็จ!');
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // ❌ ฟังก์ชันลบทิ้งถาวรจากถังขยะ
  const handlePermanentDelete = async (loanId, billCode) => {
    if (!confirm(`⚠️ คำเตือน: คุณต้องการลบบิลรหัส "${billCode}" ออกจากระบบอย่างถาวรใช่หรือไม่? (ไม่สามารถกู้คืนได้)`)) return;

    try {
      await supabase.from('payments').delete().eq('loan_id', loanId);
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;

      alert('ลบบิลออกจากระบบอย่างถาวรแล้ว!');
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // 📌 ฟังก์ชันบันทึกรายการปล่อยกู้ใหม่
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
        remaining_interest: 0,
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

  // 📌 ฟังก์ชันอนุมัติบิลที่รอตรวจสอบ
  const handleApproveLoan = async (e) => {
    e.preventDefault();
    if (!selectedLoanForApproval) return;

    try {
      const principal = Number(selectedLoanForApproval.principal_amount || 0);
      const interestStartDate = calculateInterestStartDate(selectedLoanForApproval.loan_date || todayStr, approvalData.calc_next_day);
      const scheduleStr = approvalData.payment_schedule === 'กำหนดช่วงวัน'
        ? `${approvalData.schedule_start}-${approvalData.schedule_end}`
        : approvalData.payment_schedule;

      const { error } = await supabase.from('loans').update({
        loan_type: approvalData.loan_type,
        daily_interest: approvalData.loan_type === 'ดอกลอย' ? Number(approvalData.daily_interest || 0) : 0,
        total_interest: approvalData.loan_type === 'จบต้นดอก' ? Number(approvalData.total_interest || 0) : 0,
        total_installments: Number(approvalData.installment_count || 0),
        payment_schedule: scheduleStr,
        calc_next_day: approvalData.calc_next_day,
        interest_start_date: interestStartDate,
        remaining_principal: principal,
        status: 'อนุมัติแล้ว'
      }).eq('id', selectedLoanForApproval.id);

      if (error) throw error;

      alert('อนุมัติสินเชื่อสำเร็จ!');
      setApprovalModalOpen(false);
      setSelectedLoanForApproval(null);
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการอนุมัติ: ' + err.message);
    }
  };

  // 📌 ฟังก์ชันบันทึกการแก้ไขข้อมูลส่วนตัวของลูกค้า
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

    if (filterTab === 'ถังขยะ') {
      return status === 'ถังขยะ';
    }

    if (status === 'ถังขยะ') return false;

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

  const trashCount = loans.filter(l => l.status === 'ถังขยะ').length;

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
        <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full">
          <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-md">
            <div className="text-slate-400 text-[11px] sm:text-xs font-semibold">ยอดเก็บสดวันนี้</div>
            <div className="text-sm sm:text-lg font-bold font-mono text-emerald-400 mt-0.5">฿{todayCollectedCash.toLocaleString()}</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-md">
            <div className="text-slate-400 text-[11px] sm:text-xs font-semibold">ดอกเบี้ยค้างสะสมรวม</div>
            <div className="text-sm sm:text-lg font-bold font-mono text-pink-400 mt-0.5">฿{Math.round(totalAccruedInterestAll).toLocaleString()}</div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['บิลรอเก็บ', 'ตัดยอดแล้ว', 'อนุมัติวันนี้', 'รออนุมัติ', 'ทั้งหมด', 'ถังขยะ'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterTab === tab 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {tab} 
              {tab === 'รออนุมัติ' && pendingApprovalCount > 0 ? `(${pendingApprovalCount})` : ''}
              {tab === 'ถังขยะ' && trashCount > 0 ? `(${trashCount})` : ''}
            </button>
          ))}
        </div>

        {/* Loans Table / Content Area */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-xs sm:text-sm text-purple-300">
              {filterTab === 'ถังขยะ' ? '🗑️ รายการบิลในถังขยะ' : `รายการสินเชื่อ`} ({filteredLoans.length})
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
                
                return (
                  <div key={loan.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-800/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-pink-400 font-mono text-xs">{loan.bill_code}</span>
                        <span className="text-white font-bold text-sm">{loan.full_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-semibold">{loan.loan_type}</span>
                        {loan.status === 'ถังขยะ' && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-300 font-bold">อยู่ในถังขยะ</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 space-x-3">
                        <span>📱 โทร: <strong className="text-slate-200">{loan.phone || '-'}</strong></span>
                        <span>💰 ต้นคงเหลือ: <strong className="text-amber-400 font-mono">฿{currentPrin.toLocaleString()}</strong></span>
                        <span>📈 ดอกสะสม: <strong className="text-pink-400 font-mono">฿{Math.round(accrued).toLocaleString()}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {loan.status === 'ถังขยะ' ? (
                        <>
                          <button
                            onClick={() => handleRestoreLoan(loan.id, loan.bill_code)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>กู้คืน</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(loan.id, loan.bill_code)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบถาวร</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {loan.status === 'รออนุมัติ' ? (
                            <button
                              onClick={() => {
                                setSelectedLoanForApproval(loan);
                                setApprovalData({
                                  loan_type: loan.loan_type || 'ดอกลอย',
                                  daily_interest: loan.daily_interest || '',
                                  total_interest: loan.total_interest || '',
                                  installment_count: loan.total_installments || '',
                                  payment_schedule: loan.payment_schedule || 'จ่ายทุกวัน',
                                  schedule_start: '',
                                  schedule_end: '',
                                  calc_next_day: loan.calc_next_day || false,
                                });
                                setApprovalModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow"
                            >
                              ตรวจสอบ/อนุมัติ
                            </button>
                          ) : (
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
                          )}

                          <button
                            onClick={() => {
                              setEditingLoanId(loan.id);
                              setEditName(loan.full_name || '');
                              setEditPhone(loan.phone || '');
                              setEditFacebook(loan.facebook_link || '');
                              setEditBankName(loan.bank_name || 'ธนาคารกสิกรไทย (KBANK)');
                              setEditAccountNumber(loan.account_number || '');
                              setEditCustomerModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลลูกค้า"
                          >
                            <Edit3 className="w-4 h-4 text-purple-300" />
                          </button>

                          <button
                            onClick={() => handleMoveToTrash(loan.id, loan.bill_code)}
                            className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="ย้ายไปถังขยะ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ==================== MODALS SECTION ==================== */}

      {/* 1️⃣ Payment Modal (รับชำระเงิน) */}
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

      {/* 2️⃣ New Loan Modal (สร้างบิลรายการใหม่) */}
      {newLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 max-w-lg w-full space-y-4 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-purple-300">บันทึกรายการปล่อยกู้ใหม่</h3>
              <button onClick={() => setNewLoanModalOpen(false)} className="font-bold cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveNewLoan} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-purple-300 font-semibold">ชื่อ-นามสกุล ลูกค้า</label>
                <input 
                  type="text" required placeholder="ระบุชื่อลูกค้า..."
                  value={newLoanData.full_name}
                  onChange={(e) => setNewLoanData({ ...newLoanData, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-purple-300 font-semibold">เบอร์โทรศัพท์</label>
                  <input 
                    type="text" placeholder="08x-xxx-xxxx"
                    value={newLoanData.phone}
                    onChange={(e) => setNewLoanData({ ...newLoanData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-purple-300 font-semibold">ประเภทสินเชื่อ</label>
                  <select 
                    value={newLoanData.loan_type}
                    onChange={(e) => setNewLoanData({ ...newLoanData, loan_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                  >
                    <option value="ดอกลอย">ดอกลอย</option>
                    <option value="จบต้นดอก">จบต้นดอก</option>
                    <option value="รอเคลียร์">รอเคลียร์</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-300 font-semibold">ยอดเงินต้น (บาท)</label>
                <input 
                  type="number" required placeholder="0"
                  value={newLoanData.principal_amount}
                  onChange={(e) => setNewLoanData({ ...newLoanData, principal_amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-mono font-bold text-amber-400 outline-none focus:border-purple-500"
                />
              </div>

              {newLoanData.loan_type === 'ดอกลอย' && (
                <div className="space-y-1">
                  <label className="text-xs text-purple-300 font-semibold">ดอกเบี้ยรายวัน (บาท/วัน)</label>
                  <input 
                    type="number" placeholder="0"
                    value={newLoanData.daily_interest}
                    onChange={(e) => setNewLoanData({ ...newLoanData, daily_interest: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-mono text-pink-400 outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow-lg mt-2">
                บันทึกปล่อยกู้ใหม่
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3️⃣ Approval Modal (ตรวจสอบ/อนุมัติบิล) */}
      {approvalModalOpen && selectedLoanForApproval && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-amber-400">ตรวจสอบและอนุมัติบิล ({selectedLoanForApproval.bill_code})</h3>
              <button onClick={() => setApprovalModalOpen(false)} className="font-bold cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleApproveLoan} className="space-y-3">
              <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div>ลูกค้า: <span className="font-bold text-white">{selectedLoanForApproval.full_name}</span></div>
                <div>เงินต้น: <span className="font-mono font-bold text-amber-400">฿{Number(selectedLoanForApproval.principal_amount || 0).toLocaleString()}</span></div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-300 font-semibold">ประเภทสินเชื่อ</label>
                <select 
                  value={approvalData.loan_type}
                  onChange={(e) => setApprovalData({ ...approvalData, loan_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                >
                  <option value="ดอกลอย">ดอกลอย</option>
                  <option value="จบต้นดอก">จบต้นดอก</option>
                  <option value="รอเคลียร์">รอเคลียร์</option>
                </select>
              </div>

              {approvalData.loan_type === 'ดอกลอย' && (
                <div className="space-y-1">
                  <label className="text-xs text-purple-300 font-semibold">ดอกเบี้ยรายวัน (บาท)</label>
                  <input 
                    type="number" placeholder="0"
                    value={approvalData.daily_interest}
                    onChange={(e) => setApprovalData({ ...approvalData, daily_interest: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm font-mono text-pink-400 outline-none"
                  />
                </div>
              )}

              <button type="submit" className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-lg mt-2">
                ยืนยันการอนุมัติสินเชื่อ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4️⃣ Edit Customer Modal (แก้ไขข้อมูลลูกค้า) */}
      {editCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-purple-300">แก้ไขข้อมูลลูกค้า</h3>
              <button onClick={() => setEditCustomerModalOpen(false)} className="font-bold cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-purple-300 font-semibold">ชื่อ-นามสกุล</label>
                <input 
                  type="text" required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-300 font-semibold">เบอร์โทรศัพท์</label>
                <input 
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-300 font-semibold">ลิงก์ Facebook</label>
                <input 
                  type="text"
                  value={editFacebook}
                  onChange={(e) => setEditFacebook(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-lg mt-2">
                บันทึกการแก้ไขข้อมูล
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5️⃣ Daily Report Modal (พิมพ์รายงานประจำวัน) */}
      {dailyReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 max-w-2xl w-full space-y-4 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-purple-300">รายงานสรุปประจำวัน</h3>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintReport} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer">พิมพ์รายงาน</button>
                <button onClick={() => setDailyReportModalOpen(false)} className="font-bold cursor-pointer text-slate-400 hover:text-white">✕</button>
              </div>
            </div>

            <div ref={reportRef} className="bg-white text-slate-800 p-6 rounded-xl space-y-4 text-xs font-sans">
              <div className="text-center border-b pb-3">
                <h2 className="text-base font-bold text-purple-900">รายงานสรุปยอดประจำวัน วังทองล้น</h2>
                <p className="text-[11px] text-slate-500">วันที่ออกรายงาน: {selectedReportDate || todayStr}</p>
              </div>
              <div>
                <p><strong>ยอดเก็บสดรวมวันนี้:</strong> ฿{todayCollectedCash.toLocaleString()}</p>
                <p><strong>จำนวนรายการรับชำระวันนี้:</strong> {todayPayments.length} รายการ</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}