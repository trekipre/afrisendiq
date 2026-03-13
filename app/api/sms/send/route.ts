import { NextResponse } from "next/server"
import twilio from "twilio"

const client = twilio(
 process.env.TWILIO_ACCOUNT_SID,
 process.env.TWILIO_AUTH_TOKEN
)

export async function POST(req: Request) {

 const body = await req.json()

 const phone = body.phone
 const message = body.message

 try {

  const sms = await client.messages.create({
   body: message,
   from: process.env.TWILIO_PHONE,
   to: phone
  })

  return NextResponse.json({
   success: true,
   sid: sms.sid
  })

 } catch (error) {

  return NextResponse.json({
   success: false,
   error
  })

 }

}