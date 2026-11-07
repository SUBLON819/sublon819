'use client';

import { useState } from 'react';
import { Globe, Palette, Save, Copy, Check, ExternalLink, Smartphone } from 'lucide-react';

export default function ApplyAdminThemePage() {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // State สำหรับเก็บค่าธีมและการตั้งค่าหน้าบ้านสมาชิก
  const [settings, setSettings] = useState({
    banner_title: 'สมัครขอสินเชื่อออนไลน์ SUBLON819',
    banner_subtitle: 'อนุมัติไว ได้เงินจริง ขั้นตอนง่ายๆ ในไม่กี่นาที',
    theme_color: 'purple',
    line_contact: '@sublon819',
    is_open: true,
  });

  // ลิงก์สำหรับให้ลูกค้ากดสมัคร (ลิงก์หน้า /apply จริง)
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
      await new Promise(resolve => setTimeout(resolve, 500));
      alert('บันทึกการตั้งค่าหน้าบ้านสมาชิกสำเร็จ!');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 sm:p-6 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Banner */}
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

        {/* Form & Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ฟอร์มตั้งค่า (2 คอลัมน์) */}
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
                  className="w-full border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-600 bg-purple-50/30"
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
                    <option value="purple">ม่วงพาสเทล (Glamorous Purple)</option>
                    <option value="indigo">ครามเข้ม (Deep Indigo)</option>
                    <option value="pink">ชมพูบานเย็น (Rose Pink)</option>
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
                    checked={settings.is_open}
                    onChange={(e) => setSettings({...settings, is_open: e.target.checked})}
                    className="w-4 h-4 accent-purple-600 rounded"
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
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* พรีวิวหน้าเว็บ (1 คอลัมน์) */}
          <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-purple-100 pb-3">
              <Smartphone className="w-4 h-4 text-purple-700" />
              <span>ตัวอย่างหน้าเว็บ (Preview)</span>
            </h3>

            <div className="flex-1 bg-slate-900 rounded-2xl p-4 text-white flex flex-col justify-between border-4 border-slate-800 shadow-inner min-h-[260px]">
              <div className="space-y-3">
                <div className="inline-block px-2.5 py-0.5 bg-purple-600 text-white font-bold text-[10px] rounded-full">
                  SUBLON819
                </div>
                <h4 className="text-sm font-bold leading-snug text-purple-100">
                  {settings.banner_title}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {settings.banner_subtitle}
                </p>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-center space-y-2 mt-4">
                <div className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-xs font-bold shadow">
                  กรอกฟอร์มขอสินเชื่อ
                </div>
                <div className="text-[10px] text-slate-400">ติดต่อ: {settings.line_contact}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}