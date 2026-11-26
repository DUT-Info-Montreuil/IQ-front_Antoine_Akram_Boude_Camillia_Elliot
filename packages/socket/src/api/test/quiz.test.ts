import type { PGlite } from "@electric-sql/pglite"
import fs from "fs"
import { StatusCodes } from "http-status-codes"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { QuestionSaisie, QuizSaisie } from "@razzia/common/validators/quiz"
import { SESSION_ROLES } from "@razzia/common/constants"
import { app } from "@razzia/socket/app"
import { mintToken } from "@razzia/socket/services/auth"
import { getPath } from "@razzia/socket/services/config"
import { creerBaseTest } from "@razzia/socket/test/db"

const PDF_3_PAGES = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R]/Count 3>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "5 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n"),
)

const OPTIONS = {
  delaiLecture: 3,
  penalite: 0,
  modeScore: "STRICT",
  categorie: "",
  note: "",
  media: null,
} as const

const qcm = (overrides: Partial<QuestionSaisie> = {}): QuestionSaisie => ({
  type: "QCM",
  enonce: "Quel modèle stocke des paires clé-valeur ?",
  dureeSecondes: 30,
  pointsMax: 1000,
  propositions: [
    { libelle: "Clé-valeur", estCorrecte: true, points: 1000 },
    { libelle: "Graphe", estCorrecte: false, points: 0 },
  ],
  paires: [],
  expressions: [],
  options: OPTIONS,
  ...overrides,
})

const saisie = (overrides: Partial<QuizSaisie> = {}): QuizSaisie => ({
  titre: "Quiz 1 – Modèle clé-valeur",
  apresPage: 1,
  rang: 0,
  modeAffichage: "STATISTIQUES",
  afficherLeaderboard: true,
  sertNotation: false,
  optionsPartie: { pseudosGeneres: false, reponsesSeulement: false },
  questions: [qcm()],
  ...overrides,
})

let token = ""
let playerToken = ""

/** Base PGlite du test en cours, recréée avant chaque test. */
const contexte = {} as { base: PGlite }

