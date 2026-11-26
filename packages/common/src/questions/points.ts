/**
 * Barème par défaut d'un QCM : `maxPoints` partagé à parts égales entre les
 * bonnes réponses, le reste de la division allant aux premières. La somme vaut
 * donc exactement `maxPoints`, et une mauvaise réponse vaut 0.
 * Une bonne réponse vaut au moins 1 point : si `maxPoints` est plus petit que
 * le nombre de bonnes réponses, la somme le dépasse et le validateur le refuse.
 */
export const repartirPoints = (
  nbPropositions: number,
  solutions: number[],
  maxPoints: number,
): number[] => {
  const bonnes = [...new Set(solutions)]
    .filter((indice) => indice >= 0 && indice < nbPropositions)
    .sort((a, b) => a - b)

  const part = Math.floor(maxPoints / Math.max(bonnes.length, 1))
  const reste = maxPoints - part * bonnes.length

  return Array.from({ length: nbPropositions }, (_, indice) => {
    const rang = bonnes.indexOf(indice)

    if (rang === -1) {
      return 0
    }

    return Math.max(1, part + (rang < reste ? 1 : 0))
  })
}
