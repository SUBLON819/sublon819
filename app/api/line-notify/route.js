import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับข้อมูลคำขอกู้จากฟอร์มหน้าบ้าน
    const { fullName, phone, amount, loanType, bankName, accountNumber } = await request.json();

    // 2. ดึงค่า LINE Token และ LINE Admin ID จาก Environment Variables ของ Vercel
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const LINE_ADMIN_USER_ID = process.env.LINE_ADMIN_USER_ID; // 🟢 ดึง LINE UID แอดมิน

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE_CHANNEL_ACCESS_TOKEN ในระบบ');
    }

    // 🛡️ ป้องกันกรณีไม่ได้ตั้งค่า LINE_ADMIN_USER_ID บน Vercel
    if (!LINE_ADMIN_USER_ID) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE_ADMIN_USER_ID ใน Environment Variables ของ Vercel');
    }

    // 3. กำหนดให้เป้าหมายคือ LINE User ID ของแอดมิน
    const TARGET_LINE_USER_ID = LINE_ADMIN_USER_ID;

    // 4. จัดรูปแบบข้อความแจ้งเตือนส่งให้ "แอดมิน"
    const messageText = `🚨 มีคำขอกู้เงินใหม่เข้ามา! (SUBLON819)\n\n` +
      `👤 ชื่อ-นามสกุล: ${fullName}\n` +
      `📞 เบอร์โทรศัพท์: ${phone}\n` +
      `💵 ยอดเงินกู้: ฿${Number(amount || 0).toLocaleString()}\n` +
      `✍️ ประเภท: ${loanType || 'กำหนดช่วงวันที่'}\n` +
      `🏧 ธนาคารรับเงิน: ${bankName}\n` +
      `🔢 เลขบัญชี: ${accountNumber}\n\n` +
      `✨ กรุณาตรวจสอบข้อมูลและสลิปภาพถ่ายในระบบแอดมิน`;

    // 5. ส่งข้อมูลไปยัง LINE Messaging API (Push Message Endpoint)
    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: TARGET_LINE_USER_ID, // 🟢 ส่งตรงเข้า LINE UID ของแอดมิน
        messages: [
          {
            type: 'text',
            text: messageText
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('LINE API Error Response:', data);
      throw new Error(data.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือนผ่าน LINE');
    }

    return NextResponse.json({ success: true, message: 'ส่งแจ้งเตือนหาแอดมินสำเร็จ' });

  } catch (error) {
    console.error('LINE Notify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}