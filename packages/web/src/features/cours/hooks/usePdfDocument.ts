import { useEffect, useState } from "react"
import {
  ouvrirPdf,
  type PDFDocumentProxy,
} from "@razzia/web/features/cours/pdf"

type EtatPdf =
  | { etat: "chargement" }
  | { etat: "erreur" }
  | { etat: "pret"; document: PDFDocumentProxy; ratio: number }

interface Resultat {
  fichier: Blob
  etat: EtatPdf
}

const CHARGEMENT: EtatPdf = { etat: "chargement" }

/** Ouvre un PDF avec pdf.js et le libère au démontage. */
export const usePdfDocument = (fichier: Blob | undefined): EtatPdf => {
  const [resultat, setResultat] = useState<Resultat | null>(null)

  useEffect(() => {
    if (!fichier) {
      return undefined
    }

    const suivi = { annule: false }
    const estAnnule = () => suivi.annule
    let ouvert: PDFDocumentProxy | null = null

    const charger = async () => {
      const document = await ouvrirPdf(fichier)

      ouvert = document

      if (estAnnule()) {
        await document.loadingTask.destroy()

        return
      }

      const premiere = (await document.getPage(1)).getViewport({ scale: 1 })

      if (!estAnnule()) {
        setResultat({
          fichier,
          etat: {
            etat: "pret",
            document,
            ratio: premiere.height / premiere.width,
          },
        })
      }
    }

    charger().catch(() => {
      if (!estAnnule()) {
        setResultat({ fichier, etat: { etat: "erreur" } })
      }
    })

    return () => {
      suivi.annule = true
      void ouvert?.loadingTask.destroy()
    }
  }, [fichier])

  // Un résultat obtenu pour un autre fichier ne compte pas : on recharge.
  return resultat && resultat.fichier === fichier ? resultat.etat : CHARGEMENT
}
