import { and, eq } from "drizzle-orm"
import type { Socket } from "@razzia/common/types/game/socket"
import type Game from "@razzia/socket/services/game"
import { EVENTS } from "@razzia/common/constants"
import { getDb } from "@razzia/socket/db"
import { participation, reponse, utilisateur } from "@razzia/socket/db/schema"
import { evaluerQcm } from "@razzia/socket/services/score"
import { seanceDeLaPartie } from "@razzia/socket/services/seance"

/**
 * Moteur.recevoirReponse pour les QCM (CU 2.3, SCRUM-28) : chaque réponse
 * d'une partie de séance est horodatée par le serveur, notée par ScoreService
 * et écrite en base avant l'accusé de réception (WAIT).
 */

type Seance = NonNullable<ReturnType<typeof seanceDeLaPartie>>

const VIOLATION_UNICITE = "23505"

const estViolationUnicite = (error: unknown, contrainte: string) => {
  const { cause } = error as {
    cause?: { code?: string; constraint?: string }
  }

  return cause?.code === VIOLATION_UNICITE && cause.constraint === contrainte
}

/**
 * Étudiant provisoire, un par session Razzia.
 * shortcut: sans LDAP, la participation pointe vers ce compte « razzia:<clientId> » ;
 * remplacer par l'étudiant authentifié avec le CU 1.1 et le CU 2.2.
 */
const etudiantProvisoire = async (clientId: string, pseudo: string) => {
  const [ligne] = await getDb()
    .insert(utilisateur)
    .values({
      login: `razzia:${clientId}`,
      nom: pseudo,
      prenom: "Étudiant",
      role: "ETUDIANT",
    })
    .onConflictDoUpdate({ target: utilisateur.login, set: { nom: pseudo } })
    .returning({ idUtilisateur: utilisateur.idUtilisateur })

  return ligne.idUtilisateur
}

/** Participation de l'étudiant à la séance, créée à sa première réponse. */
const idParticipation = async (
  seance: Seance,
  { clientId, pseudo }: { clientId: string; pseudo: string },
) => {
  const connue = seance.participations.get(clientId)

  if (connue !== undefined) {
    return connue
  }

  const db = getDb()
  const idEtudiant = await etudiantProvisoire(clientId, pseudo)
  const inscrire = (pseudoRetenu: string) =>
    db
      .insert(participation)
      .values({ idSeance: seance.idSeance, idEtudiant, pseudo: pseudoRetenu })
      .onConflictDoNothing({
        target: [participation.idSeance, participation.idEtudiant],
      })

  try {
    await inscrire(pseudo)
  } catch (error) {
    if (!estViolationUnicite(error, "participation_seance_pseudo_uq")) {
      throw error
    }

    // Même pseudo qu'un autre étudiant d'un quiz précédent de la séance.
    await inscrire(`${pseudo} ${clientId.slice(0, 4)}`)
  }

  const [ligne] = await db
    .select({ id: participation.idParticipation })
    .from(participation)
    .where(
      and(
        eq(participation.idSeance, seance.idSeance),
        eq(participation.idEtudiant, idEtudiant),
      ),
    )

  seance.participations.set(clientId, ligne.id)

  return ligne.id
}

const refuser = (socket: Socket, cle: string) => {
  socket.emit(EVENTS.GAME.ERROR_MESSAGE, cle)
}

/**
 * Remplace `game.selectAnswer` dans le gestionnaire Razzia : une partie de séance
 * passe par le barème IQ et la base, une partie Razzia classique reste inchangée.
 */
export const repondre = async (
  game: Game,
  socket: Socket,
  indices: number[],
) => {
  const seance = seanceDeLaPartie(game.gameId)

  if (!seance) {
    game.selectAnswer(socket, indices)

    return
  }

  const recuLe = new Date()
  const ouvert = seance.lancement

  // 3a : hors de la fenêtre de réponse, ou après la clôture prévue.
  if (!ouvert || !game.accepteReponses || recuLe > ouvert.dateCloturePrevue) {
    refuser(socket, "errors:reponse.tempsEcoule")

    return
  }

  // 3c : seuls les joueurs de la partie, donc de la séance, répondent.
  const joueur = game.players.find((p) => p.id === socket.id)

  if (!joueur) {
    refuser(socket, "errors:reponse.nonInscrit")

    return
  }

  const question = seance.questions.at(ouvert.indice)
  const tempsRestantMs = ouvert.dateCloturePrevue.getTime() - recuLe.getTime()
  const note = question && evaluerQcm(question, indices, tempsRestantMs)

  // 3d : contenu mal formé pour la question.
  if (!note) {
    refuser(socket, "errors:reponse.contenuInvalide")

    return
  }

  try {
    await getDb()
      .insert(reponse)
      .values({
        idLancement: ouvert.idLancement,
        idParticipation: await idParticipation(seance, {
          clientId: joueur.clientId,
          pseudo: joueur.username,
        }),
        contenu: note.contenu,
        dateReponse: recuLe,
        tempsRestantMs,
        tauxReussite: note.tauxReussite,
        pointsReponse: note.pointsReponse,
        pointsClassement: note.pointsClassement,
        modeCorrection: "AUTO",
      })
  } catch (error) {
    // 3b : contrainte d'unicité (lancement, participation).
    if (estViolationUnicite(error, "reponse_lancement_participation_uq")) {
      refuser(socket, "errors:reponse.dejaEnregistree")

      return
    }

    throw error
  }

  // Écrite en base : le moteur accuse réception et classe avec les points IQ.
  game.selectAnswer(socket, indices, note.pointsClassement)
}
