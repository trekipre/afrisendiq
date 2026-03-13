"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Image from "next/image";

type Provider = {
  id: string;
  name: string;
logo_url: string;

  exchange_rate_score: number;
  exchange_rate: number;

  fee_score: number;
  speed_score: number;
  ease_score: number;
  efficiency_score: number;

  mobile_wallet_speed: number;
bank_deposit_speed: number;

referral_link: string;
};

function calculateScore(p: Partial<Provider>) {
  const exchange = Number(p.exchange_rate_score || 0);
  const fee = Number(p.fee_score || 0);
  const speed = Number(p.speed_score || 0);
  const ease = Number(p.ease_score || 0);
  const efficiency = Number(p.efficiency_score || 0);
  return (
  exchange * 0.35 +
  fee * 0.2 +
  speed * 0.2 +
  ease * 0.15 +
  efficiency * 0.1
);
}

export default function Home() {
  const [amount, setAmount] = useState<number>(500);
  const [country, setCountry] = useState<string>("Côte d'Ivoire");
  const currencyMap: Record<string, string> = {
  "Côte d'Ivoire": "XOF",
  Nigeria: "NGN",
  Ghana: "GHS",
  Kenya: "KES",
  Senegal: "XOF",
};
const [fxRates, setFxRates] = useState<any>(null);

useEffect(() => {
  async function loadFX() {
    const res = await fetch("/api/fx");
    const data = await res.json();
    setFxRates(data.rates);
  }

  loadFX();
}, []);

const currentRate = fxRates ? fxRates[currencyMap[country]] : null;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);


async function loadProviders() {
  setLoading(true);

  const { data, error } =
    await supabase.from("transfer_providers").select("*");
 if (error) {
   console.error("Supabase error:", error);
   setFetchError(error.message);
   setProviders([]);
   setLoading(false);
   return;
 } else {
   setProviders(data || []);
 }
 
  setLoading(false);
}

