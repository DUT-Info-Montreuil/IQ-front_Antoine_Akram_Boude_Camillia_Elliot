import { z } from "zod"
import type {
  ExpressionSaisie,
  OptionsPartie,
  OptionsQuestion,
  PropositionSaisie,
  QuestionSaisie,
  Quiz,
  QuizSaisie,
  TypeQuestion,
} from "@razzia/web/features/quiz/types"
import { MEDIA_URL_PREFIX } from "@razzia/common/constants"

export const DUREE_MIN = 5

export const DUREE_MAX = 300

export const DUREE_DEFAUT = 30

export const POINTS_DEFAUT = 1000

export const PROPOSITIONS_MIN = 2

/** Limite du moteur de partie (4 couleurs de réponse). */
export const PROPOSITIONS_MAX = 4

export const PAIRES_MIN = 2

export const PAIRES_MAX = 8

export const EXPRESSIONS_MAX = 10

/** Délai de lecture du moteur Razzia (3 s par défaut, dossier de conception). */
export const DELAI_LECTURE_MIN = 3

export const DELAI_LECTURE_MAX = 15

export const CATEGORIE_MAX = 40

export const NOTE_MAX = 300

export const optionsParDefaut = (): OptionsQuestion => ({
  delaiLecture: DELAI_LECTURE_MIN,
  penalite: 0,
  modeScore: "EQUILIBRE",
  categorie: "",
  note: "",
  media: null,
})

export const optionsPartieParDefaut = (): OptionsPartie => ({
  pseudosGeneres: false,
  reponsesSeulement: false,
})

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

/* ---------------------------------------------- Réponse libre (LIBRE) --- */

/** Compile une expression comme le serveur (insensible à la casse), ou null si invalide. */
export const compiler = (motif: string): RegExp | null => {
  try {
    return new RegExp(motif, "iu")
  } catch {
    return null
  }
}

/**
 * Nettoyage d'une réponse avant correction (ScoreService.normaliser) :
 * minuscules, sans accents ni espaces superflus.
 */
export const normaliserReponse = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim()

/**
 * Points d'une réponse libre : ceux de la meilleure expression reconnue, ou
 * null si aucune ne l'est (réponse à corriger à la main, CU 2.4).
 */
export const evaluerReponseLibre = (
  expressions: ExpressionSaisie[],
  texte: string,
): number | null => {
  const nettoye = normaliserReponse(texte)
  const reconnues = expressions.filter(
    (e) => e.motif.trim() !== "" && compiler(e.motif)?.test(nettoye),
  )

  return reconnues.length === 0
    ? null
    : Math.max(...reconnues.map((e) => e.points))
}

/** Points à relier : chaque association juste rapporte une part égale. */
export const pointsParPaire = (pointsMax: number, nbPaires: number) =>
  nbPaires > 0 ? Math.round((pointsMax / nbPaires) * 100) / 100 : 0

/* ------------------------------------------------------------ Règles --- */

type Ajouter = (chemin: Array<string | number>, cle: string) => void

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

  const bonnes = propositions.filter((p) => p.estCorrecte)
  const sommeBonnes = bonnes.reduce((somme, p) => somme + p.points, 0)

  // Un sans-faute rapporte la somme des bonnes réponses : au plus pointsMax.
  // Un point déjà au-dessus du maximum a son propre message.
  if (sommeBonnes > pointsMax && bonnes.every((p) => p.points <= pointsMax)) {
    ajouter(["propositions"], "errors:quiz.sommePointsSuperieureMax")
  }
}

/** Points à relier : au moins 2 paires complètes, sans élément en double. */
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

/**
 * Réponse libre : expressions valides, chacune avec ses points.
 * Sans expression, la réponse est corrigée à la main.
 */
