import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับเบอร์โทรและ OTP จากหน้าบ้าน
    const { phone, otp, lineUserId } = await request.json();

    // 2. ข้อมูล LINE Messaging API ของ SUBLON819
    const LINE_CHANNEL_ACCESS_TOKEN = '1USv0PSb1+WcgaE5jMhJ1Ke2NQnZ4iKODr+6R2ccRtPfRl/jGloaUE/1a1LUx8SUPCmbx5tesGXY4cXKYzclISGYwKugluBBwqTGMv/ym9+rlFTESXMXyjNA6SrmFUcU9ILQCyiWEVTD4AyJ3b0PsgdB04t89/1O/w1cDnyilFU=';
    
    // กำหนด LINE User ID ปลายทาง (หากส่งเข้าแอดมิน ใช้ ID แอดมิน / หากส่งหาลูกค้า ใช้ lineUserId ที่ส่งมาจากฟอร์ม)
    const TARGET_LINE_USER_ID = lineUserId || 'U3a5ab039fec1055bdbd7423678eecdf'; 

    // 3. จัดข้อความส่งเข้า LINE
    const messageText = `🚨 แจ้งเตือนคำขอ OTP ใหม่ (SUBLON819)\n\n` +
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
        to: TARGET_LINE_USER_ID, // LINE UID ของผู้รับปลายทาง
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