"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";
import {
  DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES,
  DEFAULT_STUCK_PAID_THRESHOLD_MINUTES,
  getManualBillingEscalations
} from "@/app/lib/internalAlerts";

type ManualOrder = {
  id: string;
  service: string;
  accountReference: string;
  packageLabel?: string;
  quotedAmount?: number;
  currency: string;
  status: string;
  customer: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    recipientName: string;
  };
  createdAt: string;
  updatedAt: string;
  adminQuoteNotes?: string;
  adminExecutionNotes?: string;
  failureReason?: string;
  pricingSummary?: {
    inputAmount: number;
    providerCost: number;
    customerPrice: number;
    afrisendiqMargin: number;
    afrisendiqMarginPercent: number;
    pricingStrategy: string;
  };
  metadata?: {
    normalizedAccountReference?: string;
    fulfillment?: {
      deliveryMethod: "token" | "receipt" | "confirmation";
      customerPhone?: string;
      whatsappTarget?: string;
      whatsappHref?: string;
      whatsappMessageSid?: string;
      token?: string;
      units?: string;
      receiptReference?: string;
      note?: string;
      deliveredAt?: string;
      lastUpdatedAt?: string;
      lastUpdatedBy?: "admin" | "telegram" | "automation";
    };
    notifications?: {
      whatsapp?: {
        messageSid?: string;
        status?: string;
        statusRecordedAt?: string;
        deliveredAt?: string;
        readAt?: string;
      };
      twilioSmsFallback?: {
        enabled?: boolean;
        target?: string;
        messageSid?: string;
        status?: string;
        sentAt?: string;
        lastEvaluatedAt?: string;
        skippedReason?: string;
      };
      orangeFallback?: {
        enabled?: boolean;
        target?: string;
        resourceId?: string;
        status?: string;
        sentAt?: string;
        lastEvaluatedAt?: string;
        skippedReason?: string;
      };
      mtnFallback?: {
        enabled?: boolean;
        target?: string;
        requestId?: string;
        transactionId?: string;
        clientCorrelator?: string;
        status?: string;
        sentAt?: string;
        lastEvaluatedAt?: string;
        skippedReason?: string;
      };
      africasTalkingFallback?: {
        enabled?: boolean;
        target?: string;
        messageId?: string;
        cost?: string;
        status?: string;
        statusCode?: number;
        summaryMessage?: string;
        sentAt?: string;
        lastEvaluatedAt?: string;
        skippedReason?: string;
      };
    };
    lookup?: {
      status: "found" | "not_found" | "unavailable";
      source: "external_http" | "fixture" | "historical";
      confidence: "low" | "medium" | "high";
      amount?: number;
      currency?: string;
      detail?: string;
      providerReference?: string;
      lookedUpAt: string;
    };
    insights?: {
      duplicateRisk: "low" | "medium" | "high";
      priority: "low" | "medium" | "high";
      automationStatus: string;
      suggestedNextAction: string;
      relatedOpenOrders: number;
      relatedCompletedOrders: number;
      recentOrderCount: number;
      knownAccount: boolean;
      resumableOrderId?: string;
      resumedExistingOrder?: boolean;
      lastKnownBillAmount?: number;
      lastKnownQuotedAmount?: number;
    };
  };
  auditEvents: Array<{
    id: string;
    channel: string;
    event: string;
    outcome: string;
    recordedAt: string;
    detail?: string;
    payload?: Record<string, unknown>;
  }>;
  transitions: Array<{ from: string | null; to: string; changedAt: string; note?: string }>;
};

type ReadinessCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

type ReadinessReport = {
  generatedAt: string;
  mode: "live" | "test" | "blocked";
  safeForLiveOrders: boolean;
  safeForTestOrders: boolean;
  checks: ReadinessCheck[];
  blockers: string[];
};

type MtnSubscriptionConfig = {
  configured: boolean;
  senderAddress: string | null;
  notifyUrl: string | null;
  targetSystem: string;
};

type SmsRoutingProvider = "mtn" | "orange" | "africasTalking" | "twilio" | "tpeCloud";
type SmsRoutingMessageType = "confirmation" | "token" | "receipt" | "retry";
type SmsRoutingCarrier = "mtn-ci" | "orange-ci" | "moov-ci" | "unknown-ci";
type SmsRoutingPolicy = Record<SmsRoutingMessageType, Record<SmsRoutingCarrier, SmsRoutingProvider[]>>;

const SMS_ROUTING_MESSAGE_TYPES: Array<{ id: SmsRoutingMessageType; label: string }> = [
  { id: "confirmation", label: "Confirmation" },
  { id: "token", label: "Token" },
  { id: "receipt", label: "Receipt" },
  { id: "retry", label: "Retry" },
];

const SMS_ROUTING_CARRIERS: Array<{ id: SmsRoutingCarrier; label: string }> = [
  { id: "mtn-ci", label: "MTN CI" },
  { id: "orange-ci", label: "Orange CI" },
  { id: "moov-ci", label: "Moov CI" },
  { id: "unknown-ci", label: "Unknown CI" },
];

const SMS_ROUTING_PROVIDERS: SmsRoutingProvider[] = ["mtn", "orange", "africasTalking", "twilio", "tpeCloud"];

function createDefaultSmsRoutingPolicy(): SmsRoutingPolicy {
  return {
    confirmation: {
      "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
      "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
      "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
      "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
    },
    token: {
      "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
      "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
      "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
      "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
    },
    receipt: {
      "mtn-ci": ["mtn", "africasTalking", "orange", "twilio"],
      "orange-ci": ["orange", "africasTalking", "mtn", "twilio"],
      "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
      "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
    },
    retry: {
      "mtn-ci": ["africasTalking", "twilio", "mtn", "orange"],
      "orange-ci": ["africasTalking", "twilio", "orange", "mtn"],
      "moov-ci": ["twilio", "africasTalking", "orange", "mtn"],
      "unknown-ci": ["africasTalking", "twilio", "orange", "mtn"],
    },
  };
}

function formatRoutingResult(payload: {
  summary?: { evaluated?: number; eligible?: number; sent?: number };
  results?: Array<{
    orderId: string;
    action: "skipped" | "sent";
    provider?: SmsRoutingProvider;
    routeMessageType?: SmsRoutingMessageType;
    routingCarrier?: SmsRoutingCarrier;
    routingPlan?: SmsRoutingProvider[];
    availableProviders?: SmsRoutingProvider[];
  }>;
}, dryRun: boolean) {
  const headline = `${dryRun ? "Dry run" : "Execution"}: evaluated ${payload.summary?.evaluated ?? 0}, eligible ${payload.summary?.eligible ?? 0}, sent ${payload.summary?.sent ?? 0}.`;
  const examples = (payload.results || [])
    .slice(0, 3)
    .map((result) => {
      const route = result.routingPlan?.join(" -> ") || "no route";
      const available = result.availableProviders?.join(" -> ") || "none";
      const chosen = result.provider || "none";
      return `${result.orderId}: ${result.routeMessageType || "unknown"} / ${result.routingCarrier || "unknown"} / route ${route} / eligible ${available} / chosen ${chosen} / ${result.action}`;
    });

  return examples.length > 0 ? `${headline} ${examples.join(" | ")}` : headline;
}

