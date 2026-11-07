'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, DollarSign, User, CreditCard, FileText, CheckCircle, Phone, ShieldCheck, MapPin, Upload, ArrowRight, Loader2, Globe, AlertTriangle } from 'lucide-react';

export default function ApplyPage() {
  const [step, setStep] = useState('otp'); // 'otp', 'verify_otp', 'gps', 'form'
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  
  const [isOldCustomer, setIsOldCustomer] = useState(false);
  const [location, setLocation] = useState({ lat: null, lng: null, status: 'ยังไม่ได้ระบุพิกัด' });

  // 🔒 เพิ่ม State สำหรับตรวจสอบสถานะเปิด-ปิดระบบจากหน้าตั้งค่าหลังบ้าน
  const [isSystemOpen, setIsSystemOpen] = useState(true);
  const [checkingSystem, setCheckingSystem] = useState(true);

  // ปรับสถานะฟอร์มให้ cycle_date เป็นช่องวันที่ปฏิทินช่องเดียว
  const [formData, setFormData] = useState({
    full_name: '',
    facebook_link: '',
    principal_amount: '',
    loan_date: '',
    cycle_date: '',
    bank_name: 'ธนาคารกสิกรไทย (KBANK)',
    account_number: '',
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, loan_date: today, cycle_date: today }));
    checkSystemStatus(); // เรียกตรวจสอบสถานะระบบตอนโหลดหน้า
  }, []);

  // 🔍 ฟังก์ชันเช็กสถานะเปิด-ปิดระบบจาก Supabase
  const checkSystemStatus = async () => {
    setCheckingSystem(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'is_frontend_open')
        .single();
      
      if (data && data.value === 'false') {
        setIsSystemOpen(false);
      } else {
        setIsSystemOpen(true);
      }
    } catch (err) {
      console.error('Error checking system status:', err.message);
      setIsSystemOpen(true);
    } finally {
      setCheckingSystem(false);
    }
  };

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      alert('กรุณากรอกเบอร์โทรศัพท์มือถือให้ถูกต้อง');
      return;
    }
    setLoading(true);
    try {
      const { data: existingLoans, error: fetchError } = await supabase
        .from('loans')
        .select('*')
        .eq('phone', phone)
        .order('id', { ascending: false })
        .limit(1);

      let foundOld = false;
      if (!fetchError && existingLoans && existingLoans.length > 0) {
        const oldData = existingLoans[0];
        setFormData(prev => ({
          ...prev,
          full_name: oldData.full_name || '',
          facebook_link: oldData.facebook_link || '',
          bank_name: oldData.bank_name || prev.bank_name,
          account_number: oldData.account_number || '',
        }));
        foundOld = true;
        setIsOldCustomer(true);
      } else {
        setIsOldCustomer(false);
      }

      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);

      const botToken = '9203750510:AAFJhUvWRf4mOSozUSkz0I0I9Jca-xImuTo';
      const chatId = '1880260879';
      const customerTypeTag = foundOld ? '👤 [ลูกค้าเก่า]' : '✨ [ลูกค้าใหม่]';
      const message = `🚨 แจ้งเตือนคำขอ OTP ใหม่ (SUBLON819)\n${customerTypeTag}\n📱 เบอร์โทรศัพท์ลูกค้า: ${phone}\n🔑 รหัส OTP ของคุณคือ: ${mockOtp}`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      });

      alert(`ส่งรหัส OTP ไปยัง Telegram ของแอดมินเรียบร้อยแล้ว กรุณานำรหัส 6 หลักมากรอกครับ`);
      setStep('verify_otp');
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otpCode !== generatedOtp) {
      alert('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }
    alert('ยืนยันเบอร์โทรศัพท์สำเร็จ! ไปสู่ขั้นตอนที่ 2: ระบุพิกัด GPS');
    setStep('gps');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด GPS');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          status: `พิกัดสำเร็จ: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
        });
        setLoading(false);
        alert('ดึงพิกัด GPS สำเร็จ! ไปสู่ขั้นตอนที่ 3 & 4: กรอกข้อมูล');
        setStep('form');
      },
      (error) => {
        setLoading(false);
        alert('ไม่สามารถดึงพิกัด GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง: ' + error.message);
      }
    );
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('loans').insert([{
        bill_code: 'LN-' + Math.floor(100 + Math.random() * 900),
        full_name: formData.full_name,
        phone: phone,
        facebook_link: formData.facebook_link,
        loan_type: 'กำหนดช่วงวันที่',
        principal_amount: Number(formData.principal_amount),
        remaining_principal: Number(formData.principal_amount),
        installment_amount: Number(formData.principal_amount) * 0.1,
        status: 'รออนุมัติ',
        latitude: location.lat,
        longitude: location.lng,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        loan_date: formData.loan_date || null,
        cycle_date: formData.cycle_date || null,
      }]);

      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🛑 แสดงหน้าจอกำลังตรวจสอบ
  if (checkingSystem) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-4 font-sans text-[#2D3748]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#232159] mx-auto" />
          <p className="text-xs text-slate-500">กำลังตรวจสอบสถานะระบบ...</p>
        </div>
      </div>
    );
  }

  // 🛑 หากแอดมินกดปิดระบบจากหน้าตั้งค่าหลังบ้าน จะแสดงหน้าจอนี้และบล็อกทันที
  if (!isSystemOpen) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-4 font-sans text-[#2D3748]">
        <div className="bg-white border border-[#D0D9EB] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-red-100 text-[#D93838] rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#232159]">ปิดปรับปรุงชั่วคราว</h2>
          <p className="text-xs sm:text-sm text-slate-600">
            ขณะนี้ระบบปิดรับสมัครคำขอกู้ยืมชั่วคราวโดยผู้ดูแลระบบ กรุณาติดต่อแอดมินหรือกลับมาใหม่อีกครั้งในภายหลัง
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            รีเฟรชหน้าจอเพื่อตรวจสอบอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-4 font-sans text-[#2D3748]">
        <div className="bg-white border border-[#D0D9EB] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto animate-bounce" />
          <h2 className="text-xl sm:text-2xl font-bold text-[#232159]">ส่งคำขอกู้สำเร็จครบทั้ง 4 ขั้นตอน!</h2>
          <p className="text-xs sm:text-sm text-slate-600">ระบบบันทึกข้อมูลเข้าสู่ฐานข้อมูลเรียบร้อยแล้ว กรุณารอแอดมินตรวจสอบ</p>
          <button 
            onClick={() => { setSuccess(false); setStep('otp'); setPhone(''); setOtpCode(''); setLocation({ lat: null, lng: null, status: '' }); }}
            className="w-full py-3 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
          >
            กลับสู่หน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-3 sm:p-6 font-sans text-[#2D3748] relative overflow-x-hidden">
      {/* องค์ประกอบการ์ดฟอร์มหลัก ดีไซน์สไตล์ทางการ ชัดเจน สบายตา */}
      <div className="bg-white border border-[#D0D9EB] rounded-3xl max-w-md w-full shadow-xl relative z-10 overflow-hidden">
        
        {/* ส่วนหัว Header สีน้ำเงินกรมท่าเข้มตามภาพตัวอย่าง */}
        <div className="bg-[#232159] text-white p-6 text-center space-y-1 border-b-4 border-[#313875]">
          <h1 className="text-xl sm:text-2xl font-bold tracking-wider">
            SUBLON819
          </h1>
          <p className="text-[11px] text-[#EBF0FA] opacity-90">ระบบยื่นเอกสารอนุมัติยอดสินเชื่อออนไลน์ (ทางการ)</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {step === 'otp' && (
            <form onSubmit={handleRequestOtp} className="space-y-3">
              <div className="text-[11px] font-bold text-[#232159] bg-[#EBF0FA] px-3 py-2.5 rounded-xl border border-[#D0D9EB] flex items-center gap-2">
                <span className="w-4 h-4 bg-[#232159] text-white rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold">1</span>
                <span>ยืนยันเบอร์โทรศัพท์ (ระบบตรวจสอบลูกค้าเก่าอัตโนมัติ)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#313875] shrink-0" />
                  <span>เบอร์โทรศัพท์มือถือ</span>
                </label>
                <input 
                  type="tel" required placeholder="08x-xxx-xxxx"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-3 text-sm text-[#2D3748] outline-none focus:border-[#232159] transition-all font-mono"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3.5 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังตรวจสอบเบอร์โทร...</span>
                  </>
                ) : (
                  <>
                    <span>ขอรหัส OTP ผ่าน Telegram แอดมิน</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'verify_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div className="text-[11px] font-bold text-[#232159] bg-[#EBF0FA] px-3 py-2.5 rounded-xl border border-[#D0D9EB]">
                {isOldCustomer ? '👤 ตรวจพบข้อมูลลูกค้าเก่า ดึงข้อมูลเดิมให้อัตโนมัติ!' : '✨ ลูกค้าใหม่ กรอกรหัส OTP ที่ส่งไปยัง Telegram แอดมิน'} (เบอร์ {phone})
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>รหัส OTP 6 หลัก</span>
                </label>
                <input 
                  type="text" required maxLength={6} placeholder="------"
                  value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-3 text-center text-lg tracking-widest text-[#232159] font-bold outline-none focus:border-[#232159]"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setStep('otp')} className="w-1/3 py-3 bg-slate-200 text-[#2D3748] rounded-xl text-xs font-bold hover:bg-slate-300 transition-all cursor-pointer">ย้อนกลับ</button>
                <button type="submit" className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer">
                  <span>ยืนยันรหัส OTP</span>
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {step === 'gps' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-[#232159] bg-[#EBF0FA] px-3 py-2.5 rounded-xl border border-[#D0D9EB] flex items-center gap-2">
                <span className="w-4 h-4 bg-[#232159] text-white rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold">2</span>
                <span>ระบุพิกัดตำแหน่ง GPS ปัจจุบัน</span>
              </div>

              <div className="bg-[#F5F7FC] p-5 rounded-2xl border border-[#D0D9EB] text-center space-y-3">
                <MapPin className="w-10 h-10 text-[#232159] mx-auto animate-pulse" />
                <p className="text-xs text-slate-600">ระบบต้องการเข้าถึงพิกัดตำแหน่งของคุณเพื่อใช้ประกอบการอนุมัติสินเชื่อ</p>
                <p className="text-[11px] font-mono text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">{location.status}</p>
                <button 
                  type="button"
                  onClick={handleGetLocation}
                  disabled={loading}
                  className="w-full py-3.5 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังดึงพิกัด GPS...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>คลิกเพื่อแชร์พิกัด GPS ของคุณ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleFinalSubmit} className="space-y-3">
              <div className="text-[11px] font-bold text-[#232159] bg-[#EBF0FA] px-3 py-2 rounded-xl border border-[#D0D9EB] text-center">
                {isOldCustomer ? '👤 ข้อมูลลูกค้าเก่า (ไม่ต้องกรอก Facebook และไม่ต้องแนบภาพซ้ำ)' : '✨ กรอกข้อมูลกู้ & แนบเอกสารบัตรประชาชน'}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#313875] shrink-0" />
                  <span>ชื่อ-นามสกุลจริง <span className="text-[#D93838]">*</span></span>
                </label>
                <input 
                  type="text" required placeholder="กรอกชื่อ-นามสกุล..."
                  value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-xs text-[#2D3748] outline-none focus:border-[#232159]"
                />
              </div>

              {!isOldCustomer && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>ลิงค์ Facebook ส่วนตัว <span className="text-[#D93838]">*</span></span>
                  </label>
                  <input 
                    type="url" required placeholder="https://www.facebook.com/yourname"
                    value={formData.facebook_link} onChange={(e) => setFormData({...formData, facebook_link: e.target.value})}
                    className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-xs text-[#2D3748] outline-none focus:border-[#232159] font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>ยอดเงินที่ต้องการกู้ <span className="text-[#D93838]">*</span></span>
                </label>
                <input 
                  type="number" required placeholder="เช่น 3000"
                  value={formData.principal_amount} onChange={(e) => setFormData({...formData, principal_amount: e.target.value})}
                  className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-sm text-emerald-700 font-bold outline-none focus:border-[#232159]"
                />
              </div>

              {/* ช่องวันที่กู้ */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#313875] shrink-0" />
                  <span>วันที่กู้ <span className="text-[#D93838]">*</span></span>
                </label>
                <input 
                  type="date"
                  required
                  value={formData.loan_date}
                  onChange={(e) => setFormData({...formData, loan_date: e.target.value})}
                  className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-xs text-[#2D3748] outline-none focus:border-[#232159]"
                />
              </div>

              {/* ช่องวันที่คาดว่าจะคืน */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#313875] shrink-0" />
                  <span>วันที่คาดว่าจะคืน <span className="text-[#D93838]">*</span></span>
                </label>
                <input 
                  type="date"
                  required
                  value={formData.cycle_date}
                  onChange={(e) => setFormData({...formData, cycle_date: e.target.value})}
                  className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-xs text-[#2D3748] outline-none focus:border-[#232159]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#313875] shrink-0" />
                    <span>ธนาคารรับเงิน</span>
                  </label>
                  <select
                    value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-xs text-[#2D3748] outline-none focus:border-[#232159]"
                  >
                    <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                    <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                    <option value="ธนาคารกรุงศรีอยุธยา (Krungsri)">ธนาคารกรุงศรีอยุธยา (Krungsri)</option>
                    <option value="ธนาคารเกียรตินาคินภัทร (KKP)">ธนาคารเกียรตินาคินภัทร (KKP)</option>
                    <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                    <option value="ธนาคารออมสิน (GSB)">ธนาคารออมสิน (GSB)</option>
                    <option value="ธ.ก.ส. (BAAC)">ธ.ก.ส. (BAAC)</option>
                    <option value="ธนาคารกรุงเทพ (BBL)">ธนาคารกรุงเทพ (BBL)</option>
                    <option value="วอเลต">วอเลต (TrueMoney Wallet)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#232159]">เลขบัญชี / เบอร์พร้อมเพย์ <span className="text-[#D93838]">*</span></label>
                  <input 
                    type="text" required placeholder="เลขบัญชี หรือเบอร์..."
                    value={formData.account_number} onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                    className="w-full bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 text-xs text-emerald-700 font-mono font-bold outline-none focus:border-[#232159]"
                  />
                </div>
              </div>

              {!isOldCustomer ? (
                <div className="space-y-1 pt-1 border-t border-slate-200">
                  <label className="text-xs font-semibold text-[#232159] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#313875] shrink-0" />
                    <span>ขั้นตอนที่ 4: แนบเอกสารบัตรประชาชน (เฉพาะลูกค้าใหม่) <span className="text-[#D93838]">*</span></span>
                  </label>
                  <div className="bg-[#F5F7FC] border border-[#D0D9EB] rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <label className="px-3 py-1.5 bg-[#232159] hover:bg-[#313875] text-white rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0">
                      เลือกไฟล์
                      <input 
                        type="file" required
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden" 
                      />
                    </label>
                    <span className="text-xs text-slate-500 truncate text-right flex-1">{file ? file.name : 'ไม่ได้เลือกไฟล์ใด'}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs text-emerald-700 text-center font-bold">
                  ✅ ลูกค้าเก่า: ใช้ข้อมูลเดิม ไม่ต้องแนบภาพซ้ำ
                </div>
              )}

              <div className="bg-[#EBF0FA] border border-[#D0D9EB] p-2.5 rounded-xl text-[10px] text-slate-700 leading-relaxed">
                💡 <strong>หมายเหตุ:</strong> "ข้าพเจ้ารับทราบว่าเงินกู้ยืมนี้ไม่ใช่รายได้ แต่เป็นเครดิตที่เอาไว้ใช้ในยามฉุกเฉิน ข้าพเจ้าได้ไตร่ตรองอย่างถี่ถ้วนแล้วว่า มีความสามารถในการชำระคืนได้ตรงเวลาโดยไม่กระทบต่อการดำรงชีวิตประจำวัน และจะรักษาประวัติทางการเงิน (เครดิต) ของตนเองไว้อย่างดีที่สุด"
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังส่งข้อมูลเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <span>ยืนยันส่งคำขอกู้ยืมเงิน</span>
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
