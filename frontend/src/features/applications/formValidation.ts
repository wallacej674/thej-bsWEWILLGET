export const MAX_SALARY_AMOUNT = 9_999_999_999.99;

export function validateSalaryAmount(value: string): string | undefined {
  if (!value) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return "Enter a valid non-negative salary.";
  }
  if (amount > MAX_SALARY_AMOUNT) {
    return "Salary must be no more than 9,999,999,999.99.";
  }
  return undefined;
}
