export const env = (k: string): string | undefined => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export const PRICE_DEFLECTION =
  "Pricing depends on the site, the materials you choose, and the scope — your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.";

export const DECLINE_LINE =
  "This sounds like it may not be the right fit for us right now — but feel free to reach out if your timeline or scope changes.";

/** Business thresholds, taken from services.md / qualified.md / pricing.md. */
export const RULES = {
  minWeeksLead: 6, // "cannot begin execution on a project that needs to be ready in under 6 weeks"
  officeMaxSqft: 3000,
  officeMinSqft: 500, // T18: a 180 sq ft pod was declined as below minimum
  minBudgetLakh: 3.5, // single-room all-in starts at 3.5 lakh; anything below is clearly misaligned
  avgProjectValueLakh: 11, // problem statement: 8-14 lakh average
  reminderMinutes: 30,
};
