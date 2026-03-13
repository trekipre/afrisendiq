export async function detectOperator(phone: string, country: string) {

  const res = await fetch(
    `https://topups.reloadly.com/operators/auto-detect/phone/${phone}/countries/${country}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.RELOADLY_TOKEN}`
      }
    }
  )

  return res.json()
}
