type DingTokenResponse = {
  access_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

let cachedToken: string | null = null
let expiry = 0

export function hasDingCredentials() {
  return Boolean(process.env.DING_CLIENT_ID && process.env.DING_CLIENT_SECRET && process.env.DING_TOKEN_URL)
}

export async function getDingAccessToken() {
  if (!hasDingCredentials()) {
    throw new Error("Ding credentials are not configured")
  }

  if (cachedToken && Date.now() < expiry) {
    return cachedToken
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.DING_CLIENT_ID || "",
    client_secret: process.env.DING_CLIENT_SECRET || ""
  })

  if (process.env.DING_SCOPE) {
    body.set("scope", process.env.DING_SCOPE)
  }

  const response = await fetch(process.env.DING_TOKEN_URL || "https://idp.ding.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  })

  const rawBody = await response.text()
  const data = rawBody ? JSON.parse(rawBody) as DingTokenResponse & { error?: string } : {}

  if (!response.ok) {
    throw new Error(data.error || `Ding auth failed with status ${response.status}`)
  }

  if (!data.access_token) {
    throw new Error("Ding auth response was missing access token data")
  }

  cachedToken = data.access_token
  expiry = Date.now() + Math.max((data.expires_in || 3600) - 60, 30) * 1000

  return cachedToken
}

export function resetDingTokenCache() {
  cachedToken = null
  expiry = 0
}