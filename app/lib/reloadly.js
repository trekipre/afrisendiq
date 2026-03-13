let reloadlyToken = null
let tokenExpiry = 0

export async function getReloadlyToken() {

  if (reloadlyToken && Date.now() < tokenExpiry) {
    return reloadlyToken
  }

  const response = await fetch(
    "https://auth.reloadly.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.RELOADLY_CLIENT_ID,
        client_secret: process.env.RELOADLY_CLIENT_SECRET,
        grant_type: "client_credentials",
        audience: "https://topups.reloadly.com"
      })
    }
  )

  const data = await response.json()

  reloadlyToken = data.access_token
  tokenExpiry = Date.now() + data.expires_in * 1000

  return reloadlyToken
}