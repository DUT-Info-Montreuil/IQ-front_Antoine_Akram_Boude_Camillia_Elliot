import fs from "fs"
import { dirname } from "path"
import { getDocumentProxy } from "unpdf"
import { pdfTailleMaxOctets } from "@razzia/socket/env"
import { getPath } from "@razzia/socket/services/config"
import {
  invalidInput,
  notFound,
  tooLarge,
  unprocessable,
} from "@razzia/socket/services/errors"

const SIGNATURE_PDF = Buffer.from("%PDF-")

/**
 * PdfService du dossier de conception (Tableau 38).
 * shortcut: les PDF sont rangés dans le dossier config (déjà monté en volume)
 * sous pdf/{idCours}/v{n}.pdf, au lieu de /app/data ; passer à un DATA_PATH
 * quand le compose IQ définira le volume /app/data.
 */
const cheminRelatif = (idCours: number, numero: number) =>
  `pdf/${idCours}/v${numero}.pdf`

const cheminVersion = (idCours: number, numero: number) =>
  getPath(cheminRelatif(idCours, numero))

/** Vérifie la taille (413), la signature %PDF (400), puis ouvre le document avec pdf.js (422 si protégé ou corrompu). */
export const analyserPdf = async (contenu: Buffer) => {
  // Le bodyLimit de la route ne voit pas les requêtes sans Content-Length.
  if (contenu.length > pdfTailleMaxOctets) {
    throw tooLarge("errors:cours.tropVolumineux")
  }

  if (!contenu.subarray(0, SIGNATURE_PDF.length).equals(SIGNATURE_PDF)) {
    throw invalidInput("errors:cours.pasUnPdf")
  }

  let nbPages = 0

  try {
    // Le tampon donné à pdf.js est détaché : on lui passe une copie.
    const document = await getDocumentProxy(new Uint8Array(contenu), {
      verbosity: 0,
    })

    nbPages = document.numPages
  } catch {
    // Mot de passe (PasswordException) ou fichier corrompu (InvalidPDFException).
    throw unprocessable("errors:cours.pdfIllisible")
  }

  if (nbPages < 1) {
    throw unprocessable("errors:cours.pdfIllisible")
  }

  return { nbPages, taille: contenu.length }
}

export const enregistrerPdf = (
  contenu: Buffer,
  idCours: number,
  numero: number,
) => {
  const chemin = cheminVersion(idCours, numero)

  fs.mkdirSync(dirname(chemin), { recursive: true })
  fs.writeFileSync(chemin, contenu)

  // Relatif au volume, pour survivre à un déplacement du serveur.
  return cheminRelatif(idCours, numero)
}

export const lirePdf = (idCours: number, numero: number) => {
  try {
    return fs.readFileSync(cheminVersion(idCours, numero))
  } catch {
    throw notFound("errors:cours.introuvable")
  }
}

/** Compensation : retire un fichier déposé quand l'enregistrement en base échoue. */
export const supprimerPdf = (idCours: number, numero: number) => {
  fs.rmSync(cheminVersion(idCours, numero), { force: true })
}
