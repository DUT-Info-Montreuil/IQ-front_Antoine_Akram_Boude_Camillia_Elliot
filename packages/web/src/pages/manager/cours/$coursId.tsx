import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronLeft, Play, Plus } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { ElementOrdre } from "@razzia/web/features/cours/types"
import plume from "@razzia/web/assets/iq/plume.png"
import Skeleton from "@razzia/web/components/Skeleton"
import DerouleCours from "@razzia/web/features/cours/components/DerouleCours"
import { notifier } from "@razzia/web/features/cours/notifications"
import {
  API_COURS_MOCK,
  coursKeys,
  coursQuery,
  fichierCoursQuery,
  reorganiserDeroule,
} from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"
import { formaterDuree } from "@razzia/web/features/quiz/validation"
import { ApiError } from "@razzia/web/lib/api"

const Statistique = ({
  valeur,
  libelle,
}: {
  valeur: ReactNode
  libelle: string
}) => (
  <div className="rounded-2xl bg-iq-fond p-4">
    <p className="text-3xl font-black">{valeur}</p>
    <p className="text-sm text-iq-gris">{libelle}</p>
  </div>
)

/** Éditeur du cours+quiz (E3) : déroulé du PDF importé. */
const CoursEditeurPage = () => {
  const { coursId } = Route.useParams()
  const idCours = Number(coursId)
  const valide = Number.isInteger(idCours) && idCours > 0
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const cours = useQuery({ ...coursQuery(idCours), enabled: valide })
  const fichier = useQuery({
    ...fichierCoursQuery(idCours, cours.data?.versionCourante ?? 0),
    enabled: Boolean(cours.data),
  })

  const mutationReorganiser = useMutation({
    mutationFn: (ordre: ElementOrdre[]) => reorganiserDeroule(idCours, ordre),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: coursKeys.detail(idCours),
      })
    },
    onError: async (erreur: unknown) => {
      notifier.erreur({
        titre: t(
          erreur instanceof ApiError ? erreur.key : "errors:route.description",
        ),
        description: t("manager:cours.derouleRestaure"),
      })
      await queryClient.invalidateQueries({
        queryKey: coursKeys.detail(idCours),
      })
    },
  })

  const version = cours.data?.versions.find(
    (v) => v.numero === cours.data.versionCourante,
  )
  const quizDuCours = cours.data?.deroule.filter((e) => e.type === "QUIZ")
  const nbQuestions = quizDuCours?.reduce((n, e) => n + (e.nbQuestions ?? 0), 0)
  const dureeQuiz = quizDuCours?.reduce((n, e) => n + (e.dureeSecondes ?? 0), 0)
  const nbClassements = cours.data?.deroule.filter(
    (e) => e.type === "PAGE_CLASSEMENT",
  ).length

  const insererQuiz = (apresPage?: number) =>
    navigate({
      to: "/manager/cours/quiz/$coursId",
      params: { coursId },
      search: { apresPage },
    })

  const modifierQuiz = (idQuiz: number) =>
    navigate({
      to: "/manager/cours/quiz/$coursId",
      params: { coursId },
      search: { quiz: idQuiz },
    })

  const erreur = cours.error ?? fichier.error
  const aNotifieRef = useRef(false)

  useEffect(() => {
    if ((valide && !erreur) || aNotifieRef.current) {
      return
    }

    aNotifieRef.current = true
    notifier.erreur({
      titre: t(
        erreur instanceof ApiError ? erreur.key : "errors:cours.introuvable",
      ),
      description: t("manager:cours.retourMesCours"),
    })
    navigate({ to: "/manager/cours" })
  }, [erreur, valide, navigate, t])

  return (
    <>
      <header className="border-b-4 border-iq-olive bg-iq-foret">
        <div className="mx-auto flex min-h-24 max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <button
            className="inline-flex items-center gap-1 rounded-xl bg-iq-foret-clair px-4 py-3 font-bold text-iq-creme hover:brightness-125"
            onClick={() => navigate({ to: "/manager/cours" })}
          >
            <ChevronLeft className="size-5" />
            {t("manager:cours.mesCours")}
          </button>

          <div className="min-w-0 flex-1">
            {cours.data ? (
              <>
                <h1 className="truncate text-3xl font-extrabold text-iq-creme">
                  {[cours.data.codeRessource, cours.data.titre]
                    .filter(Boolean)
                    .join(" · ")}
                </h1>
                <p className="text-white/75">
                  {t("manager:cours.versionDuPdf", {
                    numero: cours.data.versionCourante,
                  })}
                  {version &&
                    ` · ${t("manager:cours.nbPages", { nb: version.nbPages })}`}
                  {API_COURS_MOCK && ` · ${t("manager:cours.mock")}`}
                </p>
              </>
            ) : (
              <Skeleton className="h-14 w-96 max-w-full bg-iq-foret-clair" />
            )}
          </div>

          <button
            className={bouton.citron}
            disabled={!cours.data}
            onClick={() =>
              navigate({
                to: "/manager/cours/presenter/$coursId",
                params: { coursId },
              })
            }
          >
            <Play className="size-4 fill-current" />
            {t("manager:cours.presenter")}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_20rem]">
        <section>
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-4xl font-black tracking-tight">
              {t("manager:cours.deroule")}
            </h2>
            <p className="text-iq-gris">{t("manager:cours.derouleAideQuiz")}</p>
          </div>

          {fichier.data && cours.data ? (
            <DerouleCours
              fichier={fichier.data}
              deroule={cours.data.deroule}
              ordreInitial={cours.data.ordre}
              onInserer={insererQuiz}
              onOuvrirQuiz={modifierQuiz}
              onReorganiser={(ordre) => mutationReorganiser.mutate(ordre)}
            />
          ) : (
            <div className="flex flex-wrap gap-6">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-video w-36 rounded-xl bg-white/70"
                />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl bg-white p-6">
            <h3 className="mb-4 text-lg font-extrabold">
              {t("manager:cours.dansCeCours")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Statistique
                valeur={quizDuCours?.length ?? "–"}
                libelle={t("manager:cours.quiz")}
              />
              <Statistique
                valeur={nbQuestions ?? "–"}
                libelle={t("manager:cours.questions")}
              />
              <Statistique
                valeur={
                  dureeQuiz === undefined ? "–" : formaterDuree(dureeQuiz)
                }
                libelle={t("manager:cours.deQuizEnTout")}
              />
              <Statistique
                valeur={nbClassements ?? "–"}
                libelle={t("manager:cours.classement")}
              />
            </div>
          </div>

          <button
            className={bouton.principal}
            disabled={!cours.data}
            onClick={() => insererQuiz()}
          >
            <Plus className="size-5" />
            {t("manager:cours.ajouterQuiz")}
          </button>
          <button
            className={`${bouton.contour} justify-start`}
            disabled
            title={t("manager:cours.bientot")}
          >
            {t("manager:cours.ajouterClassement")}
          </button>

          <div className="flex items-center gap-4 rounded-3xl bg-iq-foret-clair p-5 text-iq-creme">
            <img src={plume} alt="" className="w-20 shrink-0" />
            <p className="text-sm leading-relaxed">
              {t("manager:cours.astuce")}
            </p>
          </div>
        </aside>
      </main>
    </>
  )
}

export const Route = createFileRoute("/manager/cours/$coursId")({
  component: CoursEditeurPage,
})
