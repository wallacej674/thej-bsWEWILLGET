import { describe, expect, it } from "vitest";

import { validateSalaryAmount } from "./formValidation";

describe("salary validation", () => {
  it("rejects amounts that exceed PostgreSQL NUMERIC(12,2)", () => {
    expect(validateSalaryAmount("60000000000.03")).toBe(
      "Salary must be no more than 9,999,999,999.99.",
    );
  });

  it("accepts an empty or representable salary amount", () => {
    expect(validateSalaryAmount("")).toBeUndefined();
    expect(validateSalaryAmount("6000000")).toBeUndefined();
  });
});
