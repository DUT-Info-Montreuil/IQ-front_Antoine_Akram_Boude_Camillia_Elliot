import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

GlobalWorkerOptions.workerSrc = workerUrl

export type { PDFDocumentProxy }

/** Ouvre un PDF avec pdf.js. En cas d'échec, la tâche (et son worker) est libérée. */
export const ouvrirPdf = async (source: Blob): Promise<PDFDocumentProxy> => {
  const tache = getDocument({
    data: new Uint8Array(await source.arrayBuffer()),
  })

  try {
    return await tache.promise
  } catch (error) {
    await tache.destroy()

    throw error
  }
}

const SIGNATURE_PDF = "%PDF-"

/**
 * Le fichier doit commencer par %PDF-, comme le vérifie PdfService côté back :
 * un contrôle plus souple ferait accepter ici un fichier que l'API refuse (400).
 */
export const aSignaturePdf = async (source: Blob) => {
  const debut = new TextDecoder("latin1").decode(
    await source.slice(0, SIGNATURE_PDF.length).arrayBuffer(),
  )

  return debut === SIGNATURE_PDF
}

export type AnalysePdf =
  | { ok: true; nbPages: number }
  | { ok: false; erreur: "errors:cours.pasUnPdf" | "errors:cours.pdfIllisible" }

/** Vérifie la signature et compte les pages, comme PdfService.analyser. */
export const analyserPdf = async (source: Blob): Promise<AnalysePdf> => {
  if (!(await aSignaturePdf(source))) {
    return { ok: false, erreur: "errors:cours.pasUnPdf" }
  }

  let nbPages = 0

  try {
    const document = await ouvrirPdf(source)

    nbPages = document.numPages
    await document.loadingTask.destroy()
  } catch {
    // Mot de passe (PasswordException) ou fichier corrompu (InvalidPDFException).
    return { ok: false, erreur: "errors:cours.pdfIllisible" }
  }

  // Un PDF sans page est refusé par l'API (422).
  return nbPages < 1
    ? { ok: false, erreur: "errors:cours.pdfIllisible" }
    : { ok: true, nbPages }
}