useEffect(() => {
  loadProviders();
}, []);

  const ranked = providers
    .map((p) => ({ ...p, final_score: calculateScore(p) }))
    .sort((a, b) => b.final_score - a.final_score);

  const fastestMobile = ranked.length ? [...ranked].sort(
    (a, b) => (b.mobile_wallet_speed ?? 0) - (a.mobile_wallet_speed ?? 0)
  )[0] : undefined;
  const fastestBank = ranked.length ? [...ranked].sort(
  (a, b) => (b.bank_deposit_speed ?? 0) - (a.bank_deposit_speed ?? 0)
)[0] : undefined;
const rankedWithPayout = ranked.map((provider) => {
  const rate = provider.exchange_rate || 0;
  const payout = amount * rate;

  return {
    ...provider,
    payout,
  };
});
const bestPayout = [...rankedWithPayout].sort(
  (a, b) => b.payout - a.payout
)[0];

 const payoutSorted = [...rankedWithPayout].sort(
   (a, b) => b.payout - a.payout
 );

 const savings =
   payoutSorted.length > 1
     ? payoutSorted[0].payout - payoutSorted[1].payout
     : 0;
 
  return (
    <main className="min-h-screen bg-[#0F3D2E] text-white p-10">
      <h1 className="text-4xl font-bold text-center mb-10">AfriSendIQ Rankings</h1>

      <div className="bg-white text-black p-6 rounded-xl mb-10 max-w-xl mx-auto">
      
        
<div className="mb-4">
  <label className="block text-sm font-semibold">
    Amount to Send (USD)
  </label>

  <input
    type="number"
    value={amount}
    onChange={(e) => setAmount(Number(e.target.value))}
    className="w-full border rounded p-2"
    placeholder="Enter amount"
  />
</div>
 {currentRate && (
   <div className="text-center text-sm text-gray-200 mt-2">
     Current FX Rate: <span className="font-semibold">1 USD = {currentRate.toFixed(2)} {currencyMap[country]}</span>
   </div>
 )}
        <div className="mb-4">
          <label className="block text-sm font-semibold">Destination Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option>Côte d'Ivoire</option>
            <option>Nigeria</option>
            <option>Ghana</option>
            <option>Kenya</option>
            <option>Senegal</option>
          </select>
        </div>
 <button
   onClick={loadProviders}
   className="bg-[#0F3D2E] text-white px-4 py-2 rounded w-full"
 >
   Compare Transfers
 </button>
    
    </div>

      {loading && <div className="text-center">Loading providers...</div>}
      {fetchError && <div className="text-center text-red-400">{fetchError}</div>}
 <div className="bg-white text-black rounded-xl p-6 shadow-lg mb-8 border border-gray-200 flex flex-col gap-2">
  <h2 className="text-xl font-bold mb-4 text-gray-900">
    Send ${amount} → Côte d’Ivoire
  </h2>

  {providers.length > 0 && (
    <div className="space-y-2 text-sm text-gray-700">
      <div>
        🏆 Best Overall (AI Score): <span className="font-semibold">{ranked[0]?.name}</span>
      </div>

      <div>
        💰 Highest Payout: <span className="font-semibold">{payoutSorted[0]?.name}</span>
      </div>
      {savings > 0 && (
        <div className="mt-3 text-sm font-semibold text-green-700">
          💰 You receive {savings.toLocaleString()} more XOF with {payoutSorted[0]?.name}
        </div>
      )}

      <div>
        ⚡ Fastest: <span className="font-semibold">{fastestMobile?.name}</span>
      </div>
    </div>
  )}
</div>
      <div className="grid md:grid-cols-2 gap-6">
        {ranked.map((provider, index) => (
          <div
  key={provider.id}
  style={{ animationDelay: `${index * 120}ms` }}
  className="relative bg-white text-black rounded-xl p-6 shadow-lg transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] cursor-pointer animate-cardFade"
>
   {index === 0 && (
   <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">
     <div className="font-semibold mb-1">🏆 Why this provider ranks #1</div>
     <ul className="list-disc ml-5 space-y-1">
       {provider.exchange_rate_score >= 8 && <li>Strong exchange rate</li>}
       {provider.mobile_wallet_speed >= 8 && <li>Fast mobile wallet transfers</li>}
       {provider.fee_score >= 8 && <li>Low transfer fees</li>}
       {provider.ease_score >= 8 && <li>Easy to use service</li>}
     </ul>
   </div>
 )}
   {index === 0 && (
   <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-md">
     🏆 TOP PICK
   </div>
 )}
            <div className="flex items-center gap-3 mb-3">
  
  <img
  src={provider.logo_url}
  alt={provider.name}
  width={40}
  height={40}
  className="object-contain"
  referrerPolicy="no-referrer"
  onError={(e) => {
    e.currentTarget.src = "https://via.placeholder.com/40?text=Logo";
  }}
/>
              <h2 className="text-2xl font-bold">{provider.name}</h2>
            </div>
{index === 0 && (
  <span className="inline-flex items-center gap-1 mt-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full transition transform hover:scale-110 hover:bg-green-200 cursor-pointer">
  🏆 Best Overall
</span>
)}

{index === 1 && (
  <span className="inline-flex items-center gap-1 mt-2 bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full transition transform hover:scale-110 hover:bg-yellow-200 cursor-pointer">
  💰 Best Rate
</span>
)}

{index === 2 && (
  <span className="inline-flex items-center gap-1 mt-2 bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full transition transform hover:scale-110 hover:bg-blue-200 cursor-pointer">
  ⚡ Fastest
</span>
)}

            {ranked.length > 0 && ranked[0].id === provider.id && (
              <span className="inline-flex items-center gap-1 mt-2 bg-yellow-200 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full transition transform hover:scale-110 hover:bg-yellow-300 cursor-pointer">
  🏆 #1 Best Overall
</span>
            )}

            {provider.id === fastestMobile?.id && (
              <span className="inline-flex items-center gap-1 mt-2 bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full transition transform hover:scale-110 hover:bg-blue-200 cursor-pointer">
  ⚡ Fastest Mobile Wallet
</span>
            )}

            {provider.id === fastestBank?.id && (
              <span className="inline-flex items-center gap-1 mt-2 bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full transition transform hover:scale-110 hover:bg-purple-200 cursor-pointer">
  🏦 Fastest Bank Deposit
</span>
            )}

             {provider.id === payoutSorted[0]?.id && (
   <span className="inline-flex items-center gap-1 mt-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
     💰 Highest Payout
   </span>
 )}

            <p className="mb-2">
              Final AI Score: <span className="font-semibold">{provider.final_score?.toFixed(2) || "0.00"}</span>
            </p>

            <p className="mb-2">
              Estimated Receive: <span className="font-semibold text-green-700">{(provider.exchange_rate * amount).toLocaleString() + " " + currencyMap[country]}</span>
            </p>

            <a
              href={provider.referral_link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0F3D2E] text-white px-4 py-2 rounded inline-block"
            >
              Send Money
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}