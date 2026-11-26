import { z } from "zod"
import {
  MAX_MEDIA_SIZE,
  MAX_POINTS,
  MEDIA_TYPES,
  MEDIA_URL_PREFIX,
  QUESTION_TYPES,
  QUIZZ_MODES,
  SCORING_MODES,
} from "@razzia/common/constants"
import { QUESTION_REFINEMENTS } from "@razzia/common/validators/questions"
import { multiOptionsValidator } from "@razzia/common/validators/questions/choice"
import { estimationOptionsValidator } from "@razzia/common/validators/questions/estimation"

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: z
    .string("errors:quizz.invalidMediaUrl")
    .refine(
      (url) =>
        url.startsWith(MEDIA_URL_PREFIX) || z.url().safeParse(url).success,
      "errors:quizz.invalidMediaUrl",
    ),
})

export const mediaUploadValidator = z.object({
  file: z
    .file("errors:media.missingFile")
    .max(MAX_MEDIA_SIZE, "errors:media.tooLarge"),
})

// Refuse aussi une chaîne faite uniquement d'espaces, sans modifier la valeur.
const notBlank = (message: string) =>
  z.string(message).refine((value) => value.trim().length > 0, message)

const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  question: notBlank("errors:quizz.questionEmpty"),
  category: z.string().optional(),
  note: z.string().optional(),
  media: questionMediaValidator.optional(),
  answers: z.array(notBlank("errors:quizz.answerEmpty")),
  answerPoints: z.array(z.number().int().min(0)).optional(),
  solutions: z.array(z.number()).optional(),
  cooldown: z
    .number()
    .int()
    .min(3, "errors:quizz.cooldownTooShort")
    .max(15, "errors:quizz.cooldownTooLong"),
  time: z.number().int().min(-1),
  maxPoints: z
    .number()
    .int()
    .min(0, "errors:quizz.maxPointsNegative")
    .optional(),
  penalty: z.number().int().min(0, "errors:quizz.penaltyNegative").optional(),
  options: z
    .union([multiOptionsValidator, estimationOptionsValidator])
    .optional(),
})

const questionValidator = questionSchema.superRefine((question, ctx) => {
  if (
    question.answerPoints &&
    question.answerPoints.length !== question.answers.length
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["answerPoints"],
      message: "errors:quizz.answerPointsLength",
    })
  }

  QUESTION_REFINEMENTS[question.type](question, (path, message) =>
    ctx.addIssue({ code: "custom", path, message }),
  )
})

export const quizzValidator = z
  .object({
    gameMode: z.enum(QUIZZ_MODES),
    subject: z.string().min(1, "errors:quizz.subjectEmpty"),
    questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
  })
  .superRefine((quizz, ctx) => {
    if (quizz.gameMode !== QUIZZ_MODES.QUIZ) {
      return
    }

    quizz.questions.forEach((question, index) => {
      const solutions = question.solutions ?? []

      if (solutions.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "solutions"],
          message: "errors:quizz.noSolution",
        })
      }

      const { answerPoints } = question

      // Barème IQ par proposition : sans answerPoints, la question garde le
      // score Razzia (maxPoints selon la rapidité), comme les anciens quiz.
      if (!answerPoints || question.type === QUESTION_TYPES.ESTIMATION) {
        return
      }

      question.answers.forEach((_, answerIndex) => {
        const isCorrect = solutions.includes(answerIndex)
        const points = answerPoints[answerIndex] ?? 0

        if (isCorrect && points < 1) {
          ctx.addIssue({
            code: "custom",
            path: ["questions", index, "answerPoints", answerIndex],
            message: "errors:quizz.correctAnswerNoPoints",
          })
        }

        if (!isCorrect && points !== 0) {
          ctx.addIssue({
            code: "custom",
            path: ["questions", index, "answerPoints", answerIndex],
            message: "errors:quizz.wrongAnswerWithPoints",
          })
        }
      })

      const totalCorrectPoints = solutions.reduce(
        (total, answerIndex) => total + (answerPoints[answerIndex] ?? 0),
        0,
      )

      if (totalCorrectPoints > (question.maxPoints ?? MAX_POINTS)) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "answerPoints"],
          message: "errors:quizz.pointsAboveMax",
        })
      }
    })
  })

export type QuizzValidated = z.infer<typeof quizzValidator>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/**
 * Upgrades quizz files written by older versions: quizzes without a `gameMode`,
 * questions without a `type`, a scalar `solutions`, or options without a
 * `scoringMode`.
 */
export const normalizeLegacyQuizz = (data: unknown): unknown => {
  if (!isRecord(data) || !Array.isArray(data.questions)) {
    return data
  }

  return {
    ...data,
    gameMode: data.gameMode ?? QUIZZ_MODES.QUIZ,
    questions: data.questions.map((question: unknown) => {
      if (!isRecord(question)) {
        return question
      }

      return {
        ...question,
        type: question.type ?? QUESTION_TYPES.SINGLE,
        solutions:
          question.solutions === undefined || Array.isArray(question.solutions)
            ? question.solutions
            : [question.solutions],
        ...(isRecord(question.options) &&
        question.type !== QUESTION_TYPES.ESTIMATION
          ? {
              options: {
                scoringMode: SCORING_MODES.BALANCED,
                ...question.options,
              },
            }
          : {}),
      }
    }),
  }
}
