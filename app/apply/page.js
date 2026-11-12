'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, DollarSign, User, CreditCard, CheckCircle, Phone, MapPin, Upload, ArrowRight, Loader2, Globe, AlertTriangle, Camera, RefreshCw } from 'lucide-react';
import liff from '@line/liff'; // 🟢 นำเข้า LIFF SDK

// 📌 ฟังก์ชันดึงวันที่ปัจจุบัน (YYYY-MM-DD) ตามเวลาประเทศไทยแบบปลอดภัย
function getThaiTodayString() {
  if (typeof window === 'undefined') return '';
  const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

// 📌 ฟังก์ชันดึงวันที่และเวลาปัจจุบันแบบ ISO / เรียลไทม์ตามเวลาประเทศไทย
function getThaiCurrentTimestamp() {
  if (typeof window === 'undefined') return new Date().toISOString();
  const now = new Date();
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now).replace(' ', 'T');
}

export default function ApplyPage() {
  const [step, setStep] = useState('phone'); // เริ่มต้นที่หน้ากรอกเบอร์โทรศัพท์ (ตัด OTP ออก)
  const [phone, setPhone] = useState('');
  
  // 🟢 State สำหรับเก็บ LINE UID ของลูกค้า
  const [customerLineId, setCustomerLineId] = useState('');

  const [isOldCustomer, setIsOldCustomer] = useState(false);
  const [location, setLocation] = useState({ lat: null, lng: null, status: 'ยังไม่ได้ระบุพิกัด' });
  const [locationError, setLocationError] = useState(false);

  // 🔒 State สำหรับจัดการข้อมูลธีมและสถานะจากหลังบ้าน (Supabase)
  const [isSystemOpen, setIsSystemOpen] = useState(true);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [siteConfig, setSiteConfig] = useState({
    banner_title: 'สมัครขอสินเชื่อออนไลน์ SUBLON819',
    banner_subtitle: 'อนุมัติไว ได้เงินจริง ขั้นตอนง่ายๆ ในไม่กี่นาที',
    theme_color: 'emerald',
    line_contact: '@306fgwvw',
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

  // 📸 State สำหรับระบบสแกนหน้าแบบเต็มจอ ถ่ายคู่บัตรประชาชน
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [autoCaptureStatus, setAutoCaptureStatus] = useState('กำลังเตรียมกล้อง...');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const todayThai = getThaiTodayString();
    setFormData(prev => ({ 
      ...prev, 
      loan_date: todayThai, 
      cycle_date: prev.cycle_date || todayThai 
    }));
    fetchSiteSettings();

    // 🟢 ผสานการทำงานร่วมกับ LINE LIFF SDK เพื่อดึง User ID อัตโนมัติ
    const initLiffAndGetProfile = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        
        if (liff.isInClient() || liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          if (profile && profile.userId) {
            setCustomerLineId(profile.userId);
            localStorage.setItem('sublon_line_user_id', profile.userId);
            return;
          }
        } else {
          liff.login();
          return;
        }
      } catch (err) {
        console.warn('LIFF initialization failed, falling back to URL/LocalStorage:', err);
      }

      const params = new URLSearchParams(window.location.search);
      let lineIdFromUrl = params.get('lineUserId');
      
      if (!lineIdFromUrl && typeof window !== 'undefined') {
        lineIdFromUrl = localStorage.getItem('sublon_line_user_id');
      }

      if (lineIdFromUrl) {
        setCustomerLineId(lineIdFromUrl);
        localStorage.setItem('sublon_line_user_id', lineIdFromUrl);
      }
    };

    initLiffAndGetProfile();
  }, []);

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

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      await fetchSiteSettings();
      alert('รีเฟรชข้อมูลปัจจุบันสำเร็จ!');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการรีเฟรช: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getThemeClasses = (color) => {
    switch (color) {
      case 'purple':
        return {
          pageBg: 'from-purple-950 via-slate-900 to-indigo-950 text-white',
          cardBg: 'bg-slate-900/90 text-slate-200 border-white/10',
          badge: 'bg-amber-500 text-purple-950 font-black',
          button: 'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white',
          headerBg: 'bg-[#4B1979] text-white',
          inputBg: 'bg-white/5 text-white border-white/10 placeholder-slate-500',
        };
      case 'pink':
        return {
          pageBg: 'from-pink-100 via-rose-50 to-pink-200 text-slate-800',
          cardBg: 'bg-white text-slate-800 border-pink-200 shadow-xl',
          badge: 'bg-pink-600 text-white font-bold',
          button: 'bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white shadow-md',
          headerBg: 'bg-[#E03E82] text-white',
          inputBg: 'bg-slate-50 text-slate-900 border-slate-200 placeholder-slate-400',
        };
      case 'yellow':
        return {
          pageBg: 'from-amber-100 via-yellow-50 to-orange-100 text-slate-900',
          cardBg: 'bg-white text-slate-900 border-[#FFCC00]/60 shadow-2xl',
          badge: 'bg-[#FFCC00] text-[#5C3D2E] font-black',
          button: 'bg-gradient-to-r from-[#5C3D2E] to-[#452D22] hover:from-[#452D22] hover:to-[#2C1D15] text-[#FFCC00] font-black shadow-md border border-[#FFCC00]/40',
          headerBg: 'bg-[#5C3D2E] text-[#FFCC00]',
          inputBg: 'bg-amber-50/40 text-slate-900 border-[#FFCC00]/60 focus:border-[#FFCC00] placeholder-slate-400',
        };
      case 'BangkokBank':
        return {
          pageBg: 'from-blue-950 via-slate-900 to-indigo-950 text-white',
          cardBg: 'bg-slate-900/95 text-slate-200 border-blue-500/30 shadow-2xl',
          badge: 'bg-blue-600 text-white font-bold',
          button: 'bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-md',
          headerBg: 'bg-[#003366] text-white',
          inputBg: 'bg-white/5 text-white border-blue-500/30 placeholder-slate-500',
        };
      case 'mystic':
        return {
          pageBg: 'from-stone-950 via-emerald-950 to-teal-950 text-stone-100',
          cardBg: 'bg-stone-900/95 text-stone-200 border-amber-500/30 shadow-2xl backdrop-blur-md',
          badge: 'bg-amber-500 text-stone-950 font-black',
          button: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black shadow-lg border border-amber-400/40',
          headerBg: 'bg-[#15291F] text-amber-300 border-b border-amber-500/20',
          inputBg: 'bg-stone-950/60 text-stone-100 border-amber-500/30 focus:border-amber-400 placeholder-stone-500',
        };
      case 'emerald':
      default:
        return {
          pageBg: 'from-emerald-950 via-slate-900 to-teal-950 text-white',
          cardBg: 'bg-slate-900/90 text-slate-200 border-white/10',
          badge: 'bg-emerald-600 text-white',
          button: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white',
          headerBg: 'bg-[#006435] text-white',
          inputBg: 'bg-white/5 text-white border-white/10 placeholder-slate-500',
        };
    }
  };

  const theme = getThemeClasses(siteConfig.theme_color);

  // 🚀 ฟังก์ชันตรวจสอบเบอร์โทรศัพท์และข้ามไปหน้าพิกัด GPS ทันที
  const handlePhoneSubmit = async (e) => {
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

      setStep('gps');
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
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
        setStep('form');
      },
      (error) => {
        setLoading(false);
        setLocationError(true);
      },
      options
    );
  };

  const handlePreSubmitForm = (e) => {
    e.preventDefault();
    const todayThai = getThaiTodayString();

    if (!formData.cycle_date) {
      alert('กรุณากรอกวันที่กำหนดคืน (วันคืน) ก่อนดำเนินการต่อครับ');
      return;
    }

    if (formData.cycle_date <= todayThai) {
      alert('กรุณากำหนดวันคืน (วันที่กำหนดคืน) ให้มากกว่าวันที่กู้ครับ');
      return;
    }

    setScanModalOpen(true);
    startCamera();
  };

  const startCamera = async () => {
    setCapturedImage(null);
    setAutoCaptureStatus('กำลังเปิดกล้อง (กรุณาถือบัตรประชาชนคู่ใบหน้าให้ชัดเจน)...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setAutoCaptureStatus('✨ กำลังจับภาพอัตโนมัติใน 3 วินาที...');
            
            setTimeout(() => {
              triggerAutoCapture();
            }, 3000);
          }).catch(err => {
            console.error("Video play error:", err);
            setAutoCaptureStatus('⚠️ กรุณากดปุ่มถ่ายภาพด้านล่าง');
          });
        };
      }
    } catch (err) {
      alert('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องในเบราว์เซอร์');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    setScanModalOpen(false);
  };

  const triggerAutoCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth || window.innerWidth;
      canvas.height = video.videoHeight || window.innerHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageUrl);
      setAutoCaptureStatus('✅ จับภาพอัตโนมัติสำเร็จ!');
    }
  };

  const handleFinalSubmit = async () => {
    if (!capturedImage) {
      alert('ยังไม่มีภาพถ่าย กรุณากดถ่ายภาพใหม่ครับ');
      return;
    }

    const todayThai = getThaiTodayString();
    setLoading(true);

    try {
      let fileUrl = null;
      let faceUrl = null;

      if (!isOldCustomer && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${phone}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('fin-docs')
          .upload(fileName, file);

        if (uploadError) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ: ' + uploadError.message);

        const { data: publicUrlData } = supabase.storage
          .from('fin-docs')
          .getPublicUrl(fileName);

        fileUrl = publicUrlData.publicUrl;
      }

      const faceBlobRes = await fetch(capturedImage);
      const faceBlob = await faceBlobRes.blob();
      const faceFileName = `face-id-${phone}-${Date.now()}.jpg`;
      
      const { error: faceUploadErr } = await supabase.storage
        .from('fin-docs')
        .upload(faceFileName, faceBlob);

      if (faceUploadErr) throw new Error('อัปโหลดภาพถ่ายคู่บัตรไม่สำเร็จ: ' + faceUploadErr.message);

      const { data: facePublicUrlData } = supabase.storage
        .from('fin-docs')
        .getPublicUrl(faceFileName);

      faceUrl = facePublicUrlData.publicUrl;

      // 🟢 บันทึกข้อมูลลง Supabase พร้อมส่ง line_user_id
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
        loan_date: todayThai,
        cycle_date: formData.cycle_date || null,
        id_card_url: fileUrl,
        face_image_url: faceUrl,
        line_user_id: customerLineId || null, 
        created_at: getThaiCurrentTimestamp(),
      }]);

      if (error) throw error;

      try {
        await fetch('/api/line-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.full_name,
            phone: phone,
            amount: formData.principal_amount,
            loanType: 'กำหนดช่วงวันที่ (กำหนดคืน: ' + formData.cycle_date + ')',
            bankName: formData.bank_name,
            accountNumber: formData.account_number,
            lineUserId: customerLineId || 'U3a5ab039fec1055bdbd7423678eecdf'
          })
        });
      } catch (lineErr) {
        console.error('Line notify background error:', lineErr);
      }

      stopCamera();
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
          <h2 className="text-xl sm:text-2xl font-bold text-[#232159]">ส่งคำขอกู้และภาพยืนยันตัวตนสำเร็จ!</h2>
          <p className="text-xs sm:text-sm text-slate-600">ระบบบันทึกข้อมูลและภาพถ่ายคู่บัตรประชาชนเรียบร้อยแล้ว กรุณารอแอดมินตรวจสอบ</p>
          <button 
            onClick={() => { setSuccess(false); setStep('phone'); setPhone(''); setLocation({ lat: null, lng: null, status: '' }); }}
            className="w-full py-3 bg-[#232159] hover:bg-[#313875] text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
          >
            กลับสู่หน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.pageBg} flex items-center justify-center p-2 sm:p-6 font-sans relative overflow-x-hidden transition-all duration-500`}>
      <div className={`${theme.cardBg} backdrop-blur-xl border rounded-3xl max-w-md w-full shadow-2xl relative z-10 overflow-hidden`}>
        
        {/* Header */}
        <div className={`${theme.headerBg} p-5 sm:p-6 text-center space-y-1.5 border-b border-black/10 transition-colors duration-300 relative`}>
          <button 
            type="button"
            onClick={handleRefreshData}
            disabled={loading}
            className="absolute top-4 right-4 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="รีเฟรชข้อมูลปัจจุบัน"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <h1 className="text-lg sm:text-2xl font-black tracking-wider leading-tight">
            {siteConfig.banner_title}
          </h1>
          <p className="text-xs opacity-90">
            {siteConfig.banner_subtitle}
          </p>
        </div>

        <div className="p-3.5 sm:p-6 space-y-3">
          
          {/* STEP 1: กรอกเบอร์โทรศัพท์ (ข้ามไปหน้าพิกัด GPS ทันที) */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div className="text-[11px] font-bold px-3 py-2.5 rounded-xl border border-black/10 bg-black/5 flex items-center gap-2">
                <span className={`w-4 h-4 ${theme.badge} rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold`}>1</span>
                <span>กรอกเบอร์โทรศัพท์มือถือ (ตรวจสอบลูกค้าเก่าอัตโนมัติ)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>เบอร์โทรศัพท์มือถือ</span>
                </label>
                <input 
                  type="tel" required placeholder="08x-xxx-xxxx"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className={`w-full ${theme.inputBg} border rounded-xl px-3.5 py-2.5 text-base outline-none transition-all font-mono`}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full py-3 ${theme.button} rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังตรวจสอบข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <span>ถัดไป: ระบุพิกัด GPS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center text-xs opacity-70 pt-2 border-t border-black/10 space-y-0.5">
                <p>สอบถามข้อมูลเพิ่มเติมผ่านเจ้าหน้าที่</p>
                <p>
                  LINE:{' '}
                  <a 
                    href="https://line.me/R/ti/p/@306fgwvw" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-mono font-bold underline transition-colors"
                  >
                    {siteConfig.line_contact}
                  </a>
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: พิกัด GPS */}
          {step === 'gps' && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold px-3 py-2.5 rounded-xl border border-black/10 bg-black/5 flex items-center gap-2">
                <span className={`w-4 h-4 ${theme.badge} rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold`}>2</span>
                <span>ระบุพิกัดตำแหน่ง GPS ปัจจุบัน ({phone})</span>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 bg-black/5 text-center space-y-3">
                <MapPin className="w-8 h-8 text-emerald-500 mx-auto animate-pulse" />
                <p className="text-xs opacity-80">ระบบต้องการเข้าถึงพิกัดตำแหน่งของคุณเพื่อใช้ประกอบการอนุมัติสินเชื่อ</p>
                
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-left space-y-1.5 text-[11px] text-amber-700 dark:text-amber-200">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>ทำไมบางครั้งถึงระบุพิกัดไม่ได้?</span>
                  </p>
                  <p className="opacity-90 leading-relaxed">
                    1. เปิดเว็บผ่านแอป Facebook / LINE (ทำให้ระบบบล็อกพิกัด)<br/>
                    2. ปิดบริการระบุตำแหน่ง (Location) ในมือถือ<br/>
                    3. เผลอกดปฏิเสธสิทธิ์ (Block) บนเบราว์เซอร์
                  </p>
                  <p className="pt-1 font-semibold">
                    👉 <b>วิธีแก้เบื้องต้น:</b> แนะนำให้คัดลอกลิงก์ไปเปิดในแอป **Google Chrome** หรือ **Safari** โดยตรงครับ
                  </p>
                </div>

                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setStep('phone')} 
                    className="w-1/3 py-3 bg-black/10 opacity-80 rounded-xl text-xs font-bold hover:opacity-100 transition-all cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  <button 
                    type="button"
                    onClick={handleGetLocation}
                    disabled={loading}
                    className={`w-2/3 py-3 ${theme.button} rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังดึงพิกัด...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>แชร์พิกัด GPS</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-black/10 space-y-2">
                  <p className="text-[11px] opacity-80">หากลองแล้วยังไม่ได้ สามารถใช้แอปถ่ายภาพพิกัดแทนได้</p>
                  <button 
                    type="button"
                    onClick={() => {
                      setLocation({ lat: null, lng: null, status: 'ลูกค้าใช้ภาพถ่ายหน้าบ้านแทนพิกัด GPS' });
                      setStep('form');
                    }}
                    className="w-full py-2.5 bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>ข้ามพิกัด & ใช้แอปถ่ายภาพหน้าบ้านแทน</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 & 4: กรอกข้อมูลฟอร์มหลัก */}
          {step === 'form' && (
            <form onSubmit={handlePreSubmitForm} className="space-y-2.5">
              <div className="text-[11px] font-bold px-3 py-2 rounded-xl border border-black/10 bg-black/5 text-center">
                {isOldCustomer ? '👤 ข้อมูลลูกค้าเก่า (ดึงข้อมูลเดิมให้ สามารถเปลี่ยนธนาคารและแก้ไขเลขบัญชีได้ทันที)' : '✨ กรอกข้อมูลกู้ & แนบเอกสารสำคัญ'}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>ชื่อ-นามสกุลจริง <span className="text-red-500">*</span></span>
                </label>
                <input 
                  type="text" required placeholder="กรอกชื่อ-นามสกุล..."
                  value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className={`w-full ${theme.inputBg} border rounded-xl px-3 py-2 text-sm sm:text-xs outline-none font-bold`}
                />
              </div>

              {!isOldCustomer && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>ลิงค์ Facebook ส่วนตัว <span className="text-red-500">*</span></span>
                  </label>
                  <input 
                    type="url" required placeholder="https://www.facebook.com/yourname"
                    value={formData.facebook_link} onChange={(e) => setFormData({...formData, facebook_link: e.target.value})}
                    className={`w-full ${theme.inputBg} border rounded-xl px-3 py-2 text-sm sm:text-xs outline-none font-mono`}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>ยอดเงินที่ต้องการกู้/ยืม <span className="text-red-500">*</span></span>
                </label>
                <input 
                  type="number" required placeholder="เช่น 3000"
                  value={formData.principal_amount} onChange={(e) => setFormData({...formData, principal_amount: e.target.value})}
                  className={`w-full ${theme.inputBg} border rounded-xl px-3 py-2 text-sm sm:text-xs font-bold outline-none font-mono`}
                />
              </div>

              {/* 🟢 ปรับช่องกำหนดคืนให้สั้นลงและกระชับ ทั้งบนมือถือและคอมพิวเตอร์ */}
              <div className="space-y-1">
                <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5 flex-wrap">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>กำหนดคืน <span className="text-red-500">*</span> <span className="text-[10px] opacity-75">(ต้องมากกว่าวันกู้)</span></span>
                </label>
                <div className="flex">
                  <input 
                    type="date"
                    required
                    min={formData.loan_date || ''}
                    value={formData.cycle_date}
                    onChange={(e) => setFormData({...formData, cycle_date: e.target.value})}
                    className={`w-auto inline-block ${theme.inputBg} border rounded-xl px-4 py-2 text-sm sm:text-xs outline-none font-mono font-bold cursor-pointer text-white`}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>ธนาคารรับเงิน (เปลี่ยนได้)</span>
                  </label>
                  <select
                    value={formData.bank_name} 
                    onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    className="w-full bg-slate-900 text-white border border-white/10 rounded-xl px-3 py-2 text-sm sm:text-xs outline-none font-bold cursor-pointer"
                  >
                    <option value="ธนาคารทหารไทยธนชาติ (TTB)" className="bg-slate-900 text-white">ธนาคารทหารไทยธนชาติ (TTB)</option>
                    <option value="ธนาคารกสิกรไทย (KBANK)" className="bg-slate-900 text-white">ธนาคารกสิกรไทย (KBANK)</option>
                    <option value="ธนาคารไทยพาณิชย์ (SCB)" className="bg-slate-900 text-white">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงไทย (KTB)" className="bg-slate-900 text-white">ธนาคารกรุงไทย (KTB)</option>
                    <option value="ธนาคารกรุงศรีอยุธยา (Krungsri)" className="bg-slate-900 text-white">ธนาคารกรุงศรีอยุธยา (Krungsri)</option>
                    <option value="ธนาคารเกียรตินาคินภัทร (KKP)" className="bg-slate-900 text-white">ธนาคารเกียรตินาคินภัทร (KKP)</option>
                    <option value="ธนาคารออมสิน (GSB)" className="bg-slate-900 text-white">ธนาคารออมสิน (GSB)</option>
                    <option value="ธ.ก.ส. (BAAC)" className="bg-slate-900 text-white">ธ.ก.ส. (BAAC)</option>
                    <option value="ธนาคารกรุงเทพ (BBL)" className="bg-slate-900 text-white">ธนาคารกรุงเทพ (BBL)</option>
                    <option value="พร้อมเพย์ (PromptPay)" className="bg-slate-900 text-white">พร้อมเพย์ (PromptPay)</option>
                    <option value="วอเลต" className="bg-slate-900 text-white">วอเลต (TrueMoney Wallet)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold opacity-80">เลขบัญชี / พร้อมเพย์ <span className="text-red-500">*</span></label>
                  <input 
                    type="text" required placeholder="เลขบัญชี หรือเบอร์..."
                    value={formData.account_number} 
                    onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                    className={`w-full ${theme.inputBg} border rounded-xl px-3 py-2 text-sm sm:text-xs font-mono font-bold outline-none`}
                  />
                </div>
              </div>

              {!isOldCustomer ? (
                <div className="space-y-1 pt-1 border-t border-black/10">
                  <label className="text-xs font-semibold opacity-80 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>แนบเอกสาร (บัตรประชาชน / ภาพถ่ายพิกัดหน้าบ้าน) <span className="text-red-500">*</span></span>
                  </label>
                  
                  <div className="border border-black/10 bg-black/5 rounded-xl p-2 flex items-center justify-between gap-2">
                    <label className={`px-2.5 py-1.5 ${theme.badge} rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0`}>
                      เลือกไฟล์
                      <input 
                        type="file" required
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden" 
                      />
                    </label>
                    <span className="text-xs opacity-70 truncate text-right flex-1">{file ? file.name : 'ไม่ได้เลือกไฟล์ใด'}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 text-center font-bold">
                  ✅ ลูกค้าเก่า: ดึงข้อมูลเดิมมาแสดง แต่ท่านสามารถเลือกเปลี่ยนธนาคารและแก้ไขเลขบัญชีได้ทันที
                </div>
              )}

              <div className="border border-black/10 bg-black/5 p-2 rounded-xl text-[10px] opacity-80 leading-relaxed">
                💡 <strong>หมายเหตุ:</strong> "ข้าพเจ้ารับทราบว่าเงินกู้ยืมนี้ไม่ใช่รายได้ แต่เป็นเครดิตที่เอาไว้ใช้ในยามฉุกเฉิน..."
              </div>

              <button 
                type="submit" 
                className={`w-full py-3 ${theme.button} rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer`}
              >
                <span>ถัดไป: ถ่ายภาพหน้าคู่บัตรประชาชน</span>
                <Camera className="w-4 h-4" />
              </button>

              <div className="text-center text-xs opacity-70 pt-2 border-t border-black/10 space-y-0.5">
                <p>สอบถามข้อมูลเพิ่มเติมผ่านเจ้าหน้าที่</p>
                <p>
                  LINE:{' '}
                  <a 
                    href="https://line.me/R/ti/p/@306fgwvw" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-mono font-bold underline transition-colors"
                  >
                    {siteConfig.line_contact}
                  </a>
                </p>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* ================= 📸 MODAL สแกนหน้าเต็มจอ ================= */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-between p-4 text-white">
          <div className="w-full max-w-md pt-4 text-center space-y-1">
            <h3 className="text-base font-black text-emerald-400">📸 ถ่ายภาพคู่บัตรประชาชน</h3>
            <p className="text-xs text-slate-300">กรุณาถือบัตรประชาชนชิดใบหน้าให้เห็นชัดเจน ระบบจะจับภาพให้อัตโนมัติ</p>
            <div className="bg-emerald-500/25 border border-emerald-500/50 py-1.5 px-3 rounded-full text-xs font-bold text-emerald-200 inline-block mt-1 animate-pulse">
              {autoCaptureStatus}
            </div>
          </div>

          <div className="relative w-full flex-1 max-w-lg my-3 bg-black rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl border border-white/20">
            {!capturedImage ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover" 
                style={{ transform: 'scaleX(-1)' }} 
              />
            ) : (
              <img src={capturedImage} alt="Captured ID Face" className="w-full h-full object-cover" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="w-full max-w-md pb-4 space-y-2">
            {!capturedImage ? (
              <button 
                type="button"
                onClick={triggerAutoCapture}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg cursor-pointer flex items-center justify-center gap-2 text-sm tracking-wider uppercase"
              >
                <Camera className="w-5 h-5" /> กดถ่ายภาพทันที
              </button>
            ) : (
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={startCamera}
                  className="flex-1 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl shadow cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <RefreshCw className="w-4 h-4" /> ถ่ายใหม่
                </button>
                <button 
                  type="button"
                  disabled={loading}
                  onClick={handleFinalSubmit}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-500 text-white font-bold rounded-2xl shadow cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <CheckCircle className="w-4 h-4" /> {loading ? 'กำลังส่งข้อมูล...' : 'ยืนยันรูปนี้และส่งคำขอ'}
                </button>
              </div>
            )}

            <button 
              type="button"
              onClick={stopCamera}
              className="w-full py-2 bg-transparent hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs transition-all cursor-pointer"
            >
              ยกเลิก / กลับไปแก้ไขฟอร์ม
            </button>
          </div>
        </div>
      )}
    </div>
  );
}