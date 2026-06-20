/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_JONATHAN_USER_ID?: string;
  readonly VITE_KAREEM_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
