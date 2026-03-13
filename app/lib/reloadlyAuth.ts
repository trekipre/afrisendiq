let cachedToken: string | null = null
let expiry = 0

export async function getReloadlyToken() {

  if (cachedToken && Date.now() < expiry) {
    return cachedToken
  }

  const response = await fetch(process.env.RELOADLY_AUTH_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: process.env.RELOADLY_CLIENT_ID,
      client_secret: process.env.RELOADLY_CLIENT_SECRET,
      grant_type: "client_credentials",
      audience: process.env.RELOADLY_AUDIENCE
    })
  })

  const data = await response.json()

  cachedToken = data.access_token
  expiry = Date.now() + (data.expires_in - 60) * 1000

  return cachedToken
}