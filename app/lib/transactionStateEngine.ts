/**
 * AfriSendIQ AI-Powered Transaction State Engine
 *
 * Unified fintech-grade state machine that governs every transaction with:
 *
 *   • Idempotency        — SHA-256 fingerprint prevents duplicate topups
 *   • Liquidity guard     — blocks execution when provider balance is too low
 *   • Max transaction     — per-user and global velocity limits
 *   • Safe balance control — real-time balance tracking, hard stop at threshold
 *   • Rate limiting       — sliding-window per customer reference
 *   • Auto-recovery       — exponential back-off retry on transient failures
 *   • Audit trail         — every state change + guard verdict is recorded
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardVerdict = {
  guard: string
  passed: boolean
  reason?: string
  metadata?: Record<string, unknown>
}

export type TransactionFingerprint = {
  hash: string
  productId: string
  customerReference: string
  amount: number
  currency: string
  createdAt: string
}

export type LiquiditySnapshot = {
  provider: string
  balance: number
  currency: string
  threshold: number
  updatedAt: string
}

export type LiquidityReservation = {
  traceId: string
  provider: string
  amount: number
  currency: string
  reservedAt: string
}

export type VelocityWindow = {
  customerReference: string
  count: number
  totalAmount: number
  windowStart: string
  windowEnd: string
}

export type TransactionGuardConfig = {
  idempotencyWindowMs: number
  maxTransactionAmount: number
  minTransactionAmount: number
  maxDailyTransactionsPerUser: number
  maxDailyAmountPerUser: number
  globalDailyTransactionLimit: number
  liquidityThresholdPercent: number
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
  retryMaxAttempts: number
  retryBaseDelayMs: number
}

// ---------------------------------------------------------------------------
// Default config from env or sensible defaults
// ---------------------------------------------------------------------------

function readEnvNumber(key: string, fallback: number): number {
  const parsed = Number(process.env[key])
  return Number.isFinite(parsed) ? parsed : fallback
}

const DEFAULT_GUARD_CONFIG: TransactionGuardConfig = {
  idempotencyWindowMs: readEnvNumber("GUARD_IDEMPOTENCY_WINDOW_MS", 30 * 60 * 1000), // 30 min
  maxTransactionAmount: readEnvNumber("GUARD_MAX_TRANSACTION_AMOUNT", 500_000),       // 500k XOF
  minTransactionAmount: readEnvNumber("GUARD_MIN_TRANSACTION_AMOUNT", 100),            // 100 XOF
  maxDailyTransactionsPerUser: readEnvNumber("GUARD_MAX_DAILY_TXN_PER_USER", 10),
  maxDailyAmountPerUser: readEnvNumber("GUARD_MAX_DAILY_AMOUNT_PER_USER", 1_000_000),
  globalDailyTransactionLimit: readEnvNumber("GUARD_GLOBAL_DAILY_TXN_LIMIT", 5000),
  liquidityThresholdPercent: readEnvNumber("GUARD_LIQUIDITY_THRESHOLD_PCT", 20),
  rateLimitWindowMs: readEnvNumber("GUARD_RATE_LIMIT_WINDOW_MS", 60_000),              // 1 min
  rateLimitMaxRequests: readEnvNumber("GUARD_RATE_LIMIT_MAX", 5),
  retryMaxAttempts: readEnvNumber("GUARD_RETRY_MAX_ATTEMPTS", 3),
  retryBaseDelayMs: readEnvNumber("GUARD_RETRY_BASE_DELAY_MS", 1000),
}

// ---------------------------------------------------------------------------
// In-memory stores (swap for Supabase/Redis in production)
// ---------------------------------------------------------------------------

const fingerprintStore = new Map<string, TransactionFingerprint>()
const liquidityStore = new Map<string, LiquiditySnapshot>()
const liquidityReservations = new Map<string, LiquidityReservation>()
const velocityStore: Array<{ customerReference: string; amount: number; timestamp: number }> = []
const rateLimitStore: Array<{ customerReference: string; timestamp: number }> = []
const auditLog: Array<{ traceId: string; guard: string; passed: boolean; reason?: string; timestamp: string }> = []
let globalDailyCount = 0
let globalDailyResetAt = startOfNextDay()

function startOfNextDay(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.getTime()
}

export function resetTransactionGuards() {
  fingerprintStore.clear()
  liquidityStore.clear()
  liquidityReservations.clear()
  velocityStore.length = 0
  rateLimitStore.length = 0
  auditLog.length = 0
  globalDailyCount = 0
  globalDailyResetAt = startOfNextDay()
}

export function getAuditLog() {
  return [...auditLog]
}

// ---------------------------------------------------------------------------
// Fingerprint / Idempotency
// ---------------------------------------------------------------------------

async function computeFingerprint(productId: string, customerReference: string, amount: number, currency: string): Promise<string> {
  const payload = `${productId}|${customerReference}|${amount}|${currency}`
  const encoded = new TextEncoder().encode(payload)
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function checkIdempotency(
  productId: string,
  customerReference: string,
  amount: number,
  currency: string,
  config: TransactionGuardConfig,
  now: number
): Promise<GuardVerdict> {
  const hash = await computeFingerprint(productId, customerReference, amount, currency)
  const existing = fingerprintStore.get(hash)

  if (existing) {
    const age = now - new Date(existing.createdAt).getTime()
    if (age < config.idempotencyWindowMs) {
      return {
        guard: "idempotency",
        passed: false,
        reason: `Duplicate transaction detected (identical request within ${Math.round(config.idempotencyWindowMs / 60000)} minutes)`,
        metadata: { existingHash: hash, ageMs: age }
      }
    }
  }

  // Record this fingerprint
  fingerprintStore.set(hash, {
    hash,
    productId,
    customerReference,
    amount,
    currency,
    createdAt: new Date(now).toISOString()
  })

  return { guard: "idempotency", passed: true }
}

// ---------------------------------------------------------------------------
// Transaction limits
// ---------------------------------------------------------------------------

function checkTransactionLimits(
  amount: number,
  config: TransactionGuardConfig
): GuardVerdict {
  if (amount < config.minTransactionAmount) {
    return {
      guard: "transaction_limits",
      passed: false,
      reason: `Amount ${amount} is below minimum ${config.minTransactionAmount}`,
      metadata: { amount, min: config.minTransactionAmount }
    }
  }

  if (amount > config.maxTransactionAmount) {
    return {
      guard: "transaction_limits",
      passed: false,
      reason: `Amount ${amount} exceeds maximum ${config.maxTransactionAmount}`,
      metadata: { amount, max: config.maxTransactionAmount }
    }
  }

  return { guard: "transaction_limits", passed: true }
}

// ---------------------------------------------------------------------------
// Velocity / per-user daily limits
// ---------------------------------------------------------------------------

function checkVelocity(
  customerReference: string,
  amount: number,
  config: TransactionGuardConfig,
  now: number
): GuardVerdict {
  const dayStart = now - 24 * 60 * 60 * 1000
  const userTxns = velocityStore.filter(
    (v) => v.customerReference === customerReference && v.timestamp >= dayStart
  )

  if (userTxns.length >= config.maxDailyTransactionsPerUser) {
    return {
      guard: "velocity_count",
      passed: false,
      reason: `Customer has reached daily transaction limit (${config.maxDailyTransactionsPerUser})`,
      metadata: { current: userTxns.length, limit: config.maxDailyTransactionsPerUser }
    }
  }

  const userDailyTotal = userTxns.reduce((sum, v) => sum + v.amount, 0)

  if (userDailyTotal + amount > config.maxDailyAmountPerUser) {
    return {
      guard: "velocity_amount",
      passed: false,
      reason: `Transaction would exceed daily amount limit (${config.maxDailyAmountPerUser})`,
      metadata: { currentTotal: userDailyTotal, requested: amount, limit: config.maxDailyAmountPerUser }
    }
  }

  return { guard: "velocity", passed: true }
}

// ---------------------------------------------------------------------------
// Global daily limit
// ---------------------------------------------------------------------------

function checkGlobalLimit(config: TransactionGuardConfig, now: number): GuardVerdict {
  if (now >= globalDailyResetAt) {
    globalDailyCount = 0
    globalDailyResetAt = startOfNextDay()
  }

  if (globalDailyCount >= config.globalDailyTransactionLimit) {
    return {
      guard: "global_daily_limit",
      passed: false,
      reason: `Global daily transaction limit reached (${config.globalDailyTransactionLimit})`,
      metadata: { current: globalDailyCount, limit: config.globalDailyTransactionLimit }
    }
  }

  return { guard: "global_daily_limit", passed: true }
}

// ---------------------------------------------------------------------------
// Rate limiting (sliding window)
// ---------------------------------------------------------------------------

function checkRateLimit(
  customerReference: string,
  config: TransactionGuardConfig,
  now: number
): GuardVerdict {
  const windowStart = now - config.rateLimitWindowMs
  const recentRequests = rateLimitStore.filter(
    (r) => r.customerReference === customerReference && r.timestamp >= windowStart
  )

  if (recentRequests.length >= config.rateLimitMaxRequests) {
    return {
      guard: "rate_limit",
      passed: false,
      reason: `Rate limit exceeded (${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowMs / 1000}s)`,
      metadata: { current: recentRequests.length, limit: config.rateLimitMaxRequests }
    }
  }

  rateLimitStore.push({ customerReference, timestamp: now })
  return { guard: "rate_limit", passed: true }
}

// ---------------------------------------------------------------------------
// Liquidity guard
// ---------------------------------------------------------------------------

export function updateLiquidity(provider: string, balance: number, currency: string, threshold?: number) {
  liquidityStore.set(provider, {
    provider,
    balance,
    currency,
    threshold: threshold ?? balance * (DEFAULT_GUARD_CONFIG.liquidityThresholdPercent / 100),
    updatedAt: new Date().toISOString()
  })
}

export function getLiquidity(provider: string): LiquiditySnapshot | undefined {
  return liquidityStore.get(provider)
}

export function getLiquidityReservations(provider?: string) {
  const reservations = [...liquidityReservations.values()]
  return provider ? reservations.filter((reservation) => reservation.provider === provider) : reservations
}

function getReservedLiquidity(provider: string, excludeTraceId?: string) {
  return [...liquidityReservations.values()]
    .filter((reservation) => reservation.provider === provider && reservation.traceId !== excludeTraceId)
    .reduce((sum, reservation) => sum + reservation.amount, 0)
}

function checkLiquidity(provider: string, amount: number, traceId?: string): GuardVerdict {
  const snapshot = liquidityStore.get(provider)

  // If no liquidity data, allow (we're in JIT mode — no pre-funded wallet)
  if (!snapshot) {
    return {
      guard: "liquidity",
      passed: true,
      metadata: { note: "No liquidity data — JIT mode assumed" }
    }
  }

  const reserved = getReservedLiquidity(provider, traceId)
  const availableBalance = snapshot.balance - reserved

  if (availableBalance - amount < snapshot.threshold) {
    return {
      guard: "liquidity",
      passed: false,
      reason: `Provider ${provider} available balance (${availableBalance}) minus transaction (${amount}) would breach safety threshold (${snapshot.threshold})`,
      metadata: { balance: snapshot.balance, reserved, availableBalance, amount, threshold: snapshot.threshold }
    }
  }

  return {
    guard: "liquidity",
    passed: true,
    metadata: { balance: snapshot.balance, reserved, availableBalance, amount, threshold: snapshot.threshold }
  }
}

export function reserveLiquidity(traceId: string, provider: string, amount: number, currency: string) {
  const snapshot = liquidityStore.get(provider)
  if (!snapshot) {
    return {
      reserved: false,
      skipped: true,
      reason: "No liquidity data — JIT mode assumed"
    }
  }

  const existing = liquidityReservations.get(traceId)
  if (existing) {
    if (existing.provider === provider && existing.amount === amount && existing.currency === currency) {
      return { reserved: true, skipped: false }
    }

    throw new Error(`Trace ${traceId} already has a liquidity reservation`)
  }

  const verdict = checkLiquidity(provider, amount, traceId)
  if (!verdict.passed) {
    return {
      reserved: false,
      skipped: false,
      reason: verdict.reason
    }
  }

  liquidityReservations.set(traceId, {
    traceId,
    provider,
    amount,
    currency,
    reservedAt: new Date().toISOString()
  })

  return { reserved: true, skipped: false }
}

export function releaseLiquidity(traceId: string) {
  return liquidityReservations.delete(traceId)
}

export function settleLiquidity(traceId: string) {
  const reservation = liquidityReservations.get(traceId)
  if (!reservation) {
    return false
  }

  const snapshot = liquidityStore.get(reservation.provider)
  if (snapshot) {
    liquidityStore.set(reservation.provider, {
      ...snapshot,
      balance: Math.max(0, Math.round((snapshot.balance - reservation.amount) * 100) / 100),
      updatedAt: new Date().toISOString()
    })
  }

  liquidityReservations.delete(traceId)
  return true
}

// ---------------------------------------------------------------------------
// Unified guard execution
// ---------------------------------------------------------------------------

export type TransactionGuardInput = {
  traceId: string
  productId: string
  customerReference: string
  amount: number
  currency: string
  provider: string
  providerCost?: number
}

export type TransactionGuardResult = {
  approved: boolean
  verdicts: GuardVerdict[]
  blockedBy?: string
}

export async function runTransactionGuards(
  input: TransactionGuardInput,
  configOverride?: Partial<TransactionGuardConfig>
): Promise<TransactionGuardResult> {
  const config = { ...DEFAULT_GUARD_CONFIG, ...configOverride }
  const now = Date.now()
  const verdicts: GuardVerdict[] = []

  // Run all guards
  const idempotencyVerdict = await checkIdempotency(input.productId, input.customerReference, input.amount, input.currency, config, now)
  verdicts.push(idempotencyVerdict)

  verdicts.push(checkTransactionLimits(input.amount, config))
  verdicts.push(checkVelocity(input.customerReference, input.amount, config, now))
  verdicts.push(checkGlobalLimit(config, now))
  verdicts.push(checkRateLimit(input.customerReference, config, now))
  verdicts.push(checkLiquidity(input.provider, input.providerCost ?? input.amount, input.traceId))

  // Audit every verdict
  for (const verdict of verdicts) {
    auditLog.push({
      traceId: input.traceId,
      guard: verdict.guard,
      passed: verdict.passed,
      reason: verdict.reason,
      timestamp: new Date(now).toISOString()
    })
  }

  const failed = verdicts.find((v) => !v.passed)

  if (failed) {
    return { approved: false, verdicts, blockedBy: failed.guard }
  }

  // Record velocity / global count on approval
  velocityStore.push({ customerReference: input.customerReference, amount: input.amount, timestamp: now })
  globalDailyCount++

  return { approved: true, verdicts }
}

// ---------------------------------------------------------------------------
// Retry with exponential back-off
// ---------------------------------------------------------------------------

export async function withRetry<T>(
  fn: () => Promise<T>,
  configOverride?: Partial<TransactionGuardConfig>
): Promise<T> {
  const config = { ...DEFAULT_GUARD_CONFIG, ...configOverride }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < config.retryMaxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on business logic errors
      if (lastError.message.includes("blocked") || lastError.message.includes("Duplicate") || lastError.message.includes("limit")) {
        throw lastError
      }

      if (attempt < config.retryMaxAttempts - 1) {
        const delay = config.retryBaseDelayMs * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error("Retry exhausted")
}
