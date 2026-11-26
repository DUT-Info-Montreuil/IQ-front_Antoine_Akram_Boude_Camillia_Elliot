import { StatusCodes } from "http-status-codes"

/** Traduction des codes HTTP de POST /api/cours (CU 1.2, cas d'erreur). */
const CLES_IMPORT: Partial<Record<number, string>> = {
  [StatusCodes.BAD_REQUEST]: "errors:cours.pasUnPdf",
  [StatusCodes.FORBIDDEN]: "errors:cours.accesRefuse",
  [StatusCodes.NOT_FOUND]: "errors:cours.introuvable",
  [StatusCodes.REQUEST_TOO_LONG]: "errors:cours.tropVolumineux",
  [StatusCodes.UNPROCESSABLE_ENTITY]: "errors:cours.pdfIllisible",
}

export const cleErreurCours = (status: number, repli: string) =>
  CLES_IMPORT[status] ?? repli
