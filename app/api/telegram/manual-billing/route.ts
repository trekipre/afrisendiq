import { handleTelegramAction, recordManualOrderAuditEvent } from "@/app/lib/manualBilling"

export async function POST(request: Request) {
  const body = await request.json()
  const callbackQuery = body?.callback_query

  if (!callbackQuery?.data) {
    return Response.json({ ok: true })
  }

  const [scope, orderId, action] = String(callbackQuery.data).split(":")

  if (scope !== "manual" || !orderId || !action) {
    return Response.json({ ok: true })
  }

  await recordManualOrderAuditEvent(orderId, {
    channel: "telegram_callback",
    event: `manual_callback.${action}`,
    outcome: "received",
    payload: {
      callbackQueryId: callbackQuery.id ?? null
    }
  })

  await handleTelegramAction(orderId, action as "start" | "confirm" | "complete")

  await recordManualOrderAuditEvent(orderId, {
    channel: "telegram_callback",
    event: `manual_callback.${action}`,
    outcome: "processed",
    payload: {
      callbackQueryId: callbackQuery.id ?? null
    }
  })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (botToken && callbackQuery.id) {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: `Updated ${orderId} with ${action}`
      })
    })
  }

  return Response.json({ ok: true })
}