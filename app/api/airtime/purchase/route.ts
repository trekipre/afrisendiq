import { detectOperator, sendAirtime } from "../../../providers/reloadly"
import { amlCheck } from "../../../lib/aml"
import { logTransaction } from "../../../lib/ledger"


export async function POST(req: Request) {

  const body = await req.json()

  const phone = body.phone
  const amount = body.amount

  const operator = await detectOperator(phone, "CI")

  if (!operator.operatorId) {
    return Response.json({ error: "Operator not found" }, { status: 400 })
  }

  amlCheck({
    amount,
    recentTransactions: 0
  })

  const reference = `AFRISEND-${Date.now()}`

  const result = await sendAirtime({
    operatorId: operator.operatorId,
    phone,
    amount,
    reference
  })

  logTransaction({
    reference,
    phone,
    operator: operator.name,
    amount,
    status: result.status
  })

  return Response.json({
    success: true,
    reference,
    transaction: result
  })
}