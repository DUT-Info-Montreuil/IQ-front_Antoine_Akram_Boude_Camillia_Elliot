import clsx from "clsx"
import { useTranslation } from "react-i18next"
import type {
  QuestionSaisie,
  TypeQuestion,
} from "@razzia/web/features/quiz/types"
import { champ } from "@razzia/web/features/cours/ui"
import {
  afficher,
  erreurDe,
  MessageErreur,
  nombre,
} from "@razzia/web/features/quiz/components/champs"
import EditeurExpressions from "@razzia/web/features/quiz/components/EditeurExpressions"
import EditeurPaires from "@razzia/web/features/quiz/components/EditeurPaires"
import EditeurPropositions from "@razzia/web/features/quiz/components/EditeurPropositions"
import {
  changerType,
  DUREE_MAX,
  DUREE_MIN,
  type ErreurSaisie,
  repartirPoints,
} from "@razzia/web/features/quiz/validation"

const TYPES: Array<{ type: TypeQuestion; cle: string }> = [
  { type: "QCM", cle: "manager:quiz.typeQcm" },
  { type: "RELIER", cle: "manager:quiz.typeRelier" },
  { type: "LIBRE", cle: "manager:quiz.typeLibre" },
]

const EDITEURS = {
  QCM: EditeurPropositions,
  RELIER: EditeurPaires,
  LIBRE: EditeurExpressions,
}

interface Props {
  question: QuestionSaisie
  numero: number
  erreurs: ErreurSaisie[]
  onChange: (question: QuestionSaisie) => void
}

const EditeurQuestion = ({ question, numero, erreurs, onChange }: Props) => {
  const { t } = useTranslation()
  const erreur = erreurDe(erreurs)
  const EditeurDuType = EDITEURS[question.type]

  const modifier = (changements: Partial<QuestionSaisie>) =>
      onChange({ ...question, ...changements })

  const changerPointsMax = (valeur: string) => {
    const pointsMax = nombre(valeur)

    modifier({
      pointsMax,
      propositions: repartirPoints(
          question.propositions,
          Number.isNaN(pointsMax) ? 0 : pointsMax,
      ),
    })
  }

  return (
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_14px_rgba(30,51,24,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold">
            {t("manager:quiz.question", { numero })}
          </h2>

          <div
              className="flex flex-wrap rounded-lg bg-iq-fond p-1"
              role="radiogroup"
              aria-label={t("manager:quiz.typeQuestion")}
          >
            {TYPES.map(({ type, cle }) => (
                <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={question.type === type}
                    className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                        question.type === type
                            ? "bg-iq-foret text-white"
                            : "text-iq-gris hover:text-iq-texte",
                    )}
                    onClick={() => onChange(changerType(question, type))}
                >
                  {t(cle)}
                </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold">{t("manager:quiz.enonce")}</span>
          <textarea
              className={clsx(
                  champ,
                  "min-h-20 resize-y text-base",
                  erreur("enonce") && "border-red-400",
              )}
              value={question.enonce}
              placeholder={t("manager:quiz.enoncePlaceholder")}
              onChange={(e) => modifier({ enonce: e.target.value })}
          />
          <MessageErreur cle={erreur("enonce")} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">{t("manager:quiz.duree")}</span>
            <span className="flex items-center gap-3">
            <input
                type="number"
                min={DUREE_MIN}
                max={DUREE_MAX}
                className={clsx(
                    champ,
                    "w-28 text-base font-semibold",
                    erreur("dureeSecondes") && "border-red-400",
                )}
                value={afficher(question.dureeSecondes)}
                onChange={(e) =>
                    modifier({ dureeSecondes: nombre(e.target.value) })
                }
            />
            <span className="text-sm text-iq-gris">
              {t("manager:quiz.dureeAide", { min: DUREE_MIN, max: DUREE_MAX })}
            </span>
          </span>
            <MessageErreur cle={erreur("dureeSecondes")} />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">{t("manager:quiz.pointsMax")}</span>
            <span className="flex items-center gap-3">
            <input
                type="number"
                min={1}
                step={100}
                className={clsx(
                    champ,
                    "w-32 text-base font-semibold",
                    erreur("pointsMax") && "border-red-400",
                )}
                value={afficher(question.pointsMax)}
                onChange={(e) => changerPointsMax(e.target.value)}
            />
            <span className="text-sm text-iq-gris">
              {t("manager:quiz.points")}
            </span>
          </span>
            <MessageErreur cle={erreur("pointsMax")} />
          </label>
        </div>

        <EditeurDuType
            question={question}
            erreurs={erreurs}
            onChange={modifier}
        />
      </section>
  )
}

export default EditeurQuestion
