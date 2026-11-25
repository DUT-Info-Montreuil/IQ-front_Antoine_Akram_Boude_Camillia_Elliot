import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { PDFDocumentProxy } from "@razzia/web/features/cours/pdf"
import Loader from "@razzia/web/components/Loader"
import PdfPageCanvas from "@razzia/web/features/cours/components/PdfPageCanvas"
import { usePdfDocument } from "@razzia/web/features/cours/hooks/usePdfDocument"

/** Emplacement « + » entre deux pages, où l'on insérera un quiz (CU 1.3). */
const EmplacementQuiz = ({ apresPage }: { apresPage: number }) => {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      disabled
      className="flex size-10 shrink-0 items-center justify-center self-center rounded-full border-2 border-dashed border-iq-sauge bg-iq-champ text-iq-olive disabled:cursor-not-allowed"
      title={t("manager:cours.insererQuizBientot", { page: apresPage })}
      aria-label={t("manager:cours.insererQuizBientot", { page: apresPage })}
    >
      <Plus className="size-5" />
    </button>
  )
}

interface ApercuProps {
  document: PDFDocumentProxy
  ratio: number
  numero: number | null
  onChange: (numero: number | null) => void
}

/** Agrandissement d'une page, avec navigation page par page. */
const ApercuPage = ({ document, ratio, numero, onChange }: ApercuProps) => {
  const { t } = useTranslation()
  const total = document.numPages

  return (
    <Dialog.Root
      open={numero !== null}
      onOpenChange={(open) => !open && onChange(null)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-iq-foret/80 data-[state=open]:animate-fade" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6 font-iq"
          onKeyDown={(e) => {
            if (numero === null) {
              return
            }

            if (e.key === "ArrowRight" && numero < total) {
              onChange(numero + 1)
            }

            if (e.key === "ArrowLeft" && numero > 1) {
              onChange(numero - 1)
            }
          }}
        >
          <Dialog.Title className="sr-only">
            {t("manager:cours.page", { numero, total })}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("manager:cours.apercuDescription")}
          </Dialog.Description>
          {numero !== null && (
            <div
              className="w-full"
              style={{
                maxWidth: `min(64rem, calc((100dvh - 9rem) / ${ratio}))`,
              }}
            >
              <PdfPageCanvas
                key={numero}
                document={document}
                numero={numero}
                ratio={ratio}
                immediat
                className="rounded-lg shadow-2xl"
              />
            </div>
          )}
          <div className="flex items-center gap-3 text-iq-creme">
            <button
              type="button"
              className="rounded-xl bg-iq-foret-clair p-3 hover:brightness-125 disabled:opacity-40"
              disabled={numero === null || numero <= 1}
              onClick={() => numero && onChange(numero - 1)}
              title={t("common:previous")}
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="min-w-28 text-center font-bold">
              {t("manager:cours.page", { numero, total })}
            </span>
            <button
              type="button"
              className="rounded-xl bg-iq-foret-clair p-3 hover:brightness-125 disabled:opacity-40"
              disabled={numero === null || numero >= total}
              onClick={() => numero && onChange(numero + 1)}
              title={t("common:next")}
            >
              <ChevronRight className="size-5" />
            </button>
            <Dialog.Close
              className="ml-4 rounded-xl bg-iq-foret-clair p-3 hover:brightness-125"
              title={t("common:close")}
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface Props {
  fichier: Blob | undefined
}

/** Déroulé du cours (E3) : les pages du PDF, rendues par pdf.js. */
const DerouleCours = ({ fichier }: Props) => {
  const pdf = usePdfDocument(fichier)
  const [apercu, setApercu] = useState<number | null>(null)
  const { t } = useTranslation()

  if (pdf.etat === "erreur") {
    return (
      <p className="rounded-2xl bg-white p-8 text-center font-semibold text-red-600">
        {t("errors:cours.affichageImpossible")}
      </p>
    )
  }

  if (pdf.etat === "chargement") {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-iq-gris">
        <Loader className="size-12 text-iq-olive" />
        <p>{t("manager:cours.chargementPdf")}</p>
      </div>
    )
  }

  const { document, ratio } = pdf

  return (
    <>
      <ol className="flex flex-wrap items-start gap-x-3 gap-y-6">
        {Array.from({ length: document.numPages }, (_, index) => {
          const numero = index + 1

          return (
            <li key={numero} className="flex items-start gap-3">
              <figure className="flex w-36 flex-col gap-1.5">
                <button
                  type="button"
                  className="overflow-hidden rounded-xl shadow-[0_3px_10px_rgba(30,51,24,0.1)] ring-iq-mousse transition hover:-translate-y-0.5 hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => setApercu(numero)}
                  title={t("manager:cours.agrandir", { numero })}
                >
                  <PdfPageCanvas
                    document={document}
                    numero={numero}
                    ratio={ratio}
                  />
                </button>
                <figcaption className="text-iq-gris">
                  {t("manager:cours.pageCourte", { numero })}
                </figcaption>
              </figure>
              <div
                className="flex items-center"
                style={{ height: `${9 * ratio}rem` }}
              >
                <EmplacementQuiz apresPage={numero} />
              </div>
            </li>
          )
        })}
      </ol>

      <ApercuPage
        document={document}
        ratio={ratio}
        numero={apercu}
        onChange={setApercu}
      />
    </>
  )
}

export default DerouleCours
