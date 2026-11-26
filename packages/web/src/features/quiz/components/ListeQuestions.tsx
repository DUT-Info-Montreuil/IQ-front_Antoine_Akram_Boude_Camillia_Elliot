import clsx from "clsx"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { QuestionSaisie } from "@razzia/web/features/quiz/types"
import {
  dureeTotale,
  formaterDuree,
} from "@razzia/web/features/quiz/validation"

interface Props {
  questions: QuestionSaisie[]
  courante: number
  enErreur: (index: number) => boolean
  onChoisir: (index: number) => void
  onAjouter: () => void
  onSupprimer: (index: number) => void
}

/** Colonne des questions du quiz (maquette E4, à gauche). */
const ListeQuestions = ({
  questions,
  courante,
  enErreur,
  onChoisir,
  onAjouter,
  onSupprimer,
}: Props) => {
  const { t } = useTranslation()

  return (
    <nav
      className="flex flex-col gap-3"
      aria-label={t("manager:quiz.questions")}
    >
      <p className="text-sm font-extrabold tracking-[0.12em] text-iq-gris uppercase">
        {t("manager:quiz.resumeQuestions", { nb: questions.length })} ·{" "}
        {formaterDuree(dureeTotale(questions))}
      </p>

      <ol className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <li key={index} className="group relative">
            <button
              type="button"
              className={clsx(
                "flex w-full flex-col gap-1 rounded-2xl border-2 bg-white p-4 text-left transition-colors",
                index === courante
                  ? "border-iq-olive shadow-[0_3px_0_var(--color-iq-olive)]"
                  : "border-iq-bordure hover:border-iq-sauge",
              )}
              aria-current={index === courante}
              onClick={() => onChoisir(index)}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-extrabold">
                <span className="flex items-center gap-1.5">
                  {t("manager:quiz.etiquetteQuestion", {
                    numero: index + 1,
                    type: t(`manager:quiz.typesCourts.${question.type}`),
                  })}
                  {enErreur(index) && (
                    <AlertCircle
                      className="size-4 text-red-600"
                      aria-label={t("manager:quiz.questionIncomplete")}
                    />
                  )}
                </span>
                <span>{question.dureeSecondes || "–"} s</span>
              </span>
              <span className="line-clamp-3 text-iq-texte">
                {question.enonce.trim() || (
                  <em className="text-iq-gris">
                    {t("manager:quiz.sansEnonce")}
                  </em>
                )}
              </span>
            </button>

            {questions.length > 1 && (
              <button
                type="button"
                className="absolute top-2 right-2 hidden rounded-lg bg-white p-1.5 text-iq-gris shadow group-hover:block hover:text-red-600 focus-visible:block"
                onClick={() => onSupprimer(index)}
                title={t("manager:quiz.supprimerQuestion", {
                  numero: index + 1,
                })}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-iq-sauge px-4 py-3 font-bold text-iq-texte hover:border-iq-mousse hover:bg-white/50"
        onClick={onAjouter}
      >
        <Plus className="size-5" />
        {t("manager:quiz.ajouterQuestion")}
      </button>
    </nav>
  )
}

export default ListeQuestions
