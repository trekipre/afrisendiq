function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

import { NextResponse } from "next/server"
import { supabase } from "@/app/lib/supabase"
import twilio from "twilio"

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(req: Request) {

  try {

    const { voucherCode, merchantPhone } = await req.json()

    const { data: voucher } = await supabase
      .from("vouchers")
      .select("*")
      .eq("voucher_code", voucherCode)
      .single()

    if (!voucher) {
      return NextResponse.json({ success:false, message:"Voucher not found"})
    }

    if (voucher.status !== "active") {
      return NextResponse.json({ success:false, message:"Voucher already used"})
    }

    const { data: merchant } = await supabase
      .from("merchants")
      .select("*")
      .eq("phone_number", merchantPhone)
      .single()

    if (!merchant) {
      return NextResponse.json({ success:false, message:"Merchant not authorized"})
    }

    const otp = generateOTP()

    await supabase
      .from("vouchers")
      .update({
        verification_code: otp,
        verification_status: "pending"
      })
      .eq("id", voucher.id)

    await client.messages.create({
      body: `AfriSendIQ: Merchant wants to redeem voucher ${voucherCode}. Verification code: ${otp}`,
      from: process.env.TWILIO_PHONE!,
      to: voucher.recipient_phone
    })

    return NextResponse.json({
      success:true,
      message:"Verification code sent"
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json({
      success:false,
      message:"Server error"
    })

  }

}