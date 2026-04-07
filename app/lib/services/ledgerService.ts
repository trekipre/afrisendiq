export type LedgerDirection = "debit" | "credit"

export type LedgerEntryInput = {
  accountCode: string
  direction: LedgerDirection
  amount: number
  currency: string
  description?: string
}

export type LedgerJournalInput = {
  referenceType: string
  referenceId: string
  description: string
  entries: LedgerEntryInput[]
  metadata?: Record<string, unknown>
}

export type LedgerJournal = LedgerJournalInput & {
  journalId: string
  postedAt: string
}

export type LedgerReserveInput = {
  reserveKey: string
  accountCode: string
  amount: number
  currency: string
  description: string
}

export type LedgerBalance = {
  accountCode: string
  currency: string
  debitTotal: number
  creditTotal: number
  net: number
}

export interface LedgerService {
  postJournal(input: LedgerJournalInput): Promise<LedgerJournal>
  reserve(input: LedgerReserveInput): Promise<void>
  releaseReserve(reserveKey: string): Promise<void>
  getBalances(): Promise<LedgerBalance[]>
}

const journals: LedgerJournal[] = []
const reserves = new Map<string, LedgerReserveInput>()

export const internalLedgerService: LedgerService = {
  async postJournal(input) {
    const debitTotal = input.entries
      .filter((entry) => entry.direction === "debit")
      .reduce((sum, entry) => sum + entry.amount, 0)

    const creditTotal = input.entries
      .filter((entry) => entry.direction === "credit")
      .reduce((sum, entry) => sum + entry.amount, 0)

    if (debitTotal !== creditTotal) {
      throw new Error("Ledger journal must balance before posting")
    }

    const journal: LedgerJournal = {
      ...input,
      journalId: crypto.randomUUID(),
      postedAt: new Date().toISOString(),
    }

    journals.push(journal)
    return journal
  },

  async reserve(input) {
    reserves.set(input.reserveKey, input)
  },

  async releaseReserve(reserveKey) {
    reserves.delete(reserveKey)
  },

  async getBalances() {
    const index = new Map<string, LedgerBalance>()

    for (const journal of journals) {
      for (const entry of journal.entries) {
        const key = `${entry.accountCode}:${entry.currency}`
        const current = index.get(key) ?? {
          accountCode: entry.accountCode,
          currency: entry.currency,
          debitTotal: 0,
          creditTotal: 0,
          net: 0,
        }

        if (entry.direction === "debit") {
          current.debitTotal += entry.amount
        } else {
          current.creditTotal += entry.amount
        }

        current.net = current.debitTotal - current.creditTotal
        index.set(key, current)
      }
    }

    return [...index.values()]
  },
}