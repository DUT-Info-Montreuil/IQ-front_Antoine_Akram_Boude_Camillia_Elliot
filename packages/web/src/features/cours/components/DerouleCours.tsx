import { ChevronLeft, ChevronRight, GripVertical, Plus, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { PDFDocumentProxy } from "@razzia/web/features/cours/pdf"
import type { ElementDeroule } from "@razzia/web/features/cours/types"
import Loader from "@razzia/web/components/Loader"
import PdfPageCanvas from "@razzia/web/features/cours/components/PdfPageCanvas"
import { usePdfDocument } from "@razzia/web/features/cours/hooks/usePdfDocument"
import { formaterDuree } from "@razzia/web/features/quiz/validation"

type ElementVisuel =
    | { cle: string; type: "PAGE"; numero: number }
    | { cle: string; type: "QUIZ"; element: ElementDeroule; numero: number }

/** Emplacement « + » entre les éléments du déroulé. */
const EmplacementQuiz = ({
                           apresPage,
                           onInserer,
                         }: {
  apresPage: number
  onInserer: (apresPage: number) => void
}) => {
  const { t } = useTranslation()

  return (
      <div className="flex h-full items-center px-1">
        <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center self-center rounded-full border-2 border-dashed border-iq-sauge bg-iq-champ text-iq-olive transition hover:scale-110 hover:border-iq-mousse hover:bg-iq-sauge/40"
            onClick={() => onInserer(apresPage)}
            title={t("manager:cours.insererQuiz", { page: apresPage })}
            aria-label={t("manager:cours.insererQuiz", { page: apresPage })}
        >
          <Plus className="size-5" />
        </button>
      </div>
  )
}

/** Carte d'un quiz placé dans le déroulé. */
const CarteQuiz = ({
                     element,
                     numero,
                     hauteur,
                     onOuvrir,
                   }: {
  element: ElementDeroule
  numero: number
  hauteur: string
  onOuvrir: (idQuiz: number) => void
}) => {
  const { t } = useTranslation()

  return (
      <figure className="flex w-36 shrink-0 flex-col gap-1.5">
        <button
            type="button"
            className="group relative flex flex-col justify-between rounded-xl bg-iq-olive p-3 text-left text-white shadow-[0_4px_0_var(--color-iq-olive-fonce)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--color-iq-olive-fonce)] focus-visible:ring-2 focus-visible:ring-iq-mousse focus-visible:outline-none"
            style={{ minHeight: hauteur }}
            onClick={() => onOuvrir(element.id)}
            title={t("manager:cours.modifierQuiz", { titre: element.titre })}
        >
        <span className="absolute top-2 right-2 rounded-md bg-white/15 p-1 opacity-0 transition group-hover:opacity-100">
          <GripVertical className="size-4" />
        </span>

          <span className="text-xl font-extrabold">
          {t("manager:quiz.quiz")}
        </span>

          <span className="text-xs leading-tight font-bold">
          {t("manager:cours.resumeQuiz", {
            nb: element.nbQuestions ?? 0,
            duree: formaterDuree(element.dureeSecondes ?? 0),
          })}
        </span>
        </button>

        <figcaption className="line-clamp-2 leading-tight font-bold text-iq-olive">
          {t("manager:quiz.numero", { numero })} · {element.titre}
        </figcaption>
      </figure>
  )
}

interface ApercuProps {
  document: PDFDocumentProxy
  ratio: number
  numero: number | null
  onChange: (numero: number | null) => void
}

/** Agrandissement d'une page avec navigation page par page. */
const ApercuPage = ({
                      document,
                      ratio,
                      numero,
                      onChange,
                    }: ApercuProps) => {
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
                if (numero === null) return

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
  deroule: ElementDeroule[]
  onInserer: (apresPage: number) => void
  onOuvrirQuiz: (idQuiz: number) => void
}

/**
 * Déroulé du cours :
 * les pages PDF et les quiz peuvent être réorganisés par glisser-déposer.
 */
const DerouleCours = ({
                        fichier,
                        deroule,
                        onInserer,
                        onOuvrirQuiz,
                      }: Props) => {
  const pdf = usePdfDocument(fichier)

  const [apercu, setApercu] = useState<number | null>(null)
  const [ordre, setOrdre] = useState<string[]>([])
  const [elementDeplace, setElementDeplace] = useState<string | null>(null)

  const { t } = useTranslation()

  const nbPages = pdf.etat === "pret" ? pdf.document.numPages : 0

  const quiz = deroule
      .filter((e) => e.type === "QUIZ")
      .sort(
          (a, b) =>
              (a.apresPage ?? 0) - (b.apresPage ?? 0) || a.rang - b.rang,
      )

  // Initialise l'ordre des éléments lors du chargement du cours.
  useEffect(() => {
    if (!nbPages) return

    const nouvelOrdre: string[] = []

    for (let numero = 1; numero <= nbPages; numero += 1) {
      nouvelOrdre.push(`page-${numero}`)

      quiz
          .filter((e) => e.apresPage === numero)
          .forEach((e) => nouvelOrdre.push(`quiz-${e.id}`))
    }

    setOrdre(nouvelOrdre)
  }, [fichier, deroule, nbPages])

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
  const hauteur = `${9 * ratio}rem`

  const elements: ElementVisuel[] = []

  for (let numero = 1; numero <= document.numPages; numero += 1) {
    elements.push({
      cle: `page-${numero}`,
      type: "PAGE",
      numero,
    })

    quiz
        .filter((e) => e.apresPage === numero)
        .forEach((element) => {
          elements.push({
            cle: `quiz-${element.id}`,
            type: "QUIZ",
            element,
            numero: quiz.indexOf(element) + 1,
          })
        })
  }

  const elementsParCle = new Map(
      elements.map((element) => [element.cle, element]),
  )

  const ordreAffiche = [
    ...ordre.filter((cle) => elementsParCle.has(cle)),
    ...elements
        .filter((element) => !ordre.includes(element.cle))
        .map((element) => element.cle),
  ]

  /** Déplace un élément avant celui qui est ciblé. */
  const deplacerElement = (
      cleSource: string,
      cleDestination: string,
  ) => {
    if (cleSource === cleDestination) return

    setOrdre((ancienOrdre) => {
      const base = ancienOrdre.length
          ? [...ancienOrdre]
          : elements.map((element) => element.cle)

      const indexSource = base.indexOf(cleSource)
      const indexDestination = base.indexOf(cleDestination)

      if (indexSource === -1 || indexDestination === -1) return base

      const nouvelOrdre = [...base]
      const [element] = nouvelOrdre.splice(indexSource, 1)

      nouvelOrdre.splice(indexDestination, 0, element)

      return nouvelOrdre
    })
  }

  return (
      <>
        <div className="mb-4 flex items-center gap-2 text-sm text-iq-gris">
          <GripVertical className="size-4" />
          <span>Maintiens une carte pour la déplacer et réorganiser le cours.</span>
        </div>

        <ol className="flex flex-wrap items-start gap-x-3 gap-y-6">
          {ordreAffiche.map((cle) => {
            const element = elementsParCle.get(cle)

            if (!element) return null

            const estDeplace = elementDeplace === cle

            return (
                <li key={cle} className="flex items-start gap-2">
                  <div
                      draggable
                      onDragStart={(event) => {
                        setElementDeplace(cle)
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", cle)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = "move"
                      }}
                      onDrop={(event) => {
                        event.preventDefault()

                        const cleSource =
                            event.dataTransfer.getData("text/plain") ||
                            elementDeplace

                        if (cleSource) {
                          deplacerElement(cleSource, cle)
                        }

                        setElementDeplace(null)
                      }}
                      onDragEnd={() => setElementDeplace(null)}
                      className={`group relative cursor-grab rounded-xl transition-all active:cursor-grabbing ${
                          estDeplace
                              ? "scale-95 opacity-40"
                              : "opacity-100 hover:-translate-y-1"
                      }`}
                      title="Glisser pour déplacer"
                  >
                    <div className="absolute -top-2 -left-2 z-10 flex size-7 items-center justify-center rounded-full border border-iq-bordure bg-white text-iq-gris opacity-0 shadow-sm transition group-hover:opacity-100">
                      <GripVertical className="size-4" />
                    </div>

                    {element.type === "PAGE" ? (
                        <figure className="flex w-36 flex-col gap-1.5">
                          <button
                              type="button"
                              className="overflow-hidden rounded-xl shadow-[0_3px_10px_rgba(30,51,24,0.1)] ring-transparent transition hover:ring-2 hover:ring-iq-mousse focus-visible:ring-2 focus-visible:outline-none"
                              onClick={() => setApercu(element.numero)}
                              title={t("manager:cours.agrandir", {
                                numero: element.numero,
                              })}
                          >
                            <PdfPageCanvas
                                document={document}
                                numero={element.numero}
                                ratio={ratio}
                            />
                          </button>

                          <figcaption className="text-iq-gris">
                            {t("manager:cours.pageCourte", {
                              numero: element.numero,
                            })}
                          </figcaption>
                        </figure>
                    ) : (
                        <CarteQuiz
                            element={element.element}
                            numero={element.numero}
                            hauteur={hauteur}
                            onOuvrir={onOuvrirQuiz}
                        />
                    )}
                  </div>

                  <EmplacementQuiz
                      apresPage={
                        element.type === "PAGE"
                            ? element.numero
                            : (element.element.apresPage ?? 0)
                      }
                      onInserer={onInserer}
                  />
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
