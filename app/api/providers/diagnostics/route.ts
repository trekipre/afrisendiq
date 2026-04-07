export async function GET() {
  return Response.json(
    {
      success: false,
      error: "Not found. Use /api/internal/providers/diagnostics from an authenticated internal session."
    },
    {
      status: 404
    }
  )
}