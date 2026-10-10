// Pushes non-empty values from .env.local to Vercel (production) without printing them.
// Usage: node scripts/push-env.js   (needs `vercel login` + `vercel link` done first)
const fs = require("fs");
const { spawnSync } = require("child_process");

const SKIP = /^(VERCEL_|NX_|TURBO_)/;
const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
let ok = 0, failed = [];
for (const line of lines) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!m || SKIP.test(m[1])) continue;
  const value = m[2].replace(/^["']|["']$/g, "").trim();
  if (!value) continue;
  // replace if it already exists, then add
  spawnSync("vercel", ["env", "rm", m[1], "production", "--yes"], { encoding: "utf8", shell: true });
  const r = spawnSync("vercel", ["env", "add", m[1], "production", "--sensitive"], { input: value, encoding: "utf8", shell: true });
  if (r.status === 0) ok++; else failed.push(m[1]);
}
console.log(`added ${ok} variables to Vercel production`);
if (failed.length) console.log("FAILED:", failed.join(", "));
