import { z } from "zod"

/** Bornes du formulaire d'import (CU 1.2), identiques à celles du front. */
export const TITRE_COURS_MAX = 120

export const CODE_RESSOURCE_MAX = 20

/** Corps multipart de POST /api/cours. La taille du fichier est bornée par la route. */
export const importCoursValidator = z.object({
  fichier: z.file("errors:cours.fichierManquant"),
  titre: z
    .string("errors:cours.titreVide")
    .trim()
    .min(1, "errors:cours.titreVide")
    .max(TITRE_COURS_MAX, "errors:cours.titreTropLong"),
  codeRessource: z
    .string()
    .trim()
    .max(CODE_RESSOURCE_MAX, "errors:cours.codeRessourceTropLong")
    .optional()
    .transform((code) => (code === "" ? undefined : code)),
})

export type ImportCours = z.infer<typeof importCoursValidator>

export const versionParamsValidator = z.object({
  idCours: z.coerce.number().int().positive(),
  numero: z.coerce.number().int().positive(),
})

export const coursParamsValidator = versionParamsValidator.pick({
  idCours: true,
})
