"use client";
import { useState } from "react";
export default function PhoneTopUpPage() {
    const [phone, setPhone] = useState("");
const [operator, setOperator] = useState("");
const [amount, setAmount] = useState(1000);
const detectOperator = (value: string) => {

  if (value.startsWith("+22505")) {
    setOperator("MTN Côte d'Ivoire");
  } 
  else if (value.startsWith("+22507")) {
    setOperator("Orange Côte d'Ivoire");
  } 
  else if (value.startsWith("+22501")) {
    setOperator("Moov Côte d'Ivoire");
  } 
  else {
    setOperator("");
  }

};
  return (
    <main className="min-h-screen bg-green-900 p-8">

      <div className="max-w-3xl mx-auto">

        <h1 className="text-3xl font-bold text-white mb-6">
          📱 Côte d’Ivoire Phone Top-Up
        </h1>
<p className="text-green-100 mb-6">
Send airtime instantly to MTN, Orange, or Moov numbers in Côte d’Ivoire.
</p>
        <div className="bg-white rounded-xl p-6 shadow-md">

          <label className="block text-sm font-medium mb-2">
            Phone Number
          </label>

          <input
  type="text"
  placeholder="+2250700000000"
  value={phone}
  onChange={(e) => {
    const value = e.target.value
    setPhone(value)
    detectOperator(value)
  }}
  className="w-full border rounded p-2"
/>

          <label className="block text-sm font-medium mb-2">
            Select Operator
          </label>

         <select
value={operator}
onChange={(e) => setOperator(e.target.value)}
className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-600"
>
            <option value="MTN Côte d'Ivoire">MTN Côte d'Ivoire</option>
<option value="Orange Côte d'Ivoire">Orange Côte d'Ivoire</option>
<option value="Moov Côte d'Ivoire">Moov Côte d'Ivoire</option>
          </select>

          <label className="block text-sm font-medium mb-2">
            Amount
          </label>

          <select
value={amount.toString()}
onChange={(e) => setAmount(parseInt(e.target.value))}
className="w-full border border-gray-300 rounded-lg p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-green-600"
>
            <option value="1000">1,000 XOF</option>
            <option value="2000">2,000 XOF</option>
            <option value="5000">5,000 XOF</option>
            <option value="10000">10,000 XOF</option>
            <option value="20000">20,000 XOF</option>
          </select>
<button
 onClick={async () => {
   const res = await fetch("/api/airtime/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        amount
      })
   })

   const data = await res.json()

   if (data.success) {
     alert("Recharge successful!")
   } else {
     alert("Recharge failed")
   }
}}
className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800"
>
Continue Recharge
</button>
        </div>

      </div>

    </main>
  );
}