function coerceSmsRoutingPolicy(rawValue: unknown): SmsRoutingPolicy {
  const fallback = createDefaultSmsRoutingPolicy();

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return fallback;
  }

  const record = rawValue as Record<string, unknown>;

  for (const messageType of SMS_ROUTING_MESSAGE_TYPES) {
    const rawCarrierConfig = record[messageType.id];

    if (!rawCarrierConfig || typeof rawCarrierConfig !== "object" || Array.isArray(rawCarrierConfig)) {
      continue;
    }

    const carrierConfig = rawCarrierConfig as Record<string, unknown>;

    for (const carrier of SMS_ROUTING_CARRIERS) {
      const rawRoute = carrierConfig[carrier.id];

      if (!Array.isArray(rawRoute)) {
        continue;
      }

      const normalized = rawRoute.reduce<SmsRoutingProvider[]>((providers, value) => {
        if (typeof value === "string" && SMS_ROUTING_PROVIDERS.includes(value as SmsRoutingProvider) && !providers.includes(value as SmsRoutingProvider)) {
          providers.push(value as SmsRoutingProvider);
        }

        return providers;
      }, []);

      if (normalized.length > 0) {
        fallback[messageType.id][carrier.id] = normalized;
      }
    }
  }

  return fallback;
}

function getServiceModeLabel() {
  return "manual";
}

function formatServiceLabel(service: string) {
  if (service === "cie-prepaid") {
    return "CIE prepaid";
  }

  if (service === "cie-postpaid") {
    return "CIE bill";
  }

  if (service === "canal-plus") {
    return "Canal+";
  }

  if (service === "sodeci") {
    return "SODECI";
  }

  return service.replaceAll("-", " ");
}

