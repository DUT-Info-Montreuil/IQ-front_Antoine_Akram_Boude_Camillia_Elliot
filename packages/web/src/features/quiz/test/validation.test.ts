import { describe, expect, it } from "vitest"
import type {
  QuestionSaisie,
  QuizSaisie,
} from "@razzia/web/features/quiz/types"
import {
  changerType,
  evaluerReponseLibre,
  formaterDuree,
  nettoyerQuestion,
  normaliserReponse,
  nouveauQuiz,
  nouvelleQuestion,
  repartirPoints,
  validerQuiz,
} from "@razzia/web/features/quiz/validation"

const question = (changements: Partial<QuestionSaisie>): QuestionSaisie => ({
  ...nouvelleQuestion(),
  enonce: "Énoncé",
  ...changements,
})

const quizAvec = (q: QuestionSaisie): QuizSaisie => ({
  ...nouveauQuiz(3),
  titre: "Bases clé-valeur",
  questions: [q],
})

const qcmValide = () =>
  question({
    propositions: [
      { libelle: "Clé-valeur", estCorrecte: true, points: 1000 },
      { libelle: "Orienté documents", estCorrecte: false, points: 0 },
    ],
  })

const cles = (saisie: QuizSaisie) => validerQuiz(saisie).map((e) => e.cle)

describe("validerQuiz — quiz et QCM", () => {
  it("accepte un quiz complet", () => {
    expect(validerQuiz(quizAvec(qcmValide()))).toEqual([])
  })

  it("exige un titre et au moins une question", () => {
    expect(
      cles({ ...quizAvec(qcmValide()), titre: " ", questions: [] }),
    ).toEqual(["errors:quiz.titreVide", "errors:quiz.aucuneQuestion"])
  })

  it("borne la durée entre 5 et 300 s", () => {
    expect(cles(quizAvec({ ...qcmValide(), dureeSecondes: 4 }))).toContain(
      "errors:quiz.dureeHorsLimites",
    )
    expect(cles(quizAvec({ ...qcmValide(), dureeSecondes: 301 }))).toContain(
      "errors:quiz.dureeHorsLimites",
    )
  })

  it("exige deux propositions dont une bonne réponse avec des points", () => {
    expect(
      cles(
        quizAvec(
          question({
            propositions: [{ libelle: "Seule", estCorrecte: false, points: 0 }],
          }),
        ),
      ),
    ).toEqual([
      "errors:quiz.tropPeuPropositions",
      "errors:quiz.aucuneBonneReponse",
    ])

    expect(
      cles(
        quizAvec(
          question({
            propositions: [
              { libelle: "A", estCorrecte: true, points: 0 },
              { libelle: "B", estCorrecte: false, points: 0 },
            ],
          }),
        ),
      ),
    ).toEqual(["errors:quiz.bonneReponseSansPoints"])
  })

  it("refuse des points au-delà du maximum de la question", () => {
    const q = qcmValide()

    q.propositions[0].points = 1500
    expect(validerQuiz(quizAvec(q))).toEqual([
      {
        chemin: ["questions", 0, "propositions", 0, "points"],
        cle: "errors:quiz.pointsSuperieursMax",
      },
    ])
  })
})

describe("validerQuiz — points à relier", () => {
  it("accepte deux paires complètes", () => {
    const q = question({
      type: "RELIER",
      paires: [
        { gauche: "Redis", droite: "Clé-valeur" },
        { gauche: "MongoDB", droite: "Documents" },
      ],
    })

    expect(validerQuiz(quizAvec(q))).toEqual([])
  })

  it("signale une paire incomplète ou en double", () => {
    const q = question({
      type: "RELIER",
      paires: [
        { gauche: "Redis", droite: "" },
        { gauche: "redis ", droite: "Documents" },
      ],
    })

    expect(validerQuiz(quizAvec(q))).toEqual([
      {
        chemin: ["questions", 0, "paires", 0, "droite"],
        cle: "errors:quiz.paireIncomplete",
      },
      {
        chemin: ["questions", 0, "paires", 1, "gauche"],
        cle: "errors:quiz.paireEnDouble",
      },
    ])
  })

  it("exige au moins deux paires", () => {
    const q = question({
      type: "RELIER",
      paires: [{ gauche: "A", droite: "B" }],
    })

    expect(cles(quizAvec(q))).toEqual(["errors:quiz.tropPeuPaires"])
  })
})

