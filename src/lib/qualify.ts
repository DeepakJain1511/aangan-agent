import { DECLINE_LINE, RULES } from "./config";
import type { CriterionResult, Decision, Facts } from "./types";

/**
 * Nikhil's rubric (qualified.md) as deterministic rules over extracted facts.
 * - fail on any criterion            -> decline gracefully
 * - unclear on 1, 2 or 3             -> ask ONE direct question
 * - unclear on 4 or 5                -> treat as qualified, note the uncertainty
 * The LLM only extracts facts; it never decides.
 */
export function qualify(f: Facts): Decision {
  const notes: string[] = [];

  if (f.intent === "complaint") {
    return {
      outcome: "escalate",
      criteria: [],
      reason: "Existing-project complaint or chase: route to a senior person, no qualification.",
      clarifyingQuestion: null,
      closingLine: "I'm getting this to our senior team right now. Someone will call you back within 15 minutes.",
      notes: ["Existing customer. Caller wants a senior callback."],
    };
  }

  const criteria: CriterionResult[] = [
    realProject(f),
    serviceArea(f),
    timeline(f, notes),
    budget(f, notes),
    decisionMaker(f, notes),
  ];

  const failed = criteria.filter((c) => c.status === "fail");
  if (failed.length > 0) {
    return {
      outcome: "decline",
      criteria,
      reason: failed.map((c) => `${c.label}: ${c.evidence}`).join(" | "),
      clarifyingQuestion: null,
      closingLine: DECLINE_LINE,
      notes,
    };
  }

  const unclearHard = criteria.filter(
    (c) => c.status === "unclear" && ["real_project", "service_area", "timeline"].includes(c.key),
  );
  if (unclearHard.length > 0) {
    return {
      outcome: "clarify",
      criteria,
      reason: `Unclear: ${unclearHard.map((c) => c.label).join(", ")}`,
      clarifyingQuestion: questionFor(unclearHard[0].key),
      closingLine: null,
      notes,
    };
  }

  return {
    outcome: "forward",
    criteria,
    reason: "Passes all five criteria (budget/decision-maker uncertainty noted for the designer).",
    clarifyingQuestion: null,
    closingLine: null,
    notes,
  };
}

function realProject(f: Facts): CriterionResult {
  const label = "Real project";
  const key = "real_project" as const;
  if (f.intent === "advice_only")
    return { key, label, status: "fail", evidence: "Wants advice/ideas only; we sell design plus execution." };
  if (f.propertyType === "hospitality_retail_gym")
    return { key, label, status: "fail", evidence: "Restaurant/hotel/retail/gym is out of scope." };
  if (f.propertyType === "office" && f.areaSqft !== null) {
    if (f.areaSqft > RULES.officeMaxSqft)
      return { key, label, status: "fail", evidence: `Office of ${f.areaSqft} sq ft exceeds our ~${RULES.officeMaxSqft} limit.` };
    if (f.areaSqft < RULES.officeMinSqft)
      return { key, label, status: "fail", evidence: `Office of ${f.areaSqft} sq ft is below our ~${RULES.officeMinSqft} minimum.` };
  }
  if (f.intent === "project" && f.propertyType !== "unknown")
    return { key, label, status: "pass", evidence: f.scope ?? "Wants design and execution." };
  return { key, label, status: "unclear", evidence: "Scope or intent not yet clear." };
}

function serviceArea(f: Facts): CriterionResult {
  const label = "Service area";
  const key = "service_area" as const;
  if (f.inServiceArea === "no")
    return { key, label, status: "fail", evidence: `${f.location ?? "Site"} is outside Pune/PCMC.` };
  if (f.inServiceArea === "yes") return { key, label, status: "pass", evidence: f.location ?? "Pune/PCMC" };
  return { key, label, status: "unclear", evidence: "Location not stated." };
}

function timeline(f: Facts, notes: string[]): CriterionResult {
  const label = "Timeline";
  const key = "timeline" as const;
  if (f.weeksAvailable === null) return { key, label, status: "unclear", evidence: "Timeline not stated." };
  if (f.weeksAvailable < RULES.minWeeksLead)
    return {
      key,
      label,
      status: "fail",
      evidence: `Needs completion in ~${f.weeksAvailable} weeks; our minimum lead time is ${RULES.minWeeksLead}.`,
    };
  if (f.weeksAvailable < 8) notes.push("Tight timeline (under 8 weeks): designer to confirm feasibility.");
  return { key, label, status: "pass", evidence: `~${f.weeksAvailable} weeks available.` };
}

function budget(f: Facts, notes: string[]): CriterionResult {
  const label = "Budget band";
  const key = "budget" as const;
  if (f.budgetLakh === null) return { key, label, status: "pass", evidence: "Not mentioned: treated as qualified." };
  if (f.budgetLakh < RULES.minBudgetLakh)
    return {
      key,
      label,
      status: "fail",
      evidence: `Volunteered budget of up to ${f.budgetLakh} lakh is clearly below any project of this scope.`,
    };
  notes.push(`Caller volunteered a budget of up to ${f.budgetLakh} lakh.`);
  return { key, label, status: "pass", evidence: `Up to ${f.budgetLakh} lakh volunteered.` };
}

function decisionMaker(f: Facts, notes: string[]): CriterionResult {
  const label = "Decision-maker";
  const key = "decision_maker" as const;
  if (f.decisionMaker === "yes") return { key, label, status: "pass", evidence: "Caller decides." };
  if (f.decisionMaker === "represented") {
    notes.push("Caller is acting for an authorising decision-maker.");
    return { key, label, status: "pass", evidence: "Calling for an authorising decision-maker." };
  }
  notes.push(
    f.decisionMaker === "no"
      ? "Caller is only researching for the owners; involve them at the consultation."
      : "Decision-maker not confirmed.",
  );
  return { key, label, status: "unclear", evidence: "Uncertain: treated as qualified per rubric, flagged." };
}

function questionFor(key: string): string {
  switch (key) {
    case "real_project":
      return "Are you looking for a full design with execution, or mainly advice and ideas?";
    case "service_area":
      return "Which area of Pune is the property in?";
    default:
      return "When would you need the project to be complete?";
  }
}
