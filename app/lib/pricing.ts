export function calculatePrice(providerCost: number) {

  const markup = 0.12

  const price = providerCost + (providerCost * markup)

  return Math.round(price * 100) / 100
}