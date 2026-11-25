import { FileText, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ModeAffichage, QuizSaisie } from "@razzia/web/features/quiz/types"
import AlertDialog from "@razzia/web/components/AlertDialog"

const MODES: Array<{ valeur: ModeAffichage; cle: string }> = [
  { valeur: "STATISTIQUES", cle: "manager:quiz.modeStatistiques" },
  { valeur: "CLASSEMENT", cle: "manager:quiz.modeClassement" },
  { valeur: "AUCUN", cle: "manager:quiz.modeAucun" },
]

interface Props {
  saisie: QuizSaisie
  nbPages: number
  onChange: (changements: Partial<QuizSaisie>) => void
  /** Présent en modification seulement. */
  onSupprimer?: () => void
}

/** Paramètres du quiz (maquette E4, à droite). */
const ParametresQuiz = ({ saisie, nbPages, onChange, onSupprimer }: Props) => {
  const { t } = useTranslation()

  return (
    <aside className="flex flex-col gap-5 rounded-3xl bg-white p-7 shadow-[0_6px_20px_rgba(30,51,24,0.06)]">
      <h2 className="text-2xl font-extrabold">
        {t("manager:quiz.parametres")}
      </h2>

      <label className="flex items-center gap-3 rounded-2xl bg-iq-fond px-4 py-3">
        <FileText className="size-5 shrink-0" />
        <span className="text-iq-gris">{t("manager:quiz.placeApres")}</span>
        <select
          className="ml-auto rounded-lg border-2 border-iq-bordure bg-white px-2 py-1 font-bold focus:border-iq-mousse focus:outline-none"
          value={saisie.apresPage}
          onChange={(e) =>
            onChange({
              apresPage: Number(e.target.value),
              rang: Number.MAX_SAFE_INTEGER,
            })
          }
        >
          {Array.from({ length: nbPages }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {t("manager:cours.pageCourte", { numero: index + 1 })}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-bold">
          {t("manager:quiz.apresChaqueQuestion")}
        </legend>
        {MODES.map(({ valeur, cle }) => (
          <label
            key={valeur}
            className="flex cursor-pointer items-center gap-3"
          >
            <input
              type="radio"
              name="mode-affichage"
              className="size-5 accent-iq-olive"
              checked={saisie.modeAffichage === valeur}
              onChange={() => onChange({ modeAffichage: valeur })}
            />
            {t(cle)}
          </label>
        ))}
      </fieldset>

      <hr className="border-dashed border-iq-bordure" />

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-iq-olive"
          checked={saisie.afficherLeaderboard}
          onChange={(e) => onChange({ afficherLeaderboard: e.target.checked })}
        />
        {t("manager:quiz.afficherLeaderboard")}
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-iq-olive"
          checked={saisie.sertNotation}
          onChange={(e) => onChange({ sertNotation: e.target.checked })}
        />
        {t("manager:quiz.sertNotation")}
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-bold">
          {t("manager:quiz.optionsPartie")}
        </legend>
        {(
          [
            [
              "pseudosGeneres",
              "manager:quiz.pseudosGeneres.libelle",
              "manager:quiz.pseudosGeneres.aide",
            ],
            [
              "reponsesSeulement",
              "manager:quiz.reponsesSeulement.libelle",
              "manager:quiz.reponsesSeulement.aide",
            ],
          ] as const
        ).map(([option, libelle, aide]) => (
          <label key={option} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-iq-olive"
              checked={saisie.optionsPartie[option]}
              onChange={(e) =>
                onChange({
                  optionsPartie: {
                    ...saisie.optionsPartie,
                    [option]: e.target.checked,
                  },
                })
              }
            />
            <span>
              {t(libelle)}
              <span className="block text-sm text-iq-gris">{t(aide)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="rounded-2xl bg-iq-foret p-5 text-iq-creme">
        <p className="mb-1 font-extrabold text-iq-citron">
          {t("manager:quiz.bonusRapidite")}
        </p>
        <p className="text-sm leading-relaxed text-white/80">
          {t("manager:quiz.bonusRapiditeAide")}
        </p>
      </div>

      {onSupprimer && (
        <AlertDialog
          trigger={
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-bold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-4" />
              {t("manager:quiz.supprimer")}
            </button>
          }
          title={t("manager:quiz.supprimer")}
          description={t("manager:quiz.supprimerConfirmation", {
            titre: saisie.titre,
          })}
          confirmLabel={t("common:delete")}
          onConfirm={onSupprimer}
        />
      )}
    </aside>
  )
}

export default ParametresQuiz
