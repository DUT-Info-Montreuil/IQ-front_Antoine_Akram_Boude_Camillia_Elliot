import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { QuizzValidated } from "@razzia/common/validators/quizz"
import type { QuestionNotee } from "@razzia/socket/services/score"
import {
  EVENTS,
  MEDIA_TYPES,
  QUESTION_TYPES,
  QUIZZ_MODES,
  SCORING_MODES,
  SESSION_ROLES,
} from "@razzia/common/constants"
import { getDb } from "@razzia/socket/db"
import {
  lancement,
  proposition,
  question,
  seance,
  versionPdf,
} from "@razzia/socket/db/schema"
import { verifierAcces } from "@razzia/socket/services/cours"
import {
  conflict,
  forbidden,
  notFound,
  serverError,
  unprocessable,
} from "@razzia/socket/services/errors"
import Game from "@razzia/socket/services/game"
import { getIo } from "@razzia/socket/services/io"
import { obtenirQuiz } from "@razzia/socket/services/quiz"
import Registry from "@razzia/socket/services/registry"
import { createInviteCode } from "@razzia/socket/utils/game"
import { SECOND_MS } from "@razzia/socket/utils/sleep"

/**
 * SeanceService et Moteur.ouvrirQuiz (dossier de conception, Tableau 40),
 * périmètre de SCRUM-64 : ouvrir une séance, y ouvrir un quiz, la terminer.
 */

interface SeanceEnCours {
  idSeance: number
  idCours: number
  idAnimateur: number
  /** Client de la session Razzia qui pilote la séance (son socket). */
  clientAnimateur: string
  codeAcces: string
  gameId: string | null
  /**
   * Participants de la séance, inscrits d'office à chaque quiz ouvert.
   * shortcut: gardés en mémoire (clientId → pseudo) faute de compte étudiant ;
   * à enregistrer dans `participation` avec le LDAP et le CU 2.2.
   */
  participants: Map<string, string>
  /** SCRUM-28 : QCM du quiz ouvert, dans l'ordre du moteur, avec leur barème. */
  questions: Array<QuestionNotee & { idQuestion: number }>
  /** Question en cours de réponse (lancement OUVERTE en base). */
  lancement: {
    idLancement: number
    indice: number
    dateCloturePrevue: Date
  } | null
  /** ClientId Razzia → participation en base, créée à la première réponse. */
  participations: Map<string, number>
}

/** Registre des séances ouvertes (Tableau 6). Perdu au redémarrage : reconstruction hors SCRUM-64. */
const seancesOuvertes = new Map<number, SeanceEnCours>()

const TENTATIVES_CODE = 20

const codeLibre = async () => {
  const pris = new Set(
    (
      await getDb()
        .select({ code: seance.codeAcces })
        .from(seance)
        .where(eq(seance.statut, "OUVERTE"))
    ).map((ligne) => ligne.code),
  )

  for (let essai = 0; essai < TENTATIVES_CODE; essai += 1) {
    const code = createInviteCode()

    if (!pris.has(code) && !Registry.getInstance().getGameByInviteCode(code)) {
      return code
    }
  }

  throw serverError("errors:seance.codeIndisponible")
}

/** SeanceService.ouvrir : séance sur la version courante du cours, avec un code à 6 chiffres libre. */
export const ouvrirSeance = async (
  idCours: number,
  idUtilisateur: number,
  clientAnimateur: string,
) => {
  await verifierAcces(idCours, idUtilisateur, "LECTURE")

  const db = getDb()
  const versions = await db
    .select({ idVersion: versionPdf.idVersion })
    .from(versionPdf)
    .where(eq(versionPdf.idCours, idCours))
    .orderBy(desc(versionPdf.numero))
    .limit(1)
  const version = versions.at(0)

  if (!version) {
    throw conflict("errors:seance.coursSansVersion")
  }

  const codeAcces = await codeLibre()
  const [creee] = await db
    .insert(seance)
    .values({
      idVersion: version.idVersion,
      idAnimateur: idUtilisateur,
      codeAcces,
    })
    .returning({ idSeance: seance.idSeance })

  seancesOuvertes.set(creee.idSeance, {
    idSeance: creee.idSeance,
    idCours,
    idAnimateur: idUtilisateur,
    clientAnimateur,
    codeAcces,
    gameId: null,
    participants: new Map(),
    questions: [],
    lancement: null,
    participations: new Map(),
  })

  return {
    idSeance: creee.idSeance,
    codeAcces,
    // Accueil Razzia avec le code prérempli (le dossier prévoit /s/{code}, écran S0 à venir).
    urlAcces: `/?pin=${codeAcces}`,
  }
}

const lireSeance = async (idSeance: number) => {
  const lignes = await getDb()
    .select()
    .from(seance)
    .where(eq(seance.idSeance, idSeance))
  const ligne = lignes.at(0)

  if (!ligne) {
    throw notFound("errors:seance.introuvable")
  }

  return ligne
}

