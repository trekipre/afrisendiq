import { getReloadlyToken } from "@/app/lib/reloadly"

export async function POST(req) {

  const { phone, operatorId, amount } = await req.json()

  const token = await getReloadlyToken()

  const response = await fetch(
    "https://topups.reloadly.com/topups",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        operatorId: operatorId,
        amount: amount,
        useLocalAmount: true,
        customIdentifier: "AfrisendIQ",
        recipientPhone: {
          countryCode: "CI",
          number: phone
        }
      })
    }
  )

  const data = await response.json()

  return Response.json(data)
}