/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** "false" pour appeler les vraies routes /api/cours au lieu du mock. */
  readonly VITE_API_MOCK?: string
  /** Taille maximale d'un PDF en Mo (50 par défaut). */
  readonly VITE_PDF_TAILLE_MAX_MO?: string
}
