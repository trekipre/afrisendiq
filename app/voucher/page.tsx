"use client"

import { useState } from "react"

export default function VoucherPage() {

  const [voucher, setVoucher] = useState("")

  async function createVoucher() {

    const response = await fetch("/api/voucher/create", {
      method: "POST"
    })

    const data = await response.json()

    console.log("API response:", data)

    setVoucher(data.voucherCode)

  }

  return (
    <div style={{ padding: "40px" }}>

      <h1>AfriSendIQ Voucher Generator</h1>

      <button
        onClick={createVoucher}
        style={{
          padding: "10px",
          background: "blue",
          color: "white",
          border: "none"
        }}
      >
        Generate Voucher
      </button>

      {voucher && (
        <div style={{ marginTop: "20px" }}>
          <h2>Voucher Code</h2>
          <h1>{voucher}</h1>
        </div>
      )}

    </div>
  )
}