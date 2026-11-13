import type { JobApplication, ResumeTailorResult } from "../applications/types";

export interface MatchVerdict {
  label: string;
  /** A theme colour (CSS variable) for the ring and the label. */
  color: string;
}

export function matchVerdict(score: number): MatchVerdict {
  if (score >= 75) return { label: "Strong match", color: "var(--success)" };
  if (score >= 50) return { label: "Good match", color: "var(--primary)" };
  return { label: "Weak match", color: "var(--warning)" };
}

export interface TailorSection {
  key: "summary" | "bullets" | "interview" | "caution" | "ats";
  title: string;
  /** Short label for the jump links. */
  shortLabel: string;
  /** A paragraph (`text`) or a bulleted list (`items`). */
  text?: string;
  items?: string[];
  /** Text placed on the clipboard by the section's Copy button. */
  copy?: string;
  tone?: "warning";
}

/** The analysis as ordered sections; empty optional sections are left out. */
export function tailorSections(result: ResumeTailorResult): TailorSection[] {
  const sections: TailorSection[] = [];
  if (result.suggested_summary.trim()) {
    sections.push({
      key: "summary",
      title: "Suggested summary",
      shortLabel: "Summary",
      text: result.suggested_summary,
      copy: result.suggested_summary,
    });
  }
  if (result.suggested_bullets.length) {
    sections.push({
      key: "bullets",
      title: "Suggested bullets",
      shortLabel: "Bullets",
      items: result.suggested_bullets,
      copy: result.suggested_bullets.join("\n"),
    });
  }
  if (result.interview_talking_points.length) {
    sections.push({
      key: "interview",
      title: "Interview talking points",
      shortLabel: "Interview",
      items: result.interview_talking_points,
    });
  }
  if (result.caution_notes.length) {
    sections.push({
      key: "caution",
      title: "Be careful",
      shortLabel: "Cautions",
      items: result.caution_notes,
      tone: "warning",
    });
  }
  if (result.ats_warnings.length) {
    sections.push({
      key: "ats",
      title: "ATS warnings",
      shortLabel: "ATS",
      items: result.ats_warnings,
      tone: "warning",
    });
  }
  return sections;
}

export function hasJobDescription(application: Pick<JobApplication, "job_description">): boolean {
  return Boolean(application.job_description?.trim());
}
