import type { PGlite } from "@electric-sql/pglite"
import fs from "fs"
import { StatusCodes } from "http-status-codes"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { Socket } from "@razzia/common/types/game/socket"
import type { QuestionSaisie, QuizSaisie } from "@razzia/common/validators/quiz"
import { EVENTS, SESSION_ROLES } from "@razzia/common/constants"
import { app } from "@razzia/socket/app"
import { mintToken } from "@razzia/socket/services/auth"
import { getPath } from "@razzia/socket/services/config"
import { setIo } from "@razzia/socket/services/io"
import Registry from "@razzia/socket/services/registry"
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
  modeScore: "STRICT",
  categorie: "",
  note: "",
  media: null,
} as const

const QCM: QuestionSaisie = {
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
}

const LIBRE: QuestionSaisie = {
  ...QCM,
  type: "LIBRE",
  propositions: [],
  expressions: [{ motif: "^cle", points: 1000 }],
}

const quiz = (questions: QuestionSaisie[]): QuizSaisie => ({
  titre: "Quiz 1",
  apresPage: 1,
  rang: 0,
  modeAffichage: "STATISTIQUES",
  afficherLeaderboard: true,
  sertNotation: false,
  optionsPartie: { pseudosGeneres: false, reponsesSeulement: true },
  questions,
})

const ANIMATEUR = { clientId: "manager", role: SESSION_ROLES.MANAGER }

let token = ""

