'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Menu, ArrowLeft, RefreshCw, Home } from 'lucide-react';

export default function RootLayoutClient({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isApplyPage = pathname === '/apply';

  // State สำหรับควบคุมการเปิด-ปิด Sidebar บนมือถือ
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Sidebar เฉพาะหน้าเว็บที่ไม่ใช่หน้าสมัคร (Apply) */}
      {!isApplyPage && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      )}

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* แถบ Header ด้านบน (เฉพาะหน้าจอขนาดเล็ก/มือถือ หรือพื้นที่ที่ไม่มี Sidebar ซ่อนอยู่) */}
        {!isApplyPage && (
          <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            
            {/* ฝั่งซ้าย: ปุ่มเมนูแฮมเบอร์เกอร์เปิด Sidebar และโลโก้ */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-slate-300 hover:text-white p-1 rounded-lg bg-slate-800 cursor-pointer"
                title="เปิดเมนู"
              >
                <Menu className="w-6 h-6" />
              </button>
              <span className="font-bold text-white text-sm tracking-wider">SUBLON819</span>
            </div>

            {/* ฝั่งขวา: ปุ่มควบคุม 3 ปุ่ม (ย้อนกลับ, รีเฟรช, หน้าแรก) */}
            <div className="flex items-center gap-1.5">
              {/* 1. ปุ่มลูกศรย้อนกลับหน้าเมื่อกี้ */}
              <button
                onClick={() => router.back()}
                className="w-9 h-9 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center transition-colors shadow cursor-pointer"
                title="ย้อนกลับหน้าเมื่อกี้"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* 2. ปุ่มรีเฟรชหน้าจอ (อยู่ตรงกลาง) */}
              <button
                onClick={() => window.location.reload()}
                className="w-9 h-9 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center transition-colors shadow cursor-pointer"
                title="รีเฟรชหน้าจอ"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* 3. ปุ่มหน้าบ้าน/แดชบอร์ด (อยู่มุมขวาสุด) */}
              <button
                onClick={() => router.push('/')}
                className="w-9 h-9 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center transition-colors shadow cursor-pointer"
                title="กลับหน้าแดชบอร์ด"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        {children}
      </main>
    </>
  );
}