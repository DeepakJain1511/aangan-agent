import { describe, expect, it } from "vitest";
import { qualify } from "@/lib/qualify";
import { CASES } from "./fixtures";

describe("qualification rubric against the 19 September phone transcripts", () => {
  for (const c of CASES) {
    it(`${c.id} ${c.caller}: ${c.expected} (${c.why})`, () => {
      expect(qualify(c.facts).outcome).toBe(c.expected);
    });
  }

  it("declines never forward and carry the graceful closing line", () => {
    const d = qualify(CASES.find((c) => c.id === "T03")!.facts);
    expect(d.closingLine).toMatch(/not be the right fit/);
  });

  it("unclear decision-maker is flagged in notes, not blocked", () => {
    const d = qualify(CASES.find((c) => c.id === "T14")!.facts);
    expect(d.outcome).toBe("forward");
    expect(d.notes.join(" ")).toMatch(/owners|Decision-maker/);
  });

  it("clarify asks exactly one question", () => {
    const d = qualify(CASES.find((c) => c.id === "T16")!.facts);
    expect(d.clarifyingQuestion).toMatch(/complete/);
  });

  it("a budget that is not mentioned is treated as qualified", () => {
    const d = qualify(CASES.find((c) => c.id === "T01")!.facts);
    expect(d.criteria.find((c) => c.key === "budget")!.status).toBe("pass");
  });
});
