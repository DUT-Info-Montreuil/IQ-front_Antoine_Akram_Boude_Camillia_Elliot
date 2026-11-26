import clsx from "clsx"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MAX_POINTS, QUIZZ_MODES } from "@razzia/common/constants"
import { repartirPoints } from "@razzia/common/questions/points"
import type { SolutionPickerProps } from "@razzia/web/features/questions/types"
import { ANSWERS_LABELS } from "@razzia/web/features/game/utils/constants"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"

const MultiSolutionPicker = ({ index, isSelected }: SolutionPickerProps) => {
  const { currentQuestion, currentIndex, gameMode, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleToggle = () => {
    const current = currentQuestion.solutions ?? []
    const isCurrentlySelected = current.includes(index)

    // En mode Quiz, il doit toujours rester au moins une bonne réponse.
    if (isCurrentlySelected && current.length === 1 && gameMode === QUIZZ_MODES.QUIZ) {
      return
    }

    const nextSolutions = isCurrentlySelected
        ? current.filter((solution) => solution !== index)
        : [...current, index]

    // Le maximum est réparti à nouveau, pour que la somme ne le dépasse pas.
    updateQuestion(currentIndex, {
      solutions: nextSolutions,
      answerPoints: repartirPoints(
        currentQuestion.answers.length,
        nextSolutions,
        currentQuestion.maxPoints ?? MAX_POINTS,
      ),
    })
  }

  return (
      <button
          type="button"
          onClick={handleToggle}
          aria-label={t("quizz:markCorrect", { label: ANSWERS_LABELS[index] })}
          aria-pressed={isSelected}
          className={clsx(
              "flex size-8 shrink-0 items-center justify-center rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2",
              isSelected
                  ? "border-green-800 bg-green-700 text-white shadow-sm"
                  : "border-slate-500 bg-white text-slate-500 hover:border-green-700 hover:bg-green-50",
          )}
      >
        {isSelected && <Check className="size-5 stroke-[3]" />}
      </button>
  )
}

export default MultiSolutionPicker
