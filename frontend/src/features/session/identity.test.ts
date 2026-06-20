import { describe, expect, it } from "vitest";

import { createIdentityStore } from "./identity";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("development identity store", () => {
  it("persists only configured seeded user UUIDs", () => {
    const storage = memoryStorage();
    const store = createIdentityStore({
      storage,
      identities: [
        { id: "jonathan-uuid", label: "Jonathan" },
        { id: "kareem-uuid", label: "Kareem" },
      ],
    });

    store.select("kareem-uuid");

    expect(store.current()).toBe("kareem-uuid");
    expect(storage.getItem("applytogether.devUserId")).toBe("kareem-uuid");
    expect(() => store.select("unknown-uuid")).toThrow(
      "Unknown development identity.",
    );
  });

  it("discards a stale stored identity", () => {
    const storage = memoryStorage();
    storage.setItem("applytogether.devUserId", "removed-user");

    const store = createIdentityStore({
      storage,
      identities: [{ id: "jonathan-uuid", label: "Jonathan" }],
    });

    expect(store.current()).toBeNull();
    expect(storage.getItem("applytogether.devUserId")).toBeNull();
  });
});