const controlerLibre = (question: QuestionSaisie, ajouter: Ajouter) => {
  const { expressions, pointsMax } = question

  if (expressions.length > EXPRESSIONS_MAX) {
    ajouter(["expressions"], "errors:quiz.tropDExpressions")
  }

  expressions.forEach((expression, index) => {
    if (!expression.motif.trim()) {
      ajouter(["expressions", index, "motif"], "errors:quiz.expressionVide")
    } else if (!compiler(expression.motif)) {
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
  TypeQuestion,
  (question: QuestionSaisie, ajouter: Ajouter) => void
> = {
  QCM: controlerQcm,
  RELIER: controlerRelier,
  LIBRE: controlerLibre,
}

const nombreEntier = (cle: string) => z.number(cle).int(cle)

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

/** Règles du CU 1.3 et RG-06 / RG-07, selon le type de question. */
export const questionSchema = z
  .object({
    type: z.enum(["QCM", "RELIER", "LIBRE"]),
    enonce: z.string().trim().min(1, "errors:quiz.enonceVide"),
    dureeSecondes: nombreEntier("errors:quiz.dureeHorsLimites")
      .min(DUREE_MIN, "errors:quiz.dureeHorsLimites")
      .max(DUREE_MAX, "errors:quiz.dureeHorsLimites"),
    pointsMax: nombreEntier("errors:quiz.pointsMaxInvalides").min(
      1,
      "errors:quiz.pointsMaxInvalides",
    ),
    propositions: z.array(
      z.object({
        libelle: z.string(),
        estCorrecte: z.boolean(),
        points: z.number("errors:quiz.pointsEntiers"),
      }),
    ),
    paires: z.array(z.object({ gauche: z.string(), droite: z.string() })),
    expressions: z.array(
      z.object({
        motif: z.string(),
        points: z.number("errors:quiz.pointsEntiers"),
      }),
    ),
    options: z.object({
      delaiLecture: z.number(),
      penalite: z.number(),
      modeScore: z.enum(["STRICT", "EQUILIBRE", "INDULGENT"]),
      categorie: z.string(),
      note: z.string(),
      media: z
        .object({
          type: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
          url: z.string(),
        })
        .nullable(),
    }),
  })
  .superRefine((question, ctx) => {
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
    .max(80, "errors:quiz.titreTropLong"),
  apresPage: z.number().int().min(1),
  rang: z.number().int().min(0),
  modeAffichage: z.enum(["STATISTIQUES", "CLASSEMENT", "AUCUN"]),
  afficherLeaderboard: z.boolean(),
  sertNotation: z.boolean(),
  optionsPartie: z.object({
    pseudosGeneres: z.boolean(),
    reponsesSeulement: z.boolean(),
  }),
  questions: z.array(questionSchema).min(1, "errors:quiz.aucuneQuestion"),
})

export interface ErreurSaisie {
  /** Chemin du champ : ["questions", 0, "propositions", 1, "points"]. */
  chemin: Array<string | number>
  cle: string
}

export const validerQuiz = (saisie: QuizSaisie): ErreurSaisie[] => {
  const resultat = quizSaisieSchema.safeParse(saisie)

  if (resultat.success) {
    return []
  }

  return resultat.error.issues.map((issue) => ({
    chemin: issue.path.filter(
      (segment): segment is string | number => typeof segment !== "symbol",
    ),
    cle: issue.message,
  }))
}

/** Erreurs qui concernent la question d'indice donné. */
export const erreursDeQuestion = (erreurs: ErreurSaisie[], index: number) =>
  erreurs.filter((e) => e.chemin[0] === "questions" && e.chemin[1] === index)

/* ----------------------------------------------------------- Saisie --- */

/**
 * Barème QCM par défaut (CU 1.3) : les points de la question sont répartis
 * sur les bonnes réponses, 0 pour une mauvaise.
 */
export const repartirPoints = (
  propositions: PropositionSaisie[],
  pointsMax: number,
): PropositionSaisie[] => {
  const nbCorrectes = propositions.filter((p) => p.estCorrecte).length

  if (nbCorrectes === 0) {
    return propositions.map((p) => ({ ...p, points: 0 }))
  }

  const part = Math.floor(pointsMax / nbCorrectes)
  let reste = pointsMax - part * nbCorrectes

  return propositions.map((p) => {
    if (!p.estCorrecte) {
      return { ...p, points: 0 }
    }

    const bonus = reste > 0 ? 1 : 0

    reste -= bonus

    return { ...p, points: part + bonus }
  })
}

export const nouvelleQuestion = (): QuestionSaisie => ({
  type: "QCM",
  enonce: "",
  dureeSecondes: DUREE_DEFAUT,
  pointsMax: POINTS_DEFAUT,
  propositions: [
    { libelle: "", estCorrecte: true, points: POINTS_DEFAUT },
    { libelle: "", estCorrecte: false, points: 0 },
  ],
  paires: [
    { gauche: "", droite: "" },
    { gauche: "", droite: "" },
  ],
  expressions: [],
  options: optionsParDefaut(),
})

/** Quiz enregistré avec un format plus ancien : complète les champs manquants. */
export const completerQuiz = (quiz: Quiz): Quiz => ({
  ...quiz,
  optionsPartie: { ...optionsPartieParDefaut(), ...quiz.optionsPartie },
  questions: quiz.questions.map((question) => ({
    ...nouvelleQuestion(),
    ...question,
    options: { ...optionsParDefaut(), ...question.options },
  })),
})

/**
 * Changer de type garde la saisie des autres types (on peut revenir en
 * arrière) et prépare une première expression pour la réponse libre.
 */
export const changerType = (
  question: QuestionSaisie,
  type: TypeQuestion,
): QuestionSaisie => ({
  ...question,
  type,
  paires:
    type === "RELIER" && question.paires.length === 0
      ? nouvelleQuestion().paires
      : question.paires,
  expressions:
    type === "LIBRE" && question.expressions.length === 0
      ? [{ motif: "", points: question.pointsMax || POINTS_DEFAUT }]
      : question.expressions,
})

/** À l'enregistrement, seule la liste du type choisi est envoyée. */
export const nettoyerQuestion = (question: QuestionSaisie): QuestionSaisie => ({
  ...question,
  propositions:
      question.type === "QCM"
          ? question.propositions.map((p) => ({
            ...p,
            points: p.estCorrecte ? p.points : 0,
          }))
          : [],
  paires: question.type === "RELIER" ? question.paires : [],
  expressions: question.type === "LIBRE" ? question.expressions : [],
})

export const nouveauQuiz = (apresPage: number): QuizSaisie => ({
  titre: "",
  apresPage,
  rang: 0,
  modeAffichage: "STATISTIQUES",
  afficherLeaderboard: true,
  sertNotation: false,
  optionsPartie: optionsPartieParDefaut(),
  questions: [nouvelleQuestion()],
})

export const dureeTotale = (questions: QuestionSaisie[]) =>
  questions.reduce(
    (total, q) => total + (Number.isNaN(q.dureeSecondes) ? 0 : q.dureeSecondes),
    0,
  )

/** 150 → « 2 min 30 », 45 → « 45 s ». */
export const formaterDuree = (secondes: number) => {
  const minutes = Math.floor(secondes / 60)
  const reste = secondes % 60

  if (minutes === 0) {
    return `${reste} s`
  }

  return reste === 0
    ? `${minutes} min`
    : `${minutes} min ${String(reste).padStart(2, "0")}`
}
