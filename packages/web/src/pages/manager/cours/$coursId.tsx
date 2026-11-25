import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronLeft, Play, Plus } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import plume from "@razzia/web/assets/iq/plume.png"
import Skeleton from "@razzia/web/components/Skeleton"
import DerouleCours from "@razzia/web/features/cours/components/DerouleCours"
import {
  API_COURS_MOCK,
  coursQuery,
  fichierCoursQuery,
} from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"
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

  const cours = useQuery({ ...coursQuery(idCours), enabled: valide })
  const fichier = useQuery({
    ...fichierCoursQuery(idCours, cours.data?.versionCourante ?? 0),
    enabled: Boolean(cours.data),
  })

  const version = cours.data?.versions.find(
    (v) => v.numero === cours.data.versionCourante,
  )
  const nbQuiz = cours.data?.deroule.filter((e) => e.type === "QUIZ").length
  const nbClassements = cours.data?.deroule.filter(
    (e) => e.type === "PAGE_CLASSEMENT",
  ).length

  const erreur = cours.error ?? fichier.error
  const aNotifieRef = useRef(false)

  useEffect(() => {
    if ((valide && !erreur) || aNotifieRef.current) {
      return
    }

    aNotifieRef.current = true
    toast.error(
      t(erreur instanceof ApiError ? erreur.key : "errors:cours.introuvable"),
    )
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
            <p className="text-iq-gris">{t("manager:cours.derouleAide")}</p>
          </div>

          {fichier.data ? (
            <DerouleCours fichier={fichier.data} />
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
                valeur={nbQuiz ?? "–"}
                libelle={t("manager:cours.quiz")}
              />
              <Statistique
                valeur={version?.nbPages ?? "–"}
                libelle={t("manager:cours.pages")}
              />
              <Statistique
                valeur={nbClassements ?? "–"}
                libelle={t("manager:cours.classement")}
              />
              <Statistique
                valeur={cours.data?.versionCourante ?? "–"}
                libelle={t("manager:cours.versionCourte")}
              />
            </div>
          </div>

          <button
            className={bouton.principal}
            disabled
            title={t("manager:cours.bientot")}
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
