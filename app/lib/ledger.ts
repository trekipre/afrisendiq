export const transactions: any[] = []

export function logTransaction(tx: any) {

  transactions.push({
    id: tx.reference,
    phone: tx.phone,
    operator: tx.operator,
    amount: tx.amount,
    provider: "RELOADLY",
    status: tx.status,
    timestamp: new Date()
  })

}