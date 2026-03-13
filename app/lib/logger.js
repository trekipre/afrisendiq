export async function logTransaction(data) {
  console.log("Transaction Log:", {
    id: "TX-" + Date.now(),
    ...data,
    createdAt: new Date().toISOString()
  })

}
