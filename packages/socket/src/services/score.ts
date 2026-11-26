import type { OptionsQuestion } from "@razzia/common/validators/quiz"

/**
 * ScoreService (dossier de conception, Tableau 41 et fiche du CU 2.3), pour les QCM.
 * Fonctions pures : le moteur et ReponseService les appellent.
 */

export interface PropositionNotee {
  idProposition: number
  points: number
  estCorrecte: boolean
}

export interface QuestionNotee {
  pointsMax: number
  dureeMs: number
  /** Choisi par l'enseignant dans E4 pour les QCM à plusieurs bonnes réponses. */
  modeScore: OptionsQuestion["modeScore"]
  /** Dans l'ordre affiché aux étudiants : l'indice reçu du front y renvoie. */
  propositions: PropositionNotee[]
}

/**
 * Points de classement = arrondi(points de réponse × (1 + temps restant / durée)) :
 * une réponse immédiate compte double, une réponse à la dernière seconde ne garde
 * que ses points de réponse. Ils ne servent qu'au classement, pas à la note.
 */
export const pointsClassement = (
  pointsReponse: number,
  tempsRestantMs: number,
  dureeMs: number,
) => {
  const ratio = Math.min(Math.max(tempsRestantMs / dureeMs, 0), 1)

  return Math.round(pointsReponse * (1 + ratio))
}

const somme = (propositions: PropositionNotee[]) =>
  propositions.reduce((total, p) => total + p.points, 0)

/**
 * Points de réponse selon le mode de score, avant de les ramener entre 0 et
 * points_max. Une mauvaise réponse vaut 0 point : sans ces modes, cocher toutes
 * les propositions rapporterait le maximum.
 * - STRICT : les points des bonnes réponses, si elles sont toutes cochées et
 *   aucune mauvaise, sinon 0.
 * - EQUILIBRE : bonnes réponses cochées, moins une bonne réponse moyenne par
 *   mauvaise réponse cochée.
 * - INDULGENT : bonnes réponses cochées, sans pénalité.
 */
const pointsSelonMode = (
  question: QuestionNotee,
  cochees: PropositionNotee[],
) => {
  const bonnes = question.propositions.filter((p) => p.estCorrecte)
  const bonnesCochees = cochees.filter((p) => p.estCorrecte)
  const nbMauvaisesCochees = cochees.length - bonnesCochees.length

  if (question.modeScore === "STRICT") {
    const sansFaute =
      bonnesCochees.length === bonnes.length && nbMauvaisesCochees === 0

    return sansFaute ? somme(bonnes) : 0
  }

  if (question.modeScore === "EQUILIBRE") {
    const moyenne = somme(bonnes) / Math.max(bonnes.length, 1)

    return Math.round(somme(bonnesCochees) - nbMauvaisesCochees * moyenne)
  }

  return somme(bonnesCochees)
}

/**
 * ScoreService.evaluer pour un QCM : points des propositions cochées selon le
 * mode de score, ramenés entre 0 et points_max. Renvoie null si le contenu est mal formé
 * (indice inconnu ou en double).
 */
export const evaluerQcm = (
  question: QuestionNotee,
  indicesCoches: number[],
  tempsRestantMs: number,
) => {
  const cochees = indicesCoches.map((indice) =>
    question.propositions.at(indice),
  )

  if (
    indicesCoches.some((indice) => !Number.isInteger(indice) || indice < 0) ||
    new Set(indicesCoches).size !== indicesCoches.length ||
    cochees.some((proposition) => proposition === undefined)
  ) {
    return null
  }

  const valides = cochees.filter((p) => p !== undefined)
  const pointsReponse = Math.min(
    Math.max(pointsSelonMode(question, valides), 0),
    question.pointsMax,
  )

  return {
    contenu: cochees.map((p) => p?.idProposition ?? 0),
    pointsReponse,
    tauxReussite:
      question.pointsMax > 0 ? pointsReponse / question.pointsMax : 0,
    pointsClassement: pointsClassement(
      pointsReponse,
      tempsRestantMs,
      question.dureeMs,
    ),
  }
}