const contexte = {} as {
  base: PGlite
  fake: ReturnType<typeof createFakeIo>
  sockets: Map<string, Socket>
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

const ouvrirSeance = async (idCours = 1) => {
  const reponse = await appel("/seances", { idCours })

  return {
    statut: reponse.status,
    corps: (await reponse.json()) as {
      idSeance: number
      codeAcces: string
      urlAcces: string
      error?: string
    },
  }
}

/** Ouverture qui doit être refusée : renvoie la clé de l'erreur. */
const refus = (
  message: { idSeance: number; idQuiz: number },
  emetteur: { clientId: string; role: string } = ANIMATEUR,
) =>
  ouvrirQuiz(message, emetteur).then(
    () => "acceptée",
    (error: unknown) => (error as { key: string }).key,
  )

/** Étudiant connecté au serveur, avec sa session Razzia. */
const etudiant = (clientId: string) => {
  const socket = contexte.fake.createSocket(`socket-${clientId}`, clientId)

  socket.data.role = SESSION_ROLES.PLAYER
  contexte.sockets.set(socket.id, socket)

  return socket
}

beforeAll(async () => {
  ;({ token } = await mintToken("manager", SESSION_ROLES.MANAGER))
})

beforeEach(async () => {
  contexte.base = await creerBaseTest()
  contexte.fake = createFakeIo()
  contexte.sockets = new Map()
  Object.assign(contexte.fake.io, { sockets: { sockets: contexte.sockets } })
  setIo(contexte.fake.io)

  const form = new FormData()

  form.append("fichier", new File([new Uint8Array(PDF)], "c.pdf"))
  form.append("titre", "R5.A.10")
  await app.request("/api/cours", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  await appel("/cours/1/quiz", quiz([QCM]))
  await appel("/cours/1/quiz", quiz([QCM, LIBRE]))
  await appel("/cours/1/quiz", quiz([LIBRE]))
})

afterEach(async () => {
  viderSeancesOuvertes()
  for (const game of Registry.getInstance().getAllGames()) {
    Registry.getInstance().removeGame(game.gameId)
  }
  await contexte.base.close()
  fs.rmSync(getPath("pdf"), { recursive: true, force: true })
})

describe("POST /api/seances (CU 2.1, étape 1)", () => {
  it("ouvre une séance sur la version courante avec un code à 6 chiffres", async () => {
    const { statut, corps } = await ouvrirSeance()

    expect(statut).toBe(StatusCodes.CREATED)
    expect(corps).toEqual({
      idSeance: 1,
      codeAcces: expect.stringMatching(/^\d{6}$/u) as string,
      urlAcces: `/?pin=${corps.codeAcces}`,
    })
    expect(
      (
        await contexte.base.query(
          "SELECT id_version, statut, code_acces FROM seance",
        )
      ).rows,
    ).toEqual([
      { id_version: 1, statut: "OUVERTE", code_acces: corps.codeAcces },
    ])
  })

  it("donne un code différent à chaque séance ouverte", async () => {
    const codes = new Set(
      await Promise.all(
        [1, 2, 3].map(async () => (await ouvrirSeance()).corps.codeAcces),
      ),
    )

    expect(codes.size).toBe(3)
  })

  it("répond 409 pour un cours sans PDF et 404 pour un cours inconnu", async () => {
    await contexte.base.exec(
      "INSERT INTO cours(titre, id_proprietaire) SELECT 'Vide', id_utilisateur FROM utilisateur",
    )

    expect(await ouvrirSeance(2)).toMatchObject({
      statut: StatusCodes.CONFLICT,
      corps: { error: "errors:seance.coursSansVersion" },
    })
    expect((await ouvrirSeance(9)).statut).toBe(StatusCodes.NOT_FOUND)
  })
})

describe("manager:openQuiz (CU 2.1, figure 12)", () => {
  it("crée la partie du quiz avec le code de la séance et ses options", async () => {
    const { idSeance, codeAcces } = (await ouvrirSeance()).corps
    const ouverte = await ouvrirQuiz({ idSeance, idQuiz: 2 }, ANIMATEUR)
    const partie = Registry.getInstance().getGameByInviteCode(codeAcces)

    expect(ouverte).toEqual({
      idSeance,
      idQuiz: 2,
      gameId: partie?.gameId,
      inviteCode: codeAcces,
      questionsIgnorees: 1,
    })
    expect(partie?.manager.clientId).toBe("manager")
    expect(partie?.settings).toMatchObject({
      generatedUsernames: false,
      answersOnly: true,
    })
  })

  it("garde le même code et inscrit d'office les participants au quiz suivant", async () => {
    const { idSeance, codeAcces } = (await ouvrirSeance()).corps
    const premiere = await ouvrirQuiz({ idSeance, idQuiz: 1 }, ANIMATEUR)
    const socket = etudiant("lacle")
    const registry = Registry.getInstance()

    registry.getGameById(premiere.gameId)?.join(socket, "LaClé")

    const seconde = await ouvrirQuiz({ idSeance, idQuiz: 2 }, ANIMATEUR)

    expect(registry.getGameById(premiere.gameId)).toBeUndefined()
    expect(seconde.inviteCode).toBe(codeAcces)
    expect(
      registry.getGameById(seconde.gameId)?.players.map((p) => p.username),
    ).toEqual(["LaClé"])
    expect(
      contexte.fake.lastEvent(socket.id, EVENTS.GAME.SUCCESS_JOIN)?.data,
    ).toMatchObject({ gameId: seconde.gameId, username: "LaClé" })
  })

  it.each([
    {
      cas: "l'émetteur n'est pas l'animateur",
      emetteur: { clientId: "autre", role: SESSION_ROLES.MANAGER },
      idQuiz: 1,
      cle: "errors:seance.nonAutorise",
    },
    {
      cas: "l'émetteur est un étudiant",
      emetteur: { clientId: "manager", role: SESSION_ROLES.PLAYER },
      idQuiz: 1,
      cle: "errors:seance.nonAutorise",
    },
    {
      cas: "le quiz n'existe pas",
      emetteur: ANIMATEUR,
      idQuiz: 9,
      cle: "errors:quiz.introuvable",
    },
    {
      cas: "le quiz n'a aucun QCM",
      emetteur: ANIMATEUR,
      idQuiz: 3,
      cle: "errors:quiz.aucuneQuestionJouable",
    },
  ])("refuse si $cas", async ({ emetteur, idQuiz, cle }) => {
    const { idSeance } = (await ouvrirSeance()).corps

    expect(await refus({ idSeance, idQuiz }, emetteur)).toBe(cle)
  })

  it("refuse une séance inconnue ou terminée", async () => {
    const { idSeance } = (await ouvrirSeance()).corps

    await appel(`/seances/${idSeance}/fin`)

    expect(await refus({ idSeance: 9, idQuiz: 1 })).toBe(
      "errors:seance.introuvable",
    )
    expect(await refus({ idSeance, idQuiz: 1 })).toBe("errors:seance.terminee")
  })

  it("refuse tant qu'une question est ouverte", async () => {
    const { idSeance } = (await ouvrirSeance()).corps
    const { gameId } = await ouvrirQuiz({ idSeance, idQuiz: 1 }, ANIMATEUR)
    const partie = Registry.getInstance().getGameById(gameId)

    Object.defineProperty(partie, "questionOuverte", { value: true })

    expect(await refus({ idSeance, idQuiz: 2 })).toBe(
      "errors:seance.questionOuverte",
    )
  })
})

describe("POST /api/seances/{id}/fin (CU 2.1, étape 8)", () => {
  it("termine la séance, ferme la partie et renvoie les étudiants à l'accueil", async () => {
    const { idSeance } = (await ouvrirSeance()).corps
    const { gameId } = await ouvrirQuiz({ idSeance, idQuiz: 1 }, ANIMATEUR)
    const reponse = await appel(`/seances/${idSeance}/fin`)

    expect(reponse.status).toBe(StatusCodes.OK)
    expect(await reponse.json()).toMatchObject({
      idSeance,
      statut: "TERMINEE",
    })
    expect(Registry.getInstance().getGameById(gameId)).toBeUndefined()
    expect(contexte.fake.lastEvent(gameId, EVENTS.GAME.RESET)?.data).toBe(
      "errors:seance.terminee",
    )
    expect(
      (await contexte.base.query("SELECT statut FROM seance")).rows,
    ).toEqual([{ statut: "TERMINEE" }])
  })

  it("répond 409 si la séance est déjà terminée, 404 si elle n'existe pas", async () => {
    const { idSeance } = (await ouvrirSeance()).corps

    await appel(`/seances/${idSeance}/fin`)

    expect((await appel(`/seances/${idSeance}/fin`)).status).toBe(
      StatusCodes.CONFLICT,
    )
    expect((await appel("/seances/9/fin")).status).toBe(StatusCodes.NOT_FOUND)
  })
})
