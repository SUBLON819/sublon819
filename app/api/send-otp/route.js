import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // สมมติว่าต้องการเชื่อม Supabase ฝั่ง Backend ด้วย (ถ้ามี)

export async function POST(request) {
  try {
    const { phone } = await request.json();

    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกเบอร์โทรศัพท์มือถือให้ถูกต้อง' },
        { status: 400 }
      );
    }

    // ตัวอย่าง: ตรวจสอบเบอร์โทรศัพท์ในฐานข้อมูล Supabase (ถ้าต้องการเช็กจากฝั่ง Server)
    const { data: existingLoans, error: fetchError } = await supabase
      .from('loans')
      .select('*')
      .eq('phone', phone)
      .order('id', { ascending: false })
      .limit(1);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const isOldCustomer = existingLoans && existingLoans.length > 0;

    return NextResponse.json({ 
      success: true, 
      isOldCustomer: isOldCustomer,
      message: isOldCustomer ? 'ตรวจพบข้อมูลลูกค้าเก่าในระบบ' : 'ไม่พบข้อมูล (ลูกค้าใหม่)',
      customerData: isOldCustomer ? existingLoans[0] : null
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' }, 
      { status: 500 }
    );
  }
}