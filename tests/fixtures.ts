import { EMPTY_FACTS } from "@/lib/extract";
import type { Facts, Outcome } from "@/lib/types";

/** Hand-labelled facts for the 20 September phone enquiries (T08 is a missed call, no transcript). */
const f = (o: Partial<Facts>): Facts => ({ ...EMPTY_FACTS, ...o });
const res = { propertyType: "residential" as const, intent: "project" as const, inServiceArea: "yes" as const };

export interface Case {
  id: string;
  caller: string;
  facts: Facts;
  expected: Outcome;
  why: string;
}

export const CASES: Case[] = [
  { id: "T01", caller: "Priya", expected: "forward", why: "3BHK Kothrud, March, owner", facts: f({ ...res, location: "Kothrud", areaSqft: 1400, weeksAvailable: 26, decisionMaker: "yes", callerName: "Priya", referral: "Shruti Joshi" }) },
  { id: "T02", caller: "Wakad 2BHK", expected: "forward", why: "Asked price twice, deflected, still qualifies", facts: f({ ...res, location: "Wakad", areaSqft: 950, weeksAvailable: 8, decisionMaker: "unknown", priceAsked: true }) },
  { id: "T03", caller: "Suresh Patil", expected: "decline", why: "Nashik is outside service area", facts: f({ ...res, location: "Nashik", inServiceArea: "no", weeksAvailable: null, callerName: "Suresh Patil" }) },
  { id: "T04", caller: "Living-room ideas", expected: "decline", why: "Advice only", facts: f({ intent: "advice_only", propertyType: "residential", inServiceArea: "unknown" }) },
  { id: "T05", caller: "Aarti Mehta", expected: "forward", why: "4BHK Koregaon Park, Feb", facts: f({ ...res, location: "Koregaon Park", areaSqft: 2400, weeksAvailable: 16, decisionMaker: "yes", callerName: "Aarti Mehta" }) },
  { id: "T06", caller: "Baner startup", expected: "forward", why: "800 sq ft office, founder", facts: f({ ...res, propertyType: "office", location: "Baner", areaSqft: 800, weeksAvailable: 12, decisionMaker: "yes" }) },
  { id: "T07", caller: "Before Diwali", expected: "decline", why: "About 3 weeks, below 6-week minimum", facts: f({ ...res, location: "Pune", weeksAvailable: 3 }) },
  { id: "T09", caller: "Sheetal Deshpande", expected: "escalate", why: "Existing-project complaint", facts: f({ intent: "complaint", callerName: "Sheetal Deshpande" }) },
  { id: "T10", caller: "Kharadi 1BHK", expected: "decline", why: "Volunteered 1-1.5 lakh for kitchen + bedroom", facts: f({ ...res, location: "Kharadi", areaSqft: 550, weeksAvailable: 12, budgetLakh: 1.5 }) },
  { id: "T11", caller: "Baner rented 2BHK", expected: "forward", why: "Rented is fine, no structural change", facts: f({ ...res, location: "Baner", weeksAvailable: 20, decisionMaker: "yes" }) },
  { id: "T12", caller: "Anand Sharma", expected: "forward", why: "5,500 sq ft villa (residential, no size cap)", facts: f({ ...res, location: "Kalyani Nagar", areaSqft: 5500, weeksAvailable: 24, decisionMaker: "yes", callerName: "Anand Sharma" }) },
  { id: "T13", caller: "Aundh 3BHK", expected: "forward", why: "Pushed for a range, deflected, booked", facts: f({ ...res, location: "Aundh", areaSqft: 1100, weeksAvailable: 12, priceAsked: true }) },
  { id: "T14", caller: "Son for parents", expected: "forward", why: "Decision-maker unclear: forward and flag (rubric)", facts: f({ ...res, location: "Hadapsar", weeksAvailable: 12, decisionMaker: "no" }) },
  { id: "T15", caller: "Smita", expected: "forward", why: "Possession in 6 weeks is enough lead time", facts: f({ ...res, location: "Undri", areaSqft: 875, weeksAvailable: 6, decisionMaker: "yes", callerName: "Smita" }) },
  { id: "T16", caller: "Girish Nair", expected: "clarify", why: "Chasing a dropped enquiry; timeline never given: ask once", facts: f({ ...res, location: "Viman Nagar", weeksAvailable: null, callerName: "Girish Nair" }) },
  { id: "T17", caller: "Ritu Kapoor", expected: "forward", why: "Pimple Saudagar 3BHK, March", facts: f({ ...res, location: "Pimple Saudagar", areaSqft: 1050, weeksAvailable: 24, callerName: "Ritu Kapoor" }) },
  { id: "T18", caller: "Coworking pod", expected: "decline", why: "180 sq ft is below the ~500 sq ft commercial minimum", facts: f({ ...res, propertyType: "office", location: "Pune", areaSqft: 180, weeksAvailable: 12 }) },
  { id: "T19", caller: "Restaurant", expected: "decline", why: "Hospitality is out of scope", facts: f({ ...res, propertyType: "hospitality_retail_gym", location: "Koregaon Park", weeksAvailable: null }) },
  { id: "T20", caller: "Pooja", expected: "forward", why: "Magarpatta 2BHK, Jan start", facts: f({ ...res, location: "Magarpatta", areaSqft: 900, weeksAvailable: 14, decisionMaker: "yes", callerName: "Pooja" }) },
];
