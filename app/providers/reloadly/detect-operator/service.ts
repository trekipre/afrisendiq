import { getReloadlyToken } from "@/app/lib/reloadlyAuth"

export async function detectOperator(phone: string, country: string) {
  const token = await getReloadlyToken()
  const normalizedPhone = phone.replace(/\D/g, "")

  const res = await fetch(
    `https://topups.reloadly.com/operators/auto-detect/phone/${normalizedPhone}/countries/${country}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  if (!res.ok) {
    throw new Error(`Reloadly operator detection failed with status ${res.status}`)
  }

  return res.json()
}
