import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Play,
} from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type { ElementDeroule } from "@razzia/web/features/cours/types"
import { STATUS } from "@razzia/common/types/game/status"
import plume from "@razzia/web/assets/iq/plume.png"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Loader from "@razzia/web/components/Loader"
import PdfPageCanvas from "@razzia/web/features/cours/components/PdfPageCanvas"
import { usePdfDocument } from "@razzia/web/features/cours/hooks/usePdfDocument"
import {
  coursQuery,
  fichierCoursQuery,
} from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"
import { useSocketConnection } from "@razzia/web/features/game/hooks/useSocketConnection"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import { formaterDuree } from "@razzia/web/features/quiz/validation"
import {
  ouvrirQuiz,
  ouvrirSeance,
  terminerSeance,
} from "@razzia/web/features/seance/api"
import { useFullscreen } from "@razzia/web/hooks/useFullscreen"
import { ApiError } from "@razzia/web/lib/api"

const searchSchema = z.object({
  etape: z.coerce.number().int().positive().optional(),
  /** Séance ouverte au début de la présentation (POST /api/seances). */
  seance: z.coerce.number().int().positive().optional(),
})

/** Erreurs après lesquelles la séance n'existe plus côté serveur. */
const SEANCE_PERDUE = new Set([
  "errors:seance.introuvable",
  "errors:seance.terminee",
])

const cleErreur = (error: unknown, repli: string) =>
  error instanceof ApiError ? error.key : repli

type Etape =
  | { type: "page"; numero: number }
  | { type: "quiz"; element: ElementDeroule; numero: number; page: number }

/** Déroulé projeté : chaque page, suivie des quiz placés après elle. */
const construireEtapes = (
  nbPages: number,
  deroule: ElementDeroule[],
): Etape[] => {
  const quiz = deroule
    .filter((e) => e.type === "QUIZ")
    .sort((a, b) => (a.apresPage ?? 0) - (b.apresPage ?? 0) || a.rang - b.rang)

  return Array.from({ length: nbPages }, (_, index): Etape[] => {
    const numero = index + 1

    return [
      { type: "page", numero },
      ...quiz
        .filter((e) => e.apresPage === numero)
        .map((element): Etape => ({
          type: "quiz",
          element,
          numero: quiz.indexOf(element) + 1,
          page: numero,
        })),
    ]
  }).flat()
}

