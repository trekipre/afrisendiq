import { NextResponse, type NextRequest } from "next/server"

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/internal") || pathname.startsWith("/api/internal")
}

function unauthorizedResponse(pathname: string, credentialsConfigured: boolean) {
  const isApiRequest = pathname.startsWith("/api/")

  if (!credentialsConfigured) {
    const message = "Internal access is not configured. Set INTERNAL_DASHBOARD_USERNAME and INTERNAL_DASHBOARD_PASSWORD."

    if (isApiRequest) {
      return NextResponse.json({ success: false, error: message }, { status: 503 })
    }

    return new NextResponse(message, { status: 503 })
  }

  const headers = new Headers({ "WWW-Authenticate": 'Basic realm="AfriSendIQ Internal"' })

  if (isApiRequest) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers })
  }

  return new NextResponse("Unauthorized", { status: 401, headers })
}

function decodeBasicCredentials(encodedCredentials: string) {
  try {
    return atob(encodedCredentials)
  } catch {
    return null
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const username = process.env.INTERNAL_DASHBOARD_USERNAME
  const password = process.env.INTERNAL_DASHBOARD_PASSWORD
  const credentialsConfigured = Boolean(username && password)

  if (!credentialsConfigured) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next()
    }

    return unauthorizedResponse(pathname, false)
  }

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Basic ")) {
    return unauthorizedResponse(pathname, true)
  }

  const encodedCredentials = authorization.slice("Basic ".length)
  const decodedCredentials = decodeBasicCredentials(encodedCredentials)

  if (!decodedCredentials) {
    return unauthorizedResponse(pathname, true)
  }

  const separatorIndex = decodedCredentials.indexOf(":")

  if (separatorIndex === -1) {
    return unauthorizedResponse(pathname, true)
  }

  const requestUsername = decodedCredentials.slice(0, separatorIndex)
  const requestPassword = decodedCredentials.slice(separatorIndex + 1)

  if (requestUsername !== username || requestPassword !== password) {
    return unauthorizedResponse(pathname, true)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/internal/:path*", "/api/internal/:path*"],
}