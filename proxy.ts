import { NextResponse, type NextRequest } from "next/server"
import { createInternalUnauthorizedResponse, decodeBasicCredentials, getInternalCredentialsConfigured } from "@/app/lib/internalAuth"

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/internal")
    || pathname.startsWith("/api/internal")
    || /^\/api\/cote-divoire\/manual-billing\/[^/]+\/operator$/.test(pathname)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const username = process.env.INTERNAL_DASHBOARD_USERNAME
  const password = process.env.INTERNAL_DASHBOARD_PASSWORD
  const credentialsConfigured = getInternalCredentialsConfigured()

  if (!credentialsConfigured) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next()
    }

    return createInternalUnauthorizedResponse(pathname.startsWith("/api/"))
  }

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Basic ")) {
    return createInternalUnauthorizedResponse(pathname.startsWith("/api/"))
  }

  const encodedCredentials = authorization.slice("Basic ".length)
  const decodedCredentials = decodeBasicCredentials(encodedCredentials)

  if (!decodedCredentials) {
    return createInternalUnauthorizedResponse(pathname.startsWith("/api/"))
  }

  const separatorIndex = decodedCredentials.indexOf(":")

  if (separatorIndex === -1) {
    return createInternalUnauthorizedResponse(pathname.startsWith("/api/"))
  }

  const requestUsername = decodedCredentials.slice(0, separatorIndex)
  const requestPassword = decodedCredentials.slice(separatorIndex + 1)

  if (requestUsername !== username || requestPassword !== password) {
    return createInternalUnauthorizedResponse(pathname.startsWith("/api/"))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/internal/:path*", "/api/internal/:path*", "/api/cote-divoire/manual-billing/:path*/operator"],
}