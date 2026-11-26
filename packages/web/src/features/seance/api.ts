import { EVENTS } from "@razzia/common/constants"
import { requete } from "@razzia/web/features/cours/api/http"
import { socketClient } from "@razzia/web/features/game/contexts/socket-context"
import { ApiError } from "@razzia/web/lib/api"

/**
 * Séance de présentation côté serveur (CU 2.1, SCRUM-64) : une séance par
 * présentation, un seul code d'accès pour tous ses quiz, et les réponses
 * enregistrées en base (SCRUM-28).
 */

export interface SeanceOuverte {
  idSeance: number
  codeAcces: string
  urlAcces: string
}

export interface QuizOuvert {
  idSeance: number
  idQuiz: number
  gameId: string
  inviteCode: string
  /** Questions RELIER et LIBRE que le moteur ne joue pas encore. */
  questionsIgnorees: number
}

const json = (corps: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corps),
})

/** « Présenter » : POST /api/seances. */
export const ouvrirSeance = async (idCours: number) =>
  (await (
    await requete(
      "/seances",
      json({ idCours }),
      "errors:seance.ouvertureImpossible",
    )
  ).json()) as SeanceOuverte

/** « Terminer la séance » : POST /api/seances/{id}/fin. Les étudiants sont renvoyés à l'accueil. */
export const terminerSeance = async (idSeance: number) => {
  await requete(`/seances/${idSeance}/fin`, { method: "POST" })
}

const DELAI_OUVERTURE_MS = 10_000

/**
 * Ouvre un quiz dans la séance (manager:openQuiz) : le serveur crée la partie du quiz avec le code de la
 * séance, puis répond manager:quizOpened, ou game:errorMessage en cas de refus.
 */
export const ouvrirQuiz = (idSeance: number, idQuiz: number) =>
  new Promise<QuizOuvert>((resoudre, rejeter) => {
    const nettoyer = () => {
      clearTimeout(minuteur)
      socketClient.off(EVENTS.MANAGER.QUIZ_OPENED, succes)
      socketClient.off(EVENTS.GAME.ERROR_MESSAGE, echec)
    }

    const succes = (ouvert: QuizOuvert) => {
      if (ouvert.idSeance === idSeance && ouvert.idQuiz === idQuiz) {
        nettoyer()
        resoudre(ouvert)
      }
    }

    const echec = (cle: string) => {
      nettoyer()
      rejeter(new ApiError(409, cle))
    }

    const minuteur = setTimeout(() => {
      nettoyer()
      rejeter(new ApiError(504, "errors:quiz.ouvertureEchouee"))
    }, DELAI_OUVERTURE_MS)

    socketClient.on(EVENTS.MANAGER.QUIZ_OPENED, succes)
    socketClient.on(EVENTS.GAME.ERROR_MESSAGE, echec)

    if (!socketClient.connected) {
      socketClient.connect()
    }

    socketClient.emit(EVENTS.MANAGER.OPEN_QUIZ, { idSeance, idQuiz })
  })
