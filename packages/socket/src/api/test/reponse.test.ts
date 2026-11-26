import type { PGlite } from "@electric-sql/pglite"
import fs from "fs"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { Socket } from "@razzia/common/types/game/socket"
import type { QuestionSaisie, QuizSaisie } from "@razzia/common/validators/quiz"
import type { CrochetsQuestion } from "@razzia/socket/services/game/round-manager"
import { EVENTS, SESSION_ROLES } from "@razzia/common/constants"
import { app } from "@razzia/socket/app"
import { mintToken } from "@razzia/socket/services/auth"
import { getPath } from "@razzia/socket/services/config"
import Game from "@razzia/socket/services/game"
import { setIo } from "@razzia/socket/services/io"
import Registry from "@razzia/socket/services/registry"
import { repondre } from "@razzia/socket/services/reponse"
import {
  ouvrirQuiz,
  viderSeancesOuvertes,
} from "@razzia/socket/services/seance"
import { creerBaseTest } from "@razzia/socket/test/db"
import { createFakeIo } from "@razzia/socket/test/fake-io"

const PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n"),
)

const OPTIONS = {
  delaiLecture: 3,
  penalite: 0,
  // Points partiels : bonnes réponses cochées moins les mauvaises.
  modeScore: "EQUILIBRE",
  categorie: "",
  note: "",
  media: null,
} as const

/** QCM de 30 s : A (600) et C (400) justes, B fausse. */
const QCM: QuestionSaisie = {
  type: "QCM",
  enonce: "Quels modèles sont NoSQL ?",
  dureeSecondes: 30,
  pointsMax: 1000,
  propositions: [
    { libelle: "Clé-valeur", estCorrecte: true, points: 600 },
    { libelle: "Relationnel", estCorrecte: false, points: 0 },
    { libelle: "Document", estCorrecte: true, points: 400 },
  ],
  paires: [],
  expressions: [],
  options: OPTIONS,
}

const quiz: QuizSaisie = {
  titre: "Quiz 1",
  apresPage: 1,
  rang: 0,
  modeAffichage: "CLASSEMENT",
  afficherLeaderboard: true,
  sertNotation: true,
  optionsPartie: { pseudosGeneres: false, reponsesSeulement: false },
  questions: [QCM, { ...QCM, enonce: "Deuxième question" }],
}

const ANIMATEUR = { clientId: "manager", role: SESSION_ROLES.MANAGER }

let token = ""

const contexte = {} as {
  base: PGlite
  fake: ReturnType<typeof createFakeIo>
  partie: Game
  crochets: CrochetsQuestion
  selectAnswer: ReturnType<typeof vi.spyOn>
}

