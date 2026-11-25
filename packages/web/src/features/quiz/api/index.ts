import { StatusCodes } from "http-status-codes"
import type {
  CoursDetail,
  ElementDeroule,
} from "@razzia/web/features/cours/types"
import type { Quiz, QuizSaisie } from "@razzia/web/features/quiz/types"
import { requete } from "@razzia/web/features/cours/api/http"
import {
  executer,
  patienter,
  STORE_COURS,
  STORE_QUIZ,
} from "@razzia/web/features/cours/api/mock"
import { dureeTotale, validerQuiz } from "@razzia/web/features/quiz/validation"
import { ApiError } from "@razzia/web/lib/api"

export interface QuizSource {
  creer: (idCours: number, saisie: QuizSaisie) => Promise<Quiz>
  obtenir: (idQuiz: number) => Promise<Quiz>
  modifier: (idQuiz: number, saisie: QuizSaisie) => Promise<Quiz>
  supprimer: (idQuiz: number) => Promise<void>
}

/* ---------------------------------------------------------------- HTTP --- */

const json = (corps: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corps),
})

/** Routes du dossier de conception (tableau 29). */
export const quizHttp: QuizSource = {
  creer: async (idCours, saisie) =>
    (await (
      await requete(
        `/cours/${idCours}/quiz`,
        { method: "POST", ...json(saisie) },
        "errors:quiz.enregistrementEchoue",
      )
    ).json()) as Quiz,

  obtenir: async (idQuiz) =>
    (await (await requete(`/quiz/${idQuiz}`)).json()) as Quiz,

  modifier: async (idQuiz, saisie) =>
    (await (
      await requete(
        `/quiz/${idQuiz}`,
        { method: "PUT", ...json(saisie) },
        "errors:quiz.enregistrementEchoue",
      )
    ).json()) as Quiz,

  supprimer: async (idQuiz) => {
    await requete(`/quiz/${idQuiz}?forcer=true`, { method: "DELETE" })
  },
}

/* ---------------------------------------------------------------- MOCK --- */

/**
 * MOCK de QuizService (SCRUM-56) : quiz et déroulé du cours dans la même
 * IndexedDB que le mock des cours, mis à jour dans une seule transaction.
 */

const echec = (status: StatusCodes, cle: string) => new ApiError(status, cle)

const lireCours = (idCours: number) =>
  executer<CoursDetail | undefined>([STORE_COURS], "readonly", (tx) =>
    tx.objectStore(STORE_COURS).get(idCours),
  )

const lireQuiz = (idQuiz: number) =>
  executer<Quiz | undefined>([STORE_QUIZ], "readonly", (tx) =>
    tx.objectStore(STORE_QUIZ).get(idQuiz),
  )

const element = (quiz: Quiz): ElementDeroule => ({
  type: "QUIZ",
  id: quiz.id,
  titre: quiz.titre,
  apresPage: quiz.apresPage,
  rang: quiz.rang,
  ordreMiseDeCote: null,
  nbQuestions: quiz.questions.length,
  dureeSecondes: dureeTotale(quiz.questions),
})

const controler = (cours: CoursDetail, saisie: QuizSaisie) => {
  if (validerQuiz(saisie).length > 0) {
    throw echec(StatusCodes.BAD_REQUEST, "errors:quiz.invalide")
  }

  if (saisie.apresPage > cours.nbPages) {
    throw echec(StatusCodes.BAD_REQUEST, "errors:quiz.positionInvalide")
  }
}

/**
 * Place l'élément à son rang après sa page, en décalant ceux qui sont au même
 * endroit (CU 1.3, étape 5), puis renumérote les rangs.
 */
const placer = (deroule: ElementDeroule[], nouveau: ElementDeroule) => {
  const autres = deroule.filter(
    (e) => !(e.type === nouveau.type && e.id === nouveau.id),
  )
  const memePage = autres
    .filter((e) => e.apresPage === nouveau.apresPage)
    .sort((a, b) => a.rang - b.rang)
  const rang = Math.min(Math.max(nouveau.rang, 0), memePage.length)

  memePage.splice(rang, 0, nouveau)
  memePage.forEach((e, index) => {
    e.rang = index
  })

  return [
    ...autres.filter((e) => e.apresPage !== nouveau.apresPage),
    ...memePage,
  ]
}

const enregistrer = async (cours: CoursDetail, quiz: Quiz) => {
  const deroule = placer(cours.deroule, element(quiz))
  const rang = deroule.find((e) => e.type === "QUIZ" && e.id === quiz.id)?.rang
  const final = { ...quiz, rang: rang ?? quiz.rang }

  await executer([STORE_COURS, STORE_QUIZ], "readwrite", (tx) => {
    tx.objectStore(STORE_QUIZ).put(final)
    tx.objectStore(STORE_COURS).put({
      ...cours,
      deroule,
      nbQuiz: deroule.filter((e) => e.type === "QUIZ").length,
      dateModification: new Date().toISOString(),
    })

    return undefined
  })

  return final
}

export const quizMock: QuizSource = {
  creer: async (idCours, saisie) => {
    await patienter()
    const cours = await lireCours(idCours)

    if (!cours) {
      throw echec(StatusCodes.NOT_FOUND, "errors:cours.introuvable")
    }

    controler(cours, saisie)

    const tous = await executer<Quiz[]>([STORE_QUIZ], "readonly", (tx) =>
      tx.objectStore(STORE_QUIZ).getAll(),
    )
    const id = tous.reduce((max, q) => Math.max(max, q.id), 0) + 1

    return enregistrer(cours, { ...saisie, id, idCours })
  },

  obtenir: async (idQuiz) => {
    await patienter()
    const quiz = await lireQuiz(idQuiz)

    if (!quiz) {
      throw echec(StatusCodes.NOT_FOUND, "errors:quiz.introuvable")
    }

    return quiz
  },

  modifier: async (idQuiz, saisie) => {
    await patienter()
    const quiz = await lireQuiz(idQuiz)
    const cours = quiz && (await lireCours(quiz.idCours))

    if (!quiz || !cours) {
      throw echec(StatusCodes.NOT_FOUND, "errors:quiz.introuvable")
    }

    controler(cours, saisie)

    return enregistrer(cours, { ...saisie, id: quiz.id, idCours: quiz.idCours })
  },

  supprimer: async (idQuiz) => {
    await patienter()
    const quiz = await lireQuiz(idQuiz)
    const cours = quiz && (await lireCours(quiz.idCours))

    if (!quiz || !cours) {
      throw echec(StatusCodes.NOT_FOUND, "errors:quiz.introuvable")
    }

    const deroule = cours.deroule.filter(
      (e) => !(e.type === "QUIZ" && e.id === idQuiz),
    )

    await executer([STORE_COURS, STORE_QUIZ], "readwrite", (tx) => {
      tx.objectStore(STORE_QUIZ).delete(idQuiz)
      tx.objectStore(STORE_COURS).put({
        ...cours,
        deroule,
        nbQuiz: deroule.filter((e) => e.type === "QUIZ").length,
        dateModification: new Date().toISOString(),
      })

      return undefined
    })
  },
}
