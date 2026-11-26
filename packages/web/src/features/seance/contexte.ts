import { z } from "zod"

/**
 * Contexte de la séance transmis dans l'URL de l'écran de partie
 * (/party/manager/$gameId?seance=3&cours=1&page=4&etape=5&quiz=2), pour
 * habiller la salle d'attente et reprendre la présentation dans la même
 * séance (même code d'accès) en quittant la partie.
 */
export const contexteSeanceSchema = z.object({
  /** Séance ouverte par POST /api/seances au début de la présentation. */
  seance: z.coerce.number().int().positive().optional(),
  cours: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  /** Étape du déroulé où reprendre la présentation en quittant la salle. */
  etape: z.coerce.number().int().positive().optional(),
  /** Quiz IQ ouvert (id en base). */
  quiz: z.coerce.number().int().positive().optional(),
})

export type ContexteSeance = z.infer<typeof contexteSeanceSchema>

/** « 482913 » → « 482 913 », comme sur la maquette E5. */
export const formaterCode = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
