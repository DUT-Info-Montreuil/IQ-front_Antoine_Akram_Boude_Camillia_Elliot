import clsx from "clsx"
import { Minus, Plus } from "lucide-react"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { MAX_ANSWERS, MIN_ANSWERS, MAX_POINTS, QUIZZ_MODES, QUESTION_TYPES } from "@razzia/common/constants"
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
    const previousPoints = currentQuestion.answerPoints ??
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
        <div className="flex items-center justify-between px-1">
          <div className="rounded-lg bg-background px-2 py-1 text-sm font-semibold text-muted-foreground">
            {currentQuestion.answers.length}
            {t("quizz:answersCountSuffix")}
          </div>
          <div className="flex gap-2">
            <button
                onClick={removeAnswer}
                aria-label={t("quizz:removeAnswer")}
                disabled={currentQuestion.answers.length <= MIN_ANSWERS}
                className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <button
                onClick={addAnswer}
                aria-label={t("quizz:addAnswer")}
                disabled={currentQuestion.answers.length >= MAX_ANSWERS}
                className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {currentQuestion.answers.map((_, i) => {
            const isSelected = currentQuestion.solutions?.includes(i) ?? false
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
                        <div className="flex flex-col gap-1">
                          <div
                              className={clsx(
                                  "flex items-center gap-3 rounded-2xl px-4 py-6",
                                  ANSWERS_COLORS[i],
                                  fieldState.invalid && "ring-2 ring-red-500",
                              )}
                          >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-black/20 text-sm font-bold text-white md:size-8 md:text-base">
                      {ANSWERS_LABELS[i]}
                    </span>
                            <div className="flex flex-1 items-center justify-between gap-1.5 drop-shadow-md">
                              <input
                                  {...field}
                                  aria-invalid={fieldState.invalid}
                                  aria-describedby={
                                    fieldState.invalid ? `${field.name}-error` : undefined
                                  }
                                  className="w-full bg-transparent font-semibold text-white placeholder-white/70 outline-none"
                                  placeholder={t("quizz:addAnswerPlaceholder")}
                              />
                              {gameMode !== QUIZZ_MODES.SURVEY && SolutionPicker && (
                                  <SolutionPicker index={i} isSelected={isSelected} />
                              )}
                            </div>
                          </div>
                          {gameMode !== QUIZZ_MODES.SURVEY &&
                              (questionType === QUESTION_TYPES.SINGLE ||
                                  questionType === QUESTION_TYPES.MULTI) && (
                                  <Controller
                                      control={control}
                                      name={questionPath(`answerPoints.${i}`)}
                                      render={({ field: pointsField }) => (
                                          <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                                            {t("quizz:question.answerPoints", {
                                              label: ANSWERS_LABELS[i],
                                            })}
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={pointsField.value ?? defaultAnswerPoints}
                                                onChange={(event) =>
                                                    pointsField.onChange(
                                                        event.target.value === ""
                                                            ? 0
                                                            : Math.max(0, Math.floor(Number(event.target.value))),
                                                    )
                                                }
                                                onBlur={pointsField.onBlur}
                                                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-foreground"
                                            />
                                          </label>
                                      )}
                                  />
                              )}
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
