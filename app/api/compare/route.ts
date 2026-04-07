import { NextResponse } from "next/server"
import { convertUsdAmount } from "@/app/lib/fx"

export async function POST(req: Request) {
  const body = await req.json()
  const amount = Number(body.amount)
  const currencyCode = typeof body.currencyCode === "string" ? body.currencyCode : "XOF"

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: "A positive amount is required" },
      { status: 400 }
    )
  }

  try {
    const conversion = await convertUsdAmount(amount, currencyCode)

    return NextResponse.json({
      success: true,
      currencyCode: conversion.currencyCode,
      rate: conversion.rate,
      converted: conversion.converted,
      source: conversion.source,
      stale: conversion.stale
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to compare rates"
      },
      { status: 400 }
    )
  }
}