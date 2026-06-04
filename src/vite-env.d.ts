/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional: a production build may be run without it (a misconfiguration the client
  // fails loud on at module load — see src/api/client.ts). Dev/test never read it.
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
