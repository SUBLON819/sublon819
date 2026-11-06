'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Shield, Database, Globe, Download, Lock } from 'lucide-react';

export default function SettingsPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  
  const [isFrontendOpen, setIsFrontendOpen] = useState(true);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  // ดึงสถานะปัจจุบันจาก Supabase เมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchSystemSettings();
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'is_frontend_open')
        .single();
      
      if (data) {
        setIsFrontendOpen(data.value === 'true');
      }
    } catch (err) {
      console.error('Error fetching settings:', err.message);
    }
  };

  // ฟังก์ชันสลับ เปิด/ปิด และบันทึกลง Supabase ทันที
  const handleToggleFrontend = async () => {
    const nextState = !isFrontendOpen;
    setLoadingToggle(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: nextState ? 'true' : 'false', updated_at: new Date() })
        .eq('key', 'is_frontend_open');

      if (error) throw error;
      
      setIsFrontendOpen(nextState);
      alert(nextState ? 'เปิดระบบหน้าบ้านเรียบร้อยแล้ว' : 'ปิดระบบหน้าบ้านเรียบร้อยแล้ว');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setLoadingToggle(false);
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ text: 'กรุณากรอกข้อมูลให้ครบทุกช่อง', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'รหัสผ่านใหม่ไม่ตรงกัน', type: 'error' });
      return;
    }
    setPasswordMsg({ text: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว!', type: 'success' });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleBackupData = async () => {
    setBackupLoading(true);
    try {
      const { data: loansData, error: loansErr } = await supabase.from('loans').select('*');
      if (loansErr) throw loansErr;

      const { data: paymentsData, error: payErr } = await supabase.from('payments').select('*');
      if (payErr) throw payErr;

      const backupObject = {
        exported_at: new Date().toISOString(),
        loans: loansData || [],
        payments: paymentsData || [],
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `sublon819_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 sm:p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 p-6 rounded-3xl shadow-xl flex items-center gap-4 text-white">
          <div className="w-12 h-12 bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">ตั้งค่าระบบหลังบ้าน</h1>
            <p className="text-xs text-purple-100">จัดการความปลอดภัย สำรองข้อมูล และควบคุมการเปิด-ปิดระบบหน้าบ้าน</p>
          </div>
        </div>

        {/* ควบคุมลิงก์หน้าบ้าน */}
        <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-purple-100 pb-3">
            <Globe className="w-5 h-5 text-purple-700" />
            <h3 className="text-sm font-black text-slate-800">ควบคุมลิงก์หน้าบ้านสมาชิก (Apply Page)</h3>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
            <div>
              <span className="font-bold text-xs text-slate-900 block">สถานะการเปิดรับสมัครผ่านหน้าเว็บ</span>
              <span className="text-[11px] text-slate-500">หากปิดการใช้งาน ลูกค้าจะไม่สามารถส่งคำขอกู้ผ่านหน้า apply ได้</span>
            </div>
            <button
              onClick={handleToggleFrontend}
              disabled={loadingToggle}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isFrontendOpen 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' 
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
              }`}
            >
              {loadingToggle ? 'กำลังบันทึก...' : isFrontendOpen ? '🟢 เปิดใช้งานอยู่ (คลิกเพื่อปิด)' : '🔴 ปิดใช้งานอยู่ (คลิกเพื่อเปิด)'}
            </button>
          </div>
        </div>

        {/* สำรองข้อมูล */}
        <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-purple-100 pb-3">
            <Database className="w-5 h-5 text-purple-700" />
            <h3 className="text-sm font-black text-slate-800">สำรองข้อมูลฐานข้อมูล (Supabase Backup)</h3>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
            <div>
              <span className="font-bold text-xs text-slate-900 block">ดาวน์โหลดข้อมูลดิบทั้งหมด (.JSON)</span>
              <span className="text-[11px] text-slate-500">สำรองข้อมูลตารางสัญญากู้ (loans) และประวัติการชำระ (payments) เก็บไว้ในเครื่องคอมพิวเตอร์</span>
            </div>
            <button
              onClick={handleBackupData}
              disabled={backupLoading}
              className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{backupLoading ? 'กำลังสำรองข้อมูล...' : 'ดาวน์โหลดไฟล์สำรองข้อมูล'}</span>
            </button>
          </div>
        </div>

        {/* เปลี่ยนรหัสผ่าน */}
        <div className="bg-white/90 backdrop-blur-md border border-purple-200 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-purple-100 pb-3">
            <Lock className="w-5 h-5 text-purple-700" />
            <h3 className="text-sm font-black text-slate-800">เปลี่ยนรหัสผ่านแอดมิน / การเข้าสู่ระบบ</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            {passwordMsg.text && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${passwordMsg.type === 'error' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                {passwordMsg.text}
              </div>
            )}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">รหัสผ่านปัจจุบัน</label>
              <input 
                type="password"
                placeholder="••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-600"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">รหัสผ่านใหม่</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">ยืนยันรหัสผ่านใหม่</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-600"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Shield className="w-4 h-4 text-purple-400" />
                <span>บันทึกรหัสผ่านใหม่</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}