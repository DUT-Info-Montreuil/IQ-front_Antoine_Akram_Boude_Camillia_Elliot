import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { CoursResume } from "@razzia/web/features/cours/types"
import { bouton, couleurBadge } from "@razzia/web/features/cours/ui"

const JOUR_MS = 24 * 60 * 60 * 1000

const debutDuJour = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const useDateModification = () => {
  const { t, i18n } = useTranslation()
  const format = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "2-digit",
  })

  return (iso: string) => {
    const date = new Date(iso)
    const ecart = debutDuJour(new Date()) - debutDuJour(date)

    if (ecart <= 0) {
      return t("manager:cours.modifieAujourdhui")
    }

    if (ecart <= JOUR_MS) {
      return t("manager:cours.modifieHier")
    }

    return t("manager:cours.modifieLe", { date: format.format(date) })
  }
}

interface Props {
  cours: CoursResume
}

/** Carte d'un cours dans « Mes cours » (E2). */
const CoursCard = ({ cours }: Props) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dateModification = useDateModification()

  const ouvrir = () =>
    navigate({
      to: "/manager/cours/$coursId",
      params: { coursId: String(cours.id) },
    })

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_6px_20px_rgba(30,51,24,0.08)]">
      <div className="relative flex min-h-42 flex-col justify-between gap-6 bg-iq-foret bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[18px_18px] p-6 pr-24">
        {cours.codeRessource ? (
          <span
            className={clsx(
              "w-fit rounded-md px-2 py-0.5 text-sm font-extrabold text-iq-foret",
              couleurBadge(cours.codeRessource),
            )}
          >
            {cours.codeRessource}
          </span>
        ) : (
          <span />
        )}
        <h2 className="line-clamp-2 text-2xl leading-tight font-extrabold text-white">
          {cours.titre}
        </h2>
        <div
          className="absolute top-6 right-6 h-20 w-16 rotate-6 rounded-md bg-iq-creme shadow-lg"
          aria-hidden
        />
      </div>

      <div className="flex flex-col gap-5 p-6">
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-iq-gris">
          <span>
            <b className="text-iq-texte">{cours.nbPages}</b>{" "}
            {t("manager:cours.pages")}
          </span>
          <span>
            <b className="text-iq-texte">{cours.nbQuiz}</b>{" "}
            {t("manager:cours.quiz")}
          </span>
          <span>{dateModification(cours.dateModification)}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button className={bouton.contour} onClick={ouvrir}>
            {t("manager:cours.ouvrir")}
          </button>
          <button
            className={bouton.sombre}
            onClick={() =>
              navigate({
                to: "/manager/cours/presenter/$coursId",
                params: { coursId: String(cours.id) },
              })
            }
          >
            <Play className="size-4 fill-current" />
            {t("manager:cours.presenter")}
          </button>
        </div>
      </div>
    </article>
  )
}

export default CoursCard
