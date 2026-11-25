import { and, desc, eq } from "drizzle-orm"
import type { QuizzValidated } from "@razzia/common/validators/quizz"
import {
  EVENTS,
  MEDIA_TYPES,
  QUESTION_TYPES,
  QUIZZ_MODES,
  SCORING_MODES,
  SESSION_ROLES,
} from "@razzia/common/constants"
import { getDb } from "@razzia/socket/db"
import { seance, versionPdf } from "@razzia/socket/db/schema"
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
    .filter((question) => question.type === "QCM")
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
