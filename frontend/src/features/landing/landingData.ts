// Sample people, companies and activity that drive the landing page demos.
// Everything here is illustrative, not real usage data.

export interface CrewMember {
  id: string;
  name: string;
}

export const CREW: CrewMember[] = [
  { id: "maya", name: "Maya Chen" },
  { id: "dev", name: "Dev Patel" },
  { id: "priya", name: "Priya Okafor" },
  { id: "sam", name: "Sam Rivera" },
  { id: "leo", name: "Leo Brooks" },
  { id: "ana", name: "Ana Silva" },
  { id: "noor", name: "Noor Haddad" },
  { id: "jules", name: "Jules Moreau" },
];

export const crew = (id: string): CrewMember =>
  CREW.find((member) => member.id === id) ?? CREW[0];

export interface WallEntry {
  company: string;
  role: string;
  owner: string;
  arrangement: "Remote" | "Hybrid" | "On-site";
}

export const WALL: WallEntry[] = [
  { company: "Northwind", role: "Product Analyst", owner: "maya", arrangement: "Hybrid" },
  { company: "Kestrel AI", role: "ML Engineer", owner: "dev", arrangement: "Remote" },
  { company: "Lakefront Health", role: "Data Analyst", owner: "priya", arrangement: "On-site" },
  { company: "Harbor & Pine", role: "UX Designer", owner: "sam", arrangement: "Remote" },
  { company: "Brightline", role: "Frontend Engineer", owner: "leo", arrangement: "Hybrid" },
  { company: "Copperleaf", role: "Ops Associate", owner: "ana", arrangement: "On-site" },
  { company: "Atlas Robotics", role: "Systems Engineer", owner: "noor", arrangement: "On-site" },
  { company: "Fieldnote", role: "Content Strategist", owner: "jules", arrangement: "Remote" },
  { company: "Bluebird Labs", role: "QA Engineer", owner: "maya", arrangement: "Remote" },
  { company: "Summit Bank", role: "Risk Analyst", owner: "dev", arrangement: "Hybrid" },
  { company: "Juniper", role: "Customer Success", owner: "priya", arrangement: "Remote" },
  { company: "Orbital", role: "Product Designer", owner: "sam", arrangement: "Hybrid" },
];

export interface ActivityItem {
  who: string;
  text: string;
  kind: "sent" | "goal" | "streak" | "tailor" | "nudge" | "invite";
}

export const ACTIVITY: ActivityItem[] = [
  { who: "maya", text: "sent an application to Northwind", kind: "sent" },
  { who: "dev", text: "hit the weekly goal", kind: "goal" },
  { who: "priya", text: "tailored a résumé for Kestrel AI · 84% match", kind: "tailor" },
  { who: "sam", text: "kept a 6-week streak alive", kind: "streak" },
  { who: "leo", text: "added Brightline to the wall", kind: "sent" },
  { who: "ana", text: "nudged Sam: two more by Sunday", kind: "nudge" },
  { who: "noor", text: "invited two friends to the workspace", kind: "invite" },
  { who: "jules", text: "sent an application to Fieldnote", kind: "sent" },
  { who: "maya", text: "hit the weekly goal", kind: "goal" },
  { who: "dev", text: "sent an application to Summit Bank", kind: "sent" },
];

export const PILLARS = [
  {
    key: "accountable",
    word: "Accountable",
    line: "Everyone sees the week.",
    text: "Weekly goals and a shared pipeline mean your crew notices when you show up, and when you go quiet.",
  },
  {
    key: "present",
    word: "Present",
    line: "A rhythm, not a sprint.",
    text: "Small goals every week and streaks worth protecting keep the search part of your routine instead of a panic.",
  },
  {
    key: "active",
    word: "Active",
    line: "Less admin, more applying.",
    text: "Paste a link and the form fills itself. Tailor a résumé in a minute. Spend your energy on the next application.",
  },
] as const;
