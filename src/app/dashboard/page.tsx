import crypto from "node:crypto";
import { env } from "@/lib/config";
import { computeMetrics } from "@/lib/metrics";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const inr = (n: number | null) => (n === null ? "n/a" : `₹${n.toFixed(n < 100 ? 2 : 0)}`);
const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

function authorised(key: string | undefined): boolean {
  const want = env("DASHBOARD_KEY");
  if (!want || !key || key.length !== want.length) return false; // fail closed
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(want));
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ key?: string; show?: string }> }) {
  const sp = await searchParams;
  if (!authorised(sp.key)) {
    return <main style={{ padding: 32 }}><h1>Dashboard</h1><p>Unauthorised. Add <code>?key=…</code>.</p></main>;
  }
  const all = await getStore().list();
  const rows = sp.show === "all" ? all : all.filter((r) => !r.is_sample);
  const m = computeMetrics(rows);
  const card = (label: string, value: string, sub?: string) => (
    <div style={{ background: "#fff", border: "1px solid #e5e0d8", borderRadius: 8, padding: 14, minWidth: 150 }}>
      <div style={{ fontSize: 12, color: "#777" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#999" }}>{sub}</div>}
    </div>
  );
  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
      <h1>Phone enquiries</h1>
      <p style={{ color: "#666" }}>
        {rows.length} calls shown. <a href={`?key=${sp.key}&show=${sp.show === "all" ? "" : "all"}`}>{sp.show === "all" ? "Hide samples" : "Include sample data"}</a>
      </p>
      <h2>What it generates</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {card("Calls answered", String(m.total))}
        {card("Qualified, forwarded", String(m.byOutcome.forward))}
        {card("Declined politely", String(m.byOutcome.decline))}
        {card("Escalated", String(m.byOutcome.escalate))}
        {card("Consultations booked", String(m.booked))}
        {card("After-hours calls", pct(m.afterHoursShare), "outside 10am-7pm IST")}
        {card("Avg call-end to designer", m.avgHandoffSeconds === null ? "n/a" : `${Math.round(m.avgHandoffSeconds)}s`, `${pct(m.handoffUnder5MinShare)} within 5 min`)}
        {card("Indicative pipeline", `₹${m.pipelineLakh} lakh`, "forwarded x avg project value; not revenue")}
      </div>
      <h2>What it costs</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {card("Total running cost", inr(m.totalCostInr))}
        {card("Voice (Vaani, estimated)", inr(m.voiceCostInr))}
        {card("AI (Gemini Flash)", inr(m.llmCostInr))}
        {card("Cost per call", inr(m.costPerCallInr))}
        {card("Cost per qualified lead", inr(m.costPerQualifiedLeadInr))}
        {card("Price-quote violations", String(m.pricingViolations), "must stay 0")}
      </div>
      <h2>Calls</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th>When</th><th>Caller</th><th>Outcome</th><th>Why</th><th>Slot</th><th>Claimed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.call_id} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
              <td>{new Date(r.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
              <td>{r.caller_name ?? r.phone ?? "unknown"}</td>
              <td><b>{r.outcome}</b></td>
              <td style={{ maxWidth: 380 }}>
                {r.reason}
                <details><summary>Handoff note and transcript</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{r.handoff_note}</pre>
                  <pre style={{ whiteSpace: "pre-wrap", color: "#555" }}>{r.transcript}</pre>
                  {r.criteria.map((c) => <div key={c.key}>{c.status === "pass" ? "✔" : c.status === "fail" ? "✘" : "?"} {c.label}: {c.evidence}</div>)}
                </details>
              </td>
              <td>{r.booked_slot ?? ""}</td>
              <td>{r.claimed_by ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
