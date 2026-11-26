import type { PGlite } from "@electric-sql/pglite"
import fs from "fs"
import { StatusCodes } from "http-status-codes"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { QuizSaisie } from "@razzia/common/validators/quiz"
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

const saisie = (titre: string, apresPage: number, rang = 0): QuizSaisie => ({
  titre,
  apresPage,
  rang,
  modeAffichage: "STATISTIQUES",
  afficherLeaderboard: true,
  sertNotation: false,
  optionsPartie: { pseudosGeneres: false, reponsesSeulement: false },
  questions: [
    {
      type: "QCM",
      enonce: "Q ?",
      dureeSecondes: 30,
      pointsMax: 1000,
      propositions: [
        { libelle: "A", estCorrecte: true, points: 1000 },
        { libelle: "B", estCorrecte: false, points: 0 },
      ],
      paires: [],
      expressions: [],
      options: {
        delaiLecture: 3,
        penalite: 0,
        modeScore: "STRICT",
        categorie: "",
        note: "",
        media: null,
      },
    },
  ],
})

const page = (numeroPdf: number) => ({ type: "PAGE", numeroPdf }) as const

const quizz = (id: number) => ({ type: "QUIZ", id }) as const

type Element = ReturnType<typeof page> | ReturnType<typeof quizz>

let token = ""

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

const reorganiser = async (ordre: unknown, idCours = 1) => {
  const reponse = await appel(`/cours/${idCours}/deroule`, {
    methode: "PUT",
    corps: { ordre },
  })

  return { statut: reponse.status, corps: (await reponse.json()) as unknown }
}

/** Ordre lu par GET /api/cours/1, sans les positions. */
const ordreLu = async () => {
  const cours = (await (await appel("/cours/1")).json()) as {
    ordre: Array<Element & { position: number }>
  }

  return cours.ordre.map(({ position: _position, ...element }) => element)
}

/** Placement des quiz (apres_page, rang, statut), par identifiant. */
const placements = async () =>
  (
    await contexte.base.query(
      "SELECT id_quiz, apres_page, rang, statut_placement FROM quiz ORDER BY id_quiz",
    )
  ).rows

beforeAll(async () => {
  ;({ token } = await mintToken("manager", SESSION_ROLES.MANAGER))
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
  // Quiz 1 après la page 1, quiz 2 après la page 2.
  await appel("/cours/1/quiz", { methode: "POST", corps: saisie("A", 1) })
  await appel("/cours/1/quiz", { methode: "POST", corps: saisie("B", 2) })
})

afterEach(async () => {
  await contexte.base.close()
  fs.rmSync(getPath("pdf"), { recursive: true, force: true })
})

describe("GET /api/cours/{id} : ordre du déroulé", () => {
  it("déduit l'ordre des pages et de apresPage/rang tant que rien n'est réorganisé", async () => {
    const cours = (await (await appel("/cours/1")).json()) as {
      ordre: unknown
    }

    expect(cours.ordre).toEqual([
      { ...page(1), position: 0 },
      { ...quizz(1), position: 1 },
      { ...page(2), position: 2 },
      { ...quizz(2), position: 3 },
      { ...page(3), position: 4 },
    ])
  })
})

