import { describe, expect, it } from "vitest"
import { QUESTION_TYPES } from "@razzia/common/constants"
import {
  evaluerQcm,
  pointsClassement,
  type QuestionNotee,
} from "@razzia/socket/services/score"
import { scoreQuestion } from "@razzia/socket/services/scoring/round"
import { createQuestion } from "@razzia/socket/test/fixtures"

const question: QuestionNotee = {
  pointsMax: 1000,
  dureeMs: 30_000,
  modeScore: "INDULGENT",
  propositions: [
    { idProposition: 11, points: 600, estCorrecte: true },
    { idProposition: 12, points: 0, estCorrecte: false },
    { idProposition: 13, points: 400, estCorrecte: true },
  ],
}

// Deux bonnes réponses sur quatre, 500 points chacune.
const qcm = (modeScore: QuestionNotee["modeScore"]): QuestionNotee => ({
  pointsMax: 1000,
  dureeMs: 30_000,
  modeScore,
  propositions: [
    { idProposition: 1, points: 500, estCorrecte: true },
    { idProposition: 2, points: 0, estCorrecte: false },
    { idProposition: 3, points: 500, estCorrecte: true },
    { idProposition: 4, points: 0, estCorrecte: false },
  ],
})

const pointsEn = (modeScore: QuestionNotee["modeScore"], indices: number[]) =>
  evaluerQcm(qcm(modeScore), indices, 0)?.pointsReponse

describe("ScoreService (CU 2.3)", () => {
  it("reprend l'exemple du dossier : 1 000 points, 18,72 s restantes sur 30 s → 1 624", () => {
    expect(pointsClassement(1000, 18_720, 30_000)).toBe(1624)
  })

  it("double les points d'une réponse immédiate et garde ceux de la dernière seconde", () => {
    expect(pointsClassement(500, 30_000, 30_000)).toBe(1000)
    expect(pointsClassement(500, 0, 30_000)).toBe(500)
    expect(pointsClassement(500, -5, 30_000)).toBe(500)
  })

  it("additionne les points des propositions cochées", () => {
    expect(evaluerQcm(question, [0, 2], 15_000)).toEqual({
      contenu: [11, 13],
      pointsReponse: 1000,
      tauxReussite: 1,
      pointsClassement: 1500,
    })
    expect(evaluerQcm(question, [0, 1], 0)).toMatchObject({
      contenu: [11, 12],
      pointsReponse: 600,
      tauxReussite: 0.6,
    })
  })

  it("ramène la somme entre 0 et points_max", () => {
    const largesse = {
      ...question,
      propositions: [
        { idProposition: 1, points: 800, estCorrecte: true },
        { idProposition: 2, points: 800, estCorrecte: true },
      ],
    }

    expect(evaluerQcm(largesse, [0, 1], 0)?.pointsReponse).toBe(1000)
    expect(evaluerQcm(question, [], 0)?.pointsReponse).toBe(0)
  })

  it.each([["STRICT"], ["EQUILIBRE"], ["INDULGENT"]] as const)(
    "donne le maximum à un sans-faute en mode %s",
    (mode) => {
      expect(pointsEn(mode, [0, 2])).toBe(1000)
    },
  )

  it.each([["STRICT"], ["EQUILIBRE"]] as const)(
    "ne donne rien à qui coche tout en mode %s",
    (mode) => {
      expect(pointsEn(mode, [0, 1, 2, 3])).toBe(0)
    },
  )

  it("donne le maximum à qui coche tout en mode INDULGENT", () => {
    expect(pointsEn("INDULGENT", [0, 1, 2, 3])).toBe(1000)
  })

  it("ne donne rien en mode STRICT sans toutes les bonnes réponses", () => {
    expect(pointsEn("STRICT", [0])).toBe(0)
  })

  it("retire une bonne réponse moyenne par mauvaise réponse en mode EQUILIBRE", () => {
    expect(pointsEn("EQUILIBRE", [0])).toBe(500)
    expect(pointsEn("EQUILIBRE", [0, 2, 1])).toBe(500)
    expect(pointsEn("EQUILIBRE", [0, 1])).toBe(0)
  })

  it("garde les points d'une bonne réponse cochée en mode INDULGENT", () => {
    expect(pointsEn("INDULGENT", [0, 1])).toBe(500)
  })

  it("fait classer le moteur avec les points IQ tels quels", () => {
    const joueur = (id: string) => ({
      id,
      clientId: id,
      connected: true,
      username: id,
      points: 0,
      streak: 0,
    })
    const classes = scoreQuestion(
      createQuestion({
        type: QUESTION_TYPES.MULTI,
        answers: ["A", "B"],
        solutions: [0],
        penalty: 100,
      }),
      [joueur("a"), joueur("b"), joueur("c")],
      [
        { playerId: "a", answerIds: [1], points: 1624, pointsFixes: true },
        { playerId: "b", answerIds: [1], points: 0, pointsFixes: true },
      ],
    )

    expect(
      classes.map(({ id, points, lastCorrect, lastPoints }) => ({
        id,
        points,
        lastCorrect,
        // Razzia donne -0 à qui n'a pas répondu.
        lastPoints: lastPoints + 0,
      })),
    ).toEqual([
      // Proposition « fausse » pour Razzia, mais 1 624 points IQ : la réponse compte.
      { id: "a", points: 1624, lastCorrect: true, lastPoints: 1624 },
      { id: "b", points: 0, lastCorrect: false, lastPoints: -100 },
      { id: "c", points: 0, lastCorrect: false, lastPoints: 0 },
    ])
  })

  it.each([[[3]], [[-1]], [[0, 0]], [[0.5]]])(
    "refuse le contenu mal formé %o",
    (indices) => {
      expect(evaluerQcm(question, indices, 0)).toBeNull()
    },
  )
})
