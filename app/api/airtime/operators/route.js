import { getReloadlyToken } from "@/lib/reloadly"

export async function GET() {

  const token = await getReloadlyToken()

  const response = await fetch(
    "https://topups.reloadly.com/operators/countries/CI",
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  )

  const data = await response.json()

  return Response.json(data)
}