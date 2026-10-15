/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Optional publishable key (pb_pk_) restricted to the portal origin; enables reader search. */
  readonly VITE_PUBLIC_SEARCH_KEY?: string;
  /** Public source repository URL. Links to it render only when set. */
  readonly VITE_SOURCE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
