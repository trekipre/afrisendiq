export async function dtoneRequest(endpoint: string, method = "GET", body?: any) {

  const url = `${process.env.DTONE_BASE_URL}${endpoint}`

  const headers: any = {
    "Content-Type": "application/json",
    Authorization:
      "Basic " +
      Buffer.from(
        `${process.env.DTONE_API_KEY}:${process.env.DTONE_API_SECRET}`
      ).toString("base64")
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json()
  return data
}

export async function getDTOneProducts() {
  return dtoneRequest("/v1/products")
}