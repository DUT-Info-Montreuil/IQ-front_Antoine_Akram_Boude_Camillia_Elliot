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

const getDefaultPoints = (maxPoints: number, correctAnswersCount: number) =>
    Math.max(1, Math.floor(maxPoints / Math.max(correctAnswersCount, 1)))

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
    if (currentQuestion.answers.length >= MAX_ANSWERS) return

    const existingPoints = currentQuestion.answers.map((_, index) =>
        currentQuestion.solutions?.includes(index)
            ? Math.max(
                1,
                currentQuestion.answerPoints?.[index] ?? getDefaultPoints(
                    currentQuestion.maxPoints ?? MAX_POINTS,
                    currentQuestion.solutions.length,
                ),
            )
            : 0,
    )

    updateQuestion(currentIndex, {
      answers: [...currentQuestion.answers, ""],
      answerPoints: [...existingPoints, 0],
    })
  }

  const removeAnswer = () => {
    if (currentQuestion.answers.length <= MIN_ANSWERS) return

    const nextAnswers = currentQuestion.answers.slice(0, -1)

    const nextSolutions = (currentQuestion.solutions ?? []).filter(
        (solution) => solution < nextAnswers.length,
    )

    const solutions = nextSolutions.length > 0 ? nextSolutions : [0]

    const previousPoints = currentQuestion.answers.map((_, index) =>
        currentQuestion.solutions?.includes(index)
            ? Math.max(
                1,
                currentQuestion.answerPoints?.[index] ?? getDefaultPoints(
                    currentQuestion.maxPoints ?? MAX_POINTS,
                    currentQuestion.solutions.length,
                ),
            )
            : 0,
    )

    const answerPoints = previousPoints.slice(0, nextAnswers.length)

    if (nextSolutions.length === 0) {
      answerPoints[0] = Math.max(1, currentQuestion.maxPoints ?? MAX_POINTS)
    }

    updateQuestion(currentIndex, {
      answers: nextAnswers,
      answerPoints,
      solutions,
    })
  }

  return (
      <div className="z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="rounded-lg bg-background px-2 py-1 text-sm font-semibold text-muted-foreground">
            {currentQuestion.answers.length} {t("quizz:answersCountSuffix")}
          </div>

          <div className="flex gap-2">
            <button
                type="button"
                onClick={removeAnswer}
                aria-label={t("quizz:removeAnswer")}
                disabled={currentQuestion.answers.length <= MIN_ANSWERS}
                className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>

            <button
                type="button"
                onClick={addAnswer}
                aria-label={t("quizz:addAnswer")}
                disabled={currentQuestion.answers.length >= MAX_ANSWERS}
                className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {currentQuestion.answers.map((_, index) => {
            const isSelected = currentQuestion.solutions?.includes(index) ?? false

            const defaultAnswerPoints = getDefaultPoints(
                currentQuestion.maxPoints ?? MAX_POINTS,
                currentQuestion.solutions?.length ?? 1,
            )

            return (
                <Controller
                    key={index}
                    control={control}
                    name={questionPath(`answers.${index}`)}
                    render={({ field, fieldState }) => (
                        <div className="flex min-w-0 flex-col gap-1">
                          <div
                              className={clsx(
                                  "flex min-h-[56px] flex-wrap items-center gap-3 rounded-xl border px-2 py-2 sm:flex-nowrap sm:px-3",
                                  isSelected
                                      ? "border-green-700 bg-[#e8f0dc]"
                                      : "border-[#dedfca] bg-[#f5f5ed]",
                                  fieldState.invalid && "ring-2 ring-red-500",
                              )}
                          >
                    <span
                        className={clsx(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white",
                            ANSWERS_COLORS[index],
                        )}
                    >
                      {ANSWERS_LABELS[index]}
                    </span>

                            <input
                                {...field}
                                aria-invalid={fieldState.invalid}
                                aria-describedby={
                                  fieldState.invalid ? `${field.name}-error` : undefined
                                }
                                className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                                placeholder={t("quizz:addAnswerPlaceholder")}
                            />

                            {gameMode !== QUIZZ_MODES.SURVEY && SolutionPicker && (
                                <div className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1">
                                  <SolutionPicker index={index} isSelected={isSelected} />

                                  <span className="whitespace-nowrap text-xs font-bold text-foreground">
                          Bonne réponse
                        </span>
                                </div>
                            )}

                            {gameMode !== QUIZZ_MODES.SURVEY &&
                                questionType === QUESTION_TYPES.MULTI && (
                                    <Controller
                                        control={control}
                                        name={questionPath(`answerPoints.${index}`)}
                                        render={({ field: pointsField }) => (
                                            <label className="flex shrink-0 items-center gap-2">
                                              <input
                                                  type="number"
                                                  min={isSelected ? 1 : 0}
                                                  step={1}
                                                  value={
                                                    isSelected
                                                        ? Math.max(1, pointsField.value ?? defaultAnswerPoints)
                                                        : 0
                                                  }
                                                  onChange={(event) =>
                                                      pointsField.onChange(
                                                          isSelected
                                                              ? Math.max(
                                                                  1,
                                                                  Math.floor(Number(event.target.value) || 1),
                                                              )
                                                              : 0,
                                                      )
                                                  }
                                                  onBlur={pointsField.onBlur}
                                                  disabled={!isSelected}
                                                  aria-label={`Points pour la réponse ${ANSWERS_LABELS[index]}`}
                                                  className="w-[68px] rounded-lg border border-[#d9ddc8] bg-background px-2 py-1.5 text-center text-sm font-semibold text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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
