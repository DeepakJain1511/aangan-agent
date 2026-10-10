/**
 * Live smoke test of the keys in .env.local. Prints pass/fail only, never key values.
 * Run: npx tsx --env-file=.env.local scripts/check-keys.ts
 */
import { extractFacts } from "../src/lib/extract";
import { qualify } from "../src/lib/qualify";

const transcript = `AI: Good day, Aangan Studio. How can I help you?
Caller: Hi, I'm Suresh Patil. I'm in Nashik. I want to redo my home office and study.
AI: We only work in Pune and PCMC.`;

async function main() {
  const g = await extractFacts(transcript, new Date("2026-09-03"));
  console.log("gemini:", g.source === "gemini" ? "OK" : "FELL BACK TO HEURISTIC (key or model problem)", "| area:", g.facts.inServiceArea, "| outcome:", qualify(g.facts).outcome, "| cost USD:", g.costUsd.toFixed(6));

  const t = process.env.HUBSPOT_TOKEN;
  if (!t) return console.log("hubspot: no token");
  const h = { authorization: `Bearer ${t}`, "content-type": "application/json" };
  const c = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", { method: "POST", headers: h, body: JSON.stringify({ properties: { firstname: "ZZ-Setup-Test", lastname: "Delete-Me" } }) });
  if (!c.ok) return console.log("hubspot contacts create: FAIL", c.status, (await c.text()).slice(0, 200));
  const id = ((await c.json()) as { id: string }).id;
  const d = await fetch("https://api.hubapi.com/crm/v3/objects/deals", { method: "POST", headers: h, body: JSON.stringify({ properties: { dealname: "ZZ-Setup-Test deal", dealstage: "appointmentscheduled" } }) });
  console.log("hubspot contact create: OK | deal create:", d.ok ? "OK" : `FAIL ${d.status} ${(await d.text()).slice(0, 200)}`);
  if (d.ok) await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${((await d.json()) as { id: string }).id}`, { method: "DELETE", headers: h });
  const del = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, { method: "DELETE", headers: h });
  console.log("hubspot test records cleaned up:", del.status === 204 ? "yes" : `no (${del.status})`);
}
main().catch((e) => console.log("error:", (e as Error).message));
