export function getInternalCredentialsConfigured() {
  return Boolean(process.env.INTERNAL_DASHBOARD_USERNAME && process.env.INTERNAL_DASHBOARD_PASSWORD)
}

export function decodeBasicCredentials(encodedCredentials: string) {
  try {
    return atob(encodedCredentials)
  } catch {
    return null
  }
}

export function isAuthorizedInternalRequest(request: Request) {
  const username = process.env.INTERNAL_DASHBOARD_USERNAME
  const password = process.env.INTERNAL_DASHBOARD_PASSWORD

  if (!username || !password) {
    return false
  }

  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Basic ")) {
    return false
  }

  const encodedCredentials = authorization.slice("Basic ".length)
  const decodedCredentials = decodeBasicCredentials(encodedCredentials)
  if (!decodedCredentials) {
    return false
  }

  const separatorIndex = decodedCredentials.indexOf(":")
  if (separatorIndex === -1) {
    return false
  }

  const requestUsername = decodedCredentials.slice(0, separatorIndex)
  const requestPassword = decodedCredentials.slice(separatorIndex + 1)

  return requestUsername === username && requestPassword === password
}

export function createInternalUnauthorizedResponse(isApiRequest: boolean) {
  const credentialsConfigured = getInternalCredentialsConfigured()

  if (!credentialsConfigured) {
    const message = "Internal access is not configured. Set INTERNAL_DASHBOARD_USERNAME and INTERNAL_DASHBOARD_PASSWORD."

    if (isApiRequest) {
      return Response.json({ success: false, error: message }, { status: 503 })
    }

    return new Response(message, { status: 503 })
  }

  const headers = new Headers({ "WWW-Authenticate": 'Basic realm="AfriSendIQ Internal"' })

  if (isApiRequest) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401, headers })
  }

  return new Response("Unauthorized", { status: 401, headers })
}