function FlowModePill({ mode }: { mode: "manual" | "automated" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${mode === "manual" ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-900"}`}>
      {mode}
    </span>
  );
}

function getReadinessTone(status: ReadinessCheck["status"]) {
  if (status === "pass") {
    return "bg-emerald-100 text-emerald-900";
  }

  if (status === "warn") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-rose-100 text-rose-900";
}

function getWhatsAppReadinessSummary(report: ReadinessReport | null) {
  if (!report) {
    return null;
  }

  const checks = report.checks.filter((check) => check.id.startsWith("twilio-whatsapp"));
  const failedCheck = checks.find((check) => check.status === "fail");
  if (failedCheck) {
    return {
      status: "fail" as const,
      label: "Fallback only",
      detail: failedCheck.detail,
      checks
    };
  }

  const warningCheck = checks.find((check) => check.status === "warn");
  if (warningCheck) {
    return {
      status: "warn" as const,
      label: "Needs attention",
      detail: warningCheck.detail,
      checks
    };
  }

  return {
    status: "pass" as const,
    label: "Live delivery ready",
    detail: "Twilio account validation and WhatsApp sender checks passed.",
    checks
  };
}

function getAfricasTalkingReadinessSummary(report: ReadinessReport | null) {
  if (!report) {
    return null;
  }

  const checks = report.checks.filter((check) => check.id.startsWith("africas-talking"));
  const warningCheck = checks.find((check) => check.status === "warn");

  if (warningCheck) {
    return {
      status: "warn" as const,
      label: "Setup incomplete",
      detail: warningCheck.detail,
      checks
    };
  }

  return {
    status: "pass" as const,
    label: "Ready to verify",
    detail: "Africa's Talking credentials, wallet auth probe, SMS endpoint probe, and delivery-report callback target are ready for the first verification-triggering API call.",
    checks
  };
}

export default function InternalManualBillingPage() {
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [readinessReport, setReadinessReport] = useState<ReadinessReport | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [testWhatsAppPhone, setTestWhatsAppPhone] = useState("");
  const [testWhatsAppMessage, setTestWhatsAppMessage] = useState("AfriSendIQ WhatsApp test from internal ops.");
  const [testWhatsAppResult, setTestWhatsAppResult] = useState<string | null>(null);
  const [testWhatsAppSending, setTestWhatsAppSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [actioningOrderId, setActioningOrderId] = useState<string | null>(null);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [auditChannelFilter, setAuditChannelFilter] = useState<string>("all");
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<string>("all");
  const [auditOrderFilter, setAuditOrderFilter] = useState<string>("");
  const [quoteValues, setQuoteValues] = useState<Record<string, string>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});
  const [failureNotes, setFailureNotes] = useState<Record<string, string>>({});
  const [executionNotes, setExecutionNotes] = useState<Record<string, string>>({});
  const [fulfillmentPhones, setFulfillmentPhones] = useState<Record<string, string>>({});
  const [fulfillmentTokens, setFulfillmentTokens] = useState<Record<string, string>>({});
  const [fulfillmentUnits, setFulfillmentUnits] = useState<Record<string, string>>({});
  const [fulfillmentReceipts, setFulfillmentReceipts] = useState<Record<string, string>>({});
  const [quoteRequestedThresholdMinutes, setQuoteRequestedThresholdMinutes] = useState(DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES);
  const [stuckPaidThresholdMinutes, setStuckPaidThresholdMinutes] = useState(DEFAULT_STUCK_PAID_THRESHOLD_MINUTES);
  const [whatsappFallbackDelayMinutes, setWhatsappFallbackDelayMinutes] = useState(15);
  const [twilioSmsFallbackEnabled, setTwilioSmsFallbackEnabled] = useState(false);
  const [orangeFallbackEnabled, setOrangeFallbackEnabled] = useState(false);
  const [mtnFallbackEnabled, setMtnFallbackEnabled] = useState(false);
  const [africasTalkingFallbackEnabled, setAfricasTalkingFallbackEnabled] = useState(false);
  const [tpeCloudFallbackEnabled, setTpeCloudFallbackEnabled] = useState(false);
  const [quoteThresholdInput, setQuoteThresholdInput] = useState(String(DEFAULT_QUOTE_REQUESTED_THRESHOLD_MINUTES));
  const [paidThresholdInput, setPaidThresholdInput] = useState(String(DEFAULT_STUCK_PAID_THRESHOLD_MINUTES));
  const [fallbackDelayInput, setFallbackDelayInput] = useState("15");
  const [runningFallback, setRunningFallback] = useState(false);
  const [fallbackResult, setFallbackResult] = useState<string | null>(null);
  const [smsRoutingPolicy, setSmsRoutingPolicy] = useState<SmsRoutingPolicy>(createDefaultSmsRoutingPolicy());
  const [mtnSubscriptionConfig, setMtnSubscriptionConfig] = useState<MtnSubscriptionConfig | null>(null);
  const [mtnSubscriptionLoading, setMtnSubscriptionLoading] = useState(false);
  const [mtnSubscriptionResult, setMtnSubscriptionResult] = useState<string | null>(null);
  const anySmsProviderEnabled = twilioSmsFallbackEnabled || orangeFallbackEnabled || mtnFallbackEnabled || africasTalkingFallbackEnabled || tpeCloudFallbackEnabled;

  const escalations = getManualBillingEscalations(orders, {
    quoteRequestedThresholdMinutes,
    paidThresholdMinutes: stuckPaidThresholdMinutes
  });
  const escalationsByOrderId = new Map(escalations.map((order) => [order.id, order]));
  const quoteRequestedEscalationCount = escalations.filter((order) => order.escalationKind === "quote_requested_sla").length;
  const paidEscalationCount = escalations.filter((order) => order.escalationKind === "paid_sla").length;
  const priorityWeight = { high: 3, medium: 2, low: 1 } as const;
  const prioritizedOrders = [...orders].sort((left, right) => {
    const leftPriority = priorityWeight[left.metadata?.insights?.priority || "low"];
    const rightPriority = priorityWeight[right.metadata?.insights?.priority || "low"];

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const filteredAuditEvents = orders
    .flatMap((order) => order.auditEvents.map((auditEvent) => ({
      ...auditEvent,
      orderId: order.id,
      service: order.service,
      pricingSummary: order.pricingSummary
    })))
    .filter((auditEvent) => auditChannelFilter === "all" || auditEvent.channel === auditChannelFilter)
    .filter((auditEvent) => auditOutcomeFilter === "all" || auditEvent.outcome === auditOutcomeFilter)
    .filter((auditEvent) => auditOrderFilter.trim().length === 0 || auditEvent.orderId.toLowerCase().includes(auditOrderFilter.trim().toLowerCase()))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));

  const whatsappReadiness = getWhatsAppReadinessSummary(readinessReport);
  const africasTalkingReadiness = getAfricasTalkingReadinessSummary(readinessReport);

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await fetch("/api/cote-divoire/manual-billing");
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to load manual billing orders");
      }

      setOrders(payload.orders || []);
      const nextQuoteThreshold = Number(payload.settings?.quoteRequestedThresholdMinutes);
      const nextThreshold = Number(payload.settings?.stuckPaidThresholdMinutes);
      if (Number.isFinite(nextQuoteThreshold) && nextQuoteThreshold > 0) {
        const normalizedQuoteThreshold = Math.floor(nextQuoteThreshold);
        setQuoteRequestedThresholdMinutes(normalizedQuoteThreshold);
        setQuoteThresholdInput(String(normalizedQuoteThreshold));
      }
      if (Number.isFinite(nextThreshold) && nextThreshold > 0) {
        const normalizedThreshold = Math.floor(nextThreshold);
        setStuckPaidThresholdMinutes(normalizedThreshold);
        setPaidThresholdInput(String(normalizedThreshold));
      }
      const nextFallbackDelay = Number(payload.settings?.whatsappFallbackDelayMinutes);
      if (Number.isFinite(nextFallbackDelay) && nextFallbackDelay > 0) {
        const normalizedDelay = Math.floor(nextFallbackDelay);
        setWhatsappFallbackDelayMinutes(normalizedDelay);
        setFallbackDelayInput(String(normalizedDelay));
      }
      if (typeof payload.settings?.orangeFallbackEnabled === "boolean") {
        setOrangeFallbackEnabled(payload.settings.orangeFallbackEnabled);
      }
      if (typeof payload.settings?.twilioSmsFallbackEnabled === "boolean") {
        setTwilioSmsFallbackEnabled(payload.settings.twilioSmsFallbackEnabled);
      }
      if (typeof payload.settings?.mtnFallbackEnabled === "boolean") {
        setMtnFallbackEnabled(payload.settings.mtnFallbackEnabled);
      }
      if (typeof payload.settings?.africasTalkingFallbackEnabled === "boolean") {
        setAfricasTalkingFallbackEnabled(payload.settings.africasTalkingFallbackEnabled);
      }
      if (typeof payload.settings?.tpeCloudFallbackEnabled === "boolean") {
        setTpeCloudFallbackEnabled(payload.settings.tpeCloudFallbackEnabled);
      }
      setSmsRoutingPolicy(coerceSmsRoutingPolicy(payload.settings?.routingPolicy));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load manual billing orders");
    } finally {
      setLoading(false);
    }
  }

  async function loadReadiness() {
    setReadinessLoading(true);

    try {
      const response = await fetch("/api/internal/cie-readiness");
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to load live readiness");
      }

      setReadinessReport(payload.report || null);
      setReadinessError(null);
    } catch (error) {
      setReadinessError(error instanceof Error ? error.message : "Unable to load live readiness");
    } finally {
      setReadinessLoading(false);
    }
  }

  async function loadMtnSubscriptionConfig() {
    try {
      const response = await fetch("/api/internal/mtn/subscription");
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to load MTN subscription config");
      }

      setMtnSubscriptionConfig(payload.config || null);
    } catch (error) {
      setMtnSubscriptionResult(error instanceof Error ? error.message : "Unable to load MTN subscription config");
    }
  }

  async function refreshDashboard() {
    await Promise.all([loadOrders(), loadReadiness(), loadMtnSubscriptionConfig()]);
  }

  async function sendTestWhatsApp() {
    setTestWhatsAppSending(true);
    setTestWhatsAppResult(null);

    try {
      const response = await fetch("/api/internal/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testWhatsAppPhone,
          message: testWhatsAppMessage
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to send test WhatsApp message");
      }

      setTestWhatsAppResult(`Delivered to ${payload.to} with SID ${payload.sid}.`);
    } catch (error) {
      setTestWhatsAppResult(error instanceof Error ? error.message : "Unable to send test WhatsApp message");
    } finally {
      setTestWhatsAppSending(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
  }, []);

  async function saveThreshold() {
    const nextQuoteThreshold = Number(quoteThresholdInput);
    const nextPaidThreshold = Number(paidThresholdInput);
    const nextFallbackDelay = Number(fallbackDelayInput);

    if (!Number.isFinite(nextQuoteThreshold) || nextQuoteThreshold <= 0 || !Number.isFinite(nextPaidThreshold) || nextPaidThreshold <= 0 || !Number.isFinite(nextFallbackDelay) || nextFallbackDelay <= 0) {
      setSettingsMessage("All threshold values must be positive numbers of minutes.");
      return;
    }

    setSavingThreshold(true);
    setSettingsMessage(null);

    try {
      const response = await fetch("/api/internal/settings/manual-billing-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteRequestedThresholdMinutes: nextQuoteThreshold,
          stuckPaidThresholdMinutes: nextPaidThreshold,
          whatsappFallbackDelayMinutes: nextFallbackDelay,
          twilioSmsFallbackEnabled,
          orangeFallbackEnabled,
          mtnFallbackEnabled,
          africasTalkingFallbackEnabled,
          tpeCloudFallbackEnabled,
          routingPolicy: smsRoutingPolicy
        })
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to update alert threshold");
      }

      const updatedQuoteThreshold = Number(payload.setting?.quoteRequestedThresholdMinutes);
      const updatedPaidThreshold = Number(payload.setting?.stuckPaidThresholdMinutes);
      if (Number.isFinite(updatedQuoteThreshold) && updatedQuoteThreshold > 0) {
        const normalizedThreshold = Math.floor(updatedQuoteThreshold);
        setQuoteRequestedThresholdMinutes(normalizedThreshold);
        setQuoteThresholdInput(String(normalizedThreshold));
      }
      if (Number.isFinite(updatedPaidThreshold) && updatedPaidThreshold > 0) {
        const normalizedThreshold = Math.floor(updatedPaidThreshold);
        setStuckPaidThresholdMinutes(normalizedThreshold);
        setPaidThresholdInput(String(normalizedThreshold));
      }
      const updatedFallbackDelay = Number(payload.setting?.whatsappFallbackDelayMinutes);
      if (Number.isFinite(updatedFallbackDelay) && updatedFallbackDelay > 0) {
        const normalizedDelay = Math.floor(updatedFallbackDelay);
        setWhatsappFallbackDelayMinutes(normalizedDelay);
        setFallbackDelayInput(String(normalizedDelay));
      }
      if (typeof payload.setting?.twilioSmsFallbackEnabled === "boolean") {
        setTwilioSmsFallbackEnabled(payload.setting.twilioSmsFallbackEnabled);
      }
      if (typeof payload.setting?.orangeFallbackEnabled === "boolean") {
        setOrangeFallbackEnabled(payload.setting.orangeFallbackEnabled);
      }
      if (typeof payload.setting?.mtnFallbackEnabled === "boolean") {
        setMtnFallbackEnabled(payload.setting.mtnFallbackEnabled);
      }
      if (typeof payload.setting?.africasTalkingFallbackEnabled === "boolean") {
        setAfricasTalkingFallbackEnabled(payload.setting.africasTalkingFallbackEnabled);
      }
      if (typeof payload.setting?.tpeCloudFallbackEnabled === "boolean") {
        setTpeCloudFallbackEnabled(payload.setting.tpeCloudFallbackEnabled);
      }
      setSmsRoutingPolicy(coerceSmsRoutingPolicy(payload.setting?.routingPolicy));

      setSettingsMessage("Manual billing alert and SMS fallback settings updated.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Unable to update alert settings");
    } finally {
      setSavingThreshold(false);
    }
  }

  async function runFallbackEvaluation(dryRun: boolean) {
    setRunningFallback(true);
    setFallbackResult(null);

    try {
      const response = await fetch("/api/internal/manual-billing/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 20 })
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to evaluate SMS fallback");
      }

      setFallbackResult(formatRoutingResult(payload, dryRun));
      await loadOrders();
    } catch (error) {
      setFallbackResult(error instanceof Error ? error.message : "Unable to evaluate SMS fallback");
    } finally {
      setRunningFallback(false);
    }
  }

  function updateRoutingPolicyRoute(messageType: SmsRoutingMessageType, carrier: SmsRoutingCarrier, rawValue: string) {
    const normalized = rawValue
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is SmsRoutingProvider => SMS_ROUTING_PROVIDERS.includes(value as SmsRoutingProvider))
      .filter((value, index, values) => values.indexOf(value) === index);

    setSmsRoutingPolicy((currentPolicy) => ({
      ...currentPolicy,
      [messageType]: {
        ...currentPolicy[messageType],
        [carrier]: normalized.length > 0 ? normalized : currentPolicy[messageType][carrier],
      },
    }));
  }

  async function createMtnSubscription() {
    setMtnSubscriptionLoading(true);
    setMtnSubscriptionResult(null);

    try {
      const response = await fetch("/api/internal/mtn/subscription", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to create MTN delivery receipt subscription");
      }

      setMtnSubscriptionConfig(payload.config || null);
      setMtnSubscriptionResult(`Subscription created for ${payload.subscription?.senderAddress || "MTN sender"} with ID ${payload.subscription?.subscriptionId || "unknown"}.`);
    } catch (error) {
      setMtnSubscriptionResult(error instanceof Error ? error.message : "Unable to create MTN delivery receipt subscription");
    } finally {
      setMtnSubscriptionLoading(false);
    }
  }

  async function submitQuote(orderId: string) {
    const quotedAmount = Number(quoteValues[orderId]);

    const response = await fetch(`/api/cote-divoire/manual-billing/${orderId}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotedAmount,
        adminQuoteNotes: quoteNotes[orderId] || undefined
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setMessage(payload.error || "Unable to save quote");
      return;
    }

    await loadOrders();
  }

  async function markFailed(orderId: string) {
    const failureReason = failureNotes[orderId];
    if (!failureReason) {
      setMessage("Failure reason is required");
      return;
    }

    const response = await fetch(`/api/cote-divoire/manual-billing/${orderId}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        failureReason,
        adminExecutionNotes: failureReason
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setMessage(payload.error || "Unable to fail order");
      return;
    }

    await loadOrders();
  }

  async function advanceOperatorState(orderId: string, action: "start" | "confirm" | "complete") {
    setActioningOrderId(orderId);
    setMessage(null);

    try {
      const response = await fetch(`/api/cote-divoire/manual-billing/${orderId}/operator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          adminExecutionNotes: executionNotes[orderId] || undefined,
          fulfillment: {
            customerPhone: fulfillmentPhones[orderId] || undefined,
            token: fulfillmentTokens[orderId] || undefined,
            units: fulfillmentUnits[orderId] || undefined,
            receiptReference: fulfillmentReceipts[orderId] || undefined,
            note: executionNotes[orderId] || undefined
          }
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to update operator state");
      }

      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update operator state");
    } finally {
      setActioningOrderId(null);
    }
  }

  function nextOperatorAction(order: ManualOrder) {
    if (order.status === "paid") {
      return { action: "start" as const, label: "Mark started" };
    }

    if (order.status === "operator_started") {
      return { action: "confirm" as const, label: "Mark confirmed" };
    }

    if (order.status === "operator_confirmed") {
      return { action: "complete" as const, label: "Mark complete" };
    }

    return null;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#0b1f18_42%,#07120d_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3">
            <Link href="/internal/cie-readiness" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              CIE readiness
            </Link>
            <Link href="/internal/manual-billing/repeat-payers" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              Repeat payers
            </Link>
            <Link href="/internal/twilio-inbox" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              Twilio inbox
            </Link>
            <Link href="/internal/profitability" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              Profitability
            </Link>
            <button onClick={() => void refreshDashboard()} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-emerald-50 transition hover:bg-white/16">
              Refresh
            </button>
          </div>
        </div>

        <section className="grid gap-6 rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">Manual billing admin</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">SODECI, CIE bill, CIE prepaid, and Canal+ operator queue.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/78">
              These services are all manual AfriSendIQ flows. CIE and SODECI can still prefill quote context automatically, but fulfillment and operator progression stay in the manual queue.
            </p>
          </div>
          <CoteDIvoireHeroPanel
            badge="Admin billing ops"
            gradientClass="from-[#0F3B2E] via-[#145A46] to-[#1D7B5F]"
            imageSrcs={[
              ...coteDivoireVisualAssets.sodeci,
              ...coteDivoireVisualAssets.ciePostpaid,
              ...coteDivoireVisualAssets.canalPlus
            ]}
            imageAlt="Côte d'Ivoire billing operations cards"
            contextLabel="Côte d'Ivoire"
            wordmark="Afrisendiq"
            heightClassName="h-[21rem]"
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">WhatsApp delivery</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Operator readiness for live customer delivery</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getReadinessTone(whatsappReadiness?.status || "warn")}`}>
                {readinessLoading ? "checking" : whatsappReadiness?.label || "unknown"}
              </span>
            </div>

            {readinessError ? (
              <p className="mt-4 rounded-2xl border border-rose-200/40 bg-rose-50 px-4 py-3 text-sm text-rose-900">{readinessError}</p>
            ) : readinessLoading ? (
              <p className="mt-4 text-sm leading-7 text-emerald-50/76">Validating Twilio account credentials and the configured WhatsApp sender...</p>
            ) : (
              <>
                <p className="mt-4 text-sm leading-7 text-emerald-50/78">
                  {whatsappReadiness?.detail || "Readiness data is not available yet."}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {(whatsappReadiness?.checks || []).map((check) => (
                    <div key={check.id} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">{check.label}</div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getReadinessTone(check.status)}`}>
                          {check.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-emerald-50/72">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <article className="rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">Ops note</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Test live WhatsApp delivery</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/78">
              Use this to send one direct WhatsApp message through the same Twilio path used by manual-order completion. If the readiness panel is not green, this test is expected to fail until the sender is configured.
            </p>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm text-emerald-50/78">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/72">Destination WhatsApp number</span>
                <input
                  type="tel"
                  value={testWhatsAppPhone}
                  onChange={(event) => setTestWhatsAppPhone(event.target.value)}
                  placeholder="+2250708123456"
                  className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-emerald-50/45"
                />
              </label>
              <label className="grid gap-2 text-sm text-emerald-50/78">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/72">Message</span>
                <textarea
                  value={testWhatsAppMessage}
                  onChange={(event) => setTestWhatsAppMessage(event.target.value)}
                  rows={4}
                  className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-emerald-50/45"
                />
              </label>
              <button
                onClick={() => void sendTestWhatsApp()}
                disabled={testWhatsAppSending}
                className="rounded-full border border-white/12 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testWhatsAppSending ? "Sending..." : "Send test WhatsApp"}
              </button>
            </div>
            {testWhatsAppResult ? (
              <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-emerald-50">{testWhatsAppResult}</p>
            ) : null}
            {readinessReport ? (
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-emerald-100/68">
                Last checked {new Date(readinessReport.generatedAt).toLocaleString()}
              </p>
            ) : null}
          </article>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">Africa's Talking</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Verification readiness before the first API call</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getReadinessTone(africasTalkingReadiness?.status || "warn")}`}>
                {readinessLoading ? "checking" : africasTalkingReadiness?.label || "unknown"}
              </span>
            </div>

            {readinessError ? (
              <p className="mt-4 rounded-2xl border border-rose-200/40 bg-rose-50 px-4 py-3 text-sm text-rose-900">{readinessError}</p>
            ) : readinessLoading ? (
              <p className="mt-4 text-sm leading-7 text-emerald-50/76">Validating Africa's Talking credentials, wallet auth, SMS endpoint readiness, and callback target...</p>
            ) : (
              <>
                <p className="mt-4 text-sm leading-7 text-emerald-50/78">
                  {africasTalkingReadiness?.detail || "Readiness data is not available yet."}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {(africasTalkingReadiness?.checks || []).map((check) => (
                    <div key={check.id} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">{check.label}</div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getReadinessTone(check.status)}`}>
                          {check.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-emerald-50/72">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <article className="rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">First-send checklist</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">What must be true before the first SMS</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/78">
              Africa&apos;s Talking verifies the account after an owned app interacts with the API. Use this panel to confirm the missing pieces before attempting that first send through the development-only Africa&apos;s Talking test route.
            </p>
            <div className="mt-5 grid gap-3 text-sm text-emerald-50/78">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">Credentials must be present: username, API key, and sender ID.</div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">The delivery-report callback must stay pointed at <span className="font-semibold">/api/africastalking/delivery-report</span>.</div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">The first successful API interaction can be done with the development-only internal Africa&apos;s Talking SMS test route once secrets are loaded.</div>
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">Operator alerts</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Orders breaching quote or operator SLAs</h2>
            </div>
            <div className="flex flex-wrap items-end gap-3 text-sm text-emerald-50/78">
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">Quote requested</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quoteThresholdInput}
                  onChange={(event) => setQuoteThresholdInput(event.target.value)}
                  className="w-20 bg-transparent text-right text-sm text-white outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">Paid</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={paidThresholdInput}
                  onChange={(event) => setPaidThresholdInput(event.target.value)}
                  className="w-20 bg-transparent text-right text-sm text-white outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">WA fallback</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={fallbackDelayInput}
                  onChange={(event) => setFallbackDelayInput(event.target.value)}
                  className="w-20 bg-transparent text-right text-sm text-white outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <input
                  type="checkbox"
                  checked={twilioSmsFallbackEnabled}
                  onChange={(event) => setTwilioSmsFallbackEnabled(event.target.checked)}
                />
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">Twilio enabled</span>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <input
                  type="checkbox"
                  checked={orangeFallbackEnabled}
                  onChange={(event) => setOrangeFallbackEnabled(event.target.checked)}
                />
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">Orange enabled</span>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <input
                  type="checkbox"
                  checked={mtnFallbackEnabled}
                  onChange={(event) => setMtnFallbackEnabled(event.target.checked)}
                />
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">MTN enabled</span>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <input
                  type="checkbox"
                  checked={africasTalkingFallbackEnabled}
                  onChange={(event) => setAfricasTalkingFallbackEnabled(event.target.checked)}
                />
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">AfricasTalking enabled</span>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-white">
                <input
                  type="checkbox"
                  checked={tpeCloudFallbackEnabled}
                  onChange={(event) => setTpeCloudFallbackEnabled(event.target.checked)}
                />
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">TPECloud enabled</span>
              </label>
              <button
                onClick={() => void saveThreshold()}
                disabled={savingThreshold}
                className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingThreshold ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-emerald-50/72">
            <div>Quote SLA: {quoteRequestedThresholdMinutes} minutes in quote requested</div>
            <div>Paid SLA: {stuckPaidThresholdMinutes} minutes in paid status</div>
            <div>WhatsApp fallback: {whatsappFallbackDelayMinutes} minutes</div>
            <div>Twilio: {twilioSmsFallbackEnabled ? "enabled" : "disabled"}</div>
            <div>Orange: {orangeFallbackEnabled ? "enabled" : "disabled"}</div>
            <div>MTN: {mtnFallbackEnabled ? "enabled" : "disabled"}</div>
            <div>AfricasTalking: {africasTalkingFallbackEnabled ? "enabled" : "disabled"}</div>
            <div>TPECloud: {tpeCloudFallbackEnabled ? "enabled" : "disabled"}</div>
            <div>{quoteRequestedEscalationCount} quote escalations</div>
            <div>{paidEscalationCount} paid escalations</div>
          </div>

          {settingsMessage ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{settingsMessage}</div> : null}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-emerald-50/85">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/72">Carrier-aware routing policy</div>
            <p className="mt-2 text-sm leading-6 text-emerald-50/72">
              Edit each route as a comma-separated provider order using only <span className="font-semibold">mtn, orange, africasTalking, twilio</span>.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {SMS_ROUTING_MESSAGE_TYPES.map((messageType) => (
                <div key={messageType.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <div className="text-sm font-semibold text-white">{messageType.label}</div>
                  <div className="mt-3 grid gap-3">
                    {SMS_ROUTING_CARRIERS.map((carrier) => (
                      <label key={`${messageType.id}-${carrier.id}`} className="grid gap-2 text-sm text-emerald-50/78">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/72">{carrier.label}</span>
                        <input
                          type="text"
                          value={smsRoutingPolicy[messageType.id][carrier.id].join(", ")}
                          onChange={(event) => updateRoutingPolicyRoute(messageType.id, carrier.id, event.target.value)}
                          className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-emerald-50/45"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runFallbackEvaluation(true)}
              disabled={runningFallback}
              className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningFallback ? "Working..." : "Dry run SMS fallback"}
            </button>
            <button
              onClick={() => void runFallbackEvaluation(false)}
              disabled={runningFallback || !anySmsProviderEnabled}
              className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Run SMS fallback
            </button>
            <button
              onClick={() => void createMtnSubscription()}
              disabled={mtnSubscriptionLoading}
              className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mtnSubscriptionLoading ? "Creating MTN subscription..." : "Create MTN receipt subscription"}
            </button>
          </div>
          {fallbackResult ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{fallbackResult}</div> : null}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm text-emerald-50/85">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/72">MTN delivery receipts</div>
            <div className="mt-3 flex flex-wrap gap-4">
              <div>Configured: <span className="font-semibold">{mtnSubscriptionConfig?.configured ? "yes" : "no"}</span></div>
              <div>Sender: <span className="font-semibold">{mtnSubscriptionConfig?.senderAddress || "missing"}</span></div>
              <div>Notify URL: <span className="font-semibold break-all">{mtnSubscriptionConfig?.notifyUrl || "missing"}</span></div>
              <div>Target: <span className="font-semibold">{mtnSubscriptionConfig?.targetSystem || "MADAPI"}</span></div>
            </div>
            <p className="mt-3 text-emerald-50/72">
              MTN SMS V2 delivery receipts are created through the API subscription endpoint, not through a separate portal callback screen.
            </p>
          </div>
          {mtnSubscriptionResult ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{mtnSubscriptionResult}</div> : null}

          {escalations.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">No quote-requested or paid orders are currently beyond the configured SLA thresholds.</div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {escalations.map((order) => (
                <div key={`escalation-${order.id}`} className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-[0_12px_40px_rgba(120,53,15,0.12)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{order.id}</div>
                      <div className="mt-1">{formatServiceLabel(order.service)} · {order.customer.recipientName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em]">{order.escalationLabel}</div>
                    </div>
                    <div className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-950">
                      {order.ageMinutes} min waiting
                    </div>
                  </div>
                  <div className="mt-3">Last updated {new Date(order.updatedAt).toLocaleString()}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <FlowModePill mode="manual" />
                    <span>Status {order.status.replaceAll("_", " ")}</span>
                  </div>
                  <div>Quote {order.quotedAmount ? `${order.quotedAmount.toLocaleString()} ${order.currency}` : "Unavailable"}</div>
                  <div>Customer {order.customer.customerName} · {order.customer.customerEmail}</div>
                  {order.metadata?.insights?.suggestedNextAction ? <div>Next step {order.metadata.insights.suggestedNextAction}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/82">Audit inspector</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Webhook and Telegram evidence feed</h2>
            </div>
            <div className="text-sm text-emerald-50/78">{filteredAuditEvents.length} matching event{filteredAuditEvents.length === 1 ? "" : "s"}</div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input
              value={auditOrderFilter}
              onChange={(event) => setAuditOrderFilter(event.target.value)}
              placeholder="Filter by order id"
              className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-emerald-50/45"
            />
            <select
              value={auditChannelFilter}
              onChange={(event) => setAuditChannelFilter(event.target.value)}
              className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white"
            >
              <option value="all">All channels</option>
              <option value="stripe_webhook">Stripe webhook</option>
              <option value="telegram_send">Telegram send</option>
              <option value="telegram_callback">Telegram callback</option>
              <option value="whatsapp_send">WhatsApp send</option>
              <option value="automation">Automation</option>
              <option value="admin">Admin</option>
              <option value="system">System</option>
            </select>
            <select
              value={auditOutcomeFilter}
              onChange={(event) => setAuditOutcomeFilter(event.target.value)}
              className="rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white"
            >
              <option value="all">All outcomes</option>
              <option value="attempted">Attempted</option>
              <option value="received">Received</option>
              <option value="processed">Processed</option>
              <option value="delivered">Delivered</option>
              <option value="duplicate">Duplicate</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>

          <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-2 text-sm">
            {filteredAuditEvents.length === 0 ? (
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-emerald-50/78">No audit events match the current filters.</div>
            ) : filteredAuditEvents.map((auditEvent) => (
              <div key={auditEvent.id} className="rounded-2xl bg-white/10 px-4 py-3 text-emerald-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold">{auditEvent.orderId} · {auditEvent.channel.replaceAll("_", " ")} · {auditEvent.event}</div>
                  <div className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">{auditEvent.outcome.replaceAll("_", " ")}</div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-emerald-50/72">
                  <span>{new Date(auditEvent.recordedAt).toLocaleString()} · {formatServiceLabel(auditEvent.service)}</span>
                  <FlowModePill mode="manual" />
                </div>
                {auditEvent.pricingSummary ? (
                  <div className="mt-2 text-emerald-50/82">
                    Bill {auditEvent.pricingSummary.inputAmount.toLocaleString()} XOF · Quote {auditEvent.pricingSummary.customerPrice.toLocaleString()} XOF · Margin {auditEvent.pricingSummary.afrisendiqMargin.toLocaleString()} XOF
                  </div>
                ) : null}
                {auditEvent.detail ? <div className="mt-2 text-emerald-50/82">{auditEvent.detail}</div> : null}
              </div>
            ))}
          </div>
        </section>

  {message ? <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">{message}</div> : null}

        {loading ? (
          <div className="mt-8 rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">Loading manual orders...</div>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            {prioritizedOrders.map((order) => {
              const escalation = escalationsByOrderId.get(order.id);

              return (
              <article key={order.id} className={`rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)] ${escalation ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      <span>{formatServiceLabel(order.service)}</span>
                      <FlowModePill mode="manual" />
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold">{order.id}</h2>
                  </div>
                  <div className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${escalation ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-700"}`}>{order.status.replaceAll("_", " ")}</div>
                </div>

                {escalation ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    {escalation.escalationKind === "quote_requested_sla"
                      ? `Quote lookup alert: this order has remained in quote requested for at least ${quoteRequestedThresholdMinutes} minutes and still needs bill capture or lookup review.`
                      : `Paid order alert: this order has remained in paid status for at least ${stuckPaidThresholdMinutes} minutes and still needs operator progression.`}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account</div>
                    <div className="mt-2 font-semibold">{order.accountReference}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recipient</div>
                    <div className="mt-2 font-semibold">{order.customer.recipientName}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer</div>
                    <div className="mt-2 font-semibold">{order.customer.customerName}</div>
                    <div>{order.customer.customerEmail}</div>
                    {order.customer.customerPhone ? <div>{order.customer.customerPhone}</div> : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Customer quote</div>
                    <div className="mt-2 font-semibold">{order.quotedAmount ? `${order.quotedAmount.toLocaleString()} ${order.currency}` : "Pending lookup"}</div>
                    {order.packageLabel ? <div>{order.packageLabel}</div> : null}
                  </div>
                </div>

                {order.metadata?.insights ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-slate-700">
                    <div className="rounded-2xl bg-sky-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Queue priority</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.insights.priority}</div>
                      <div className="mt-1 capitalize text-slate-600">Duplicate risk: {order.metadata.insights.duplicateRisk}</div>
                    </div>
                    <div className="rounded-2xl bg-sky-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Automation guidance</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.insights.automationStatus.replaceAll("_", " ")}</div>
                      <div className="mt-1 text-slate-600">{order.metadata.insights.suggestedNextAction}</div>
                    </div>
                    <div className="rounded-2xl bg-sky-50 px-4 py-3 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Known-account context</div>
                      <div className="mt-2 text-slate-700">
                        Normalized reference: <span className="font-semibold">{order.metadata.normalizedAccountReference || order.accountReference}</span>
                      </div>
                      <div className="mt-1 text-slate-700">
                        Open related requests: <span className="font-semibold">{order.metadata.insights.relatedOpenOrders}</span>
                        {" · "}
                        Prior completed requests: <span className="font-semibold">{order.metadata.insights.relatedCompletedOrders}</span>
                      </div>
                      {typeof order.metadata.insights.lastKnownBillAmount === "number" ? (
                        <div className="mt-1 text-slate-700">
                          Last bill amount: <span className="font-semibold">{order.metadata.insights.lastKnownBillAmount.toLocaleString()} {order.currency}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {order.metadata?.lookup ? (
                  <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lookup status</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.lookup.status.replaceAll("_", " ")}</div>
                      <div className="mt-1 capitalize text-slate-600">Source: {order.metadata.lookup.source.replaceAll("_", " ")}</div>
                      <div className="mt-1 capitalize text-slate-600">Confidence: {order.metadata.lookup.confidence}</div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lookup detail</div>
                      <div className="mt-2 text-slate-700">{order.metadata.lookup.detail || "No provider detail recorded."}</div>
                      {typeof order.metadata.lookup.amount === "number" ? <div className="mt-1 font-semibold">{order.metadata.lookup.amount.toLocaleString()} {order.metadata.lookup.currency || order.currency}</div> : null}
                    </div>
                  </div>
                ) : null}

                {order.metadata?.fulfillment ? (
                  <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                    <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Fulfillment</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.fulfillment.deliveryMethod}</div>
                      {order.metadata.fulfillment.token ? <div className="mt-1">Token: <span className="font-semibold">{order.metadata.fulfillment.token}</span></div> : null}
                      {order.metadata.fulfillment.units ? <div className="mt-1">Units: <span className="font-semibold">{order.metadata.fulfillment.units}</span></div> : null}
                      {order.metadata.fulfillment.receiptReference ? <div className="mt-1">Reference: <span className="font-semibold">{order.metadata.fulfillment.receiptReference}</span></div> : null}
                    </div>
                    <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Delivery handoff</div>
                      {order.metadata.fulfillment.customerPhone ? <div className="mt-2">Customer phone: <span className="font-semibold">{order.metadata.fulfillment.customerPhone}</span></div> : null}
                      {order.metadata.fulfillment.deliveredAt ? <div className="mt-1">Delivered: <span className="font-semibold">{new Date(order.metadata.fulfillment.deliveredAt).toLocaleString()}</span></div> : null}
                      {order.metadata.fulfillment.whatsappHref ? (
                        <a href={order.metadata.fulfillment.whatsappHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
                          Open WhatsApp handoff
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {order.metadata?.notifications ? (
                  <div className="mt-4 grid gap-4 text-sm text-slate-700 md:grid-cols-5">
                    <div className="rounded-2xl bg-sky-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">WhatsApp status</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.notifications.whatsapp?.status || "pending"}</div>
                      {order.metadata.notifications.whatsapp?.messageSid ? <div className="mt-1 break-all">SID: <span className="font-semibold">{order.metadata.notifications.whatsapp.messageSid}</span></div> : null}
                      {order.metadata.notifications.whatsapp?.statusRecordedAt ? <div className="mt-1">Updated: <span className="font-semibold">{new Date(order.metadata.notifications.whatsapp.statusRecordedAt).toLocaleString()}</span></div> : null}
                      {order.metadata.notifications.whatsapp?.readAt ? <div className="mt-1">Read: <span className="font-semibold">{new Date(order.metadata.notifications.whatsapp.readAt).toLocaleString()}</span></div> : null}
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Twilio SMS primary</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.notifications.twilioSmsFallback?.status || (order.metadata.notifications.twilioSmsFallback?.enabled ? "queued" : "not sent")}</div>
                      {order.metadata.notifications.twilioSmsFallback?.messageSid ? <div className="mt-1 break-all">SID: <span className="font-semibold">{order.metadata.notifications.twilioSmsFallback.messageSid}</span></div> : null}
                      {order.metadata.notifications.twilioSmsFallback?.sentAt ? <div className="mt-1">Sent: <span className="font-semibold">{new Date(order.metadata.notifications.twilioSmsFallback.sentAt).toLocaleString()}</span></div> : null}
                      {order.metadata.notifications.twilioSmsFallback?.target ? <div className="mt-1">Target: <span className="font-semibold">{order.metadata.notifications.twilioSmsFallback.target}</span></div> : null}
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">MTN secondary</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.notifications.mtnFallback?.status || (order.metadata.notifications.mtnFallback?.enabled ? "queued" : "not sent")}</div>
                      {order.metadata.notifications.mtnFallback?.requestId ? <div className="mt-1 break-all">Request: <span className="font-semibold">{order.metadata.notifications.mtnFallback.requestId}</span></div> : null}
                      {order.metadata.notifications.mtnFallback?.transactionId ? <div className="mt-1 break-all">Transaction: <span className="font-semibold">{order.metadata.notifications.mtnFallback.transactionId}</span></div> : null}
                      {order.metadata.notifications.mtnFallback?.sentAt ? <div className="mt-1">Sent: <span className="font-semibold">{new Date(order.metadata.notifications.mtnFallback.sentAt).toLocaleString()}</span></div> : null}
                      {order.metadata.notifications.mtnFallback?.target ? <div className="mt-1">Target: <span className="font-semibold">{order.metadata.notifications.mtnFallback.target}</span></div> : null}
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Orange tertiary</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.notifications.orangeFallback?.status || (order.metadata.notifications.orangeFallback?.enabled ? "queued" : "not sent")}</div>
                      {order.metadata.notifications.orangeFallback?.resourceId ? <div className="mt-1 break-all">Resource: <span className="font-semibold">{order.metadata.notifications.orangeFallback.resourceId}</span></div> : null}
                      {order.metadata.notifications.orangeFallback?.sentAt ? <div className="mt-1">Sent: <span className="font-semibold">{new Date(order.metadata.notifications.orangeFallback.sentAt).toLocaleString()}</span></div> : null}
                      {order.metadata.notifications.orangeFallback?.target ? <div className="mt-1">Target: <span className="font-semibold">{order.metadata.notifications.orangeFallback.target}</span></div> : null}
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">AfricasTalking backup</div>
                      <div className="mt-2 font-semibold capitalize">{order.metadata.notifications.africasTalkingFallback?.status || (order.metadata.notifications.africasTalkingFallback?.enabled ? "queued" : "not sent")}</div>
                      {order.metadata.notifications.africasTalkingFallback?.messageId ? <div className="mt-1 break-all">Message: <span className="font-semibold">{order.metadata.notifications.africasTalkingFallback.messageId}</span></div> : null}
                      {order.metadata.notifications.africasTalkingFallback?.statusCode !== undefined ? <div className="mt-1">Code: <span className="font-semibold">{order.metadata.notifications.africasTalkingFallback.statusCode}</span></div> : null}
                      {order.metadata.notifications.africasTalkingFallback?.cost ? <div className="mt-1">Cost: <span className="font-semibold">{order.metadata.notifications.africasTalkingFallback.cost}</span></div> : null}
                      {order.metadata.notifications.africasTalkingFallback?.sentAt ? <div className="mt-1">Sent: <span className="font-semibold">{new Date(order.metadata.notifications.africasTalkingFallback.sentAt).toLocaleString()}</span></div> : null}
                      {order.metadata.notifications.africasTalkingFallback?.lastEvaluatedAt ? <div className="mt-1">Updated: <span className="font-semibold">{new Date(order.metadata.notifications.africasTalkingFallback.lastEvaluatedAt).toLocaleString()}</span></div> : null}
                      {order.metadata.notifications.africasTalkingFallback?.target ? <div className="mt-1">Target: <span className="font-semibold">{order.metadata.notifications.africasTalkingFallback.target}</span></div> : null}
                      {order.metadata.notifications.africasTalkingFallback?.summaryMessage ? <div className="mt-1">Detail: <span className="font-semibold">{order.metadata.notifications.africasTalkingFallback.summaryMessage}</span></div> : null}
                    </div>
                  </div>
                ) : null}

                {order.pricingSummary ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-700">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bill amount</div>
                      <div className="mt-2 font-semibold">{order.pricingSummary.inputAmount.toLocaleString()} {order.currency}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Net margin</div>
                      <div className="mt-2 font-semibold">{order.pricingSummary.afrisendiqMargin.toLocaleString()} {order.currency}</div>
                      <div>{order.pricingSummary.afrisendiqMarginPercent.toFixed(2)}%</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Pricing strategy</div>
                      <div className="mt-2 font-semibold capitalize">{order.pricingSummary.pricingStrategy.replaceAll("_", " ")}</div>
                    </div>
                  </div>
                ) : null}

                {order.status === "quote_requested" ? (
                  <div className="mt-6 rounded-2xl bg-emerald-50 p-4">
                    <div className="text-sm font-semibold text-emerald-900">Add bill amount</div>
                    <input
                      value={quoteValues[order.id] || ""}
                      onChange={(event) => setQuoteValues((current) => ({ ...current, [order.id]: event.target.value }))}
                      placeholder="Base bill amount in XOF"
                      className="mt-3 w-full rounded-xl border border-emerald-200 px-4 py-3"
                    />
                    <textarea
                      value={quoteNotes[order.id] || ""}
                      onChange={(event) => setQuoteNotes((current) => ({ ...current, [order.id]: event.target.value }))}
                      placeholder="Admin lookup notes"
                      className="mt-3 w-full rounded-xl border border-emerald-200 px-4 py-3"
                    />
                    <button onClick={() => void submitQuote(order.id)} className="mt-3 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">
                      Save quote
                    </button>
                  </div>
                ) : null}

                {nextOperatorAction(order) ? (
                  <div className="mt-6 rounded-2xl bg-cyan-50 p-4">
                    <div className="text-sm font-semibold text-cyan-900">Operator progression</div>
                    <input
                      value={fulfillmentPhones[order.id] ?? order.metadata?.fulfillment?.customerPhone ?? order.customer.customerPhone ?? ""}
                      onChange={(event) => setFulfillmentPhones((current) => ({ ...current, [order.id]: event.target.value }))}
                      placeholder="Customer WhatsApp phone"
                      className="mt-3 w-full rounded-xl border border-cyan-200 px-4 py-3"
                    />
                    {order.service === "cie-prepaid" ? (
                      <>
                        <input
                          value={fulfillmentTokens[order.id] || ""}
                          onChange={(event) => setFulfillmentTokens((current) => ({ ...current, [order.id]: event.target.value }))}
                          placeholder="Token or prepaid code"
                          className="mt-3 w-full rounded-xl border border-cyan-200 px-4 py-3"
                        />
                        <input
                          value={fulfillmentUnits[order.id] || ""}
                          onChange={(event) => setFulfillmentUnits((current) => ({ ...current, [order.id]: event.target.value }))}
                          placeholder="Units or kWh"
                          className="mt-3 w-full rounded-xl border border-cyan-200 px-4 py-3"
                        />
                      </>
                    ) : (
                      <input
                        value={fulfillmentReceipts[order.id] || ""}
                        onChange={(event) => setFulfillmentReceipts((current) => ({ ...current, [order.id]: event.target.value }))}
                        placeholder="Receipt or confirmation reference"
                        className="mt-3 w-full rounded-xl border border-cyan-200 px-4 py-3"
                      />
                    )}
                    <textarea
                      value={executionNotes[order.id] || ""}
                      onChange={(event) => setExecutionNotes((current) => ({ ...current, [order.id]: event.target.value }))}
                      placeholder="Operator/admin execution notes or delivery note"
                      className="mt-3 w-full rounded-xl border border-cyan-200 px-4 py-3"
                    />
                    <button
                      onClick={() => {
                        const action = nextOperatorAction(order);
                        if (action) {
                          void advanceOperatorState(order.id, action.action);
                        }
                      }}
                      disabled={actioningOrderId === order.id}
                      className="mt-3 rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-400"
                    >
                      {actioningOrderId === order.id ? "Updating..." : nextOperatorAction(order)?.label}
                    </button>
                  </div>
                ) : null}

                <div className="mt-6 rounded-2xl bg-rose-50 p-4">
                  <div className="text-sm font-semibold text-rose-900">Fail order</div>
                  <textarea
                    value={failureNotes[order.id] || ""}
                    onChange={(event) => setFailureNotes((current) => ({ ...current, [order.id]: event.target.value }))}
                    placeholder="Failure reason"
                    className="mt-3 w-full rounded-xl border border-rose-200 px-4 py-3"
                  />
                  <button onClick={() => void markFailed(order.id)} className="mt-3 rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800">
                    Mark failed
                  </button>
                </div>

                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Transitions</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {order.transitions.map((transition, index) => (
                      <div key={`${order.id}-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="font-semibold">{transition.to.replaceAll("_", " ")}</div>
                        <div>{new Date(transition.changedAt).toLocaleString()}</div>
                        {transition.note ? <div>{transition.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Audit events</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {order.auditEvents.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">No explicit webhook or Telegram audit events yet.</div>
                    ) : order.auditEvents.map((auditEvent) => (
                      <div key={auditEvent.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="font-semibold">{auditEvent.channel.replaceAll("_", " ")} · {auditEvent.event}</div>
                        <div>{auditEvent.outcome.replaceAll("_", " ")} · {new Date(auditEvent.recordedAt).toLocaleString()}</div>
                        {auditEvent.detail ? <div>{auditEvent.detail}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            )})}
          </section>
        )}
      </div>
    </main>
  );
}