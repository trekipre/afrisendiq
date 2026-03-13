import { NextResponse } from "next/server"

export async function POST(req: Request) {

  const body = await req.json()

  const { amount } = body

  // call internal FX API
  const res = await fetch("http://localhost:3000/api/fx")

  const data = await res.json()

  const rate = data.rates["XOF"]

  const converted = amount * rate

  return NextResponse.json({
    rate,
    converted
  })
}