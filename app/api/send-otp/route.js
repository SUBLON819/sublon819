import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับเบอร์โทร, OTP, lineUserId และสถานะลูกค้าจากหน้าบ้าน
    const { phone, otp, lineUserId, isOldCustomer } = await request.json();

    // 🛡️ สำคัญ: ถ้าไม่มี lineUserId ส่งมา แปลว่าลูกค้ายังไม่ได้ล็อกอินผ่าน LINE ให้ปฏิเสธทันที
    if (!lineUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบ LINE User ID กรุณาล็อกอินด้วย LINE ก่อนทำรายการ' 
      }, { status: 400 });
    }

    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE_CHANNEL_ACCESS_TOKEN ในระบบ');
    }

    // 2. จัดรูปแบบข้อความ OTP สำหรับส่งให้ลูกค้า
    const customerTypeTag = isOldCustomer ? '👤 (ลูกค้าเก่า)' : '✨ (ลูกค้าใหม่)';
    const messageText = `🚨 รหัสยืนยัน OTP ของคุณ (SUBLON819)\n\n` +
      `${customerTypeTag}\n` +
      `📞 เบอร์โทรศัพท์: ${phone}\n` +
      `🔑 รหัส OTP: ${otp}\n\n` +
      `*(ห้ามบอกรหัสนี้ให้ผู้อื่นทราบ)*`;

    // 3. ส่งไปยัง LINE Messaging API (Push Message ไปหาลูกค้ารายนั้นโดยตรง)
    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId, // 👈 ส่งเข้า LINE UID ของลูกค้าคนนี้โดยตรง
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
      console.error('LINE API Response Error:', data);
      throw new Error(data.message || 'ไม่สามารถส่งข้อความหาลูกค้าได้ (ลูกค้าอาจจะยังไม่ได้เพิ่มเพื่อนกับบอท)');
    }

    return NextResponse.json({ success: true, message: 'ส่ง OTP เข้า LINE ลูกค้าเรียบร้อยแล้ว' });

  } catch (error) {
    console.error('LINE OTP Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}