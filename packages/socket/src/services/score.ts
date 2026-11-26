/**
 * ScoreService (dossier de conception, Tableau 41 et fiche du CU 2.3), pour les QCM.
 * Fonctions pures : le moteur et ReponseService les appellent.
 */

export interface PropositionNotee {
  idProposition: number
  points: number
}

export interface QuestionNotee {
  pointsMax: number
  dureeMs: number
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

/**
 * ScoreService.evaluer pour un QCM : somme des points des propositions cochées,
 * ramenée entre 0 et points_max. Renvoie null si le contenu est mal formé
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

  const somme = cochees.reduce((total, p) => total + (p?.points ?? 0), 0)
  const pointsReponse = Math.min(Math.max(somme, 0), question.pointsMax)

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
