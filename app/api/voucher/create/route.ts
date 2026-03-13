import { NextResponse } from "next/server"
import { supabase } from "@/app/lib/supabase"
import twilio from "twilio"

const client = twilio(
 process.env.TWILIO_ACCOUNT_SID,
 process.env.TWILIO_AUTH_TOKEN
)

export async function POST() {

 try {

  const voucherCode = Math.random().toString(36).substring(2,8).toUpperCase()

  const amount = 10000
  const merchantId = "m1"
  const recipientPhone = "+2250708123456"

  const { data, error } = await supabase
   .from("vouchers")
   .insert([
    {
     voucher_code: voucherCode,
     amount: amount,
     merchant_id: merchantId,
     recipient_phone: recipientPhone,
     status: "active"
    }
   ])

  if (error) throw error

  const message = `AfriSendIQ Voucher
Code: ${voucherCode}
Amount: ${amount} XOF`

  await client.messages.create({
   body: message,
   from: process.env.TWILIO_PHONE,
   to: recipientPhone
  })

  return NextResponse.json({
   success: true,
   voucherCode
  })

 } catch (error) {

  console.error(error)

  return NextResponse.json({
   success: false,
   error
  })

 }
}