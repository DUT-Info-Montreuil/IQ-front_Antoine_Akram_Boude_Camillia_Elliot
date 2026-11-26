import { describe, expect, it } from "vitest"
import type { Question, Quizz } from "@razzia/common/types/game"
import {
  ESTIMATION_INPUT_MODES,
  QUESTION_TYPES,
  QUIZZ_MODES,
  SCORING_MODES,
} from "@razzia/common/constants"
import {
  normalizeLegacyQuizz,
  questionMediaValidator,
  quizzValidator,
} from "@razzia/common/validators/quizz"

const choiceQuestion = (overrides: Partial<Question> = {}): Question => ({
  type: QUESTION_TYPES.SINGLE,
  question: "Question ?",
  answers: ["A", "B"],
  solutions: [0],
  cooldown: 5,
  time: 15,
  ...overrides,
})

const estimationQuestion = (overrides: Partial<Question> = {}): Question => ({
  type: QUESTION_TYPES.ESTIMATION,
  question: "How many ?",
  answers: [],
  solutions: [50],
  cooldown: 5,
  time: 15,
  options: {
    inputMode: ESTIMATION_INPUT_MODES.SLIDER,
    min: 0,
    max: 100,
    step: 1,
    margin: 10,
  },
  ...overrides,
})

const quizz = (
  questions: Question[],
  gameMode: Quizz["gameMode"] = QUIZZ_MODES.QUIZ,
): Quizz => ({ gameMode, subject: "Subject", questions })

const issues = (data: unknown) =>
  quizzValidator.safeParse(data).error?.issues.map((issue) => issue.message) ??
  []

describe("quizzValidator", () => {
  it("accepts a valid quizz mixing every question type", () => {
    const data = quizz([
      choiceQuestion(),
      choiceQuestion({
        type: QUESTION_TYPES.MULTI,
        answers: ["A", "B", "C", "D"],
        solutions: [0, 2],
        options: { scoringMode: SCORING_MODES.STRICT },
      }),
      estimationQuestion(),
    ])

    expect(issues(data)).toEqual([])
  })

  it("requires at least one question", () => {
    expect(issues(quizz([]))).toContain("errors:quizz.noQuestions")
  })

  it("requires a solution in quiz mode but not in survey mode", () => {
    const question = choiceQuestion({ solutions: [] })

    expect(issues(quizz([question]))).toContain("errors:quizz.noSolution")
    expect(issues(quizz([question], QUIZZ_MODES.SURVEY))).toEqual([])
  })

  it("limits choice questions to 2-4 answers", () => {
    expect(issues(quizz([choiceQuestion({ answers: ["A"] })]))).toContain(
      "errors:quizz.tooFewAnswers",
    )
    expect(
      issues(quizz([choiceQuestion({ answers: ["A", "B", "C", "D", "E"] })])),
    ).toContain("errors:quizz.tooManyAnswers")
  })

  it("accepts 0 max points but no negative points", () => {
    expect(issues(quizz([choiceQuestion({ maxPoints: 0 })]))).toEqual([])
    expect(issues(quizz([choiceQuestion({ maxPoints: -1 })]))).toContain(
      "errors:quizz.maxPointsNegative",
    )
    expect(issues(quizz([choiceQuestion({ penalty: -1 })]))).toContain(
      "errors:quizz.penaltyNegative",
    )
  })

  it("bounds the cooldown between 3 and 15 seconds", () => {
    expect(issues(quizz([choiceQuestion({ cooldown: 2 })]))).toContain(
      "errors:quizz.cooldownTooShort",
    )
    expect(issues(quizz([choiceQuestion({ cooldown: 16 })]))).toContain(
      "errors:quizz.cooldownTooLong",
    )
  })

  it("rejects estimation questions without options", () => {
    expect(
      issues(quizz([estimationQuestion({ options: undefined })])),
    ).toContain("errors:quizz.estimationInvalidOptions")
  })

  it.each([
    [{ step: 0 }, "errors:quizz.estimationStepInvalid"],
    [{ margin: -1 }, "errors:quizz.estimationMarginNegative"],
    [{ min: 100, max: 0 }, "errors:quizz.estimationInvalidRange"],
  ])("rejects invalid estimation options %o", (options, message) => {
    const question = estimationQuestion({
      options: {
        inputMode: ESTIMATION_INPUT_MODES.SLIDER,
        min: 0,
        max: 100,
        step: 1,
        margin: 10,
        ...options,
      },
    })

    expect(issues(quizz([question]))).toContain(message)
  })

  it("rejects an estimation solution outside of the range", () => {
    expect(issues(quizz([estimationQuestion({ solutions: [101] })]))).toContain(
      "errors:quizz.estimationSolutionOutOfRange",
    )
  })
})

