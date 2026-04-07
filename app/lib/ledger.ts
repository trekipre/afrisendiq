export type TransactionRecord = {
  id: string
  phone: string
  operator: string
  amount: number
  provider: string
  status: string
  traceId?: string
  riskScore?: number
  quotedPrice?: number
  createdAt: string
}

export const transactions: TransactionRecord[] = []

export function resetTransactions() {
  transactions.length = 0
}

export function logTransaction(tx: Omit<TransactionRecord, "createdAt" | "provider"> & { provider?: string }) {
  const record: TransactionRecord = {
    ...tx,
    provider: tx.provider || "RELOADLY",
    createdAt: new Date().toISOString()
  }

  transactions.push(record)
  return record
}