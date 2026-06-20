export interface DevelopmentIdentity {
  id: string;
  label: string;
}

interface IdentityStoreOptions {
  identities: DevelopmentIdentity[];
  storage: Storage;
}

const STORAGE_KEY = "applytogether.devUserId";

export function createIdentityStore({
  identities,
  storage,
}: IdentityStoreOptions) {
  const allowedIds = new Set(identities.map((identity) => identity.id));

  function current(): string | null {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored && !allowedIds.has(stored)) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored;
  }

  function select(userId: string): void {
    if (!allowedIds.has(userId)) {
      throw new Error("Unknown development identity.");
    }
    storage.setItem(STORAGE_KEY, userId);
  }

  function clear(): void {
    storage.removeItem(STORAGE_KEY);
  }

  return { clear, current, identities, select };
}

export function configuredDevelopmentIdentities(): DevelopmentIdentity[] {
  return [
    { id: import.meta.env.VITE_JONATHAN_USER_ID ?? "", label: "Jonathan" },
    { id: import.meta.env.VITE_KAREEM_USER_ID ?? "", label: "Kareem" },
  ].filter((identity) => identity.id.trim().length > 0);
}
