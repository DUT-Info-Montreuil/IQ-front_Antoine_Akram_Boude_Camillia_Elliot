import type { QuizzValidated } from "@razzia/common/validators/quizz"
import type {
  ModeScore,
  Quiz,
  TypeMedia,
} from "@razzia/web/features/quiz/types"
import {
  MEDIA_TYPES,
  QUESTION_TYPES,
  QUIZZ_MODES,
  SCORING_MODES,
} from "@razzia/common/constants"
import {
  createGame,
  createQuizz,
  updateGameSettings,
  updateQuizz,
} from "@razzia/web/features/manager/queries"
import { completerQuiz } from "@razzia/web/features/quiz/validation"
import { ApiError } from "@razzia/web/lib/api"

/**
 * Adaptateur vers le moteur de partie de Razzia, en attendant que le back
 * ouvre la partie lui-même à partir du quiz du cours (manager:openQuiz,
 * SCRUM-64). Le quiz IQ est copié au format QCM de Razzia (SCRUM-13), puis
 * la partie est créée et réglée avec l'API Razzia existante.
 *
 * Le moteur ne joue que les QCM : les questions « points à relier » et
 * « réponse libre » sont ignorées en séance jusqu'au lot 2.
 */

const CLE_CORRESPONDANCES = "iq-moteur-quiz"

type Correspondances = Record<string, string>

const lire = (): Correspondances => {
  try {
    return JSON.parse(
      localStorage.getItem(CLE_CORRESPONDANCES) ?? "{}",
    ) as Correspondances
  } catch {
    return {}
  }
}

const memoriser = (idQuiz: number, idMoteur: string) => {
  localStorage.setItem(
    CLE_CORRESPONDANCES,
    JSON.stringify({ ...lire(), [idQuiz]: idMoteur }),
  )
}

const MODES_SCORE = {
  STRICT: SCORING_MODES.STRICT,
  EQUILIBRE: SCORING_MODES.BALANCED,
  INDULGENT: SCORING_MODES.LENIENT,
} satisfies Record<ModeScore, string>

const TYPES_MEDIA = {
  IMAGE: MEDIA_TYPES.IMAGE,
  VIDEO: MEDIA_TYPES.VIDEO,
  AUDIO: MEDIA_TYPES.AUDIO,
} satisfies Record<TypeMedia, string>

export const versMoteur = (quiz: Quiz): QuizzValidated => ({
  gameMode: QUIZZ_MODES.QUIZ,
  subject: quiz.titre,
  questions: completerQuiz(quiz)
    .questions.filter((question) => question.type === "QCM")
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

/** Questions du quiz que le moteur ne sait pas encore jouer. */
export const questionsIgnorees = (quiz: Quiz) =>
  quiz.questions.filter((question) => question.type !== "QCM").length

/** Copie (ou met à jour) le quiz dans le moteur, puis ouvre et règle une partie. */
export const ouvrirDansMoteur = async (quiz: Quiz) => {
  const json = versMoteur(quiz)

  if (json.questions.length === 0) {
    throw new ApiError(422, "errors:quiz.aucuneQuestionJouable")
  }

  let idMoteur: string | undefined = lire()[quiz.id]

  if (idMoteur) {
    try {
      await updateQuizz({ id: idMoteur, json })
    } catch {
      idMoteur = undefined
    }
  }

  if (!idMoteur) {
    ;({ id: idMoteur } = await createQuizz(json))
    memoriser(quiz.id, idMoteur)
  }

  const partie = await createGame(idMoteur)
  const { pseudosGeneres, reponsesSeulement } =
    completerQuiz(quiz).optionsPartie

  await updateGameSettings({
    gameId: partie.gameId,
    json: {
      generatedUsernames: pseudosGeneres,
      answersOnly: reponsesSeulement,
    },
  })

  return { ...partie, idMoteur, ignorees: questionsIgnorees(quiz) }
}
