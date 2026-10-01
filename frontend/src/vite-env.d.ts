/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // 'true' in the artifact build (vite.artifact.config.ts)
  readonly VITE_ARTIFACT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
