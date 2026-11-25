import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Play,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Loader from "@razzia/web/components/Loader"
import PdfPageCanvas from "@razzia/web/features/cours/components/PdfPageCanvas"
import { usePdfDocument } from "@razzia/web/features/cours/hooks/usePdfDocument"
import {
  coursQuery,
  fichierCoursQuery,
} from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"
import ChoixQuizDialog from "@razzia/web/features/seance/components/ChoixQuizDialog"
import { useFullscreen } from "@razzia/web/hooks/useFullscreen"

const searchSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
})

/** Présentation du cours en salle (E5), page par page. */
const PresentationPage = () => {
  const { coursId } = Route.useParams()
  const { page: pageInitiale } = Route.useSearch()
  const idCours = Number(coursId)
  const navigate = useNavigate()
  const { isFullscreen, toggle } = useFullscreen()
  const [choixQuiz, setChoixQuiz] = useState(false)
  const { t } = useTranslation()

  const cours = useQuery(coursQuery(idCours))
  const fichier = useQuery({
    ...fichierCoursQuery(idCours, cours.data?.versionCourante ?? 0),
    enabled: Boolean(cours.data),
  })
  const pdf = usePdfDocument(fichier.data)
  const total = pdf.etat === "pret" ? pdf.document.numPages : 0
  const page = Math.min(Math.max(pageInitiale ?? 1, 1), Math.max(total, 1))

  const allerA = useCallback(
    (cible: number) => {
      if (cible >= 1 && cible <= total) {
        void navigate({
          to: ".",
          search: { page: cible },
          replace: true,
        })
      }
    },
    [navigate, total],
  )

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (choixQuiz) {
        return
      }

      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault()
        allerA(page + 1)
      }

      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault()
        allerA(page - 1)
      }
    }

    window.addEventListener("keydown", clavier)

    return () => window.removeEventListener("keydown", clavier)
  }, [allerA, page, choixQuiz])

  const terminer = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    }

    void navigate({
      to: "/manager/cours/$coursId",
      params: { coursId: String(idCours) },
    })
  }

  return (
    <div className="flex h-svh flex-col bg-iq-foret text-iq-creme">
      <main className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {pdf.etat === "pret" ? (
          <div
            className="w-full"
            style={{
              maxWidth: `calc((100svh - 7.5rem) / ${pdf.ratio})`,
            }}
          >
            <PdfPageCanvas
              key={page}
              document={pdf.document}
              numero={page}
              ratio={pdf.ratio}
              immediat
              className="rounded-lg shadow-2xl"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            {pdf.etat === "erreur" || cours.isError ? (
              <p className="font-semibold text-iq-saumon">
                {t("errors:cours.affichageImpossible")}
              </p>
            ) : (
              <Loader className="size-12 text-iq-sauge" />
            )}
          </div>
        )}

        <button
          className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white/70 hover:bg-black/40 hover:text-white disabled:invisible"
          disabled={page <= 1}
          onClick={() => allerA(page - 1)}
          title={t("common:previous")}
        >
          <ChevronLeft className="size-6" />
        </button>
        <button
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white/70 hover:bg-black/40 hover:text-white disabled:invisible"
          disabled={page >= total}
          onClick={() => allerA(page + 1)}
          title={t("common:next")}
        >
          <ChevronRight className="size-6" />
        </button>
      </main>

      <footer className="bg-black/25">
        <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-4">
          <AlertDialog
            trigger={
              <button
                className={`${bouton.base} border-2 border-iq-olive px-5 py-3 text-iq-creme hover:bg-iq-foret-clair`}
              >
                {t("manager:seance.terminer")}
              </button>
            }
            title={t("manager:seance.terminer")}
            description={t("manager:seance.terminerConfirmation")}
            confirmLabel={t("manager:seance.terminer")}
            onConfirm={terminer}
          />

          <p className="flex items-center gap-3 text-white/70">
            {cours.data && (
              <span className="font-bold text-iq-creme">
                {[cours.data.codeRessource, cours.data.titre]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            {total > 0 && (
              <span>{t("manager:seance.pageDuDeroule", { page, total })}</span>
            )}
          </p>

          <div className="flex items-center gap-3">
            <button
              className="rounded-xl p-3 text-white/70 hover:bg-iq-foret-clair hover:text-white"
              onClick={toggle}
              title={t(
                isFullscreen ? "common:exitFullscreen" : "common:fullscreen",
              )}
            >
              {isFullscreen ? (
                <Minimize className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </button>
            <button
              className={bouton.citron}
              onClick={() => setChoixQuiz(true)}
              disabled={total === 0}
            >
              <Play className="size-4 fill-current" />
              {t("manager:seance.ouvrirQuiz")}
            </button>
          </div>
        </div>
      </footer>

      <ChoixQuizDialog
        open={choixQuiz}
        onOpenChange={setChoixQuiz}
        idCours={idCours}
        page={page}
      />
    </div>
  )
}

export const Route = createFileRoute("/manager/cours/presenter/$coursId")({
  validateSearch: searchSchema,
  component: PresentationPage,
})