describe("quizzValidator, QCM avec barème (SCRUM-13)", () => {
  const qcm = (overrides: Partial<Question> = {}) =>
    choiceQuestion({
      type: QUESTION_TYPES.MULTI,
      answers: ["A", "B", "C"],
      solutions: [0, 2],
      maxPoints: 10,
      answerPoints: [5, 0, 5],
      ...overrides,
    })

  it("accepte deux propositions et une bonne réponse", () => {
    expect(
      issues(
        quizz([
          qcm({ answers: ["A", "B"], solutions: [0], answerPoints: [10, 0] }),
        ]),
      ),
    ).toEqual([])
  })

  it("accepte plusieurs bonnes réponses dont la somme vaut maxPoints", () => {
    expect(issues(quizz([qcm()]))).toEqual([])
  })

  it.each([
    ["l'énoncé est vide", { question: "" }, "errors:quizz.questionEmpty"],
    [
      "l'énoncé n'a que des espaces",
      { question: "   " },
      "errors:quizz.questionEmpty",
    ],
    [
      "une proposition est vide",
      { answers: ["A", "", "C"] },
      "errors:quizz.answerEmpty",
    ],
    [
      "une proposition n'a que des espaces",
      { answers: ["A", "  ", "C"] },
      "errors:quizz.answerEmpty",
    ],
    [
      "il y a moins de deux propositions",
      { answers: ["A"], solutions: [0], answerPoints: [5] },
      "errors:quizz.tooFewAnswers",
    ],
    [
      "aucune bonne réponse",
      { solutions: [], answerPoints: [0, 0, 0] },
      "errors:quizz.noSolution",
    ],
    [
      "un indice est négatif",
      { solutions: [-1] },
      "errors:quizz.invalidSolution",
    ],
    [
      "un indice n'est pas entier",
      { solutions: [0.5] },
      "errors:quizz.invalidSolution",
    ],
    [
      "un indice est hors limites",
      { solutions: [0, 3] },
      "errors:quizz.invalidSolution",
    ],
    [
      "answerPoints n'a pas la bonne longueur",
      { answerPoints: [5, 0] },
      "errors:quizz.answerPointsLength",
    ],
    [
      "des points sont négatifs",
      { answerPoints: [5, -1, 5] },
      "Too small: expected number to be >=0",
    ],
    [
      "une mauvaise réponse a des points",
      { answerPoints: [5, 1, 4] },
      "errors:quizz.wrongAnswerWithPoints",
    ],
    [
      "une bonne réponse a 0 point",
      { answerPoints: [10, 0, 0] },
      "errors:quizz.correctAnswerNoPoints",
    ],
    [
      "la somme des bonnes réponses dépasse maxPoints",
      { answerPoints: [6, 0, 5] },
      "errors:quizz.pointsAboveMax",
    ],
  ] as Array<[string, Partial<Question>, string]>)(
    "refuse si %s",
    (_, overrides, message) => {
      expect(issues(quizz([qcm(overrides)]))).toContain(message)
    },
  )

  it("refuse des points non entiers", () => {
    expect(
      quizzValidator.safeParse(quizz([qcm({ answerPoints: [5, 0, 4.5] })]))
        .success,
    ).toBe(false)
  })

  it("compare la somme à 1000 points quand maxPoints est absent", () => {
    expect(
      issues(
        quizz([qcm({ maxPoints: undefined, answerPoints: [500, 0, 500] })]),
      ),
    ).toEqual([])
    expect(
      issues(
        quizz([qcm({ maxPoints: undefined, answerPoints: [600, 0, 500] })]),
      ),
    ).toContain("errors:quizz.pointsAboveMax")
  })
})

describe("questionMediaValidator", () => {
  it.each(["/media/picture.png", "https://example.com/picture.png"])(
    "accepts %s",
    (url) => {
      expect(questionMediaValidator.safeParse({ url }).success).toBe(true)
    },
  )

  it.each(["picture.png", "/other/picture.png"])("rejects %s", (url) => {
    expect(questionMediaValidator.safeParse({ url }).success).toBe(false)
  })
})

describe("normalizeLegacyQuizz", () => {
  it("upgrades a quizz written by an older version", () => {
    const legacy = {
      subject: "Old",
      questions: [
        {
          question: "Q",
          answers: ["A", "B"],
          solutions: 1,
          cooldown: 5,
          time: 15,
          options: {},
        },
      ],
    }

    const normalized = normalizeLegacyQuizz(legacy)

    expect(normalized).toMatchObject({
      gameMode: QUIZZ_MODES.QUIZ,
      questions: [
        {
          type: QUESTION_TYPES.SINGLE,
          solutions: [1],
          options: { scoringMode: SCORING_MODES.BALANCED },
        },
      ],
    })
    expect(quizzValidator.safeParse(normalized).success).toBe(true)
  })

  it("leaves estimation options untouched", () => {
    const question = estimationQuestion()
    const normalized = normalizeLegacyQuizz(quizz([question])) as Quizz

    expect(normalized.questions[0].options).toEqual(question.options)
  })

  it("returns unknown data as is", () => {
    expect(normalizeLegacyQuizz("not a quizz")).toBe("not a quizz")
  })
})
