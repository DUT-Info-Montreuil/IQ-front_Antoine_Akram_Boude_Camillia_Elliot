import { ArrowBigDownDash, Clock, Star, Timer } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  MAX_POINTS,
  NO_TIME_LIMIT,
  QUIZZ_MODES,
} from "@razzia/common/constants"
import { repartirPoints } from "@razzia/common/questions/points"
import Switch from "@razzia/web/components/Switch"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"

const DEFAULT_TIME = 20
const DEFAULT_PENALTY = 100

const BaseConfig = () => {
  const { currentQuestion, currentIndex, gameMode, updateQuestion } =
      useQuizzEditor()
  const { t } = useTranslation()
  const isTimeLimitEnabled = currentQuestion.time !== NO_TIME_LIMIT
  const isPenaltyEnabled = (currentQuestion.penalty ?? 0) > 0
  const handleToggleTimeLimit = (checked: boolean) => {
    updateQuestion(currentIndex, {
      time: checked ? DEFAULT_TIME : NO_TIME_LIMIT,
    })
  }

  // Un nouveau maximum est réparti entre les bonnes réponses du barème.
  const handleMaxPointsChange = (maxPoints: number) => {
    if (!currentQuestion.answerPoints) {
      return
    }

    updateQuestion(currentIndex, {
      answerPoints: repartirPoints(
        currentQuestion.answers.length,
        currentQuestion.solutions ?? [],
        maxPoints,
      ),
    })
  }

  const handleTogglePenalty = (checked: boolean) => {
    updateQuestion(currentIndex, {
      penalty: checked ? DEFAULT_PENALTY : undefined,
    })
  }

  return (
      <>
        {gameMode !== QUIZZ_MODES.SURVEY && (
            <ConfigSection title={t("quizz:question.config.scoring")}>
              <ConfigField>
                <ConfigField.Label
                    icon={<Star className="size-4" />}
                    label={t("quizz:question.config.maxPoints")}
                    unit="pts"
                />
                <ConfigNumberInput
                    name="maxPoints"
                    label={t("quizz:question.config.maxPoints")}
                    fallback={MAX_POINTS}
                    min={0}
                    onValueChange={handleMaxPointsChange}
                />
                <ConfigField.Description>
                  {t("quizz:question.config.maxPointsHint")}
                </ConfigField.Description>
              </ConfigField>

              <ConfigField>
                <ConfigField.Label
                    icon={<ArrowBigDownDash className="size-4" />}
                    label={t("quizz:question.config.penalty")}
                    unit={isPenaltyEnabled ? "pts" : undefined}
                    action={
                      <Switch
                          aria-label={t("quizz:question.config.penalty")}
                          checked={isPenaltyEnabled}
                          onCheckedChange={handleTogglePenalty}
                      />
                    }
                />
                {isPenaltyEnabled && (
                    <ConfigNumberInput
                        name="penalty"
                        label={t("quizz:question.config.penalty")}
                        fallback={DEFAULT_PENALTY}
                        min={1}
                    />
                )}
                <ConfigField.Description>
                  {t("quizz:question.config.penaltyHint")}
                </ConfigField.Description>
              </ConfigField>

            </ConfigSection>
        )}

        <ConfigSection title={t("quizz:question.config.timings")}>
          <ConfigField>
            <ConfigField.Label
                icon={<Clock className="size-4" />}
                label={t("quizz:question.config.questionDisplay")}
                unit="sec"
            />
            <ConfigNumberInput
                name="cooldown"
                label={t("quizz:question.config.questionDisplay")}
                min={3}
                max={15}
            />
            <ConfigField.Description>
              {t("quizz:question.config.questionDisplayHint")}
            </ConfigField.Description>
          </ConfigField>

          <ConfigField>
            <ConfigField.Label
                icon={<Timer className="size-4" />}
                label={t("quizz:question.config.answerTime")}
                unit={isTimeLimitEnabled ? "sec" : undefined}
                action={
                  <Switch
                      aria-label={t("quizz:question.config.answerTime")}
                      checked={isTimeLimitEnabled}
                      onCheckedChange={handleToggleTimeLimit}
                  />
                }
            />
            {isTimeLimitEnabled && (
                <ConfigNumberInput
                    name="time"
                    label={t("quizz:question.config.answerTime")}
                    min={5}
                />
            )}
            <ConfigField.Description>
              {isTimeLimitEnabled
                  ? t("quizz:question.config.answerTimeHint")
                  : t("quizz:question.config.noTimeLimitHint")}
            </ConfigField.Description>
          </ConfigField>
        </ConfigSection>
      </>
  )
}

export default BaseConfig
