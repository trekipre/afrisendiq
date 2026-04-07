"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand"
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel"
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets"

type TwilioInboundMessage = {
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
  signatureValid: boolean
  receivedAt: string
}

function formatChannelLabel(channel: TwilioInboundMessage["channel"]) {
  return channel === "whatsapp" ? "WhatsApp" : "SMS"
}

export default function InternalTwilioInboxPage() {
  const [messages, setMessages] = useState<TwilioInboundMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [channelFilter, setChannelFilter] = useState<string>("all")

  useEffect(() => {
    async function loadInbox() {
      try {
        const response = await fetch("/api/internal/twilio-inbox")
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Unable to load Twilio inbox")
        }

        setMessages(payload.messages || [])
        setError(null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load Twilio inbox")
      } finally {
        setLoading(false)
      }
    }

    void loadInbox()
  }, [])

  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return messages
      .filter((message) => channelFilter === "all" || message.channel === channelFilter)
      .filter((message) => {
        if (!normalizedQuery) {
          return true
        }

        return [message.fromNumber, message.toNumber, message.body, message.profileName, message.providerMessageSid]
          .some((value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery))
      })
  }, [channelFilter, messages, query])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#0b1f18_42%,#07120d_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/internal/manual-billing" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Manual billing queue
            </Link>
            <Link href="/internal/cie-readiness" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              CIE readiness
            </Link>
            <Link href="/internal/profitability" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              Profitability
            </Link>
          </div>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">Internal Twilio inbox</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">Inbound SMS and WhatsApp messages received through Twilio.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/78">
              This inbox is populated by the Twilio inbound webhook route. It stores verified inbound messages in Supabase and gives ops a quick view without leaving AfriSendIQ.
            </p>
          </div>
          <CoteDIvoireHeroPanel
            badge="Twilio inbox"
            gradientClass="from-[#17335F] via-[#1F4E8C] to-[#38A3FF]"
            imageSrcs={coteDivoireVisualAssets.ciePostpaid}
            imageAlt="Twilio inbox operations card"
            contextLabel="Operations"
            wordmark="AfriSendIQ"
            heightClassName="h-[20rem]"
          />
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
          <div className="flex flex-wrap gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search phone, message body, profile, or SID"
              className="min-w-[18rem] flex-1 rounded-full border border-white/12 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-emerald-50/45"
            />
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="rounded-full border border-white/12 bg-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">All channels</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </section>

        {loading ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">Loading Twilio inbox...</div>
        ) : error ? (
          <div className="mt-8 rounded-[1.75rem] border border-rose-200/50 bg-rose-50 p-6 text-sm text-rose-900">{error}</div>
        ) : filteredMessages.length === 0 ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">No inbound Twilio messages match the current filters.</div>
        ) : (
          <section className="mt-8 grid gap-5">
            {filteredMessages.map((message) => (
              <article key={message.id} className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{formatChannelLabel(message.channel)}</div>
                    <h2 className="mt-2 text-xl font-semibold">{message.fromNumber} to {message.toNumber}</h2>
                    <p className="mt-2 text-sm text-slate-600">Received {new Date(message.receivedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${message.signatureValid ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
                      {message.signatureValid ? "signature valid" : "signature invalid"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-800">
                      media {message.numMedia}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-[#F5FBF8] px-4 py-3 text-sm text-slate-700">
                    <div><strong>SID:</strong> {message.providerMessageSid}</div>
                    {message.profileName ? <div className="mt-2"><strong>Profile:</strong> {message.profileName}</div> : null}
                    {message.messagingServiceSid ? <div className="mt-2"><strong>Messaging service:</strong> {message.messagingServiceSid}</div> : null}
                  </div>
                  <div className="rounded-2xl bg-[#F5FBF8] px-4 py-3 text-sm text-slate-700">
                    <div><strong>Body</strong></div>
                    <p className="mt-2 whitespace-pre-wrap leading-7">{message.body || "No text body"}</p>
                  </div>
                </div>

                {message.mediaUrls.length > 0 ? (
                  <div className="mt-4 rounded-2xl bg-[#F5FBF8] px-4 py-3 text-sm text-slate-700">
                    <div><strong>Media URLs</strong></div>
                    <div className="mt-2 grid gap-2">
                      {message.mediaUrls.map((mediaUrl) => (
                        <a key={mediaUrl} href={mediaUrl} target="_blank" rel="noreferrer" className="break-all text-[#1F4E8C] underline">
                          {mediaUrl}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}