export async function sendAirtime({
  operatorId,
  phone,
  amount,
  reference
}: any) {

  const res = await fetch("https://topups.reloadly.com/topups", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RELOADLY_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      operatorId,
      amount,
      useLocalAmount: true,
      customIdentifier: reference,
      recipientPhone: {
        countryCode: "CI",
        number: phone.replace("+225", "")
      }
    })
  })

  return res.json()
}
