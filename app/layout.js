import './globals.css';
import RootLayoutClient from '@/components/RootLayoutClient';

export const metadata = {
  title: 'SUBLON819 - Executive Portal',
  description: 'ต่อลมหายใจคนรอเงินเดือน',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex antialiased">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}