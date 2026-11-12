import { describe, expect, it } from "vitest";

import type { ApplicationFilters, JobApplication } from "../types";
import {
  activeFilterCount,
  canDeleteApplication,
  canEditApplication,
  compactSalary,
  featuresNewest,
  sentAgo,
} from "./wallModel";

// Wednesday 11 November 2026, 6pm local time.
const WEDNESDAY = new Date(2026, 10, 11, 18, 0, 0);

const salary = (overrides: Partial<JobApplication>) => ({
  salary_min: null,
  salary_max: null,
  salary_currency: "USD",
  salary_period: null,
  ...overrides,
});

const filters: ApplicationFilters = {
  search: "",
  ownerId: "",
  status: "",
  workArrangement: "",
  employmentType: "",
  sortBy: "application_date",
  sortOrder: "desc",
  page: 1,
  pageSize: 10,
};

const ownedBy = (ownerId: string) =>
  ({ owner: { id: ownerId, display_name: "Someone", avatar_url: null } }) as JobApplication;

describe("compactSalary", () => {
  it("abbreviates a yearly range", () => {
    expect(
      compactSalary(salary({ salary_min: "140000", salary_max: "165000", salary_period: "yearly" })),
    ).toBe("$140K–$165K/yr");
  });

  it("shows a single hourly figure", () => {
    expect(compactSalary(salary({ salary_min: "45", salary_period: "hourly" }))).toBe("$45/hr");
  });

  it("is empty when no salary is saved", () => {
    expect(compactSalary(salary({}))).toBeNull();
  });

  it("falls back to plain numbers for an unknown currency", () => {
    expect(
      compactSalary(
        salary({ salary_min: "50000", salary_max: "60000", salary_currency: "ZZZZ", salary_period: "yearly" }),
      ),
    ).toBe("50000–60000/yr");
  });
});

describe("sentAgo", () => {
  it("describes how long ago an application was sent", () => {
    expect(sentAgo("2026-11-11", WEDNESDAY)).toBe("today");
    expect(sentAgo("2026-11-10", WEDNESDAY)).toBe("yesterday");
    expect(sentAgo("2026-11-01", WEDNESDAY)).toBe("10 days ago");
  });
});

describe("permissions", () => {
  it("lets only the author edit", () => {
    expect(canEditApplication(ownedBy("jonathan"), "jonathan")).toBe(true);
    expect(canEditApplication(ownedBy("jonathan"), "kareem")).toBe(false);
  });

  it("lets the author or a moderator delete", () => {
    expect(canDeleteApplication(ownedBy("jonathan"), "jonathan", false)).toBe(true);
    expect(canDeleteApplication(ownedBy("jonathan"), "kareem", false)).toBe(false);
    expect(canDeleteApplication(ownedBy("jonathan"), "kareem", true)).toBe(true);
  });
});

describe("filters", () => {
  it("features the newest application only in the default ordering", () => {
    expect(featuresNewest(filters)).toBe(true);
    expect(featuresNewest({ ...filters, page: 2 })).toBe(false);
    expect(featuresNewest({ ...filters, sortOrder: "asc" })).toBe(false);
    expect(featuresNewest({ ...filters, sortBy: "company_name" })).toBe(false);
  });

  it("counts the filters that narrow the results", () => {
    expect(activeFilterCount(filters)).toBe(0);
    expect(activeFilterCount({ ...filters, search: "lake", status: "applied" })).toBe(2);
  });
});
