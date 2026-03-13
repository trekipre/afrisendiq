"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
export default function CoteDIvoirePage() {

  const [phone, setPhone] = useState("")
const [operator, setOperator] = useState("")
const [loadingOperator, setLoadingOperator] = useState(false)
const [amount, setAmount] = useState(5000)

  const [fxRates, setFxRates] = useState<any>(null);
  useEffect(() => {
  async function loadFX() {



    const res = await fetch("/api/fx");
    const data = await res.json();

    setFxRates(data.rates);

  }

  loadFX();
}, []);
async function detectOperator(phoneNumber: string) {

  if (phoneNumber.length < 8) return

  setLoadingOperator(true)

  const res = await fetch("/api/reloadly/detect-operator", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      phone: phoneNumber
    })
  })

  const data = await res.json()

  if (data.success) {
    setOperator(data.operator.name)
  }

  setLoadingOperator(false)
}

  function calculateUSD(amountXOF: number) {

  if (!fxRates?.XOF) return 0

  const rate = Number(fxRates.XOF)

  const usd = amountXOF / rate

  let fee = 0

  if (amountXOF <= 5000) {
    fee = 1.40
  }

  else if (amountXOF <= 20000) {
    fee = 1.20
  }

  else if (amountXOF <= 100000) {
    fee = 0.80
  }

  else {
    fee = 0.60
  }

  return (usd + fee).toFixed(2)

}

  return (
    <main className="min-h-screen bg-green-900 p-8">

      <div className="max-w-5xl mx-auto">

        <h1 className="text-3xl font-bold text-white mb-6">
          🇨🇮 Côte d’Ivoire Services Hub
        </h1>
        {fxRates?.XOF && (
  <div className="bg-green-800/40 text-green-200 px-4 py-2 rounded-lg mb-6 inline-block">
    Market FX Rate:
    <span className="font-semibold ml-1">
      1 USD = {Number(fxRates.XOF).toFixed(2)} XOF
    </span>
  </div>
)}
   <div className="bg-yellow-500/20 text-yellow-200 px-4 py-2 rounded-lg mb-6 inline-block">
Estimated Price for {amount} XOF:
<span className="font-semibold ml-2">
${calculateUSD(amount)}
</span>
</div>
     <h2 className="text-xl font-semibold text-white mb-4">
   Available Services
   </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/"
            className="inline-block hover:shadow-xl transition"
          >
            <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
              <h2 className="text-xl font-semibold mb-2">Send Money to Côte d’Ivoire</h2>
              <p className="text-gray-600">
                Compare the best money transfer services sending to Côte d’Ivoire.
              </p>
            </div>
          </Link>

          <Link
            href="/cote-divoire/phone-top-up"
            className="block bg-white rounded-xl p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <h2 className="text-xl font-semibold mb-2">📱 Phone Top-Up</h2>
            <p className="text-gray-600">Recharge MTN, Orange, and Moov mobile numbers instantly.</p>
          </Link>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all">
            <h2 className="text-xl font-semibold mb-2">🎁 Gift Cards</h2>
            <p className="text-gray-600">Send Jumia and other digital gift cards to family in Côte d’Ivoire.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all">
            <h2 className="text-xl font-semibold mb-2">⚡ Electricity Bill</h2>
            <p className="text-gray-600">Pay CIE electricity bills from abroad.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all">
            <h2 className="text-xl font-semibold mb-2">💧 Water Bill</h2>
            <p className="text-gray-600">Pay SODECI water bills easily.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all">
            <h2 className="text-xl font-semibold mb-2">📺 Canal+ Subscription</h2>
            <p className="text-gray-600">Recharge Canal+ TV subscriptions.</p>
          </div>

      </div>
    </div>

    </main>
  );
}
