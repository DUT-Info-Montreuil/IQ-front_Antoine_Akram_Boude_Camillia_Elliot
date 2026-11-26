import clsx from "clsx"
import { CircleCheck, CircleHelp, FlaskConical, Plus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type {
  ExpressionSaisie,
  QuestionSaisie,
} from "@razzia/web/features/quiz/types"
import {
  afficher,
  champPoints,
  erreurDe,
  MessageErreur,
  nombre,
} from "@razzia/web/features/quiz/components/champs"
import {
  type ErreurSaisie,
  evaluerReponseLibre,
  EXPRESSIONS_MAX,
  normaliserReponse,
} from "@razzia/web/features/quiz/validation"

interface Props {
  question: QuestionSaisie
  erreurs: ErreurSaisie[]
  onChange: (changements: Partial<QuestionSaisie>) => void
}

/**
 * Test des expressions sur des exemples de réponses (CU 1.3, étape 3).
 * Fait localement en attendant POST /api/quiz/expressions/test (SCRUM-56).
 */
const TestExpressions = ({
  expressions,
}: {
  expressions: ExpressionSaisie[]
}) => {
  const [exemples, setExemples] = useState("")
  const { t } = useTranslation()
  const lignes = exemples.split("\n").filter((l) => l.trim())

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-iq-fond p-5">
      <label className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-bold">
          <FlaskConical className="size-5 text-iq-olive" />
          {t("manager:quiz.testerExpressions")}
        </span>
        <span className="text-sm text-iq-gris">
          {t("manager:quiz.testerExpressionsAide")}
        </span>
        <textarea
          className="min-h-20 resize-y rounded-xl border-2 border-iq-bordure bg-white px-3 py-2 focus:border-iq-mousse focus:outline-none"
          value={exemples}
          placeholder={t("manager:quiz.exemplesPlaceholder")}
          onChange={(e) => setExemples(e.target.value)}
        />
      </label>

      {lignes.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {lignes.map((ligne, index) => {
            const points = evaluerReponseLibre(expressions, ligne)

            return (
              <li
                key={index}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2",
                  points === null ? "bg-iq-or/20" : "bg-iq-sauge/30",
                )}
              >
                {points === null ? (
                  <CircleHelp className="size-5 shrink-0 text-iq-foret" />
                ) : (
                  <CircleCheck className="size-5 shrink-0 text-iq-olive" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{ligne}</span>
                  <span className="block font-mono text-xs text-iq-gris">
                    {t("manager:quiz.reponseNettoyee", {
                      texte: normaliserReponse(ligne),
                    })}
                  </span>
                </span>
                <span className="shrink-0 font-bold">
                  {points === null
                    ? t("manager:quiz.aCorriger")
                    : t("manager:quiz.nbPoints", { nb: points })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Réponse libre (CU 1.3) : la réponse rapporte les points de la meilleure
 * expression reconnue ; sans expression reconnue, elle est corrigée à la main.
 */
const EditeurExpressions = ({ question, erreurs, onChange }: Props) => {
  const { t } = useTranslation()
  const erreur = erreurDe(erreurs)
  const { expressions, pointsMax } = question

  const modifier = (index: number, changements: Partial<ExpressionSaisie>) =>
    onChange({
      expressions: expressions.map((e, i) =>
        i === index ? { ...e, ...changements } : e,
      ),
    })

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3">
        <span className="font-bold">{t("manager:quiz.expressions")}</span>
        <span className="text-iq-gris">
          {" "}
          · {t("manager:quiz.expressionsAide")}
        </span>
      </legend>

      {expressions.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-iq-bordure p-4 text-iq-gris">
          {t("manager:quiz.sansExpression")}
        </p>
      )}

      {expressions.map((expression, index) => {
        const erreurMotif = erreur("expressions", index, "motif")
        const erreurPoints = erreur("expressions", index, "points")

        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-iq-bordure bg-iq-champ p-3 sm:flex-nowrap">
              <span className="flex min-w-0 flex-1 items-center rounded-xl border-2 border-iq-bordure bg-white font-mono focus-within:border-iq-mousse">
                <span className="pl-3 text-iq-gris" aria-hidden>
                  /
                </span>
                <input
                  className={clsx(
                    "min-w-0 flex-1 bg-transparent px-1 py-2 focus:outline-none",
                    erreurMotif && "text-red-600",
                  )}
                  value={expression.motif}
                  placeholder={t("manager:quiz.motifPlaceholder")}
                  aria-label={t("manager:quiz.expression", {
                    numero: index + 1,
                  })}
                  spellCheck={false}
                  onChange={(e) => modifier(index, { motif: e.target.value })}
                />
                <span className="pr-3 text-iq-gris" aria-hidden>
                  /i
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className={clsx(
                    champPoints,
                    erreurPoints && "border-red-400",
                  )}
                  value={afficher(expression.points)}
                  aria-label={t("manager:quiz.pointsExpression", {
                    numero: index + 1,
                  })}
                  onChange={(e) =>
                    modifier(index, { points: nombre(e.target.value) })
                  }
                />
                <span className="text-iq-gris">{t("manager:quiz.pts")}</span>
              </span>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-iq-gris hover:bg-white hover:text-red-600"
                onClick={() =>
                  onChange({
                    expressions: expressions.filter((_, i) => i !== index),
                  })
                }
                title={t("manager:quiz.retirerExpression", {
                  numero: index + 1,
                })}
              >
                <X className="size-4" />
              </button>
            </div>
            <MessageErreur cle={erreurMotif ?? erreurPoints} />
          </div>
        )
      })}

      <MessageErreur cle={erreur("expressions")} />

      {expressions.length < EXPRESSIONS_MAX && (
        <button
          type="button"
          className="mt-2 flex w-fit items-center gap-2 font-bold text-iq-olive hover:text-iq-mousse"
          onClick={() =>
            onChange({
              expressions: [
                ...expressions,
                { motif: "", points: pointsMax || 0 },
              ],
            })
          }
        >
          <Plus className="size-5" />
          {t("manager:quiz.ajouterExpression")}
        </button>
      )}

      <p className="max-w-xl text-sm text-iq-gris">
        {t("manager:quiz.expressionsBareme")}
      </p>

      <TestExpressions expressions={expressions} />
    </fieldset>
  )
}

export default EditeurExpressions
