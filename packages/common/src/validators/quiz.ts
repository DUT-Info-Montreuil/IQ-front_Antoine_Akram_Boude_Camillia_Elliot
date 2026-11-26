import { z } from "zod"
import { MEDIA_URL_PREFIX } from "@razzia/common/constants"

/**
 * QuizSaisie et ses règles (CU 1.3, RG-06 et RG-07), partagées par le front
 * et le serveur. Reprise à l'identique de packages/web/src/features/quiz/validation.ts
 * (branche feat-front/inserer-quiz-cours), mêmes clés i18n.
 */

export const DUREE_MIN = 5

export const DUREE_MAX = 300

export const PROPOSITIONS_MIN = 2

/** Limite du moteur de partie (4 couleurs de réponse). */
export const PROPOSITIONS_MAX = 4

export const PAIRES_MIN = 2

export const PAIRES_MAX = 8

export const EXPRESSIONS_MAX = 10

export const DELAI_LECTURE_MIN = 3

export const DELAI_LECTURE_MAX = 15

export const CATEGORIE_MAX = 40

export const NOTE_MAX = 300

export const TITRE_QUIZ_MAX = 80

/** Média : fichier de la médiathèque (/media/...) ou adresse web complète. */
export const urlMediaValide = (url: string) => {
  if (url.startsWith(MEDIA_URL_PREFIX)) {
    return true
  }

  try {
    return ["http:", "https:"].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

/** Compile une expression comme pour la correction (insensible à la casse), ou null si invalide. */
export const compilerExpression = (motif: string): RegExp | null => {
  try {
    return new RegExp(motif, "iu")
  } catch {
    return null
  }
}

type Ajouter = (chemin: Array<string | number>, cle: string) => void

const optionsQuestionSchema = z.object({
  delaiLecture: z.number(),
  penalite: z.number(),
  modeScore: z.enum(["STRICT", "EQUILIBRE", "INDULGENT"]),
  categorie: z.string(),
  note: z.string(),
  media: z
    .object({ type: z.enum(["IMAGE", "VIDEO", "AUDIO"]), url: z.string() })
    .nullable(),
})

export const optionsPartieSchema = z.object({
  pseudosGeneres: z.boolean(),
  reponsesSeulement: z.boolean(),
})

export type OptionsQuestion = z.infer<typeof optionsQuestionSchema>

export type OptionsPartie = z.infer<typeof optionsPartieSchema>

const questionObjet = z.object({
  type: z.enum(["QCM", "RELIER", "LIBRE"]),
  enonce: z.string().trim().min(1, "errors:quiz.enonceVide"),
  dureeSecondes: z
    .number("errors:quiz.dureeHorsLimites")
    .int("errors:quiz.dureeHorsLimites")
    .min(DUREE_MIN, "errors:quiz.dureeHorsLimites")
    .max(DUREE_MAX, "errors:quiz.dureeHorsLimites"),
  pointsMax: z
    .number("errors:quiz.pointsMaxInvalides")
    .int("errors:quiz.pointsMaxInvalides")
    .min(1, "errors:quiz.pointsMaxInvalides"),
  propositions: z.array(
    z.object({
      libelle: z.string(),
      estCorrecte: z.boolean(),
      points: z.number(),
    }),
  ),
  paires: z.array(z.object({ gauche: z.string(), droite: z.string() })),
  expressions: z.array(z.object({ motif: z.string(), points: z.number() })),
  options: optionsQuestionSchema,
})

export type QuestionSaisie = z.infer<typeof questionObjet>

/** Points d'un élément : entier, positif, au plus les points de la question. */
const controlerPoints = (
  { points, pointsMax }: { points: number; pointsMax: number },
  chemin: Array<string | number>,
  ajouter: Ajouter,
) => {
  if (!Number.isInteger(points)) {
    ajouter(chemin, "errors:quiz.pointsEntiers")
  } else if (points < 0) {
    ajouter(chemin, "errors:quiz.pointsNegatifs")
  } else if (points > pointsMax) {
    ajouter(chemin, "errors:quiz.pointsSuperieursMax")
  }
}

/** QCM : 2 à 4 propositions, au moins une bonne réponse qui rapporte des points. */
const controlerQcm = (question: QuestionSaisie, ajouter: Ajouter) => {
  const { propositions, pointsMax } = question

  if (propositions.length < PROPOSITIONS_MIN) {
    ajouter(["propositions"], "errors:quiz.tropPeuPropositions")
  }

  if (propositions.length > PROPOSITIONS_MAX) {
    ajouter(["propositions"], "errors:quiz.tropDePropositions")
  }

  if (!propositions.some((p) => p.estCorrecte)) {
    ajouter(["propositions"], "errors:quiz.aucuneBonneReponse")
  }

  propositions.forEach((p, index) => {
    if (!p.libelle.trim()) {
      ajouter(["propositions", index, "libelle"], "errors:quiz.propositionVide")
    }

    if (p.estCorrecte && p.points < 1) {
      ajouter(
        ["propositions", index, "points"],
        "errors:quiz.bonneReponseSansPoints",
      )
    } else {
      controlerPoints(
        { points: p.points, pointsMax },
        ["propositions", index, "points"],
        ajouter,
      )
    }
  })
}

/** Points à relier : 2 à 8 paires complètes, sans élément en double. */
const controlerRelier = (question: QuestionSaisie, ajouter: Ajouter) => {
  const { paires } = question

  if (paires.length < PAIRES_MIN) {
    ajouter(["paires"], "errors:quiz.tropPeuPaires")
  }

  if (paires.length > PAIRES_MAX) {
    ajouter(["paires"], "errors:quiz.tropDePaires")
  }

  const vus = { gauche: new Set<string>(), droite: new Set<string>() }

  paires.forEach((paire, index) => {
    for (const cote of ["gauche", "droite"] as const) {
      const valeur = paire[cote].trim().toLowerCase()

      if (!valeur) {
        ajouter(["paires", index, cote], "errors:quiz.paireIncomplete")
      } else if (vus[cote].has(valeur)) {
        ajouter(["paires", index, cote], "errors:quiz.paireEnDouble")
      }

      vus[cote].add(valeur)
    }
  })
}

/** Réponse libre : 0 à 10 expressions valides, chacune avec ses points. */
const controlerLibre = (question: QuestionSaisie, ajouter: Ajouter) => {
  const { expressions, pointsMax } = question

  if (expressions.length > EXPRESSIONS_MAX) {
    ajouter(["expressions"], "errors:quiz.tropDExpressions")
  }

  expressions.forEach((expression, index) => {
    if (!expression.motif.trim()) {
      ajouter(["expressions", index, "motif"], "errors:quiz.expressionVide")
    } else if (!compilerExpression(expression.motif)) {
      ajouter(["expressions", index, "motif"], "errors:quiz.expressionInvalide")
    }

    controlerPoints(
      { points: expression.points, pointsMax },
      ["expressions", index, "points"],
      ajouter,
    )
  })
}

const CONTROLES: Record<
  QuestionSaisie["type"],
  (question: QuestionSaisie, ajouter: Ajouter) => void
> = {
  QCM: controlerQcm,
  RELIER: controlerRelier,
  LIBRE: controlerLibre,
}

/** Options avancées, communes aux trois types. */
const controlerOptions = (question: QuestionSaisie, ajouter: Ajouter) => {
  const { options, pointsMax } = question
  const { delaiLecture, penalite, categorie, note, media } = options

  if (
    !Number.isInteger(delaiLecture) ||
    delaiLecture < DELAI_LECTURE_MIN ||
    delaiLecture > DELAI_LECTURE_MAX
  ) {
    ajouter(["options", "delaiLecture"], "errors:quiz.delaiHorsLimites")
  }

  controlerPoints(
    { points: penalite, pointsMax },
    ["options", "penalite"],
    ajouter,
  )

  if (categorie.length > CATEGORIE_MAX) {
    ajouter(["options", "categorie"], "errors:quiz.categorieTropLongue")
  }

  if (note.length > NOTE_MAX) {
    ajouter(["options", "note"], "errors:quiz.noteTropLongue")
  }

  if (media && !urlMediaValide(media.url.trim())) {
    ajouter(["options", "media", "url"], "errors:quiz.mediaInvalide")
  }
}

export const questionSchema = questionObjet.superRefine((question, ctx) => {
  const ajouter: Ajouter = (path, message) =>
    ctx.addIssue({ code: "custom", path, message })

  CONTROLES[question.type](question, ajouter)
  controlerOptions(question, ajouter)
})

export const quizSaisieSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, "errors:quiz.titreVide")
    .max(TITRE_QUIZ_MAX, "errors:quiz.titreTropLong"),
  // 0 : avant la première page, possible depuis le glisser-déposer du déroulé (SCRUM-17).
  apresPage: z.number().int().min(0, "errors:quiz.positionInvalide"),
  rang: z.number().int().min(0),
  modeAffichage: z.enum(["STATISTIQUES", "CLASSEMENT", "AUCUN"]),
  afficherLeaderboard: z.boolean(),
  sertNotation: z.boolean(),
  optionsPartie: optionsPartieSchema,
  questions: z.array(questionSchema).min(1, "errors:quiz.aucuneQuestion"),
})

export type QuizSaisie = z.infer<typeof quizSaisieSchema>

export const quizParamsValidator = z.object({
  idQuiz: z.coerce.number().int().positive(),
})

export const suppressionQuizValidator = z.object({
  forcer: z.enum(["true", "false"]).optional(),
})
