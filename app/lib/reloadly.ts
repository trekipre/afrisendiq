let accessToken: string | null = null
let tokenExpiry = 0

export async function getReloadlyToken() {

  const now = Date.now()

  if (accessToken && now < tokenExpiry) {
    return accessToken
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

  accessToken = data.access_token
  tokenExpiry = Date.now() + data.expires_in * 1000

  return accessToken
}


// Detect mobile operator
export async function detectOperator(phone: string) {

  const token = await getReloadlyToken()

  const res = await fetch(
   `https://topups.reloadly.com/operators/auto-detect/phone/${phone.replace("+","")}/countries/CI`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  const data = await res.json()

  return {
    name: data.name,
    id: data.operatorId
  }
}
// Get balance
export async function getReloadlyBalance() {

  const token = await getReloadlyToken()

  const response = await fetch(
    "https://topups.reloadly.com/accounts/balance",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  const data = await response.json()

  return data
}

// Send airtime
export async function sendTopup(
  phone: string,
  operatorId: number,
  amount: number
) {
  const reference = "ASIQ-" + Date.now()

  const token = await getReloadlyToken()

  const response = await fetch(
  "https://topups.reloadly.com/topups",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      operatorId: operatorId,
      amount: amount,
      useLocalAmount: true,
      customIdentifier: reference,
      recipientPhone: {
        countryCode: "CI",
        number: phone
      }
    })
  }
)
 

  return response.json()
}