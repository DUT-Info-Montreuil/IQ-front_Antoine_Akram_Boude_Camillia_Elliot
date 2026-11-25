import { z } from "zod"

/**
 * Contexte de la séance transmis dans l'URL de l'écran de partie
 * (/party/manager/$gameId?cours=1&page=4&quiz=...), pour habiller la salle
 * d'attente et revenir à la bonne page du cours.
 *
 * Provisoire : sera remplacé par la séance côté serveur (POST /api/seances,
 * manager:openQuiz) quand le back du CU 2.1 sera livré (SCRUM-64).
 */
export const contexteSeanceSchema = z.object({
  cours: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  quiz: z.string().optional(),
})

export type ContexteSeance = z.infer<typeof contexteSeanceSchema>

/** « 482913 » → « 482 913 », comme sur la maquette E5. */
export const formaterCode = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
