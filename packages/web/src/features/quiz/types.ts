/**
 * Quiz d'un cours (dossier de conception, tableau 36 : QuizSaisie, QuestionSaisie).
 * Trois types de question : QCM (propositions), RELIER (paires) et LIBRE
 * (expressions régulières). Seule la liste du type choisi est utilisée.
 * `options` et `optionsPartie` reprennent les réglages du moteur Razzia.
 * À déplacer dans @razzia/common quand le back exposera /api/cours/{id}/quiz.
 */

export type ModeAffichage = "STATISTIQUES" | "CLASSEMENT" | "AUCUN"

export type TypeQuestion = "QCM" | "RELIER" | "LIBRE"

/** Calcul des points d'un QCM à plusieurs bonnes réponses (moteur Razzia). */
export type ModeScore = "STRICT" | "EQUILIBRE" | "INDULGENT"

export type TypeMedia = "IMAGE" | "VIDEO" | "AUDIO"

export interface PropositionSaisie {
  libelle: string
  estCorrecte: boolean
  points: number
}

export interface PaireSaisie {
  gauche: string
  droite: string
}

export interface ExpressionSaisie {
  /** Expression régulière (moteur RE2 côté serveur), sans délimiteurs. */
  motif: string
  points: number
}

export interface MediaQuestion {
  type: TypeMedia
  url: string
}

/** Réglages avancés d'une question, repris de l'éditeur Razzia. */
export interface OptionsQuestion {
  /** Secondes d'affichage de l'énoncé avant l'ouverture des réponses (3 à 15). */
  delaiLecture: number
  /** Points retirés au classement pour une mauvaise réponse. */
  penalite: number
  modeScore: ModeScore
  /** Les questions consécutives d'une même catégorie forment une manche. */
  categorie: string
  /** Explication affichée avec la bonne réponse. */
  note: string
  media: MediaQuestion | null
}

export interface QuestionSaisie {
  type: TypeQuestion
  enonce: string
  dureeSecondes: number
  pointsMax: number
  propositions: PropositionSaisie[]
  paires: PaireSaisie[]
  expressions: ExpressionSaisie[]
  options: OptionsQuestion
}

/** Réglages de la partie, repris des paramètres de partie Razzia. */
export interface OptionsPartie {
  /** Les étudiants choisissent parmi des pseudos générés. */
  pseudosGeneres: boolean
  /** Les téléphones n'affichent que les boutons de réponse. */
  reponsesSeulement: boolean
}

export interface QuizSaisie {
  titre: string
  apresPage: number
  rang: number
  modeAffichage: ModeAffichage
  afficherLeaderboard: boolean
  sertNotation: boolean
  optionsPartie: OptionsPartie
  questions: QuestionSaisie[]
}

export interface Quiz extends QuizSaisie {
  id: number
  idCours: number
}
