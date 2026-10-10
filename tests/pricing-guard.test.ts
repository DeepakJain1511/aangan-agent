import { describe, expect, it } from "vitest";
import { PRICE_DEFLECTION } from "@/lib/config";
import { auditTranscript, guardOutgoing, violatesPricingRule } from "@/lib/pricing-guard";

describe("pricing guard (the Cut: the agent never quotes price)", () => {
  it.each([
    "It'll cost around 20 lakh.",
    "Our rates start at ₹1,800 per sq ft",
    "For a 2BHK it's typically 12 lakhs",
    "Rs 2400 per square foot",
    "around 3.5 lakh",
  ])("flags: %s", (t) => expect(violatesPricingRule(t)).toBe(true));

  it.each([
    "Pricing depends on the site, the materials you choose, and the scope.",
    "We can do 10am on Monday.",
    "Your flat is about 950 sq ft?",
  ])("allows: %s", (t) => expect(violatesPricingRule(t)).toBe(false));

  it("replaces a violating outgoing line with the approved deflection", () => {
    expect(guardOutgoing("It starts from 1800 per sq ft")).toBe(PRICE_DEFLECTION);
  });

  it("audit only looks at agent turns, not caller numbers", () => {
    const ok = auditTranscript("Caller: my budget is 2 lakh\nAI: Thanks, which area is it in?");
    expect(ok.violation).toBe(false);
    const bad = auditTranscript("Caller: how much?\nAI: Usually around 15 lakh for that.");
    expect(bad.violation).toBe(true);
  });
});
