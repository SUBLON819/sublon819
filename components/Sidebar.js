'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Globe, 
  TrendingUp, 
  Settings 
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();

  const menuGroups = [
    {
      title: 'หมวดภาพรวม & การเงิน',
      items: [
        { name: 'แดชบอร์ดหลัก', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'หมวดจัดการลูกหนี้ & คำขอกู้',
      items: [
        { 
          name: 'รายชื่อลูกหนี้ทั้งหมด', 
          href: '/customers', 
          icon: Users
        },
        { name: 'หน้าบ้านสมาชิก (apply.html)', href: '/apply', icon: Globe },
      ],
    },
    {
      title: 'หมวดรายงาน & ตั้งค่า',
      items: [
        { name: 'รายงานผลประกอบการประจำเดือน', href: '/reports', icon: TrendingUp },
        { name: 'ตั้งค่าระบบหลังบ้าน', href: '/settings', icon: Settings },
        { name: 'บัญชีธนาคาร & พื้นที่ส่วนตัว', href: '/personal', icon: Building2 },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop สำหรับมือถือเวลากดเปิดเมนู */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Component */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 min-h-screen text-slate-300 flex flex-col justify-between shrink-0 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          {/* Header Branding */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-lg text-white font-bold text-xl">
                S819
              </div>
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">SUBLON819</h1>
                <p className="text-xs text-slate-400">Executive Portal v2.0</p>
              </div>
            </div>
            {/* ปุ่มปิดเมนูด้านข้างบนมือถือ */}
            <button 
              onClick={onClose}
              className="md:hidden text-slate-400 hover:text-white font-bold text-lg p-1"
            >
              ✕
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-6">
            {menuGroups.map((group, idx) => (
              <div key={idx}>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {group.title}
                </h2>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClose} // กดเลือกเมนูแล้วให้ปิด Sidebar บนมือถืออัตโนมัติ
                        className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-purple-600 text-white font-semibold'
                            : 'hover:bg-slate-800 hover:text-white text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          SUBLON819 System Online
        </div>
      </aside>
    </>
  );
}