const appel = (chemin: string, corps?: unknown) =>
  app.request(`/api${chemin}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })

const etudiant = (clientId: string, pseudo: string) => {
  const socket = contexte.fake.createSocket(`socket-${clientId}`, clientId)

  socket.data.role = SESSION_ROLES.PLAYER
  contexte.partie.join(socket, pseudo)

  return socket
}

/** Ouvre la question d'indice donné comme le ferait le moteur au passage en SELECT_ANSWER. */
const ouvrirQuestion = async (indice = 0) => {
  Object.defineProperty(contexte.partie, "accepteReponses", {
    value: true,
    configurable: true,
  })
  await contexte.crochets.ouverture?.(indice)
}

const fermerQuestion = async () => {
  Object.defineProperty(contexte.partie, "accepteReponses", {
    value: false,
    configurable: true,
  })
  await contexte.crochets.cloture?.(0)
}

const erreur = (socket: Socket) =>
  contexte.fake.lastEvent(socket.id, EVENTS.GAME.ERROR_MESSAGE)?.data

const lignes = async (sql: string) =>
  (await contexte.base.query<Record<string, unknown>>(sql)).rows

beforeAll(async () => {
  ;({ token } = await mintToken("manager", SESSION_ROLES.MANAGER))
})

beforeEach(async () => {
  contexte.base = await creerBaseTest()
  contexte.fake = createFakeIo()
  Object.assign(contexte.fake.io, { sockets: { sockets: new Map() } })
  setIo(contexte.fake.io)

  const form = new FormData()

  form.append("fichier", new File([new Uint8Array(PDF)], "c.pdf"))
  form.append("titre", "R5.A.10")
  await app.request("/api/cours", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  await appel("/cours/1/quiz", quiz)

  const setCrochets = vi.spyOn(Game.prototype, "setCrochets")

  contexte.selectAnswer = vi.spyOn(Game.prototype, "selectAnswer")

  const { idSeance } = (await (
    await appel("/seances", { idCours: 1 })
  ).json()) as {
    idSeance: number
  }
  const { gameId } = await ouvrirQuiz({ idSeance, idQuiz: 1 }, ANIMATEUR)

  const partie = Registry.getInstance().getGameById(gameId)

  if (!partie) {
    throw new Error("Partie de la séance introuvable")
  }

  contexte.partie = partie
  ;[[contexte.crochets]] = setCrochets.mock.calls
})

afterEach(async () => {
  vi.restoreAllMocks()
  viderSeancesOuvertes()

  for (const game of Registry.getInstance().getAllGames()) {
    Registry.getInstance().removeGame(game.gameId)
  }

  await contexte.base.close()
  fs.rmSync(getPath("pdf"), { recursive: true, force: true })
})

describe("lancements (CU 2.1, étapes 4 et 6)", () => {
  it("enregistre l'ouverture avec sa clôture prévue, puis la clôture", async () => {
    const avant = Date.now()

    await ouvrirQuestion()

    const [ouvert] = await lignes(
      "SELECT id_question, statut, date_cloture_prevue FROM lancement",
    )

    expect(ouvert).toMatchObject({ id_question: 1, statut: "OUVERTE" })
    expect(
      (ouvert.date_cloture_prevue as Date).getTime() - avant,
    ).toBeGreaterThanOrEqual(30_000 - 50)

    await fermerQuestion()

    expect(
      await lignes(
        "SELECT statut, date_cloture IS NOT NULL AS close FROM lancement",
      ),
    ).toEqual([{ statut: "CLOSE", close: true }])
  })

  it("clôt en base une question interrompue par la fin de séance", async () => {
    await ouvrirQuestion()
    await appel("/seances/1/fin")

    expect(await lignes("SELECT statut FROM lancement")).toEqual([
      { statut: "CLOSE" },
    ])
  })
})

describe("réponses à un QCM (CU 2.3)", () => {
  it("note la réponse, l'écrit en base, puis la transmet au moteur avec les points IQ", async () => {
    const lacle = etudiant("lacle", "LaClé")

    await ouvrirQuestion()
    await repondre(contexte.partie, lacle, [0, 2])

    const [ligne] = await lignes(
      "SELECT contenu, points_reponse, points_classement, taux_reussite, mode_correction, temps_restant_ms FROM reponse",
    )

    expect(ligne).toMatchObject({
      contenu: [1, 3],
      points_reponse: 1000,
      taux_reussite: 1,
      mode_correction: "AUTO",
    })
    // Réponse quasi immédiate : près du double des points de réponse.
    expect(ligne.points_classement as number).toBeGreaterThan(1990)
    expect(contexte.selectAnswer).toHaveBeenLastCalledWith(
      lacle,
      [0, 2],
      ligne.points_classement,
    )
    expect(
      await lignes(
        "SELECT p.pseudo, u.login, u.role FROM participation p JOIN utilisateur u ON u.id_utilisateur = p.id_etudiant",
      ),
    ).toEqual([{ pseudo: "LaClé", login: "razzia:lacle", role: "ETUDIANT" }])
  })

  it("donne des points partiels et 0 à une mauvaise réponse", async () => {
    const a = etudiant("a", "Alice")
    const b = etudiant("b", "Bob")

    await ouvrirQuestion()
    await repondre(contexte.partie, a, [0])
    await repondre(contexte.partie, b, [1])

    expect(
      await lignes(
        "SELECT points_reponse, taux_reussite FROM reponse ORDER BY id_reponse",
      ),
    ).toEqual([
      { points_reponse: 600, taux_reussite: 0.6 },
      { points_reponse: 0, taux_reussite: 0 },
    ])
  })

  it("refuse une deuxième réponse à la même question", async () => {
    const lacle = etudiant("lacle", "LaClé")

    await ouvrirQuestion()
    await repondre(contexte.partie, lacle, [0])
    await repondre(contexte.partie, lacle, [2])

    expect(erreur(lacle)).toBe("errors:reponse.dejaEnregistree")
    expect(await lignes("SELECT contenu FROM reponse")).toEqual([
      { contenu: [1] },
    ])
  })

  it.each([
    {
      cas: "avant l'ouverture",
      avant: () => Promise.resolve(),
      cle: "errors:reponse.tempsEcoule",
    },
    {
      cas: "après la clôture",
      avant: async () => {
        await ouvrirQuestion()
        await fermerQuestion()
      },
      cle: "errors:reponse.tempsEcoule",
    },
  ])("refuse une réponse $cas", async ({ avant, cle }) => {
    const lacle = etudiant("lacle", "LaClé")

    await avant()
    await repondre(contexte.partie, lacle, [0])

    expect(erreur(lacle)).toBe(cle)
    expect(await lignes("SELECT * FROM reponse")).toEqual([])
  })

  it("refuse une réponse arrivée après la clôture prévue, même si le minuteur tarde", async () => {
    const lacle = etudiant("lacle", "LaClé")

    await ouvrirQuestion()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now() + 31_000)
    await repondre(contexte.partie, lacle, [0])
    vi.useRealTimers()

    expect(erreur(lacle)).toBe("errors:reponse.tempsEcoule")
  })

  it("refuse un étudiant qui ne participe pas et un contenu mal formé", async () => {
    const intrus = contexte.fake.createSocket("socket-intrus", "intrus")
    const lacle = etudiant("lacle", "LaClé")

    await ouvrirQuestion()
    await repondre(contexte.partie, intrus, [0])
    await repondre(contexte.partie, lacle, [7])

    expect(erreur(intrus)).toBe("errors:reponse.nonInscrit")
    expect(erreur(lacle)).toBe("errors:reponse.contenuInvalide")
    expect(await lignes("SELECT * FROM reponse")).toEqual([])
  })

  it("garde une seule participation par étudiant sur toute la séance", async () => {
    const lacle = etudiant("lacle", "LaClé")

    await ouvrirQuestion(0)
    await repondre(contexte.partie, lacle, [0])
    await fermerQuestion()
    await ouvrirQuestion(1)
    await repondre(contexte.partie, lacle, [2])

    expect(
      await lignes(
        "SELECT count(DISTINCT id_participation)::int AS participations, count(*)::int AS reponses FROM reponse",
      ),
    ).toEqual([{ participations: 1, reponses: 2 }])
  })

  it("laisse une partie Razzia classique au calcul d'origine", async () => {
    const razzia = new Game(contexte.fake.io, "manager", {
      gameMode: "quiz",
      subject: "Razzia",
      questions: [],
    })
    const socket = contexte.fake.createSocket("s", "s")

    await repondre(razzia, socket, [0])

    expect(contexte.selectAnswer).toHaveBeenLastCalledWith(socket, [0])
  })
})
