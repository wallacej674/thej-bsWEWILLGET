import { describe, expect, it } from "vitest";

import { buildApplicationQuery } from "./query";

describe("application list query", () => {
  it("maps visible filters to the backend contract and omits empty values", () => {
    expect(
      buildApplicationQuery({
        search: "finance",
        ownerId: "owner-1",
        status: "applied",
        workArrangement: "",
        employmentType: "full_time",
        sortBy: "company_name",
        sortOrder: "asc",
        page: 2,
        pageSize: 10,
      }),
    ).toEqual({
      search: "finance",
      owner_id: "owner-1",
      status: "applied",
      employment_type: "full_time",
      sort_by: "company_name",
      sort_order: "asc",
      page: 2,
      page_size: 10,
    });
  });
});
