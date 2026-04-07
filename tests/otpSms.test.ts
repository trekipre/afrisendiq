import { buildOtpSmsMessage } from "@/app/lib/otpSms"

describe("OTP SMS template", () => {
  it("builds a branded OTP message with the default safety copy", () => {
    expect(buildOtpSmsMessage({ code: "123456" })).toBe([
      "AfriSendIQ verification code: 123456",
      "Use it to finish your sign-in.",
      "Expires in 10 min. Do not share this code.",
      "afrisendiq.com",
    ].join("\n"))
  })

  it("supports custom purpose and expiry", () => {
    expect(buildOtpSmsMessage({
      code: "AB12CD",
      purpose: "account recovery",
      expiryMinutes: 5,
    })).toContain("Use it to finish your account recovery.")

    expect(buildOtpSmsMessage({
      code: "AB12CD",
      purpose: "account recovery",
      expiryMinutes: 5,
    })).toContain("Expires in 5 min. Do not share this code.")
  })

  it("rejects invalid OTP codes", () => {
    expect(() => buildOtpSmsMessage({ code: "12" })).toThrow("OTP code must be 4 to 10 alphanumeric characters")
  })
})