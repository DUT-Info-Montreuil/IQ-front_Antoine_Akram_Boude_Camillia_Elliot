import clsx from "clsx"
import { RenderingCancelledException } from "pdfjs-dist"
import { useEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "@razzia/web/features/cours/pdf"
import Loader from "@razzia/web/components/Loader"

interface Props {
  document: PDFDocumentProxy
  numero: number
  /** Rapport hauteur / largeur affiché avant le rendu de la page. */
  ratio: number
  className?: string
  /** Rendu immédiat, sans attendre que la page approche de l'écran. */
  immediat?: boolean
}

/**
 * Une page du PDF rendue par pdf.js dans un canvas à la largeur de son
 * conteneur. Par défaut, le rendu attend que la page approche de l'écran,
 * pour ne pas dessiner d'un coup toutes les pages d'un long cours.
 */
const PdfPageCanvas = ({
  document,
  numero,
  ratio: ratioInitial,
  className,
  immediat = false,
}: Props) => {
  const hoteRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(immediat)
  const [ratio, setRatio] = useState(ratioInitial)
  const [rendue, setRendue] = useState(false)

  useEffect(() => {
    const hote = hoteRef.current

    if (immediat || !hote) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "400px 0px" },
    )

    observer.observe(hote)

    return () => observer.disconnect()
  }, [immediat])

  useEffect(() => {
    const hote = hoteRef.current

    if (!visible || !hote) {
      return undefined
    }

    let tache: { promise: Promise<void>; cancel: () => void } | null = null
    const suivi = { annule: false }
    const estAnnule = () => suivi.annule

    const dessiner = async () => {
      const page = await document.getPage(numero)
      const base = page.getViewport({ scale: 1 })

      if (estAnnule()) {
        return
      }

      setRatio(base.height / base.width)

      const largeur = hote.clientWidth || base.width
      const echelle = (largeur / base.width) * (window.devicePixelRatio || 1)
      const viewport = page.getViewport({ scale: echelle })
      // Un canvas neuf à chaque rendu : pdf.js refuse deux rendus simultanés
      // sur le même canvas (double montage en StrictMode, changement de page).
      const canvas = window.document.createElement("canvas")

      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.className = "block h-full w-full"

      tache = page.render({ canvas, viewport })

      try {
        await tache.promise
      } catch (error) {
        if (error instanceof RenderingCancelledException) {
          return
        }

        throw error
      }

      if (!estAnnule()) {
        hote.replaceChildren(canvas)
        setRendue(true)
      }
    }

    dessiner().catch(() => undefined)

    return () => {
      suivi.annule = true
      tache?.cancel()
    }
  }, [visible, document, numero])

  return (
    <div
      className={clsx("relative w-full overflow-hidden bg-white", className)}
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      <div ref={hoteRef} className="absolute inset-0" />
      {!rendue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader className="size-8 text-iq-sauge" />
        </div>
      )}
    </div>
  )
}

export default PdfPageCanvas
