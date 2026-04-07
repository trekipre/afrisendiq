import { getReloadlyToken } from "./reloadlyAuth"

export { getReloadlyToken }

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

// Detect mobile operator
export async function detectOperator(phone: string) {
  const token = await getReloadlyToken()
  const normalizedPhone = normalizePhone(phone)

  const res = await fetch(
   `https://topups.reloadly.com/operators/auto-detect/phone/${normalizedPhone}/countries/CI`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  if (!res.ok) {
    throw new Error(`Reloadly operator detection failed with status ${res.status}`)
  }

  const data = await res.json()

  return {
    name: data.name,
    operatorId: data.operatorId,
    countryCode: "CI"
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

  if (!response.ok) {
    throw new Error(`Reloadly balance lookup failed with status ${response.status}`)
  }

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
  const normalizedPhone = normalizePhone(phone)

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
        number: normalizedPhone.replace(/^225/, "")
      }
    })
  }
)
 
  if (!response.ok) {
    throw new Error(`Reloadly topup failed with status ${response.status}`)
  }

  return response.json()
}