describe("PUT /api/cours/{id}/deroule (SCRUM-17)", () => {
  it("enregistre un ordre avec des pages déplacées et un quiz avant la page 1", async () => {
    const ordre = [quizz(2), page(1), quizz(1), page(3), page(2)]
    const { statut, corps } = await reorganiser(ordre)

    expect(statut).toBe(StatusCodes.OK)
    expect(corps).toEqual({
      ordre: ordre.map((element, position) => ({ ...element, position })),
    })
    expect(await ordreLu()).toEqual(ordre)
    expect(await placements()).toEqual([
      { id_quiz: 1, apres_page: 1, rang: 0, statut_placement: "PLACE" },
      { id_quiz: 2, apres_page: 0, rang: 0, statut_placement: "PLACE" },
    ])
  })

  it("réordonne plusieurs quiz derrière la même page", async () => {
    await reorganiser([page(1), quizz(2), quizz(1), page(2), page(3)])

    expect(await placements()).toEqual([
      { id_quiz: 1, apres_page: 1, rang: 1, statut_placement: "PLACE" },
      { id_quiz: 2, apres_page: 1, rang: 0, statut_placement: "PLACE" },
    ])
  })

  it("garde l'ordre enregistré quand on crée, déplace ou supprime un quiz ensuite", async () => {
    await reorganiser([page(3), page(1), quizz(1), page(2), quizz(2)])

    await appel("/cours/1/quiz", { methode: "POST", corps: saisie("C", 3) })
    expect(await ordreLu()).toEqual([
      page(3),
      quizz(3),
      page(1),
      quizz(1),
      page(2),
      quizz(2),
    ])

    await appel("/quiz/1", { methode: "PUT", corps: saisie("A", 2) })
    expect(await ordreLu()).toEqual([
      page(3),
      quizz(3),
      page(1),
      page(2),
      quizz(1),
      quizz(2),
    ])

    await appel("/quiz/2?forcer=true", { methode: "DELETE" })
    expect(await ordreLu()).toEqual([
      page(3),
      quizz(3),
      page(1),
      page(2),
      quizz(1),
    ])
  })

  it("replace un quiz mis de côté qui revient dans le déroulé", async () => {
    await contexte.base.exec(
      "UPDATE quiz SET statut_placement = 'MIS_DE_COTE', apres_page = NULL, ordre_mise_de_cote = 0 WHERE id_quiz = 2",
    )
    await reorganiser([page(1), quizz(1), page(2), page(3), quizz(2)])

    expect((await placements()).at(1)).toEqual({
      id_quiz: 2,
      apres_page: 3,
      rang: 0,
      statut_placement: "PLACE",
    })
  })

  it.each([
    {
      cas: "une page hors du PDF",
      ordre: [page(1), quizz(1), page(2), quizz(2), page(4)],
      cle: "errors:deroule.pageInvalide",
    },
    {
      cas: "une page manquante",
      ordre: [page(1), quizz(1), page(2), quizz(2)],
      cle: "errors:deroule.pageManquante",
    },
    {
      cas: "une page en double",
      ordre: [page(1), quizz(1), page(2), quizz(2), page(3), page(3)],
      cle: "errors:deroule.doublon",
    },
    {
      cas: "un quiz en double",
      ordre: [page(1), quizz(1), quizz(1), page(2), quizz(2), page(3)],
      cle: "errors:deroule.doublon",
    },
    {
      cas: "un quiz d'un autre cours",
      ordre: [page(1), quizz(1), page(2), quizz(2), page(3), quizz(9)],
      cle: "errors:deroule.quizInconnu",
    },
    {
      cas: "un quiz placé manquant",
      ordre: [page(1), quizz(1), page(2), page(3)],
      cle: "errors:deroule.quizManquant",
    },
    {
      cas: "un type inconnu",
      ordre: [page(1), { type: "VIDEO", id: 1 }],
      cle: "errors:deroule.typeInconnu",
    },
  ])("refuse $cas", async ({ ordre, cle }) => {
    expect(await reorganiser(ordre)).toEqual({
      statut: StatusCodes.BAD_REQUEST,
      corps: { error: cle },
    })
    expect(await ordreLu()).toEqual([
      page(1),
      quizz(1),
      page(2),
      quizz(2),
      page(3),
    ])
  })

  it("refuse un champ inconnu, un cours inexistant et le cours d'un autre enseignant", async () => {
    await contexte.base.exec(`
      INSERT INTO utilisateur(login, nom, prenom, role) VALUES ('collegue', 'C', 'C', 'ENSEIGNANT');
      INSERT INTO cours(titre, id_proprietaire) SELECT 'Privé', id_utilisateur FROM utilisateur WHERE login = 'collegue';
    `)

    expect((await reorganiser([{ ...page(1), position: 7 }])).statut).toBe(
      StatusCodes.BAD_REQUEST,
    )
    expect((await reorganiser([], 9)).statut).toBe(StatusCodes.NOT_FOUND)
    expect((await reorganiser([], 2)).statut).toBe(StatusCodes.FORBIDDEN)
  })

  it("refuse pendant qu'une question du cours est ouverte en séance", async () => {
    await contexte.base.exec(`
      INSERT INTO seance(id_version, id_animateur, code_acces)
        SELECT 1, id_utilisateur, '482913' FROM utilisateur WHERE login = 'enseignant';
      INSERT INTO lancement(id_seance, id_question, date_cloture_prevue) VALUES (1, 1, now());
    `)

    expect(
      await reorganiser([page(1), quizz(1), page(2), quizz(2), page(3)]),
    ).toEqual({
      statut: StatusCodes.CONFLICT,
      corps: { error: "errors:seance.questionOuverte" },
    })
  })

  it("ne garde rien d'un enregistrement qui échoue en cours de route", async () => {
    await reorganiser([page(1), quizz(1), page(2), quizz(2), page(3)])
    // Le recalcul de apres_page échouera après l'écriture de l'ordre.
    await contexte.base.exec(
      "ALTER TABLE quiz ADD CONSTRAINT test_echec CHECK (apres_page <> 3)",
    )

    const { statut } = await reorganiser([
      page(1),
      page(2),
      page(3),
      quizz(1),
      quizz(2),
    ])

    expect(statut).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
    expect(await ordreLu()).toEqual([
      page(1),
      quizz(1),
      page(2),
      quizz(2),
      page(3),
    ])
  })
})
