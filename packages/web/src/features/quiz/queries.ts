import { queryOptions } from "@tanstack/react-query"
import type { QuizSaisie } from "@razzia/web/features/quiz/types"
import { API_COURS_MOCK } from "@razzia/web/features/cours/queries"
import { quizHttp, quizMock } from "@razzia/web/features/quiz/api"

const source = API_COURS_MOCK ? quizMock : quizHttp

export const quizKeys = {
  detail: (idQuiz: number) => ["quiz", idQuiz] as const,
}

export const quizQuery = (idQuiz: number) =>
  queryOptions({
    queryKey: quizKeys.detail(idQuiz),
    queryFn: () => source.obtenir(idQuiz),
  })

export const creerQuiz = ({
  idCours,
  saisie,
}: {
  idCours: number
  saisie: QuizSaisie
}) => source.creer(idCours, saisie)

export const modifierQuiz = ({
  idQuiz,
  saisie,
}: {
  idQuiz: number
  saisie: QuizSaisie
}) => source.modifier(idQuiz, saisie)

export const supprimerQuiz = (idQuiz: number) => source.supprimer(idQuiz)
