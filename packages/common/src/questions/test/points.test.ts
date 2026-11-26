import { describe, expect, it } from "vitest"
import { QUESTION_TYPES, QUIZZ_MODES } from "@razzia/common/constants"
import { repartirPoints } from "@razzia/common/questions/points"
import { quizzValidator } from "@razzia/common/validators/quizz"

const somme = (points: number[]) => points.reduce((a, b) => a + b, 0)

describe("repartirPoints", () => {
  it("donne tout le maximum à une seule bonne réponse", () => {
    expect(repartirPoints(4, [2], 1000)).toEqual([0, 0, 1000, 0])
  })

  it("partage le maximum à parts égales entre les bonnes réponses", () => {
    expect(repartirPoints(4, [0, 3], 1000)).toEqual([500, 0, 0, 500])
  })

  it("donne le reste aux premières bonnes réponses, dans l'ordre", () => {
    const points = repartirPoints(4, [3, 0, 1], 10)

    expect(points).toEqual([4, 3, 0, 3])
    expect(somme(points)).toBe(10)
  })

  it("ne dépasse jamais le maximum quand il suffit", () => {
    for (let max = 3; max <= 50; max += 1) {
      expect(somme(repartirPoints(6, [0, 2, 5], max))).toBe(max)
    }
  })

  it("garde au moins 1 point par bonne réponse si le maximum est trop petit", () => {
    expect(repartirPoints(3, [0, 1], 1)).toEqual([1, 1, 0])
  })

  it("ignore les doublons et les indices hors des propositions", () => {
    expect(repartirPoints(2, [1, 1, 5, -1], 7)).toEqual([0, 7])
  })

  it("produit un barème accepté par le validateur", () => {
    const answers = ["A", "B", "C", "D"]
    const solutions = [0, 1, 3]

    const result = quizzValidator.safeParse({
      gameMode: QUIZZ_MODES.QUIZ,
      subject: "Barème",
      questions: [
        {
          type: QUESTION_TYPES.MULTI,
          question: "Question ?",
          answers,
          solutions,
          answerPoints: repartirPoints(answers.length, solutions, 100),
          maxPoints: 100,
          cooldown: 5,
          time: 20,
        },
      ],
    })

    expect(result.success).toBe(true)
  })
})