/** Retire la partie du moteur ; `reset` renvoie ses étudiants à l'accueil. */
const fermerPartie = (gameId: string | null, reset: boolean) => {
  if (!gameId) {
    return
  }

  if (reset) {
    getIo().to(gameId).emit(EVENTS.GAME.RESET, "errors:seance.terminee")
  }

  Registry.getInstance().removeGame(gameId)
}

/** SeanceService.terminer : statut TERMINEE, code libéré, étudiants renvoyés à l'accueil. */
export const terminerSeance = async (
  idSeance: number,
  idUtilisateur: number,
) => {
  const ligne = await lireSeance(idSeance)

  if (ligne.idAnimateur !== idUtilisateur) {
    throw forbidden("errors:seance.nonAutorise")
  }

  if (ligne.statut === "TERMINEE") {
    throw conflict("errors:seance.terminee")
  }

  const dateFin = new Date()
  const enCours = seancesOuvertes.get(idSeance)

  await getDb()
    .update(seance)
    .set({ statut: "TERMINEE", dateFin })
    .where(and(eq(seance.idSeance, idSeance), eq(seance.statut, "OUVERTE")))

  fermerPartie(enCours?.gameId ?? null, true)
  seancesOuvertes.delete(idSeance)
  // Une question interrompue par la fin de séance ne doit pas rester ouverte en base.
  await getDb()
    .update(lancement)
    .set({ statut: "CLOSE", dateCloture: dateFin })
    .where(
      and(eq(lancement.idSeance, idSeance), eq(lancement.statut, "OUVERTE")),
    )

  return {
    idSeance,
    statut: "TERMINEE" as const,
    dateDebut: ligne.dateDebut.toISOString(),
    dateFin: dateFin.toISOString(),
    nbParticipants: enCours?.participants.size ?? 0,
  }
}

const MODES_SCORE = {
  STRICT: SCORING_MODES.STRICT,
  EQUILIBRE: SCORING_MODES.BALANCED,
  INDULGENT: SCORING_MODES.LENIENT,
} as const

const TYPES_MEDIA = {
  IMAGE: MEDIA_TYPES.IMAGE,
  VIDEO: MEDIA_TYPES.VIDEO,
  AUDIO: MEDIA_TYPES.AUDIO,
} as const

/**
 * Quiz IQ → format QCM du moteur Razzia (repris de features/seance/moteur.ts du front).
 * Seuls les QCM sont joués : RELIER et LIBRE attendent le lot 2.
 */
export const versMoteur = (
  quiz: Awaited<ReturnType<typeof obtenirQuiz>>,
): QuizzValidated => ({
  gameMode: QUIZZ_MODES.QUIZ,
  subject: quiz.titre,
  questions: quiz.questions
    .filter((q) => q.type === "QCM")
    .map(({ enonce, propositions, pointsMax, dureeSecondes, options }) => ({
      type: QUESTION_TYPES.MULTI,
      question: enonce,
      answers: propositions.map((p) => p.libelle),
      solutions: propositions.flatMap((p, index) =>
        p.estCorrecte ? [index] : [],
      ),
      answerPoints: propositions.map((p) => p.points),
      maxPoints: pointsMax,
      penalty: options.penalite,
      options: { scoringMode: MODES_SCORE[options.modeScore] },
      cooldown: options.delaiLecture,
      time: dureeSecondes,
      ...(options.categorie.trim() && { category: options.categorie.trim() }),
      ...(options.note.trim() && { note: options.note.trim() }),
      ...(options.media && {
        media: {
          type: TYPES_MEDIA[options.media.type],
          url: options.media.url,
        },
      }),
    })),
})

/** Barème des QCM du quiz, dans l'ordre où versMoteur les donne au moteur. */
const chargerBareme = async (idQuiz: number) => {
  const db = getDb()
  const questions = await db
    .select({
      idQuestion: question.idQuestion,
      pointsMax: question.pointsMax,
      dureeSecondes: question.dureeSecondes,
      options: question.options,
    })
    .from(question)
    .where(and(eq(question.idQuiz, idQuiz), eq(question.type, "QCM")))
    .orderBy(asc(question.ordre))
  const propositions =
    questions.length === 0
      ? []
      : await db
          .select({
            idQuestion: proposition.idQuestion,
            idProposition: proposition.idProposition,
            points: proposition.points,
            estCorrecte: proposition.estCorrecte,
          })
          .from(proposition)
          .where(
            inArray(
              proposition.idQuestion,
              questions.map((q) => q.idQuestion),
            ),
          )
          .orderBy(asc(proposition.ordre))

  return questions.map((q) => ({
    idQuestion: q.idQuestion,
    pointsMax: q.pointsMax,
    dureeMs: q.dureeSecondes * SECOND_MS,
    modeScore: q.options.modeScore,
    propositions: propositions
      .filter((p) => p.idQuestion === q.idQuestion)
      .map(({ idProposition, points, estCorrecte }) => ({
        idProposition,
        points,
        estCorrecte,
      })),
  }))
}