const appel = (
  chemin: string,
  { methode = "GET", corps }: { methode?: string; corps?: unknown } = {},
) =>
  app.request(`/api${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })

const creer = async (corps: QuizSaisie = saisie()) => {
  const reponse = await appel("/cours/1/quiz", { methode: "POST", corps })

  return { statut: reponse.status, corps: (await reponse.json()) as unknown }
}

const deroule = async () => {
  const cours = (await (await appel("/cours/1")).json()) as {
    deroule: Array<{ id: number; apresPage: number; rang: number }>
  }

  return cours.deroule.map(({ id, apresPage, rang }) => ({
    id,
    apresPage,
    rang,
  }))
}

/** Une séance où la première question du quiz 1 a été lancée, avec une réponse. */
const jouerQuiz1 = (statutLancement: "OUVERTE" | "CLOSE") =>
  contexte.base.exec(`
    INSERT INTO seance(id_version, id_animateur, code_acces)
      SELECT 1, id_utilisateur, '482913' FROM utilisateur WHERE login = 'enseignant';
    INSERT INTO utilisateur(login, nom, prenom, role) VALUES ('lacle', 'X', 'Y', 'ETUDIANT');
    INSERT INTO participation(id_seance, id_etudiant, pseudo)
      SELECT 1, id_utilisateur, 'LaClé' FROM utilisateur WHERE login = 'lacle';
    INSERT INTO lancement(id_seance, id_question, date_cloture_prevue, statut)
      VALUES (1, 1, now(), '${statutLancement}');
    INSERT INTO reponse(id_lancement, id_participation, contenu, temps_restant_ms)
      VALUES (1, 1, '[0]', 18720);
  `)

beforeAll(async () => {
  ;({ token } = await mintToken("manager", SESSION_ROLES.MANAGER))
  ;({ token: playerToken } = await mintToken("player", SESSION_ROLES.PLAYER))
})

beforeEach(async () => {
  contexte.base = await creerBaseTest()

  const form = new FormData()

  form.append("fichier", new File([new Uint8Array(PDF_3_PAGES)], "c.pdf"))
  form.append("titre", "R5.A.10")
  await app.request("/api/cours", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
})

afterEach(async () => {
  await contexte.base.close()
  fs.rmSync(getPath("pdf"), { recursive: true, force: true })
})

describe("POST /api/cours/{id}/quiz (CU 1.3)", () => {
  it("enregistre le quiz et le renvoie tel que saisi", async () => {
    const { statut, corps } = await creer()

    expect(statut).toBe(StatusCodes.CREATED)
    expect(corps).toEqual({ ...saisie(), id: 1, idCours: 1 })
  })

  it("garde les trois types de question et leurs options", async () => {
    const questions: QuestionSaisie[] = [
      qcm({ options: { ...OPTIONS, penalite: 100, categorie: "NoSQL" } }),
      qcm({
        type: "RELIER",
        propositions: [],
        paires: [
          { gauche: "Redis", droite: "Clé-valeur" },
          { gauche: "Neo4j", droite: "Graphe" },
        ],
      }),
      qcm({
        type: "LIBRE",
        propositions: [],
        expressions: [{ motif: "^cl[eé].?valeur$", points: 1000 }],
        options: {
          ...OPTIONS,
          media: { type: "IMAGE", url: "/media/schema.png" },
        },
      }),
      qcm({ type: "LIBRE", propositions: [], expressions: [] }),
    ]

    await creer(saisie({ questions }))

    expect(await (await appel("/quiz/1")).json()).toMatchObject({ questions })
  })

  it("ajoute nbQuestions et dureeSecondes aux cartes du déroulé (E3)", async () => {
    await creer(saisie({ questions: [qcm(), qcm({ dureeSecondes: 45 })] }))

    expect(await (await appel("/cours/1")).json()).toMatchObject({
      nbQuiz: 1,
      deroule: [{ type: "QUIZ", id: 1, nbQuestions: 2, dureeSecondes: 75 }],
    })
  })

  it.each([
    [{ titre: " " }, "errors:quiz.titreVide"],
    [{ questions: [] }, "errors:quiz.aucuneQuestion"],
    [
      {
        questions: [
          qcm({
            propositions: [
              { libelle: "A", estCorrecte: false, points: 0 },
              { libelle: "B", estCorrecte: false, points: 0 },
            ],
          }),
        ],
      },
      "errors:quiz.aucuneBonneReponse",
    ],
    [
      { questions: [qcm({ dureeSecondes: 4 })] },
      "errors:quiz.dureeHorsLimites",
    ],
    [
      {
        questions: [
          qcm({ type: "LIBRE", expressions: [{ motif: "(", points: 1 }] }),
        ],
      },
      "errors:quiz.expressionInvalide",
    ],
    [{ apresPage: 4 }, "errors:quiz.positionInvalide"],
    [
      {
        questions: [
          qcm({
            pointsMax: 10,
            propositions: [
              { libelle: "A", estCorrecte: true, points: 10 },
              { libelle: "B", estCorrecte: true, points: 10 },
            ],
          }),
        ],
      },
      "errors:quiz.sommePointsSuperieureMax",
    ],
  ] as Array<[Partial<QuizSaisie>, string]>)(
    "refuse %o",
    async (overrides, erreur) => {
      expect(await creer(saisie(overrides))).toEqual({
        statut: StatusCodes.BAD_REQUEST,
        corps: { error: erreur },
      })
    },
  )

  it("insère le quiz à son rang et décale ceux de la même page", async () => {
    await creer(saisie({ titre: "A" }))
    await creer(saisie({ titre: "B" }))
    await creer(saisie({ titre: "C", rang: 1 }))
    await creer(saisie({ titre: "D", apresPage: 2, rang: 5 }))
    // « En dernier » : l'éditeur E4 envoie Number.MAX_SAFE_INTEGER.
    await creer(saisie({ titre: "E", rang: Number.MAX_SAFE_INTEGER }))

    expect(await deroule()).toEqual([
      { id: 2, apresPage: 1, rang: 0 },
      { id: 3, apresPage: 1, rang: 1 },
      { id: 1, apresPage: 1, rang: 2 },
      { id: 5, apresPage: 1, rang: 3 },
      { id: 4, apresPage: 2, rang: 0 },
    ])
  })

  it("répond 404 pour un cours inconnu et 401 sans compte enseignant", async () => {
    const inconnu = await appel("/cours/9/quiz", {
      methode: "POST",
      corps: saisie(),
    })

    token = playerToken

    const joueur = await appel("/cours/1/quiz", {
      methode: "POST",
      corps: saisie(),
    })

    ;({ token } = await mintToken("manager", SESSION_ROLES.MANAGER))

    expect(inconnu.status).toBe(StatusCodes.NOT_FOUND)
    expect(joueur.status).toBe(StatusCodes.UNAUTHORIZED)
  })
})

describe("GET, PUT, DELETE /api/quiz/{id}", () => {
  it("répond 404 pour un quiz inconnu", async () => {
    const reponse = await appel("/quiz/9")

    expect(reponse.status).toBe(StatusCodes.NOT_FOUND)
    expect(await reponse.json()).toEqual({ error: "errors:quiz.introuvable" })
  })

  it("remplace le contenu du quiz et le déplace", async () => {
    await creer(saisie({ titre: "A" }))
    await creer(saisie({ titre: "B" }))

    const modifie = saisie({
      titre: "B modifié",
      apresPage: 3,
      questions: [qcm({ enonce: "Nouvelle question" })],
    })
    const reponse = await appel("/quiz/1", { methode: "PUT", corps: modifie })

    expect(reponse.status).toBe(StatusCodes.OK)
    expect(await reponse.json()).toEqual({ ...modifie, id: 1, idCours: 1 })
    expect(await deroule()).toEqual([
      { id: 2, apresPage: 1, rang: 0 },
      { id: 1, apresPage: 3, rang: 0 },
    ])
  })

  it("supprime le quiz, ses questions, et recale les rangs", async () => {
    await creer(saisie({ titre: "A" }))
    await creer(saisie({ titre: "B" }))

    const reponse = await appel("/quiz/2?forcer=true", { methode: "DELETE" })

    expect(reponse.status).toBe(StatusCodes.NO_CONTENT)
    expect(await deroule()).toEqual([{ id: 1, apresPage: 1, rang: 0 }])
    expect(
      (await contexte.base.query("SELECT id_question FROM question")).rows,
    ).toHaveLength(1)
  })

  it("refuse de modifier un quiz déjà joué, ou dont une question est ouverte", async () => {
    await creer()
    await jouerQuiz1("CLOSE")

    const joue = await appel("/quiz/1", { methode: "PUT", corps: saisie() })

    await contexte.base.exec("UPDATE lancement SET statut = 'OUVERTE'")

    const ouvert = await appel("/quiz/1", { methode: "PUT", corps: saisie() })

    expect([joue.status, await joue.json()]).toEqual([
      StatusCodes.CONFLICT,
      { error: "errors:seance.quizDejaJoue" },
    ])
    expect([ouvert.status, await ouvert.json()]).toEqual([
      StatusCodes.CONFLICT,
      { error: "errors:seance.questionOuverte" },
    ])
  })

  it("ne supprime un quiz qui a des réponses qu'avec forcer=true", async () => {
    await creer()
    await jouerQuiz1("CLOSE")

    const refuse = await appel("/quiz/1", { methode: "DELETE" })
    const force = await appel("/quiz/1?forcer=true", { methode: "DELETE" })

    expect([refuse.status, await refuse.json()]).toEqual([
      StatusCodes.CONFLICT,
      { error: "errors:seance.reponsesExistantes" },
    ])
    expect(force.status).toBe(StatusCodes.NO_CONTENT)
    expect(
      (
        await contexte.base.query(
          "SELECT (SELECT count(*) FROM reponse)::int AS reponses, (SELECT count(*) FROM lancement)::int AS lancements",
        )
      ).rows,
    ).toEqual([{ reponses: 0, lancements: 0 }])
  })
})
