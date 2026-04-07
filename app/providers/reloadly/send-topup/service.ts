import { getReloadlyToken } from "@/app/lib/reloadlyAuth"

type SendAirtimeInput = {
  operatorId: number
  phone: string
  amount: number
  reference: string
}

export async function sendAirtime({
  operatorId,
  phone,
  amount,
  reference
}: SendAirtimeInput) {
  const token = await getReloadlyToken()
  const normalizedPhone = String(phone).replace(/\D/g, "").replace(/^225/, "")

  const res = await fetch("https://topups.reloadly.com/topups", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      operatorId,
      amount,
      useLocalAmount: true,
      customIdentifier: reference,
      recipientPhone: {
        countryCode: "CI",
        number: normalizedPhone
      }
    })
  })

  if (!res.ok) {
    throw new Error(`Reloadly airtime purchase failed with status ${res.status}`)
  }

  return res.json()
}