/** Lancement en base à l'ouverture et à la clôture de chaque question (CU 2.1, étapes 4 et 6). */
const crochetsLancement = (enCours: SeanceEnCours) => ({
  ouverture: async (indice: number) => {
    const q = enCours.questions.at(indice)

    if (!q) {
      return
    }

    const dateCloturePrevue = new Date(Date.now() + q.dureeMs)
    const [cree] = await getDb()
      .insert(lancement)
      .values({
        idSeance: enCours.idSeance,
        idQuestion: q.idQuestion,
        dateCloturePrevue,
      })
      .returning({ idLancement: lancement.idLancement })

    enCours.lancement = {
      idLancement: cree.idLancement,
      indice,
      dateCloturePrevue,
    }
  },
  cloture: async () => {
    const ouvert = enCours.lancement

    enCours.lancement = null

    if (ouvert) {
      await getDb()
        .update(lancement)
        .set({ statut: "CLOSE", dateCloture: new Date() })
        .where(eq(lancement.idLancement, ouvert.idLancement))
    }
  },
})

/** Séance dont `gameId` est la partie en cours (undefined pour une partie Razzia classique). */
export const seanceDeLaPartie = (gameId: string) =>
  [...seancesOuvertes.values()].find((enCours) => enCours.gameId === gameId)

/** Contrôles de la figure 12, dans l'ordre ; renvoie la séance en cours. */
const controlerOuverture = async (
  idSeance: number,
  clientId: string,
  role: string,
) => {
  const enCours = seancesOuvertes.get(idSeance)

  if (!enCours) {
    const lignes = await getDb()
      .select({ statut: seance.statut })
      .from(seance)
      .where(eq(seance.idSeance, idSeance))

    // Inconnue, terminée, ou ouverte avant un redémarrage du serveur.
    throw notFound(
      lignes.at(0)?.statut === "TERMINEE"
        ? "errors:seance.terminee"
        : "errors:seance.introuvable",
    )
  }

  if (role !== SESSION_ROLES.MANAGER || enCours.clientAnimateur !== clientId) {
    throw forbidden("errors:seance.nonAutorise")
  }

  const partie = enCours.gameId
    ? Registry.getInstance().getGameById(enCours.gameId)
    : undefined

  if (partie?.questionOuverte) {
    throw conflict("errors:seance.questionOuverte")
  }

  return { enCours, partie }
}

/**
 * Moteur.ouvrirQuiz (manager:openQuiz) : crée la partie du quiz avec le code de
 * la séance et y inscrit d'office les participants de la séance.
 */
export const ouvrirQuiz = async (
  { idSeance, idQuiz }: { idSeance: number; idQuiz: number },
  { clientId, role }: { clientId: string; role: string },
) => {
  const { enCours, partie } = await controlerOuverture(idSeance, clientId, role)
  const quiz = await obtenirQuiz(idQuiz, enCours.idAnimateur)

  if (quiz.idCours !== enCours.idCours) {
    throw notFound("errors:quiz.introuvable")
  }

  const quizz = versMoteur(quiz)

  if (quizz.questions.length === 0) {
    throw unprocessable("errors:quiz.aucuneQuestionJouable")
  }

  // Les joueurs du quiz précédent deviennent participants de la séance.
  for (const joueur of partie?.players ?? []) {
    enCours.participants.set(joueur.clientId, joueur.username)
  }

  // Un seul quiz ouvert par séance : le code passe à la nouvelle partie.
  fermerPartie(enCours.gameId, false)

  const registry = Registry.getInstance()
  const io = getIo()
  const nouvelle = new Game(io, clientId, quizz, enCours.codeAcces)

  nouvelle.updateSettings({
    generatedUsernames: quiz.optionsPartie.pseudosGeneres,
    answersOnly: quiz.optionsPartie.reponsesSeulement,
  })
  enCours.questions = await chargerBareme(idQuiz)
  enCours.lancement = null
  nouvelle.setCrochets(crochetsLancement(enCours))
  registry.addGame(nouvelle)
  registry.markGameAsEmpty(nouvelle)
  enCours.gameId = nouvelle.gameId

  for (const socket of io.sockets.sockets.values()) {
    const pseudo = enCours.participants.get(socket.data.clientId)

    if (pseudo !== undefined && socket.data.role === SESSION_ROLES.PLAYER) {
      nouvelle.join(socket, pseudo)
    }
  }

  return {
    idSeance,
    idQuiz,
    gameId: nouvelle.gameId,
    inviteCode: nouvelle.inviteCode,
    questionsIgnorees: quiz.questions.length - quizz.questions.length,
  }
}

/** Pour les tests : vide le registre des séances. */
export const viderSeancesOuvertes = () => {
  seancesOuvertes.clear()
}
