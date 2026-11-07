import React from 'react';

export default function CustomerDetail({ customer, onBack, onOpenEditLoan, onOpenReceivePayment }) {
  // ป้องกันกรณีที่ส่งข้อมูลลูกค้ามาเป็นค่าว่าง
  const customerData = customer || {
    name: 'ไม่ระบชื่อ',
    phone: '-',
    facebook: '-',
    totalLoan: 0,
    totalRemaining: 0,
    totalPaid: 0,
    loans: []
  };

  return (
    <div className="min-h-screen bg-slate-950 p-3 sm:p-6 lg:p-8 font-sans text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ปุ่มย้อนกลับ */}
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        >
          &larr; ย้อนกลับสู่แดชบอร์ด
        </button>

        {/* ข้อมูลหัวข้อและสรุปยอด */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
          
          {/* ข้อมูลชื่อและช่องทางการติดต่อ */}
          <div className="space-y-1.5 w-full lg:w-auto bg-purple-950/40 p-4 rounded-xl border border-purple-900/50">
            <h1 className="text-xl font-bold tracking-wide text-white uppercase">{customerData.name || customerData.full_name}</h1>
            <p className="text-xs text-slate-300">เบอร์โทร: <span className="font-semibold text-white">{customerData.phone || '-'}</span></p>
            <p className="text-xs text-slate-300">Facebook: <span className="text-purple-300 underline cursor-pointer">{customerData.facebook || customerData.facebook_link || '-'}</span></p>
          </div>

          {/* กล่องสรุปยอดรวม 3 ช่อง */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto flex-1 max-w-3xl">
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">ยอดกู้สะสมทั้งหมด</span>
              <span className="text-lg font-bold text-sky-400">{Number(customerData?.totalLoan || 0).toLocaleString()} ฿</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">ยอดเงินต้นคงค้างปัจจุบัน</span>
              <span className="text-lg font-bold text-red-400">{Number(customerData?.totalRemaining || 0).toLocaleString()} ฿</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">ยอดชำระสะสมทั้งหมด</span>
              <span className="text-lg font-bold text-emerald-400">{Number(customerData?.totalPaid || 0).toLocaleString()} ฿</span>
            </div>
          </div>

        </div>

        {/* ส่วนแสดงรายการสินเชื่อของลูกค้า (ถ้ามี) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-purple-300 uppercase tracking-wider">รายการสัญญาเงินกู้ของลูกค้า</h2>
          
          {customerData.loans && customerData.loans.length > 0 ? (
            <div className="space-y-3">
              {customerData.loans.map((loan, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-xs font-bold text-purple-400 font-mono">รหัสบิล: {loan.bill_code || '-'}</span>
                    <p className="text-xs text-slate-300 mt-1">ประเภท: {loan.loan_type || '-'} | สถานะ: {loan.status || '-'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-emerald-400">{Number(loan.remaining_principal || loan.principal_amount || 0).toLocaleString()} ฿</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">ไม่พบรายการสินเชื่อเพิ่มเติม</p>
          )}
        </div>

      </div>
    </div>
  );
}