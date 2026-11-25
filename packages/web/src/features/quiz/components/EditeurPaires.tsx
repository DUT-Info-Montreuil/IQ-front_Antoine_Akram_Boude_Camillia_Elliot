import clsx from "clsx"
import { ArrowLeftRight, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type {
  PaireSaisie,
  QuestionSaisie,
} from "@razzia/web/features/quiz/types"
import {
  erreurDe,
  MessageErreur,
} from "@razzia/web/features/quiz/components/champs"
import {
  type ErreurSaisie,
  PAIRES_MAX,
  PAIRES_MIN,
  pointsParPaire,
} from "@razzia/web/features/quiz/validation"

interface Props {
  question: QuestionSaisie
  erreurs: ErreurSaisie[]
  onChange: (changements: Partial<QuestionSaisie>) => void
}

const champPaire =
  "min-w-0 flex-1 rounded-xl border-2 border-iq-bordure bg-white px-3 py-2 text-lg font-semibold focus:border-iq-mousse focus:outline-none"

/**
 * Points à relier (CU 1.3) : l'étudiant relie chaque élément de gauche à son
 * élément de droite, affichés mélangés. Chaque association juste rapporte une
 * part égale des points de la question.
 */
const EditeurPaires = ({ question, erreurs, onChange }: Props) => {
  const { t } = useTranslation()
  const erreur = erreurDe(erreurs)
  const { paires, pointsMax } = question

  const modifier = (index: number, changements: Partial<PaireSaisie>) =>
    onChange({
      paires: paires.map((p, i) =>
        i === index ? { ...p, ...changements } : p,
      ),
    })

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3">
        <span className="font-bold">{t("manager:quiz.paires")}</span>
        <span className="text-iq-gris"> · {t("manager:quiz.pairesAide")}</span>
      </legend>

      <div className="hidden grid-cols-[2.5rem_1fr_1.5rem_1fr_2.5rem] gap-3 px-3 text-sm font-bold text-iq-gris sm:grid">
        <span />
        <span>{t("manager:quiz.colonneGauche")}</span>
        <span />
        <span>{t("manager:quiz.colonneDroite")}</span>
      </div>

      {paires.map((paire, index) => {
        const erreurGauche = erreur("paires", index, "gauche")
        const erreurDroite = erreur("paires", index, "droite")

        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-iq-bordure bg-iq-champ p-3 sm:flex-nowrap">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-iq-foret font-black text-iq-creme"
                aria-hidden
              >
                {index + 1}
              </span>
              <input
                className={clsx(champPaire, erreurGauche && "border-red-400")}
                value={paire.gauche}
                placeholder={t("manager:quiz.gauchePlaceholder")}
                aria-label={t("manager:quiz.gauche", { numero: index + 1 })}
                onChange={(e) => modifier(index, { gauche: e.target.value })}
              />
              <ArrowLeftRight
                className="size-5 shrink-0 text-iq-mousse"
                aria-hidden
              />
              <input
                className={clsx(champPaire, erreurDroite && "border-red-400")}
                value={paire.droite}
                placeholder={t("manager:quiz.droitePlaceholder")}
                aria-label={t("manager:quiz.droite", { numero: index + 1 })}
                onChange={(e) => modifier(index, { droite: e.target.value })}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-iq-gris hover:bg-white hover:text-red-600 disabled:invisible"
                disabled={paires.length <= PAIRES_MIN}
                onClick={() =>
                  onChange({ paires: paires.filter((_, i) => i !== index) })
                }
                title={t("manager:quiz.retirerPaire", { numero: index + 1 })}
              >
                <X className="size-4" />
              </button>
            </div>
            <MessageErreur cle={erreurGauche ?? erreurDroite} />
          </div>
        )
      })}

      <MessageErreur cle={erreur("paires")} />

      {paires.length < PAIRES_MAX && (
        <button
          type="button"
          className="mt-2 flex w-fit items-center gap-2 font-bold text-iq-olive hover:text-iq-mousse"
          onClick={() =>
            onChange({ paires: [...paires, { gauche: "", droite: "" }] })
          }
        >
          <Plus className="size-5" />
          {t("manager:quiz.ajouterPaire")}
        </button>
      )}

      <p className="max-w-xl text-sm text-iq-gris">
        {t("manager:quiz.pairesBareme", {
          part: pointsParPaire(pointsMax || 0, paires.length),
          max: pointsMax || 0,
          nb: paires.length,
        })}
      </p>
    </fieldset>
  )
}

export default EditeurPaires