/** Présentation du cours en salle (E5), page par page, quiz compris. */
const PresentationPage = () => {
  const { coursId } = Route.useParams()
  const { etape: etapeDemandee, seance: idSeance } = Route.useSearch()
  const idCours = Number(coursId)
  const navigate = useNavigate()
  const { updateManager } = useManagerStore()
  const { isFullscreen, toggle } = useFullscreen()
  const { t } = useTranslation()
  const seanceEnCours = useRef<Promise<number> | null>(null)

  useSocketConnection()

  const cours = useQuery(coursQuery(idCours))
  const fichier = useQuery({
    ...fichierCoursQuery(idCours, cours.data?.versionCourante ?? 0),
    enabled: Boolean(cours.data),
  })
  const pdf = usePdfDocument(fichier.data)
  const etapes =
    pdf.etat === "pret" && cours.data
      ? construireEtapes(pdf.document.numPages, cours.data.deroule)
      : []
  const total = etapes.length
  const indice = Math.min(Math.max(etapeDemandee ?? 1, 1), Math.max(total, 1))
  const etape = etapes.at(indice - 1)
  const page = etape?.type === "quiz" ? etape.page : (etape?.numero ?? 1)

  const allerA = (cible: number) => {
    if (cible >= 1 && cible <= total) {
      void navigate({
        to: ".",
        search: { etape: cible, seance: idSeance },
        replace: true,
      })
    }
  }

  /**
   * « Présenter » ouvre une séance (un seul code d'accès pour tous les quiz
   * de la présentation) et garde son id dans l'URL jusqu'à la fin.
   */
  const assurerSeance = useCallback(() => {
    if (idSeance) {
      return Promise.resolve(idSeance)
    }

    seanceEnCours.current ??= ouvrirSeance(idCours)
      .then((seance) => {
        void navigate({
          to: ".",
          search: { etape: etapeDemandee, seance: seance.idSeance },
          replace: true,
        })

        return seance.idSeance
      })
      .catch((error: unknown) => {
        seanceEnCours.current = null

        throw error
      })

    return seanceEnCours.current
  }, [idSeance, idCours, etapeDemandee, navigate])

  useEffect(() => {
    assurerSeance().catch((error: unknown) =>
      toast.error(t(cleErreur(error, "errors:seance.ouvertureImpossible"))),
    )
  }, [assurerSeance, t])

  const ouverture = useMutation({
    mutationFn: async (element: ElementDeroule) =>
      ouvrirQuiz(await assurerSeance(), element.id),
    onSuccess: (
      { gameId, inviteCode, questionsIgnorees, idSeance: seance },
      element,
    ) => {
      if (questionsIgnorees > 0) {
        toast(
          t("manager:seance.questionsIgnorees", { nb: questionsIgnorees }),
          {
            icon: "ℹ️",
            duration: 6000,
          },
        )
      }

      updateManager({
        gameId,
        inviteCode,
        players: [],
        status: createStatus(STATUS.SHOW_ROOM, {
          text: "game:waitingForPlayers",
          inviteCode,
        }),
      })
      void navigate({
        to: "/party/manager/$gameId",
        params: { gameId },
        search: {
          seance,
          cours: idCours,
          page,
          etape: indice,
          quiz: element.id,
        },
      })
    },
    onError: (error) => {
      const cle = cleErreur(error, "errors:quiz.ouvertureEchouee")

      // Séance perdue (serveur redémarré, séance close) : la prochaine
      // ouverture de quiz en crée une nouvelle.
      if (SEANCE_PERDUE.has(cle)) {
        seanceEnCours.current = null
        void navigate({ to: ".", search: { etape: indice }, replace: true })
      }

      toast.error(t(cle))
    },
  })

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const pas = ["ArrowRight", "PageDown", " "].includes(e.key) ? 1 : 0
      const recul = ["ArrowLeft", "PageUp"].includes(e.key) ? -1 : 0
      const cible = indice + pas + recul

      if (pas + recul !== 0 && cible >= 1 && cible <= total) {
        e.preventDefault()
        void navigate({
          to: ".",
          search: { etape: cible, seance: idSeance },
          replace: true,
        })
      }
    }

    window.addEventListener("keydown", clavier)

    return () => window.removeEventListener("keydown", clavier)
  }, [navigate, indice, total, idSeance])

  /** « Terminer la séance » : les étudiants sont renvoyés à l'accueil. */
  const terminer = async () => {
    if (idSeance) {
      try {
        await terminerSeance(idSeance)
      } catch (error) {
        const cle = cleErreur(error, "errors:route.description")

        // Déjà terminée ou inconnue du serveur : rien à fermer.
        if (!SEANCE_PERDUE.has(cle)) {
          toast.error(t(cle))
        }
      }
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen()
    }

    void navigate({
      to: "/manager/cours/$coursId",
      params: { coursId: String(idCours) },
    })
  }

  const contenu = () => {
    if (pdf.etat === "erreur" || cours.isError) {
      return (
        <p className="font-semibold text-iq-saumon">
          {t("errors:cours.affichageImpossible")}
        </p>
      )
    }

    if (pdf.etat !== "pret" || !etape) {
      return <Loader className="size-12 text-iq-sauge" />
    }

    if (etape.type === "quiz") {
      return (
        <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
          <div className="rounded-[2rem] bg-iq-foret-clair p-5">
            <img src={plume} alt="" className="w-32" />
          </div>
          <p className="text-lg font-extrabold tracking-[0.15em] text-iq-citron uppercase">
            {[
              cours.data?.codeRessource,
              t("manager:quiz.numero", { numero: etape.numero }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="text-5xl leading-tight font-black lg:text-6xl">
            {etape.element.titre}
          </h1>
          <p className="text-xl text-white/70">
            {t("manager:cours.resumeQuiz", {
              nb: etape.element.nbQuestions ?? 0,
              duree: formaterDuree(etape.element.dureeSecondes ?? 0),
            })}
          </p>
          <button
            className={`${bouton.citron} px-8 py-4 text-xl`}
            onClick={() => ouverture.mutate(etape.element)}
            disabled={ouverture.isPending}
          >
            {ouverture.isPending ? (
              <Loader className="size-6" />
            ) : (
              <Play className="size-5 fill-current" />
            )}
            {t("manager:seance.ouvrir")}
          </button>
        </div>
      )
    }

    return (
      <div
        className="w-full"
        style={{ maxWidth: `calc((100svh - 7.5rem) / ${pdf.ratio})` }}
      >
        <PdfPageCanvas
          key={etape.numero}
          document={pdf.document}
          numero={etape.numero}
          ratio={pdf.ratio}
          immediat
          className="rounded-lg shadow-2xl"
        />
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-iq-foret text-iq-creme">
      <main className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {contenu()}

        <button
          className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white/70 hover:bg-black/40 hover:text-white disabled:invisible"
          disabled={indice <= 1}
          onClick={() => allerA(indice - 1)}
          title={t("common:previous")}
        >
          <ChevronLeft className="size-6" />
        </button>
        <button
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/20 p-3 text-white/70 hover:bg-black/40 hover:text-white disabled:invisible"
          disabled={indice >= total}
          onClick={() => allerA(indice + 1)}
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
            onConfirm={() => void terminer()}
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
              <span>
                {t("manager:seance.etapeDuDeroule", { etape: indice, total })}
              </span>
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
              onClick={() => allerA(indice + 1)}
              disabled={indice >= total}
            >
              {t("common:next")}
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

export const Route = createFileRoute("/manager/cours/presenter/$coursId")({
  validateSearch: searchSchema,
  component: PresentationPage,
})
