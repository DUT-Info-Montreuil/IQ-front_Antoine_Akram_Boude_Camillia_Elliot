import { z } from "zod"

/** Taille maximale d'un PDF (PDF_TAILLE_MAX_MO, 50 Mo par défaut). */
export const PDF_TAILLE_MAX_MO =
  Number(import.meta.env.VITE_PDF_TAILLE_MAX_MO) || 50

export const PDF_TAILLE_MAX_OCTETS = PDF_TAILLE_MAX_MO * 1024 * 1024

export const TITRE_MAX = 120

export const CODE_RESSOURCE_MAX = 20

type FichierInfo = Pick<File, "name" | "size" | "type">

/**
 * Contrôles faits par le front avant l'envoi (CU 1.2, étape 2) :
 * extension, type et taille. La signature %PDF est vérifiée par l'API.
 * Renvoie la clé de traduction de l'erreur, ou null si le fichier est accepté.
 */
export const validerFichierPdf = (
  fichier: FichierInfo | null | undefined,
): string | null => {
  if (!fichier) {
    return "errors:cours.fichierManquant"
  }

  const extensionPdf = fichier.name.toLowerCase().endsWith(".pdf")
  const typePdf = !fichier.type || fichier.type === "application/pdf"

  if (!extensionPdf || !typePdf || fichier.size === 0) {
    return "errors:cours.pasUnPdf"
  }

  if (fichier.size > PDF_TAILLE_MAX_OCTETS) {
    return "errors:cours.tropVolumineux"
  }

  return null
}

export const importCoursSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, "errors:cours.titreVide")
    .max(TITRE_MAX, "errors:cours.titreTropLong"),
  codeRessource: z
    .string()
    .trim()
    .max(CODE_RESSOURCE_MAX, "errors:cours.codeRessourceTropLong")
    .optional()
    .transform((code) => (code === "" ? undefined : code)),
})

export type ImportCoursChamps = z.input<typeof importCoursSchema>

/** Titre proposé à partir du nom du fichier (« R5.A.10_cours.pdf » → « R5.A.10 cours »). */
export const titreDepuisNomFichier = (nom: string) =>
  nom
    .replace(/\.pdf$/iu, "")
    .replace(/[_-]+/gu, " ")
    .trim()
    .slice(0, TITRE_MAX)

export const formaterTaille = (octets: number) =>
  octets >= 1024 * 1024
    ? `${(octets / (1024 * 1024)).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`
