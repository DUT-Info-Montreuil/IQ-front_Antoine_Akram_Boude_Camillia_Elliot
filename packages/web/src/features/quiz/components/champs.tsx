import { useTranslation } from "react-i18next"
import {
  type ErreurSaisie,
  CATEGORIE_MAX,
  DELAI_LECTURE_MAX,
  DELAI_LECTURE_MIN,
  DUREE_MAX,
  DUREE_MIN,
  NOTE_MAX,
} from "@razzia/web/features/quiz/validation"

/** Lit un champ numérique : vide → NaN, que la validation signale. */
export const nombre = (valeur: string) =>
  valeur === "" ? Number.NaN : Number(valeur)

export const afficher = (valeur: number) => (Number.isNaN(valeur) ? "" : valeur)

export const champPoints =
  "w-24 rounded-xl border-2 border-iq-bordure bg-white px-3 py-2 text-center font-bold focus:border-iq-mousse focus:outline-none"

/** Recherche l'erreur d'un champ dans les erreurs d'une question. */
export const erreurDe =
  (erreurs: ErreurSaisie[]) =>
  (...chemin: Array<string | number>) =>
    erreurs.find(
      (e) =>
        e.chemin.length === chemin.length &&
        chemin.every((segment, i) => e.chemin[i] === segment),
    )?.cle

/** Message d'erreur d'un champ, avec les bornes utiles aux traductions. */
export const MessageErreur = ({ cle }: { cle: string | undefined }) => {
  const { t } = useTranslation()

  if (!cle) {
    return null
  }

  return (
    <span className="text-sm font-semibold text-red-600" role="alert">
      {t(cle, {
        min: DUREE_MIN,
        max: DUREE_MAX,
        delaiMin: DELAI_LECTURE_MIN,
        delaiMax: DELAI_LECTURE_MAX,
        categorieMax: CATEGORIE_MAX,
        noteMax: NOTE_MAX,
      })}
    </span>
  )
}
