type StatusAssessment = {
  phase: "completed" | "failed" | "provider-still-processing" | "delayed-provider-processing" | "likely-stalled" | "unknown";
  ageMinutes: number | null;
  expiresInMinutes: number | null;
  escalationRecommended: boolean;
  operatorHint: string;
};

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assessDtOneTransactionStatus(transaction: Record<string, unknown>): StatusAssessment {
  const statusRecord = transaction.status as Record<string, unknown> | undefined;
  const statusMessage = typeof statusRecord?.message === "string"
    ? statusRecord.message.toUpperCase()
    : String(statusRecord?.id ?? "UNKNOWN").toUpperCase();

  const createdAt = parseDate(transaction.creation_date);
  const expiresAt = parseDate(transaction.confirmation_expiration_date);
  const now = Date.now();
  const ageMinutes = createdAt ? Math.max(0, Math.floor((now - createdAt.getTime()) / 60000)) : null;
  const expiresInMinutes = expiresAt ? Math.floor((expiresAt.getTime() - now) / 60000) : null;

  if (["COMPLETED", "SUCCESSFUL", "CONFIRMED"].includes(statusMessage)) {
    return {
      phase: "completed",
      ageMinutes,
      expiresInMinutes,
      escalationRecommended: false,
      operatorHint: "Provider completed the transaction. If the recharge code is still missing, inspect the raw provider payload and PIN fields."
    };
  }

  if (["REJECTED", "FAILED", "CANCELLED", "DECLINED", "ERROR"].includes(statusMessage)) {
    return {
      phase: "failed",
      ageMinutes,
      expiresInMinutes,
      escalationRecommended: true,
      operatorHint: "Provider marked the transaction as failed. Do not keep polling; investigate the provider response or retry strategy."
    };
  }

  if (["CREATED", "PENDING", "SUBMITTED", "PROCESSING"].includes(statusMessage)) {
    if (expiresInMinutes !== null && expiresInMinutes <= 0) {
      return {
        phase: "likely-stalled",
        ageMinutes,
        expiresInMinutes,
        escalationRecommended: true,
        operatorHint: "Provider confirmation window has expired while the transaction is still unresolved. Treat this as likely stalled and escalate or reconcile manually."
      };
    }

    if (ageMinutes !== null && ageMinutes >= 20) {
      return {
        phase: "likely-stalled",
        ageMinutes,
        expiresInMinutes,
        escalationRecommended: true,
        operatorHint: "Transaction has remained unresolved for 20+ minutes. Treat this as likely stalled and escalate with the provider reference."
      };
    }

    if (ageMinutes !== null && ageMinutes >= 10) {
      return {
        phase: "delayed-provider-processing",
        ageMinutes,
        expiresInMinutes,
        escalationRecommended: false,
        operatorHint: "Provider is still processing, but the delay is longer than expected. Continue slower polling and prepare escalation if it does not move soon."
      };
    }

    return {
      phase: "provider-still-processing",
      ageMinutes,
      expiresInMinutes,
      escalationRecommended: false,
      operatorHint: "Provider still appears to be processing normally. Continue polling with backoff; no escalation yet."
    };
  }

  return {
    phase: "unknown",
    ageMinutes,
    expiresInMinutes,
    escalationRecommended: false,
    operatorHint: "Provider returned an unclassified status. Review the raw transaction payload before deciding whether to escalate."
  };
}