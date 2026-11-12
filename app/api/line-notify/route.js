import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับข้อมูลคำขอกู้และ lineUserId จากฟอร์มหน้าบ้าน
    const { fullName, phone, amount, loanType, bankName, accountNumber, lineUserId } = await request.json();

    // 🛡️ ป้องกันกรณีไม่มี LINE UID ส่งมา
    if (!lineUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบ LINE User ID ของผู้ใช้งาน' 
      }, { status: 400 });
    }

    // 2. ดึงค่า LINE Token จาก Environment Variables เพื่อความปลอดภัย
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('ยังไม่ได้กำหนดค่า LINE_CHANNEL_ACCESS_TOKEN ในระบบ');
    }
    
    // 3. ใช้ LINE User ID ของลูกค้าที่กดสมัครคนนั้นโดยตรง
    const TARGET_LINE_USER_ID = lineUserId;

    // 4. จัดรูปแบบข้อความแจ้งเตือนส่งให้ลูกค้า
    const messageText = `🚨 แจ้งผลคำขอกู้เงิน (SUBLON819)\n\n` +
      `👤 ชื่อ-นามสกุล: ${fullName}\n` +
      `📞 เบอร์โทรศัพท์: ${phone}\n` +
      `💵 ยอดเงินกู้: ฿${Number(amount || 0).toLocaleString()}\n` +
      `✍️ ประเภท: ${loanType || 'กำหนดช่วงวันที่'}\n` +
      `🏧 ธนาคารรับเงิน: ${bankName}\n` +
      `🔢 เลขบัญชี: ${accountNumber}\n\n` +
      `✨ ระบบได้รับคำขอกู้ของคุณเรียบร้อยแล้ว กรุณารอแอดมินตรวจสอบและอนุมัติ`;

    // 5. ส่งข้อมูลไปยัง LINE Messaging API (Push Message Endpoint)
    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: TARGET_LINE_USER_ID, // LINE User ID ของลูกค้าคนนั้นๆ
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
      throw new Error(data.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือนผ่าน LINE');
    }

    return NextResponse.json({ success: true, message: 'ส่งแจ้งเตือนเข้า LINE สำเร็จ' });

  } catch (error) {
    console.error('LINE Notify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}