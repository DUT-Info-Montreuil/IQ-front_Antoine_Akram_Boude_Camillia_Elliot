import { z } from "zod"

/**
 * Corps de PUT /api/cours/{id}/deroule (SCRUM-17) : l'ordre complet du déroulé,
 * pages du PDF et quiz mêlés. La position de chaque élément est son rang dans le tableau.
 */
export const elementOrdreSchema = z.discriminatedUnion(
  "type",
  [
    z.strictObject({
      type: z.literal("PAGE"),
      numeroPdf: z.number().int().min(1, "errors:deroule.pageInvalide"),
    }),
    z.strictObject({
      type: z.literal("QUIZ"),
      id: z.number().int().positive("errors:deroule.quizInconnu"),
    }),
  ],
  "errors:deroule.typeInconnu",
)

export type ElementOrdre = z.infer<typeof elementOrdreSchema>

export const ordreDerouleValidator = z.strictObject({
  ordre: z.array(elementOrdreSchema),
})