describe("validerQuiz — réponse libre", () => {
  it("accepte une question sans expression (correction à la main)", () => {
    expect(
      validerQuiz(quizAvec(question({ type: "LIBRE", expressions: [] }))),
    ).toEqual([])
  })

  it("refuse une expression vide, invalide ou trop payée", () => {
    const q = question({
      type: "LIBRE",
      expressions: [
        { motif: "", points: 100 },
        { motif: "cle(valeur", points: 100 },
        { motif: "redis", points: 2000 },
      ],
    })

    expect(cles(quizAvec(q))).toEqual([
      "errors:quiz.expressionVide",
      "errors:quiz.expressionInvalide",
      "errors:quiz.pointsSuperieursMax",
    ])
  })

  it("n'applique que les règles du type choisi", () => {
    const q = question({
      type: "LIBRE",
      propositions: [{ libelle: "", estCorrecte: false, points: 0 }],
      expressions: [{ motif: "redis", points: 1000 }],
    })

    expect(validerQuiz(quizAvec(q))).toEqual([])
  })
})

describe("réponse libre : correction", () => {
  const expressions = [
    { motif: "^cle[- ]?valeur$", points: 1000 },
    { motif: "valeur", points: 400 },
  ]

  it("nettoie la réponse (minuscules, accents, espaces)", () => {
    expect(normaliserReponse("  Clé   VALEUR ")).toBe("cle valeur")
  })

  it("donne les points de la meilleure expression reconnue", () => {
    expect(evaluerReponseLibre(expressions, "Clé-Valeur")).toBe(1000)
    expect(evaluerReponseLibre(expressions, "une valeur")).toBe(400)
    expect(evaluerReponseLibre(expressions, "graphe")).toBeNull()
  })
})

describe("validerQuiz — barème QCM", () => {
  it("refuse des bonnes réponses dont la somme dépasse le maximum", () => {
    const qcm = question({
      pointsMax: 10,
      propositions: [
        { libelle: "A", estCorrecte: true, points: 10 },
        { libelle: "B", estCorrecte: true, points: 10 },
      ],
    })

    expect(cles(quizAvec(qcm))).toEqual([
      "errors:quiz.sommePointsSuperieureMax",
    ])
  })

  it("refuse en français un champ de points vidé", () => {
    const qcm = question({
      propositions: [
        { libelle: "A", estCorrecte: true, points: Number.NaN },
        { libelle: "B", estCorrecte: false, points: 0 },
      ],
    })

    expect(cles(quizAvec(qcm))).toContain("errors:quiz.pointsEntiers")
    expect(cles(quizAvec(qcm)).every((cle) => cle.startsWith("errors:"))).toBe(
      true,
    )
  })

  it("accepte le barème réparti par défaut", () => {
    const qcm = question({
      pointsMax: 10,
      propositions: repartirPoints(
        [
          { libelle: "A", estCorrecte: true, points: 0 },
          { libelle: "B", estCorrecte: true, points: 0 },
          { libelle: "C", estCorrecte: true, points: 0 },
        ],
        10,
      ),
    })

    expect(validerQuiz(quizAvec(qcm))).toEqual([])
  })
})

describe("saisie", () => {
  it("répartit les points QCM sur les bonnes réponses", () => {
    const propositions = repartirPoints(
      [
        { libelle: "A", estCorrecte: true, points: 0 },
        { libelle: "B", estCorrecte: false, points: 300 },
        { libelle: "C", estCorrecte: true, points: 0 },
      ],
      1001,
    )

    expect(propositions.map((p) => p.points)).toEqual([501, 0, 500])
  })

  it("prépare une expression en passant en réponse libre et n'envoie que le type choisi", () => {
    const libre = changerType(qcmValide(), "LIBRE")

    expect(libre.expressions).toEqual([{ motif: "", points: 1000 }])
    expect(nettoyerQuestion(libre)).toMatchObject({
      propositions: [],
      paires: [],
    })
  })

  it("affiche secondes et minutes", () => {
    expect(formaterDuree(45)).toBe("45 s")
    expect(formaterDuree(150)).toBe("2 min 30")
    expect(formaterDuree(120)).toBe("2 min")
  })
})

describe("validerQuiz — options avancées (moteur Razzia)", () => {
  it("borne le délai de lecture et la pénalité", () => {
    const q = qcmValide()

    q.options = { ...q.options, delaiLecture: 2, penalite: 5000 }
    expect(cles(quizAvec(q))).toEqual([
      "errors:quiz.delaiHorsLimites",
      "errors:quiz.pointsSuperieursMax",
    ])
  })

  it("accepte un média de la médiathèque ou une adresse https", () => {
    const q = qcmValide()

    q.options = {
      ...q.options,
      media: { type: "IMAGE", url: "/media/schema.png" },
    }
    expect(validerQuiz(quizAvec(q))).toEqual([])

    q.options = {
      ...q.options,
      media: { type: "VIDEO", url: "javascript:alert(1)" },
    }
    expect(cles(quizAvec(q))).toEqual(["errors:quiz.mediaInvalide"])
  })
})
