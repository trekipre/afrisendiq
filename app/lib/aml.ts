export function amlCheck({
  amount,
  recentTransactions
}: {
  amount: number
  recentTransactions: number
}) {

  let riskScore = 0

  if (amount > 100000) riskScore += 40
  if (recentTransactions > 5) riskScore += 30

  if (riskScore >= 70) {
    throw new Error("Transaction blocked due to AML risk")
  }

  return riskScore
}