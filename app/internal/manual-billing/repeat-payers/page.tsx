"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";

type ManualOrder = {
  id: string;
  service: string;
  accountReference: string;
  quotedAmount?: number;
  currency: string;
  status: string;
  customer: {
    customerName: string;
    customerEmail: string;
    recipientName: string;
  };
  updatedAt: string;
  pricingSummary?: {
    inputAmount: number;
    customerPrice: number;
  };
  metadata?: {
    normalizedAccountReference?: string;
    lookup?: {
      status: "found" | "not_found" | "unavailable";
      source: "external_http" | "fixture" | "historical";
      confidence: "low" | "medium" | "high";
      amount?: number;
      currency?: string;
      lookedUpAt: string;
    };
    insights?: {
      priority: "low" | "medium" | "high";
      duplicateRisk: "low" | "medium" | "high";
      recentOrderCount: number;
      relatedCompletedOrders: number;
      relatedOpenOrders: number;
      knownAccount: boolean;
      lastKnownBillAmount?: number;
      lastKnownQuotedAmount?: number;
      suggestedNextAction: string;
    };
  };
};

type RepeatPayerRow = {
  key: string;
  service: string;
  normalizedAccountReference: string;
  latestOrder: ManualOrder;
  totalOrders: number;
  completedOrders: number;
  openOrders: number;
  customerEmails: string[];
  customerNames: string[];
  lastKnownBillAmount?: number;
  lastKnownQuotedAmount?: number;
};

function buildRepeatPayerRows(orders: ManualOrder[]) {
  const grouped = new Map<string, ManualOrder[]>();

  for (const order of orders) {
    if (order.service !== "sodeci" && order.service !== "cie-postpaid") {
      continue;
    }

    const normalizedAccountReference = order.metadata?.normalizedAccountReference || order.accountReference;
    const insights = order.metadata?.insights;
    const looksRepeated = Boolean(
      insights?.knownAccount ||
      (insights?.relatedCompletedOrders || 0) > 0 ||
      (insights?.recentOrderCount || 0) > 1
    );

    if (!looksRepeated) {
      continue;
    }

    const key = `${order.service}:${normalizedAccountReference}`;
    const existing = grouped.get(key) || [];
    existing.push(order);
    grouped.set(key, existing);
  }

  return [...grouped.entries()]
    .map(([key, cohort]): RepeatPayerRow => {
      const sorted = [...cohort].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const latestOrder = sorted[0];
      const completedOrders = cohort.filter((order) => order.status === "completed").length;
      const openOrders = cohort.filter((order) => order.status !== "completed" && order.status !== "failed").length;
      const customerEmails = [...new Set(cohort.map((order) => order.customer.customerEmail))];
      const customerNames = [...new Set(cohort.map((order) => order.customer.customerName))];

      return {
        key,
        service: latestOrder.service,
        normalizedAccountReference: latestOrder.metadata?.normalizedAccountReference || latestOrder.accountReference,
        latestOrder,
        totalOrders: cohort.length,
        completedOrders,
        openOrders,
        customerEmails,
        customerNames,
        lastKnownBillAmount: latestOrder.metadata?.insights?.lastKnownBillAmount ?? latestOrder.pricingSummary?.inputAmount,
        lastKnownQuotedAmount: latestOrder.metadata?.insights?.lastKnownQuotedAmount ?? latestOrder.quotedAmount ?? latestOrder.pricingSummary?.customerPrice,
      };
    })
    .sort((left, right) => {
      if (left.completedOrders !== right.completedOrders) {
        return right.completedOrders - left.completedOrders;
      }

      if (left.totalOrders !== right.totalOrders) {
        return right.totalOrders - left.totalOrders;
      }

      return right.latestOrder.updatedAt.localeCompare(left.latestOrder.updatedAt);
    });
}

