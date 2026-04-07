import { sendAirtime } from "@/app/providers/reloadly"
import { sendDingTransfer } from "@/app/providers/ding"
import { sendDTOneTransaction } from "@/app/lib/dtone"

export type AirtimeProvider = "reloadly" | "dtone" | "ding"

export type AirtimeExecutionInput = {
  traceId: string
  phone: string
  amount: number
  operatorId: number
  reference: string
  countryCode: string
}

export type ProviderExecutionAttempt = {
  provider: AirtimeProvider
  success: boolean
  startedAt: string
  finishedAt: string
  error?: string
}

export type ProviderExecutionResult = {
  provider: AirtimeProvider
  status: string
  transaction: Record<string, unknown>
  attempts: ProviderExecutionAttempt[]
}

export type AirtimeExecutor = (input: AirtimeExecutionInput) => Promise<Record<string, unknown>>

export class ProviderExecutionError extends Error {
  attempts: ProviderExecutionAttempt[]

  constructor(message: string, attempts: ProviderExecutionAttempt[]) {
    super(message)
    this.name = "ProviderExecutionError"
    this.attempts = attempts
  }
}

function resolveProviderPriority(rawValue = process.env.AIRTIME_PROVIDER_PRIORITY) {
  const providers = (rawValue || "reloadly")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean) as AirtimeProvider[]

  return providers.length > 0 ? providers : (["reloadly"] as AirtimeProvider[])
}

const defaultExecutors: Partial<Record<AirtimeProvider, AirtimeExecutor>> = {
  reloadly: async (input) =>
    sendAirtime({
      operatorId: input.operatorId,
      phone: input.phone,
      amount: input.amount,
      reference: input.reference
    })
}

export async function executeAirtimeWithFallback(
  input: AirtimeExecutionInput,
  options?: {
    executors?: Partial<Record<AirtimeProvider, AirtimeExecutor>>
    providerPriority?: AirtimeProvider[]
    onAttempt?: (attempt: ProviderExecutionAttempt) => void
  }
) {
  const executors = options?.executors || defaultExecutors
  const providerPriority = options?.providerPriority || resolveProviderPriority()
  const attempts: ProviderExecutionAttempt[] = []

  for (const provider of providerPriority) {
    const executor = executors[provider]

    if (!executor) {
      const skippedAttempt: ProviderExecutionAttempt = {
        provider,
        success: false,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: `Provider ${provider} is not configured`
      }

      attempts.push(skippedAttempt)
      options?.onAttempt?.(skippedAttempt)
      continue
    }

    const startedAt = new Date().toISOString()

    try {
      const transaction = await executor(input)
      const successfulAttempt: ProviderExecutionAttempt = {
        provider,
        success: true,
        startedAt,
        finishedAt: new Date().toISOString()
      }

      attempts.push(successfulAttempt)
      options?.onAttempt?.(successfulAttempt)

      return {
        provider,
        status: String(transaction.status || "submitted"),
        transaction,
        attempts
      } satisfies ProviderExecutionResult
    } catch (error) {
      const failedAttempt: ProviderExecutionAttempt = {
        provider,
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : `Provider ${provider} failed`
      }

      attempts.push(failedAttempt)
      options?.onAttempt?.(failedAttempt)
    }
  }

  throw new ProviderExecutionError(
    attempts.map((attempt) => `${attempt.provider}: ${attempt.error || "failed"}`).join("; "),
    attempts
  )
}

// ---------------------------------------------------------------------------
// Unified provider dispatch for JIT webhook execution
// ---------------------------------------------------------------------------

export type RouteProviderInput = {
  provider: string
  productId: string
  amount: number
  phone: string
  reference: string
  traceId: string
}

export async function routeProviderExecution(input: RouteProviderInput): Promise<Record<string, unknown>> {
  const provider = input.provider.toLowerCase()

  if (provider === "reloadly") {
    const result = await sendAirtime({
      operatorId: Number(input.productId),
      phone: input.phone,
      amount: input.amount,
      reference: input.reference
    })
    return result as unknown as Record<string, unknown>
  }

  if (provider === "ding") {
    const result = await sendDingTransfer({
      skuCode: input.productId,
      sendValue: input.amount,
      accountNumber: input.phone,
      distributorRef: input.reference,
      correlationId: input.traceId
    })
    return result as unknown as Record<string, unknown>
  }

  if (provider === "dtone") {
    const result = await sendDTOneTransaction({
      productId: Number(input.productId),
      creditPartyIdentifier: {
        mobile_number: input.phone
      },
      sourceAmount: input.amount,
      externalId: input.reference
    })
    return result as unknown as Record<string, unknown>
  }

  throw new Error(`Unsupported provider: ${input.provider}`)
}