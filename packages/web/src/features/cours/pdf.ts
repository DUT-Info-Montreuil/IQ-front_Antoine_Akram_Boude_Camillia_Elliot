import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

GlobalWorkerOptions.workerSrc = workerUrl

export type { PDFDocumentProxy }

export const ouvrirPdf = async (source: Blob): Promise<PDFDocumentProxy> =>
  getDocument({ data: new Uint8Array(await source.arrayBuffer()) }).promise

/** La norme PDF autorise l'en-tête %PDF- dans les 1 024 premiers octets. */
export const aSignaturePdf = async (source: Blob) => {
  const debut = new TextDecoder("latin1").decode(
    await source.slice(0, 1024).arrayBuffer(),
  )

  return debut.includes("%PDF-")
}

export type AnalysePdf =
  | { ok: true; nbPages: number }
  | { ok: false; erreur: "errors:cours.pasUnPdf" | "errors:cours.pdfIllisible" }

/** Vérifie la signature et compte les pages, comme PdfService.analyser. */
export const analyserPdf = async (source: Blob): Promise<AnalysePdf> => {
  if (!(await aSignaturePdf(source))) {
    return { ok: false, erreur: "errors:cours.pasUnPdf" }
  }

  try {
    const document = await ouvrirPdf(source)
    const nbPages = document.numPages

    await document.loadingTask.destroy()

    return { ok: true, nbPages }
  } catch {
    return { ok: false, erreur: "errors:cours.pdfIllisible" }
  }
}
