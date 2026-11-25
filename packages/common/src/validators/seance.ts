import { z } from "zod"

/** Corps de POST /api/seances (CU 2.1, étape 1). */
export const ouvrirSeanceValidator = z.object({
  idCours: z.number().int().positive(),
})

export const seanceParamsValidator = z.object({
  idSeance: z.coerce.number().int().positive(),
})
