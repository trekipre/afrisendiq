import { getSupabase } from "@/app/lib/supabase"

export type TwilioInboundMessage = {
  id: string
  providerMessageSid: string
  accountSid?: string
  messagingServiceSid?: string
  channel: "sms" | "whatsapp"
  fromNumber: string
  toNumber: string
  body?: string
  profileName?: string
  numMedia: number
  mediaUrls: string[]
  rawPayload: Record<string, string>
  signatureValid: boolean
  receivedAt: string
}

type TwilioInboundMessageRow = {
  id: string
  provider_message_sid: string
  account_sid: string | null
  messaging_service_sid: string | null
  channel: TwilioInboundMessage["channel"]
  from_number: string
  to_number: string
  body: string | null
  profile_name: string | null
  num_media: number
  media_urls: string[] | null
  raw_payload: Record<string, string>
  signature_valid: boolean
  received_at: string
}

function mapRow(row: TwilioInboundMessageRow): TwilioInboundMessage {
  return {
    id: row.id,
    providerMessageSid: row.provider_message_sid,
    accountSid: row.account_sid ?? undefined,
    messagingServiceSid: row.messaging_service_sid ?? undefined,
    channel: row.channel,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    body: row.body ?? undefined,
    profileName: row.profile_name ?? undefined,
    numMedia: row.num_media,
    mediaUrls: row.media_urls ?? [],
    rawPayload: row.raw_payload,
    signatureValid: row.signature_valid,
    receivedAt: row.received_at,
  }
}

export async function persistTwilioInboundMessage(message: Omit<TwilioInboundMessage, "id" | "receivedAt"> & { receivedAt?: string }) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("twilio_inbound_messages")
    .upsert(
      {
        provider_message_sid: message.providerMessageSid,
        account_sid: message.accountSid ?? null,
        messaging_service_sid: message.messagingServiceSid ?? null,
        channel: message.channel,
        from_number: message.fromNumber,
        to_number: message.toNumber,
        body: message.body ?? null,
        profile_name: message.profileName ?? null,
        num_media: message.numMedia,
        media_urls: message.mediaUrls,
        raw_payload: message.rawPayload,
        signature_valid: message.signatureValid,
        received_at: message.receivedAt ?? new Date().toISOString(),
      },
      { onConflict: "provider_message_sid" }
    )
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Unable to persist Twilio inbound message")
  }

  return mapRow(data as TwilioInboundMessageRow)
}

export async function listTwilioInboundMessages(limit = 100) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("twilio_inbound_messages")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit)

  if (error || !data) {
    throw new Error(error?.message || "Unable to list Twilio inbound messages")
  }

  return (data as TwilioInboundMessageRow[]).map(mapRow)
}