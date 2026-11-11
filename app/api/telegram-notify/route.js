import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับข้อมูลคำขอกู้จากฟอร์มหน้าบ้าน
    const { fullName, phone, amount, loanType, bankName, accountNumber, lineUserId } = await request.json();

    // 2. ข้อมูล LINE Messaging API ของ SUBLON819
    const LINE_CHANNEL_ACCESS_TOKEN = '1USv0PSb1+WcgaE5jMhJ1Ke2NQnZ4iKODr+6R2ccRtPfRl/jGloaUE/1a1LUx8SUPCmbx5tesGXY4cXKYzclISGYwKugluBBwqTGMv/ym9+rlFTESXMXyjNA6SrmFUcU9ILQCyiWEVTD4AyJ3b0PsgdB04t89/1O/w1cDnyilFU=';
    
    // หมายเหตุ: กรณีส่งหาแอดมินโดยตรง สามารถใส่ LINE User ID ของแอดมินไว้ที่นี่ได้เลย 
    // หรือถ้าส่งหาลูกค้า ให้ส่ง lineUserId แนบมาจากฟอร์มหน้าบ้านครับ
    const TARGET_LINE_USER_ID = lineUserId || 'U3a5ab039fec1055bdbd7423678eecdf'; // (ตัวอย่างใช้ User ID แอดมินที่คุณมี)

    // 3. จัดรูปแบบข้อความแจ้งเตือนคำขอกู้ใหม่ (LINE รองรับ Markdown แบบย่อหรือข้อความ text ธรรมดา)
    const messageText = `🚨 มีคำขอกู้เงินใหม่เข้ามา (SUBLON819)\n\n` +
      `👤 ชื่อ-นามสกุล: ${fullName}\n` +
      `📞 เบอร์โทรศัพท์: ${phone}\n` +
      `💵 ยอดเงินกู้: ฿${Number(amount).toLocaleString()}\n` +
      `✍️ ประเภท: ${loanType}\n` +
      `🏧 ธนาคารรับเงิน: ${bankName}\n` +
      `🔢 เลขบัญชี: ${accountNumber}\n\n` +
      `กรุณาตรวจสอบข้อมูล เอกสาร และพิกัด GPS ในระบบหลังบ้าน`;

    // 4. ส่งข้อมูลไปยัง LINE Messaging API (Push Message Endpoint)
    const lineUrl = 'https://api.line.me/v2/bot/message/push';

    const response = await fetch(lineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: TARGET_LINE_USER_ID, // LINE User ID ของผู้รับปลายทาง
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