export default function ManualBillingRepeatPayersPage() {
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);

      try {
        const response = await fetch("/api/cote-divoire/manual-billing");
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Unable to load repeat payer data");
        }

        setOrders(payload.orders || []);
        setMessage(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load repeat payer data");
      } finally {
        setLoading(false);
      }
    }

    void loadOrders();
  }, []);

  const repeatPayers = buildRepeatPayerRows(orders);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#0b1f18_42%,#07120d_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3">
            <Link href="/internal/manual-billing" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              Back to queue
            </Link>
          </div>
        </div>

        <section className="rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">Repeat payer dashboard</div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">Known CIE and SODECI accounts with repeat payment behavior.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/78">
            This dashboard groups known utility references using normalized account metadata and recent order history so operators can identify habitual payers, likely duplicate requests, and likely bill ranges before manual intervention.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-emerald-50/78">
            <div>{repeatPayers.length} repeat payer cohorts</div>
            <div>{repeatPayers.reduce((total, row) => total + row.completedOrders, 0)} completed repeat payments</div>
            <div>{repeatPayers.reduce((total, row) => total + row.openOrders, 0)} open repeat requests</div>
          </div>
        </section>

        {message ? <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">{message}</div> : null}

        {loading ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">Loading repeat payer cohorts...</div>
        ) : repeatPayers.length === 0 ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">No repeat CIE or SODECI payer cohorts are available yet.</div>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            {repeatPayers.map((row) => (
              <article key={row.key} className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{row.service}</div>
                    <h2 className="mt-2 text-2xl font-semibold">{row.normalizedAccountReference}</h2>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {row.latestOrder.metadata?.insights?.priority || "medium"} priority
                  </div>
                </div>

                <div className="mt-5 grid gap-4 text-sm text-slate-700 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total orders</div>
                    <div className="mt-2 text-2xl font-semibold">{row.totalOrders}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Completed</div>
                    <div className="mt-2 text-2xl font-semibold">{row.completedOrders}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Open</div>
                    <div className="mt-2 text-2xl font-semibold">{row.openOrders}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent customers</div>
                    <div className="mt-2 font-semibold">{row.customerNames.join(", ")}</div>
                    <div className="mt-1 text-slate-600">{row.customerEmails.join(", ")}</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Last known pricing</div>
                    <div className="mt-2 font-semibold">
                      {typeof row.lastKnownBillAmount === "number" ? `${row.lastKnownBillAmount.toLocaleString()} ${row.latestOrder.currency}` : "No bill amount yet"}
                    </div>
                    <div className="mt-1 text-slate-600">
                      {typeof row.lastKnownQuotedAmount === "number" ? `Last quote ${row.lastKnownQuotedAmount.toLocaleString()} ${row.latestOrder.currency}` : "No customer quote yet"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                  <div className="rounded-2xl bg-amber-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Duplicate risk</div>
                    <div className="mt-2 font-semibold capitalize">{row.latestOrder.metadata?.insights?.duplicateRisk || "low"}</div>
                    <div className="mt-1 text-slate-600">{row.latestOrder.metadata?.insights?.suggestedNextAction || "Review open orders before quoting again."}</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest lookup</div>
                    <div className="mt-2 font-semibold capitalize">{row.latestOrder.metadata?.lookup?.status?.replaceAll("_", " ") || "unavailable"}</div>
                    <div className="mt-1 capitalize text-slate-600">{row.latestOrder.metadata?.lookup ? `${row.latestOrder.metadata.lookup.source.replaceAll("_", " ")} · ${row.latestOrder.metadata.lookup.confidence} confidence` : "No lookup recorded"}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-slate-700">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest order</div>
                  <div className="mt-2 font-semibold">{row.latestOrder.id} · {row.latestOrder.status.replaceAll("_", " ")}</div>
                  <div className="mt-1">Recipient {row.latestOrder.customer.recipientName}</div>
                  <div className="mt-1">Updated {new Date(row.latestOrder.updatedAt).toLocaleString()}</div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}