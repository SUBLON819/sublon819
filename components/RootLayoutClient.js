'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Menu } from 'lucide-react'; // ใช้ไอคอนปุ่มเมนูด้านบน (ถ้ามี) หรือใช้ปุ่มธรรมดาตามชอบ

export default function RootLayoutClient({ children }) {
  const pathname = usePathname();
  const isApplyPage = pathname === '/apply';

  // 1. เพิ่ม State สำหรับควบคุมการเปิด-ปิด Sidebar บนมือถือ
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* 2. ส่ง props isOpen และ onClose เข้าไปที่ Sidebar ตัวเดียวเท่านั้น */}
      {!isApplyPage && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      )}

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* ปุ่มเปิด Sidebar บนมือถือ (หากหน้าจอ Dashboard ขาดปุ่มกดเปิดเมนูซ้ายมือ) */}
        {!isApplyPage && (
          <div className="md:hidden p-4 bg-slate-900 border-b border-slate-800 flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-300 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 font-bold text-white text-sm">SUBLON819</span>
          </div>
        )}

        {children}
      </main>
    </>
  );
}
