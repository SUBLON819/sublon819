import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับข้อมูลจากหน้าบ้าน
    const { fullName, phone, amount, loanType, bankName, accountNumber } = await request.json();

    // 2. ดึงค่า Token และ Admin ID จาก Environment Variables ของ Vercel
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const LINE_ADMIN_USER_ID = process.env.LINE_ADMIN_USER_ID; // LINE UID ของแอดมิน

    if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_ADMIN_USER_ID) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE Token หรือ Admin ID ใน Vercel');
    }

    // 3. กำหนดให้เป้าหมายส่งตรงเข้าแชทส่วนตัวของ "แอดมิน" เสมอ
    const TARGET_LINE_USER_ID = LINE_ADMIN_USER_ID;

    // 4. จัดรูปแบบข้อความแจ้งเตือน (เปลี่ยนเป็น "รอบบิล" และแสดงแค่วันที่คืน)
    const lineMessage = `✨ ส่งคำขอเรียบร้อยค่ะ.. \n\n` +
        `👤 ชื่อ-นามสกุล: ${formData.full_name}\n` +
        `📞 เบอร์โทรศัพท์: ${phone}\n` +
        `💵 ยอดเงินกู้: ฿${Number(formData.principal_amount || 0).toLocaleString()}\n` +
        `📅 รอบบิล: ${formData.cycle_date}\n` +
        `🏦 ธนาคารรับเงิน: ${formData.bank_name}\n` +
        `💳 เลขบัญชี: ${formData.account_number}\n\n` +
        `📌 พิกัด GPS: ${location.lat ? location.lat.toFixed(4) : 'ไม่ระบุ'}, ${location.lng ? location.lng.toFixed(4) : 'ไม่ระบุ'}\n`

    // 5. ส่งข้อมูลไปยัง LINE Messaging API (Push Message)
    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: TARGET_LINE_USER_ID, // 🟢 ส่งตรงเข้าแชทแอดมิน
        messages: [
          {
            type: 'text',
            text: lineMessage
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'เกิดข้อผิดพลาดในการส่ง LINE Notify');
    }

    return NextResponse.json({ success: true, message: 'ส่งแจ้งเตือนหาแอดมินสำเร็จ' });

  } catch (error) {
    console.error('LINE Notify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}