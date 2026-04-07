import { getDingDiagnostics, getDtOneDiagnostics } from "@/app/lib/providerDiagnostics"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderStatusBadge(label: string, active: boolean) {
  const background = active ? "#d1fae5" : "#fee2e2"
  const foreground = active ? "#065f46" : "#991b1b"
  const state = active ? "yes" : "no"

  return `<span style="display:inline-flex;align-items:center;gap:0.4rem;border-radius:999px;background:${background};color:${foreground};padding:0.45rem 0.8rem;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(label)}: ${state}</span>`
}

function renderList(items: string[], emptyLabel: string) {
  if (!items.length) {
    return `<div style="color:#64748b;font-size:0.95rem;">${escapeHtml(emptyLabel)}</div>`
  }

  return `<div style="display:flex;flex-wrap:wrap;gap:0.6rem;">${items
    .map(
      (item) =>
        `<span style="border-radius:999px;background:#f1f5f9;color:#0f172a;padding:0.5rem 0.8rem;font-size:0.82rem;font-weight:600;">${escapeHtml(item)}</span>`
    )
    .join("")}</div>`
}

function renderProviderCard(provider: Awaited<ReturnType<typeof getDingDiagnostics>>) {
  const coverage = provider.coverage
  const details = provider.details ? escapeHtml(JSON.stringify(provider.details, null, 2)) : ""
  const providerName = provider.provider === "ding" ? "Ding" : "DT One"

  return `
    <section style="border:1px solid rgba(15,23,42,0.08);border-radius:28px;background:#ffffff;padding:1.5rem;box-shadow:0 24px 80px rgba(15,23,42,0.08);">
      <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.74rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">${escapeHtml(provider.provider)}</div>
          <h2 style="margin:0.45rem 0 0;color:#0f172a;font-size:1.85rem;line-height:1.1;">${providerName}</h2>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.55rem;">
          ${renderStatusBadge("configured", provider.configured)}
          ${renderStatusBadge("auth", provider.authOk)}
          ${renderStatusBadge("api", provider.apiReachable)}
        </div>
      </div>

      ${provider.message ? `<div style="margin-top:1rem;border-radius:18px;background:#f8fafc;padding:0.95rem 1rem;color:#334155;font-size:0.95rem;line-height:1.6;">${escapeHtml(provider.message)}</div>` : ""}

      ${
        coverage
          ? `
        <div style="margin-top:1.25rem;display:grid;gap:1rem;">
          <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
            <div style="border-radius:20px;background:#f8fafc;padding:1rem;">
              <div style="font-size:0.72rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">Country</div>
              <div style="margin-top:0.45rem;font-size:1.15rem;font-weight:700;color:#0f172a;">${escapeHtml(coverage.countryIso)}</div>
            </div>
            <div style="border-radius:20px;background:#f8fafc;padding:1rem;">
              <div style="font-size:0.72rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">Providers</div>
              <div style="margin-top:0.45rem;font-size:1.15rem;font-weight:700;color:#0f172a;">${coverage.providerCount}</div>
            </div>
            <div style="border-radius:20px;background:#f8fafc;padding:1rem;">
              <div style="font-size:0.72rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">Products</div>
              <div style="margin-top:0.45rem;font-size:1.15rem;font-weight:700;color:#0f172a;">${coverage.productCount}</div>
            </div>
          </div>

          <div>
            <div style="margin-bottom:0.6rem;font-size:0.78rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;">Coverage categories</div>
            ${renderList(coverage.categories, "No categories found.")}
          </div>

          <div>
            <div style="margin-bottom:0.6rem;font-size:0.78rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;">Highlights</div>
            ${renderList(coverage.highlights, "No key highlights found.")}
          </div>

          <div>
            <div style="margin-bottom:0.6rem;font-size:0.78rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;">Visible providers</div>
            ${renderList(coverage.providers, "No visible providers found.")}
          </div>
        </div>`
          : ""
      }

      ${details ? `<pre style="margin-top:1.25rem;overflow:auto;border-radius:20px;background:#0f172a;padding:1rem;color:#d1fae5;font-size:0.78rem;line-height:1.6;">${details}</pre>` : ""}
    </section>`
}

function renderDiagnosticsDashboard(ding: Awaited<ReturnType<typeof getDingDiagnostics>>, dtone: Awaited<ReturnType<typeof getDtOneDiagnostics>>) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>AfriSendIQ Provider Diagnostics</title>
    </head>
    <body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:radial-gradient(circle at top,#173d32 0%,#0b1f18 42%,#07120d 100%);color:#e2e8f0;">
      <main style="max-width:1180px;margin:0 auto;padding:32px 24px 56px;">
        <header style="display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:end;">
          <div>
            <div style="font-size:0.78rem;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#99f6e4;">Internal provider diagnostics</div>
            <h1 style="margin:0.8rem 0 0;font-size:clamp(2rem,5vw,3.4rem);line-height:1.02;color:#ffffff;">Ding and DT One health, reachability, and Côte d'Ivoire coverage.</h1>
            <p style="margin:1rem 0 0;max-width:760px;font-size:1rem;line-height:1.75;color:rgba(226,232,240,0.84);">This browser view is a readable version of the internal diagnostics endpoint. Internal fetch clients still receive JSON.</p>
          </div>
          <div style="justify-self:start;border:1px solid rgba(255,255,255,0.12);border-radius:28px;background:rgba(255,255,255,0.08);padding:1rem 1.15rem;backdrop-filter:blur(14px);">
            <div style="font-size:0.76rem;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#99f6e4;">Internal endpoint</div>
            <div style="margin-top:0.55rem;font-size:0.95rem;line-height:1.6;color:#f8fafc;">/api/internal/providers/diagnostics</div>
          </div>
        </header>

        <section style="margin-top:2rem;display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));">
          ${renderProviderCard(ding)}
          ${renderProviderCard(dtone)}
        </section>
      </main>
    </body>
  </html>`
}

export async function GET(request: Request) {
  const [ding, dtone] = await Promise.all([getDingDiagnostics(), getDtOneDiagnostics()])

  const acceptsHtml = request.headers.get("accept")?.includes("text/html")

  if (acceptsHtml) {
    return new Response(renderDiagnosticsDashboard(ding, dtone), {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    })
  }

  return Response.json({
    success: true,
    providers: {
      ding,
      dtone
    }
  })
}