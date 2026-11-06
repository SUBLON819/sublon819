'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function RootLayoutClient({ children }) {
  const pathname = usePathname();
  const isApplyPage = pathname === '/apply';

  return (
    <>
      {!isApplyPage && <Sidebar />}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </>
  );
}