let cachedToken: string | null = null
let expiry = 0

export async function getReloadlyToken() {
  if (cachedToken && Date.now() < expiry) {
    return cachedToken
  }

  const authUrl = process.env.RELOADLY_AUTH_URL || "https://auth.reloadly.com/oauth/token"
  const audience = process.env.RELOADLY_AUDIENCE || "https://topups.reloadly.com"

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: process.env.RELOADLY_CLIENT_ID,
      client_secret: process.env.RELOADLY_CLIENT_SECRET,
      grant_type: "client_credentials",
      audience
    })
  })

  if (!response.ok) {
    throw new Error(`Reloadly auth failed with status ${response.status}`)
  }

  const data = await response.json()

  if (!data.access_token || !data.expires_in) {
    throw new Error("Reloadly auth response was missing access token data")
  }

  cachedToken = data.access_token
  expiry = Date.now() + Math.max(data.expires_in - 60, 30) * 1000

  return cachedToken
}