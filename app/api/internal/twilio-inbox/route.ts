import { listTwilioInboundMessages } from "@/app/lib/twilioInbox"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get("limit") || "100")

    const messages = await listTwilioInboundMessages(Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 100)

    return Response.json({
      success: true,
      messages,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to load Twilio inbox"
    }, { status: 500 })
  }
}