import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับเบอร์โทร, OTP, lineUserId และสถานะลูกค้าเก่า/ใหม่จากหน้าบ้าน
    const { phone, otp, lineUserId, isOldCustomer } = await request.json();

    // 2. ดึงค่า LINE Token และ Admin ID จาก Environment Variables (.env.local / Vercel)
    const LINE_CHANNEL_ACCESS_TOKEN = '70239ca5a4ab3ea729e6d25552343043';
    const TARGET_LINE_USER_ID = lineUserId || 'U3a5ab0c39fec1055bdbd7423678eecdf';

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE_CHANNEL_ACCESS_TOKEN ในระบบ');
    }

    // 3. จัดข้อความส่งเข้า LINE (ระบุป้ายลูกค้าเก่า / ลูกค้าใหม่)
    const customerTypeTag = isOldCustomer ? '👤 [ลูกค้าเก่า]' : '✨ [ลูกค้าใหม่]';

    const messageText = `🚨 แจ้งเตือนคำขอ OTP ใหม่ (SUBLON819)\n\n` +
      `${customerTypeTag}\n` +
      `📞 เบอร์โทรศัพท์ลูกค้า: ${phone}\n` +
      `🔑 รหัส OTP: ${otp}\n\n` +
      `กรุณาแจ้งรหัสนี้แก่ลูกค้าเพื่อยืนยันตัวตนในหน้าสมัคร`;

    // 4. ส่งข้อมูลไปยัง LINE Messaging API (Push Message Endpoint)
    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: TARGET_LINE_USER_ID,
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
      throw new Error(data.message || 'เกิดข้อผิดพลาดในการส่งข้อความผ่าน LINE');
    }

    return NextResponse.json({ success: true, message: 'ส่ง OTP เข้า LINE เรียบร้อยแล้ว' });

  } catch (error) {
    console.error('LINE OTP Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}