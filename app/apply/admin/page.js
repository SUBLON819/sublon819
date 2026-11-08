'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Globe, Palette, Save, Copy, Check, ExternalLink, Smartphone, Loader2 } from 'lucide-react';

export default function ApplyAdminThemePage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied] = useState(false);

  const [settings, setSettings] = useState({
    banner_title: 'สมัครขอสินเชื่อออนไลน์ SUBLON819',
    banner_subtitle: 'อนุมัติไว ได้เงินจริง ขั้นตอนง่ายๆ ในไม่กี่นาที',
    theme_color: 'emerald',
    line_contact: '@682clwce',
    is_frontend_open: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (data && !error) {
        let loadedConfig = {};
        data.forEach(item => {
          if (item.key === 'banner_title') loadedConfig.banner_title = item.value;
          if (item.key === 'banner_subtitle') loadedConfig.banner_subtitle = item.value;
          if (item.key === 'theme_color') loadedConfig.theme_color = item.value;
          if (item.key === 'line_contact') loadedConfig.line_contact = item.value;
          if (item.key === 'is_frontend_open') {
            loadedConfig.is_frontend_open = item.value === 'true';
          }
        });
        setSettings(prev => ({ ...prev, ...loadedConfig }));
      }
    } catch (err) {
      console.error('Error fetching settings:', err.message);
    } finally {
      setFetching(false);
    }
  };

  const applyUrl = typeof window !== 'undefined' ? `${window.location.origin}/apply` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(applyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates = [
        { key: 'banner_title', value: settings.banner_title },
        { key: 'banner_subtitle', value: settings.banner_subtitle },
        { key: 'theme_color', value: settings.theme_color },
        { key: 'line_contact', value: settings.line_contact },
        { key: 'is_frontend_open', value: settings.is_frontend_open ? 'true' : 'false' },
      ];

      for (let item of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({ key: item.key, value: item.value }, { onConflict: 'key' });

        if (error) throw error;
      }

      alert('บันทึกการตั้งค่าหน้าบ้านสมาชิกสำเร็จ!');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 📌 แมปสไตล์และสีจริงของแต่ละธนาคาร สำหรับแสดงผล Preview ตรงตามหน้าเว็บจริง 100%
  const getPreviewThemeClasses = (color) => {
    switch (color) {
      case 'purple': // 💜 ธีมไทยพาณิชย์
        return {
          bg: 'bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white',
          badge: 'bg-amber-500 text-purple-950 font-black',
          button: 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white',
          headerBg: 'bg-[#4B1979] text-white'
        };
      case 'pink': // 💗 ธีมชมพูออมสิน (การ์ดขาว หัวชมพู)
        return {
          bg: 'bg-white text-slate-800 border-pink-200 shadow-xl',
          badge: 'bg-pink-600 text-white font-bold',
          button: 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md',
          headerBg: 'bg-[#E03E82] text-white'
        };
      case 'yellow': // 💛 ธีมกรุงศรีอยุธยา (การ์ดขาว หัวน้ำตาล ปุ่มน้ำตาล)
        return {
          bg: 'bg-white text-slate-900 border-amber-200 shadow-xl',
          badge: 'bg-[#5C3D2E] text-white font-bold',
          button: 'bg-gradient-to-r from-[#5C3D2E] to-[#452D22] text-white font-bold shadow-md',
          headerBg: 'bg-[#5C3D2E] text-white'
        };
      case 'BangkokBank': // 🔷 ธีมธนาคารกรุงเทพ (น้ำเงิน BBL)[cite: 6]
        return {
          bg: 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white',
          badge: 'bg-blue-600 text-white font-bold',
          button: 'bg-gradient-to-r from-blue-700 to-sky-600 text-white shadow-md',
          headerBg: 'bg-[#003366] text-white'
        };
      case 'emerald':
      default: // 💚 ธีมกสิกรไทย
        return {
          bg: 'bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white',
          badge: 'bg-emerald-600 text-white',
          button: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
          headerBg: 'bg-[#006435] text-white'
        };
    }
  };

  const themeClasses = getPreviewThemeClasses(settings.theme_color);

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-purple-700 mx-auto" />
          <p className="text-xs text-slate-500">กำลังโหลดข้อมูลการตั้งค่า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 sm:p-6 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">ระบบจัดการ & ปรับแต่งหน้าบ้านสมาชิก</h1>
              <p className="text-xs text-purple-100">จัดการธีมสี ข้อความ และคัดลอกลิงก์ส่งให้ลูกค้า</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์หน้าสมัคร'}</span>
            </button>
            <a
              href="/apply"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
            >
              <span>ดูหน้าเว็บจริง</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-6 shadow-xl space-y-6">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-purple-100 pb-3">
              <Palette className="w-4 h-4 text-purple-700" />
              <span>ตั้งค่าข้อความและธีมหน้าบ้าน</span>
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">หัวข้อแบนเนอร์หลัก</label>
                <input 
                  type="text"
                  value={settings.banner_title}
                  onChange={(e) => setSettings({...settings, banner_title: e.target.value})}
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/30 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">ข้อความรอง / คำโปรย</label>
                <input 
                  type="text"
                  value={settings.banner_subtitle}
                  onChange={(e) => setSettings({...settings, banner_subtitle: e.target.value})}
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">เลือกธีมสี</label>
                  <select
                    value={settings.theme_color}
                    onChange={(e) => setSettings({...settings, theme_color: e.target.value})}
                    className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/30 font-semibold"
                  >
                    <option value="emerald">ธีมกสิกรไทย (เขียวมรกต)</option>
                    <option value="purple">ธีมไทยพาณิชย์ (ม่วง-ขาว-เหลืองทอง)</option>
                    <option value="pink">ธีมชมพู (ออมสิน)</option>
                    <option value="yellow">ธีมกรุงศรีอยุธยา (เหลือง-น้ำตาล)</option>
                    <option value="BangkokBank">ธีมธนาคารกรุงเทพ (น้ำเงิน BBL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">LINE สำหรับติดต่อ</label>
                  <input 
                    type="text"
                    value={settings.line_contact}
                    onChange={(e) => setSettings({...settings, line_contact: e.target.value})}
                    className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/30 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-purple-100 flex items-center">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input 
                    type="checkbox"
                    checked={settings.is_frontend_open}
                    onChange={(e) => setSettings({...settings, is_frontend_open: e.target.checked})}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                  <span>เปิดฟอร์มรับสมัครออนไลน์ (สถานะเปิดใช้งาน)</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 📱 ตัวอย่างหน้าเว็บ (Preview) ดึงธีมจริงมาแสดงผล */}
          <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-purple-100 pb-3">
              <Smartphone className="w-4 h-4 text-purple-700" />
              <span>ตัวอย่างหน้าเว็บ (Preview)</span>
            </h3>

            <div className={`flex-1 ${themeClasses.bg} rounded-2xl overflow-hidden flex flex-col border-4 border-slate-800 shadow-inner min-h-[280px] transition-all duration-300`}>
              
              {/* Header Preview */}
              <div className={`${themeClasses.headerBg} p-3.5 text-center space-y-1 transition-colors duration-300`}>
                <div className={`inline-block px-2 py-0.5 ${themeClasses.badge} text-[9px] rounded-full`}>
                  SUBLON819
                </div>
                <h4 className="text-xs font-bold leading-snug">
                  {settings.banner_title || 'หัวข้อแบนเนอร์...'}
                </h4>
                <p className="text-[10px] opacity-80">
                  {settings.banner_subtitle || 'คำโปรย...'}
                </p>
              </div>

              {/* Body Preview */}
              <div className="p-3 flex-1 flex flex-col justify-between space-y-3">
                <div className="bg-black/10 dark:bg-white/10 p-2 rounded-xl text-[10px] flex items-center gap-1.5 font-medium">
                  <span className={`w-3.5 h-3.5 ${themeClasses.badge} rounded-full flex items-center justify-center text-[8px]`}>1</span>
                  <span>ยืนยันเบอร์โทรศัพท์</span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] opacity-80">เบอร์โทรศัพท์มือถือ</div>
                  <div className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-mono opacity-60">
                    08x-xxx-xxxx
                  </div>
                </div>

                <div className={`w-full py-2 ${themeClasses.button} rounded-lg text-[11px] font-bold text-center shadow`}>
                  ขอรหัส OTP ผ่านแอดมิน →
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}