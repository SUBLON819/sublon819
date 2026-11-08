'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, DollarSign, User, CreditCard, CheckCircle, Phone, ShieldCheck, MapPin, Upload, ArrowRight, Loader2, Globe, AlertTriangle } from 'lucide-react';

// 📌 ฟังก์ชันดึงวันที่ปัจจุบัน (YYYY-MM-DD) ตามเวลาประเทศไทยแบบเรียลไทม์
function getThaiTodayString() {
  const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

export default function ApplyPage() {
  const [step, setStep] = useState('otp'); // 'otp', 'verify_otp', 'gps', 'form'
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  
  const [isOldCustomer, setIsOldCustomer] = useState(false);
  const [location, setLocation] = useState({ lat: null, lng: null, status: 'ยังไม่ได้ระบุพิกัด' });
  const [locationError, setLocationError] = useState(false);

  // 🔒 State สำหรับจัดการข้อมูลธีมและสถานะจากหลังบ้าน (Supabase)
  const [isSystemOpen, setIsSystemOpen] = useState(true);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [siteConfig, setSiteConfig] = useState({
    banner_title: 'สมัครขอสินเชื่อออนไลน์ SUBLON819',
    banner_subtitle: 'อนุมัติไว ได้เงินจริง ขั้นตอนง่ายๆ ในไม่กี่นาที',
    theme_color: 'purple',
    line_contact: '@682clwce',
  });

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
    const todayThai = getThaiTodayString();
    setFormData(prev => ({ 
      ...prev, 
      loan_date: todayThai, 
      cycle_date: todayThai 
    }));
    fetchSiteSettings();
  }, []);

  // 🔍 ฟังก์ชันดึงการตั้งค่าจาก Supabase
  const fetchSiteSettings = async () => {
    setCheckingSystem(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');
      
      if (data && !error) {
        let configObj = {};
        data.forEach(item => {
          if (item.key === 'is_frontend_open') {
            setIsSystemOpen(item.value !== 'false');
          }
          if (item.key === 'banner_title') configObj.banner_title = item.value;
          if (item.key === 'banner_subtitle') configObj.banner_subtitle = item.value;
          if (item.key === 'theme_color') configObj.theme_color = item.value;
          if (item.key === 'line_contact') configObj.line_contact = item.value;
        });

        setSiteConfig(prev => ({ ...prev, ...configObj }));
      }
    } catch (err) {
      console.error('Error fetching system settings:', err.message);
    } finally {
      setCheckingSystem(false);
    }
  };

  // ฟังก์ชันจับคู่ธีมสี
  const getThemeClasses = (color) => {
    switch (color) {
      case 'indigo':
        return {
          bg: 'from-indigo-950 via-slate-900 to-indigo-900',
          badge: 'bg-indigo-600',
          button: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500',
          headerBg: 'bg-[#1E1B4B]',
        };
      case 'pink':
        return {
          bg: 'from-rose-950 via-slate-900 to-pink-900',
          badge: 'bg-pink-600',
          button: 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500',
          headerBg: 'bg-[#581C87]',
        };
      default:
        return {
          bg: 'from-purple-950 via-slate-900 to-indigo-950',
          badge: 'bg-purple-600',
          button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500',
          headerBg: 'bg-[#232159]',
        };
    }
  };

  const theme = getThemeClasses(siteConfig.theme_color);

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
    setLocationError(false);

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

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
        setLocationError(true);
      },
      options
    );
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    const todayThai = getThaiTodayString();

    if (formData.loan_date < todayThai) {
      alert('ไม่อนุญาตให้เลือกวันที่กู้ย้อนหลังได้ กรุณาเลือกวันที่ปัจจุบัน');
      return;
    }

    if (!formData.cycle_date) {
      alert('กรุณากรอกวันที่กำหนดคืน (วันคืน) ก่อนกดส่งคำขอครับ');
      return;
    }

    if (formData.cycle_date <= formData.loan_date) {
      alert('กรุณากำหนดวันคืน (วันที่กำหนดคืน) ให้มากกว่าวันที่กู้ครับ');
      return;
    }

    setLoading(true);
    try {
      let fileUrl = null;

      if (!isOldCustomer && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${phone}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) {
          throw new Error('อัปโหลดไฟล์ไม่สำเร็จ: ' + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        fileUrl = publicUrlData.publicUrl;
      }

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
        id_card_url: fileUrl,
      }]);

      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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

  if (!isSystemOpen) {
    return (
      <div className="min-h-screen bg-[#F5F7FC] flex items-center justify-center p-4 font-sans text-[#2D3748]">
        <div className="bg-white border border-[#D0D9EB] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-red-100 text-[#D93838] rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#232159]">ปิดปรับปรุงชั่วคราว</h2>
          <p className="text-xs sm:text-sm text-slate-600">
            ขณะนี้ระบบปิดรับสมัครคำขอกู้ยืมชั่วคราวโดยผู้ดูแลระบบ กรุณาติดต่อแอดมินผ่าน LINE: <span className="font-bold">{siteConfig.line_contact}</span>
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-md"
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
          <h2 className="text-xl sm:text-2xl font-bold text-[#232159]">ส่งคำขอกู้สำเร็จครบทุกขั้นตอน!</h2>
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
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} flex items-center justify-center p-2 sm:p-6 font-sans text-white relative overflow-x-hidden transition-all duration-500`}>
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl max-w-md w-full shadow-2xl relative z-10 overflow-hidden">
        
        {/* Header (เอาพิลกซิล/ป้ายซ้ำซ้อนออก เหลือหัวข้อเด่นหัวข้อเดียว) */}
        <div className={`${theme.headerBg} text-white p-5 sm:p-6 text-center space-y-1.5 border-b border-white/10 transition-colors duration-300`}>
          <h1 className="text-lg sm:text-2xl font-black tracking-wider leading-tight">
            {siteConfig.banner_title}
          </h1>
          <p className="text-xs text-slate-200">
            {siteConfig.banner_subtitle}
          </p>
        </div>

        <div className="p-3.5 sm:p-6 space-y-3 text-slate-200">
          
          {/* STEP 1: OTP */}
          {step === 'otp' && (
            <form onSubmit={handleRequestOtp} className="space-y-3">
              <div className="text-[11px] font-bold text-white bg-white/10 px-3 py-2.5 rounded-xl border border-white/10 flex items-center gap-2">
                <span className={`w-4 h-4 ${theme.badge} text-white rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold`}>1</span>
                <span>ยืนยันเบอร์โทรศัพท์ (ระบบตรวจสอบลูกค้าเก่าอัตโนมัติ)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>เบอร์โทรศัพท์มือถือ</span>
                </label>
                <input 
                  type="tel" required placeholder="08x-xxx-xxxx"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-base text-white placeholder-slate-500 outline-none focus:border-purple-400 transition-all font-mono"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full py-3 ${theme.button} text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังตรวจสอบเบอร์โทร...</span>
                  </>
                ) : (
                  <>
                    <span>ขอรหัส OTP ผ่านแอดมิน</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 'verify_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div className="text-[11px] font-bold text-white bg-white/10 px-3 py-2.5 rounded-xl border border-white/10">
                {isOldCustomer ? '👤 ตรวจพบข้อมูลลูกค้าเก่า ดึงข้อมูลเดิมให้อัตโนมัติ!' : '✨ ลูกค้าใหม่ กรอกรหัส OTP ที่ส่งไปยัง Telegram แอดมิน'} (เบอร์ {phone})
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>รหัส OTP 6 หลัก</span>
                </label>
                <input 
                  type="text" required maxLength={6} placeholder="------"
                  value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-center text-base tracking-widest text-white font-bold outline-none focus:border-purple-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setStep('otp')} className="w-1/3 py-2.5 bg-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-white/20 transition-all cursor-pointer">ย้อนกลับ</button>
                <button type="submit" className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer">
                  <span>ยืนยันรหัส OTP</span>
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: พิกัด GPS พร้อมคำแนะนำเหตุผลและวิธีแก้ไข */}
          {step === 'gps' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-white bg-white/10 px-3 py-2.5 rounded-xl border border-white/10 flex items-center gap-2">
                <span className={`w-4 h-4 ${theme.badge} text-white rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold`}>2</span>
                <span>ระบุพิกัดตำแหน่ง GPS ปัจจุบัน</span>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center space-y-3">
                <MapPin className="w-8 h-8 text-purple-400 mx-auto animate-pulse" />
                <p className="text-xs text-slate-300">ระบบต้องการเข้าถึงพิกัดตำแหน่งของคุณเพื่อใช้ประกอบการอนุมัติสินเชื่อ</p>
                
                {/* 📌 คำแนะนำ/สาเหตุเบื้องต้นที่มักทำให้ระบุพิกัดไม่ได้ */}
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-left space-y-1.5 text-[11px] text-amber-200">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>ทำไมบางครั้งถึงระบุพิกัดไม่ได้?</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    1. เปิดเว็บผ่านแอป Facebook / LINE (ทำให้ระบบบล็อกพิกัด)<br/>
                    2. ปิดบริการระบุตำแหน่ง (Location) ในมือถือ<br/>
                    3. เผลอกดปฏิเสธสิทธิ์ (Block) บนเบราว์เซอร์
                  </p>
                  <p className="text-purple-300 pt-1 font-semibold">
                    👉 <b>วิธีแก้เบื้องต้น:</b> แนะนำให้คัดลอกลิงก์ไปเปิดในแอป **Google Chrome** หรือ **Safari** โดยตรงครับ
                  </p>
                </div>

                <button 
                  type="button"
                  onClick={handleGetLocation}
                  disabled={loading}
                  className={`w-full py-3 ${theme.button} text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer`}
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

                {/* ปุ่มสำรอง: ใช้แอปถ่ายภาพหน้าบ้านแทน */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <p className="text-[11px] text-slate-300">หากลองแล้วยังไม่ได้ สามารถใช้แอปถ่ายภาพพิกัดแทนได้</p>
                  <button 
                    type="button"
                    onClick={() => {
                      setLocation({ lat: null, lng: null, status: 'ลูกค้าใช้ภาพถ่ายหน้าบ้านแทนพิกัด GPS' });
                      setStep('form');
                    }}
                    className="w-full py-2.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>ข้ามพิกัด & ใช้แอปถ่ายภาพหน้าบ้านแทน</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: กรอกข้อมูลฟอร์มหลัก */}
          {step === 'form' && (
            <form onSubmit={handleFinalSubmit} className="space-y-2.5">
              <div className="text-[11px] font-bold text-white bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-center">
                {isOldCustomer ? '👤 ข้อมูลลูกค้าเก่า (ไม่ต้องกรอก Facebook และไม่ต้องแนบภาพซ้ำ)' : '✨ กรอกข้อมูลกู้ & แนบเอกสารสำคัญ'}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>ชื่อ-นามสกุลจริง <span className="text-red-400">*</span></span>
                </label>
                <input 
                  type="text" required placeholder="กรอกชื่อ-นามสกุล..."
                  value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white placeholder-slate-500 outline-none focus:border-purple-400 font-bold"
                />
              </div>

              {!isOldCustomer && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>ลิงค์ Facebook ส่วนตัว <span className="text-red-400">*</span></span>
                  </label>
                  <input 
                    type="url" required placeholder="https://www.facebook.com/yourname"
                    value={formData.facebook_link} onChange={(e) => setFormData({...formData, facebook_link: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white placeholder-slate-500 outline-none focus:border-purple-400 font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>ยอดเงินที่ต้องการกู้/ยืม <span className="text-red-400">*</span></span>
                </label>
                <input 
                  type="number" required placeholder="เช่น 3000"
                  value={formData.principal_amount} onChange={(e) => setFormData({...formData, principal_amount: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-base text-emerald-400 font-bold placeholder-slate-500 outline-none focus:border-purple-400 font-mono"
                />
              </div>

              {/* วันที่กู้ & กำหนดคืน */}
              <div className="space-y-2.5 pt-1">
                <div className="bg-white/5 p-2 rounded-xl border border-white/10 space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>วันที่กู้ <span className="text-red-400">*</span> <span className="text-[10px] text-purple-300 font-normal">(ห้ามเลือกย้อนหลัง)</span></span>
                  </label>
                  <input 
                    type="date"
                    required
                    min={getThaiTodayString()}
                    value={formData.loan_date}
                    onChange={(e) => setFormData({...formData, loan_date: e.target.value})}
                    className="w-full bg-transparent text-base text-white outline-none font-mono py-1 px-1"
                  />
                </div>

                <div className="bg-red-500/10 p-2 rounded-xl border-2 border-red-500 shadow-sm space-y-1">
                  <label className="text-xs font-semibold text-red-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>กำหนดคืน <span className="text-red-400">*</span> <span className="text-[10px] text-red-300 font-normal">(บังคับวันคืนมากกว่าวันกู้)</span></span>
                  </label>
                  <input 
                    type="date"
                    required
                    min={formData.loan_date || getThaiTodayString()}
                    value={formData.cycle_date}
                    onChange={(e) => setFormData({...formData, cycle_date: e.target.value})}
                    className="w-full bg-transparent text-base text-white outline-none font-mono font-bold py-1 px-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>ธนาคารรับเงิน</span>
                  </label>
                  <select
                    value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white outline-none focus:border-purple-400 font-bold"
                  >
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">เลขบัญชี / พร้อมเพย์ <span className="text-red-400">*</span></label>
                  <input 
                    type="text" required placeholder="เลขบัญชี หรือเบอร์..."
                    value={formData.account_number} onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-base text-emerald-400 font-mono font-bold placeholder-slate-500 outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* แนบเอกสาร พร้อมคำแนะนำการใช้แอปพิกัด */}
              {!isOldCustomer ? (
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>แนบเอกสาร (บัตรประชาชน / ภาพถ่ายพิกัดหน้าบ้าน) <span className="text-red-400">*</span></span>
                  </label>
                  
                  {location.lat === null && (
                    <div className="bg-purple-500/10 border border-purple-500/30 p-2.5 rounded-xl text-[11px] text-purple-200 space-y-1">
                      <p className="font-bold">📱 คำแนะนำกรณีใช้ภาพถ่ายแทนพิกัด:</p>
                      <p className="text-slate-300 leading-relaxed">
                        โหลดแอปพลิเคชันระบุพิกัด/เวลา (เช่น <b>GPS Map Camera</b>) ถ่ายรูปหน้าบ้านแล้วนำภาพที่มีลายน้ำพิกัด/เวลามาแนบในช่องนี้แทนครับ
                      </p>
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <label className={`px-3 py-1.5 ${theme.badge} text-white rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0`}>
                      เลือกไฟล์
                      <input 
                        type="file" required
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden" 
                      />
                    </label>
                    <span className="text-xs text-slate-400 truncate text-right flex-1">{file ? file.name : 'ไม่ได้เลือกไฟล์ใด'}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xl text-xs text-emerald-400 text-center font-bold">
                  ✅ ลูกค้าเก่า: ใช้ข้อมูลเดิม ไม่ต้องแนบภาพซ้ำ
                </div>
              )}

              <div className="bg-white/5 border border-white/10 p-2 rounded-xl text-[10px] text-slate-300 leading-relaxed">
                💡 <strong>หมายเหตุ:</strong> "ข้าพเจ้ารับทราบว่าเงินกู้ยืมนี้ไม่ใช่รายได้ แต่เป็นเครดิตที่เอาไว้ใช้ในยามฉุกเฉิน..."
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-3 ${theme.button} text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer`}
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