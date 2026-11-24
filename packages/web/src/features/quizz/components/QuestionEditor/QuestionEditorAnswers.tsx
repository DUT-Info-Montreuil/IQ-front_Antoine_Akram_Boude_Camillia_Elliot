import clsx from "clsx"
import { Minus, Plus } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import {
  MAX_ANSWERS,
  MIN_ANSWERS,
  MAX_POINTS,
  QUIZZ_MODES,
  QUESTION_TYPES,
} from "@razzia/common/constants"
import FieldError from "@razzia/web/components/forms/FieldError"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import {
  useQuizzEditor,
  type QuizzFormValues,
} from "@razzia/web/features/quizz/contexts/quizz-editor-context"

const QuestionEditorAnswers = () => {
  const {
    currentQuestion,
    currentIndex,
    gameMode,
    updateQuestion,
    questionPath,
  } = useQuizzEditor()

  const { control } = useFormContext<QuizzFormValues>()
  const { t } = useTranslation()

  const questionType = currentQuestion.type
  const { SolutionPicker } = QUESTION_REGISTRY[questionType]

  const addAnswer = () => {
    if (currentQuestion.answers.length >= MAX_ANSWERS) {
      return
    }

    updateQuestion(currentIndex, {
      answers: [...currentQuestion.answers, ""],
      answerPoints: [
        ...(currentQuestion.answerPoints ??
            currentQuestion.answers.map((_, i) =>
                currentQuestion.solutions?.includes(i)
                    ? Math.floor(
                        (currentQuestion.maxPoints ?? MAX_POINTS) /
                        Math.max(currentQuestion.solutions?.length ?? 1, 1),
                    )
                    : 0,
            )),
        0,
      ],
    })
  }

  const removeAnswer = () => {
    if (currentQuestion.answers.length <= MIN_ANSWERS) {
      return
    }

    const next = currentQuestion.answers.slice(0, -1)
    const maxIndex = next.length - 1
    const nextSolution = (currentQuestion.solutions ?? []).filter(
        (s) => s <= maxIndex,
    )

    const solutions = nextSolution.length > 0 ? nextSolution : [0]

    const previousPoints =
        currentQuestion.answerPoints ??
        currentQuestion.answers.map((_, i) =>
            currentQuestion.solutions?.includes(i)
                ? Math.floor(
                    (currentQuestion.maxPoints ?? MAX_POINTS) /
                    Math.max(currentQuestion.solutions?.length ?? 1, 1),
                )
                : 0,
        )

    const answerPoints = previousPoints.slice(0, next.length)

    if (nextSolution.length === 0) {
      answerPoints[0] = currentQuestion.maxPoints ?? MAX_POINTS
    }

    updateQuestion(currentIndex, {
      answers: next,
      answerPoints,
      solutions,
    })
  }

  return (
      <div className="z-10 flex flex-col gap-3">
        {/* En-tête */}
        <div className="flex items-center justify-between px-1">
          <div className="rounded-lg bg-background px-2 py-1 text-sm font-semibold text-muted-foreground">
            {currentQuestion.answers.length} {t("quizz:answersCountSuffix")}
          </div>

          <div className="flex gap-2">
            <button
                onClick={removeAnswer}
                aria-label={t("quizz:removeAnswer")}
                disabled={currentQuestion.answers.length <= MIN_ANSWERS}
                className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>

            <button
                onClick={addAnswer}
                aria-label={t("quizz:addAnswer")}
                disabled={currentQuestion.answers.length >= MAX_ANSWERS}
                className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {/* Liste des réponses */}
        <div className="flex flex-col gap-2">
          {currentQuestion.answers.map((_, i) => {
            const isSelected =
                currentQuestion.solutions?.includes(i) ?? false

            const defaultAnswerPoints = isSelected
                ? Math.floor(
                    (currentQuestion.maxPoints ?? MAX_POINTS) /
                    Math.max(currentQuestion.solutions?.length ?? 1, 1),
                )
                : 0

            return (
                <Controller
                    key={i}
                    control={control}
                    name={questionPath(`answers.${i}`)}
                    render={({ field, fieldState }) => (
                        <div className="flex min-w-0 flex-col gap-1">
                          <div
                              className={clsx(
                                  "flex min-h-[52px] flex-wrap items-center gap-3 rounded-xl border px-2 py-2 sm:flex-nowrap sm:px-3",
                                  isSelected
                                      ? "border-green-700 bg-[#e8f0dc]"
                                      : "border-[#dedfca] bg-[#f5f5ed]",
                                  fieldState.invalid && "ring-2 ring-red-500",
                              )}
                          >
                            {/* Lettre de réponse */}
                            <span
                                className={clsx(
                                    "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white",
                                    ANSWERS_COLORS[i],
                                )}
                            >
                      {ANSWERS_LABELS[i]}
                    </span>

                            {/* Texte de la réponse */}
                            <input
                                {...field}
                                aria-invalid={fieldState.invalid}
                                aria-describedby={
                                  fieldState.invalid
                                      ? `${field.name}-error`
                                      : undefined
                                }
                                className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                                placeholder={t("quizz:addAnswerPlaceholder")}
                            />

                            {/* Bonne réponse */}
                            {gameMode !== QUIZZ_MODES.SURVEY &&
                                SolutionPicker && (
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      <SolutionPicker
                                          index={i}
                                          isSelected={isSelected}
                                      />
                                      <span className="whitespace-nowrap text-xs font-semibold text-foreground">
                            Bonne réponse
                          </span>
                                    </div>
                                )}

                            {/* Points */}
                            {gameMode !== QUIZZ_MODES.SURVEY &&
                                (questionType === QUESTION_TYPES.SINGLE ||
                                    questionType === QUESTION_TYPES.MULTI) && (
                                    <Controller
                                        control={control}
                                        name={questionPath(`answerPoints.${i}`)}
                                        render={({ field: pointsField }) => (
                                            <label className="flex shrink-0 items-center gap-2">
                                              <input
                                                  type="number"
                                                  min={0}
                                                  step={1}
                                                  value={
                                                      pointsField.value ?? defaultAnswerPoints
                                                  }
                                                  onChange={(event) =>
                                                      pointsField.onChange(
                                                          event.target.value === ""
                                                              ? 0
                                                              : Math.max(
                                                                  0,
                                                                  Math.floor(
                                                                      Number(event.target.value),
                                                                  ),
                                                              ),
                                                      )
                                                  }
                                                  onBlur={pointsField.onBlur}
                                                  className="w-[68px] rounded-lg border border-[#d9ddc8] bg-background px-2 py-1.5 text-center text-sm font-semibold text-foreground outline-none focus:border-primary"
                                              />
                                              <span className="text-xs text-muted-foreground">
                                pts
                              </span>
                                            </label>
                                        )}
                                    />
                                )}
                          </div>

                          <FieldError
                              id={`${field.name}-error`}
                              errors={[fieldState.error]}
                              pill
                          />
                        </div>
                    )}
                />
            )
          })}
        </div>
      </div>
  )
}

export default QuestionEditorAnswers
