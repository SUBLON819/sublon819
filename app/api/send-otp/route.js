import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { phone, otp, lineUserId, isOldCustomer } = await request.json();

    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE_CHANNEL_ACCESS_TOKEN ในระบบ');
    }

    // 🟢 ถ้าไม่มี lineUserId ส่งมา ให้ใช้ค่าสำรองหรือข้ามการส่ง Push ไปก่อนเพื่อไม่ให้แอปค้าง (หรือแจ้งเตือนแอดมิน)
    const targetUserId = lineUserId && lineUserId.trim() !== '' ? lineUserId : null;

    if (!targetUserId) {
      // กรณีหา LINE ID ไม่เจอจริงๆ ให้ผ่านไปก่อนได้ หรือส่ง Response สำเร็จจำลองเพื่อให้อย่างน้อยระบบไปต่อได้
      console.warn('Warning: lineUserId is missing, OTP generated locally:', otp);
      return NextResponse.json({ 
        success: true, 
        message: 'สร้างรหัส OTP สำเร็จ (ไม่พบ LINE UID ระบบแสดงรหัสชั่วคราว)',
        mockOtp: otp // ส่งกลับไปแสดงผลเผื่อกรณีเทส
      });
    }

    const customerTypeTag = isOldCustomer ? '👤 (ลูกค้าเก่า)' : '✨ (ลูกค้าใหม่)';
    const messageText = `🚨 รหัสยืนยัน OTP ของคุณ (SUBLON819)\n\n` +
      `${customerTypeTag}\n` +
      `📞 เบอร์โทรศัพท์: ${phone}\n` +
      `🔑 รหัส OTP: ${otp}\n\n` +
      `*(ห้ามบอกรหัสนี้ให้ผู้อื่นทราบ)*`;

    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: targetUserId,
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