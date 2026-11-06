'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// ลบการ import Sidebar ออกได้ หากไม่ได้ใช้งานที่อื่นในไฟล์นี้
import { TrendingUp, DollarSign, Calendar, FileText, ArrowUpRight } from 'lucide-react';

export default function ReportsPage() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลจาก Supabase
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansRes, paymentsRes] = await Promise.all([
        supabase.from('loans').select('*'),
        supabase.from('payments').select('*').order('created_at', { ascending: false })
      ]);

      if (loansRes.data) setLoans(loansRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // คำนวณยอดรวมทั้งหมด
  const totalCollected = payments.reduce((sum, p) => {
    const targetLoan = loans.find(l => l.id === p.loan_id);
    const extraProfit = (targetLoan && targetLoan.loan_type === 'ยอดค้างรอเคลียร์') ? Number(p.amount || 0) : 0;
    return sum + extraProfit + Number(p.interest_paid || 0) + Number(p.fine_amount || 0);
  }, 0);

  const totalPrincipalPaid = payments.reduce((sum, p) => sum + Number(p.principal_paid || 0), 0);

  return (
    // เอา <Sidebar /> ออกจากตรงนี้ เหลือแค่ <main> หรือ Layout ที่ถูกต้อง
    <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-500" />
            รายงานผลประกอบการประจำเดือน
          </h1>
          <p className="text-xs text-slate-400">สรุปภาพรวมรายรับ กำไร และประวัติการทำรายการทั้งหมดของระบบ</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs text-slate-400 font-semibold">กำไรสะสมและดอกเบี้ยรวม</div>
          <div className="text-2xl font-black font-mono text-purple-400">
            ฿{totalCollected.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">รวมดอกเบี้ย ค่าปรับ และยอดค้างรอเคลียร์ที่จัดเก็บแล้ว</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs text-slate-400 font-semibold">ยอดรับชำระเงินต้นสะสม</div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            ฿{totalPrincipalPaid.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">ยอดเงินต้นรวมที่ลูกหนี้ผ่อนชำระคืนเข้ามา</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs text-slate-400 font-semibold">จำนวนรายการรับชำระทั้งหมด</div>
          <div className="text-2xl font-black font-mono text-blue-400">
            {payments.length} รายการ
          </div>
          <p className="text-[10px] text-slate-500">ประวัติการทำรายการทั้งหมดในระบบ</p>
        </div>
      </div>

      {/* Payments History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-400" />
          ประวัติการรับชำระเงินล่าสุด
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">วันที่ / เวลา</th>
                <th className="pb-3 font-semibold">รหัสบิล / ลูกหนี้</th>
                <th className="pb-3 font-semibold">ยอดรับชำระ</th>
                <th className="pb-3 font-semibold">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-slate-500">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-slate-500">ไม่พบประวัติการชำระเงินในระบบ</td>
                </tr>
              ) : (
                payments.map((p) => {
                  const targetLoan = loans.find(l => l.id === p.loan_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3 text-slate-400">
                        {new Date(p.created_at).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 font-medium text-white">
                        {targetLoan ? `${targetLoan.bill_code} - ${targetLoan.full_name}` : 'ไม่ระบุข้อมูล'}
                      </td>
                      <td className="py-3 font-mono font-bold text-emerald-400">
                        ฿{Number(p.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-slate-400">{p.note || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}