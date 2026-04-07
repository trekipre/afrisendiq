export type AfricasTalkingDeliveryReportPayload = {
  id?: string
  status?: string
  phoneNumber?: string
  networkCode?: string
  failureReason?: string
  retryCount?: string
  [key: string]: string | undefined
}

export function parseAfricasTalkingDeliveryReportPayload(formData: URLSearchParams): AfricasTalkingDeliveryReportPayload {
  const payload: AfricasTalkingDeliveryReportPayload = {}

  for (const [key, value] of formData.entries()) {
    payload[key] = value
  }

  return payload
}