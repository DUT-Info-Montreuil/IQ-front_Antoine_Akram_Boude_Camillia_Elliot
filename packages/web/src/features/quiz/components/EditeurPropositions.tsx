import clsx from "clsx"
import { Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type {
  PropositionSaisie,
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
  PROPOSITIONS_MAX,
  PROPOSITIONS_MIN,
  repartirPoints,
} from "@razzia/web/features/quiz/validation"

export const LETTRES = ["A", "B", "C", "D"]

const COULEURS_LETTRE = [
  "bg-[#c05340] text-white",
  "bg-[#3e6e91] text-white",
  "bg-iq-citron text-iq-foret",
  "bg-iq-mousse text-white",
]

interface Props {
  question: QuestionSaisie
  erreurs: ErreurSaisie[]
  onChange: (changements: Partial<QuestionSaisie>) => void
}

/** Propositions d'un QCM, avec leur barème (maquette E4). */
const EditeurPropositions = ({ question, erreurs, onChange }: Props) => {
  const { t } = useTranslation()
  const erreur = erreurDe(erreurs)
  const { propositions, pointsMax } = question

  const modifier = (index: number, changements: Partial<PropositionSaisie>) => {
    const suivantes = propositions.map((p, i) =>
      i === index ? { ...p, ...changements } : p,
    )

    // Cocher ou décocher une bonne réponse remet le barème par défaut.
    onChange({
      propositions:
        "estCorrecte" in changements
          ? repartirPoints(suivantes, pointsMax || 0)
          : suivantes,
    })
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3">
        <span className="font-bold">{t("manager:quiz.propositions")}</span>
        <span className="text-iq-gris">
          {" "}
          · {t("manager:quiz.propositionsAide")}
        </span>
      </legend>

      {propositions.map((proposition, index) => {
        const erreurLibelle = erreur("propositions", index, "libelle")
        const erreurPoints = erreur("propositions", index, "points")

        return (
          <div key={index} className="flex flex-col gap-1">
            <div
              className={clsx(
                "flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3 sm:flex-nowrap",
                proposition.estCorrecte
                  ? "border-iq-mousse bg-iq-sauge/20"
                  : "border-iq-bordure bg-iq-champ",
              )}
            >
              <span
                className={clsx(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-black",
                  COULEURS_LETTRE[index],
                )}
                aria-hidden
              >
                {LETTRES[index]}
              </span>
              <input
                className={clsx(
                  "min-w-0 flex-1 rounded-lg border-2 border-transparent bg-transparent px-3 py-2 text-lg font-semibold focus:border-iq-mousse focus:bg-white focus:outline-none",
                  erreurLibelle && "border-red-400",
                )}
                value={proposition.libelle}
                placeholder={t("manager:quiz.propositionPlaceholder", {
                  lettre: LETTRES[index],
                })}
                aria-label={t("manager:quiz.proposition", {
                  lettre: LETTRES[index],
                })}
                onChange={(e) => modifier(index, { libelle: e.target.value })}
              />
              <label className="flex shrink-0 cursor-pointer items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-iq-olive"
                  checked={proposition.estCorrecte}
                  onChange={(e) =>
                    modifier(index, { estCorrecte: e.target.checked })
                  }
                />
                {t("manager:quiz.bonneReponse")}
              </label>
              <span className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  className={clsx(
                    champPoints,
                    erreurPoints && "border-red-400",
                  )}
                  value={afficher(proposition.points)}
                  aria-label={t("manager:quiz.pointsProposition", {
                    lettre: LETTRES[index],
                  })}
                  onChange={(e) =>
                    modifier(index, { points: nombre(e.target.value) })
                  }
                />
                <span className="text-iq-gris">{t("manager:quiz.pts")}</span>
              </span>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-iq-gris hover:bg-white hover:text-red-600 disabled:invisible"
                disabled={propositions.length <= PROPOSITIONS_MIN}
                onClick={() =>
                  onChange({
                    propositions: repartirPoints(
                      propositions.filter((_, i) => i !== index),
                      pointsMax || 0,
                    ),
                  })
                }
                title={t("manager:quiz.retirerProposition", {
                  lettre: LETTRES[index],
                })}
              >
                <X className="size-4" />
              </button>
            </div>
            <MessageErreur cle={erreurLibelle ?? erreurPoints} />
          </div>
        )
      })}

      <MessageErreur cle={erreur("propositions")} />

      {propositions.length < PROPOSITIONS_MAX && (
        <button
          type="button"
          className="mt-2 flex w-fit items-center gap-2 font-bold text-iq-olive hover:text-iq-mousse"
          onClick={() =>
            onChange({
              propositions: [
                ...propositions,
                { libelle: "", estCorrecte: false, points: 0 },
              ],
            })
          }
        >
          <Plus className="size-5" />
          {t("manager:quiz.ajouterProposition")}
        </button>
      )}

      <p className="max-w-xl text-sm text-iq-gris">
        {t("manager:quiz.baremeAide", { max: pointsMax || 0 })}
      </p>
    </fieldset>
  )
}

export default EditeurPropositions
