import { computeMetrics } from "@/lib/metrics";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public landing page: aggregate numbers only. No names, numbers, transcripts or notes. */
export default async function Home() {
  let rows: Awaited<ReturnType<ReturnType<typeof getStore>["list"]>> = [];
  try {
    rows = await getStore().list();
  } catch {
    /* store unavailable: show the page without numbers */
  }
  const m = computeMetrics(rows);
  const samples = rows.filter((r) => r.is_sample).length;
  const card = (l: string, v: string) => (
    <div style={{ background: "#fff", border: "1px solid #e5e0d8", borderRadius: 8, padding: 14, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#777" }}>{l}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{v}</div>
    </div>
  );
  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: "0 16px", lineHeight: 1.5 }}>
      <h1>Aangan Studio: phone enquiry agent</h1>
      <p>
        A voice agent answers every call, qualifies it against the founder&apos;s five-criterion rubric, books a consultation, and hands
        qualified leads to designers on Telegram with everything already asked. It never quotes a price.
      </p>
      <h2>Live numbers (aggregate only)</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {card("Calls processed", String(m.total))}
        {card("Qualified, forwarded", String(m.byOutcome.forward))}
        {card("Declined politely", String(m.byOutcome.decline))}
        {card("Needs follow-up", String(m.byOutcome.clarify))}
        {card("Escalated", String(m.byOutcome.escalate))}
        {card("After-hours share", `${Math.round(m.afterHoursShare * 100)}%`)}
        {card("Price quotes by agent", String(m.pricingViolations))}
        {card("Est. running cost", `₹${m.totalCostInr.toFixed(2)}`)}
      </div>
      <p style={{ color: "#777", fontSize: 13 }}>
        {samples} of these rows are sample data: the 19 September phone transcripts from the case, qualified by the real rules with
        hand-labelled facts, and marked as samples. Voice cost is an estimate (minutes x ₹4.92).
      </p>
      <p>
        <a href="/dashboard">Staff dashboard</a> (key required). Source and docs are in the GitHub repo.
      </p>
    </main>
  );
}
