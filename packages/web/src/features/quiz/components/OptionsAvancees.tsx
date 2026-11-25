import { useMutation } from "@tanstack/react-query"
import clsx from "clsx"
import { ChevronDown, ImagePlus, SlidersHorizontal, Trash2 } from "lucide-react"
import { type ChangeEvent, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type {
  ModeScore,
  OptionsQuestion,
  QuestionSaisie,
  TypeMedia,
} from "@razzia/web/features/quiz/types"
import Loader from "@razzia/web/components/Loader"
import { champ } from "@razzia/web/features/cours/ui"
import {
  afficher,
  erreurDe,
  MessageErreur,
  nombre,
} from "@razzia/web/features/quiz/components/champs"
import {
  CATEGORIE_MAX,
  DELAI_LECTURE_MAX,
  DELAI_LECTURE_MIN,
  type ErreurSaisie,
  NOTE_MAX,
} from "@razzia/web/features/quiz/validation"
import { uploadMedia } from "@razzia/web/features/quizz/queries"
import { ApiError } from "@razzia/web/lib/api"

const MODES_SCORE: ModeScore[] = ["STRICT", "EQUILIBRE", "INDULGENT"]

const TYPES_MEDIA: TypeMedia[] = ["IMAGE", "VIDEO", "AUDIO"]

const TYPE_DEPUIS_RAZZIA: Record<string, TypeMedia> = {
  image: "IMAGE",
  video: "VIDEO",
  audio: "AUDIO",
}

interface Props {
  question: QuestionSaisie
  erreurs: ErreurSaisie[]
  onChange: (options: OptionsQuestion) => void
}

const OptionsAvancees = ({ question, erreurs, onChange }: Props) => {
  const { t } = useTranslation()
  const fichierRef = useRef<HTMLInputElement>(null)
  const erreur = erreurDe(erreurs)
  const { options } = question
  const ouvert = erreurs.some((e) => e.chemin[0] === "options")

  const modifier = (changements: Partial<OptionsQuestion>) =>
      onChange({ ...options, ...changements })

  const envoi = useMutation({
    mutationFn: uploadMedia,
    onSuccess: (media) =>
        modifier({
          media: {
            type: TYPE_DEPUIS_RAZZIA[media.type] ?? "IMAGE",
            url: media.url,
          },
        }),
    onError: (error) =>
        toast.error(
            t(error instanceof ApiError ? error.key : "errors:media.uploadFailed"),
        ),
  })

  const choisirFichier = (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]

    if (fichier) {
      envoi.mutate(fichier)
    }

    e.target.value = ""
  }

  return (
      <details
          className="group min-w-0 overflow-hidden rounded-xl border border-iq-bordure bg-white"
          open={ouvert || undefined}
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-iq-champ/50">
          <SlidersHorizontal className="size-4 shrink-0 text-iq-olive" />

          <span className="min-w-0 flex-1 text-sm font-bold">
          {t("manager:quiz.optionsAvancees")}
        </span>

          <ChevronDown className="size-4 shrink-0 text-iq-foret transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="flex min-w-0 flex-col gap-5 border-t border-iq-bordure p-4">
          {/* Délai et pénalité */}
          <div className="flex flex-col gap-4">
            <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-bold text-iq-foret">
              {t("manager:quiz.delaiLecture")}
            </span>

              <div className="flex min-w-0 items-center gap-2">
                <input
                    type="number"
                    min={DELAI_LECTURE_MIN}
                    max={DELAI_LECTURE_MAX}
                    className={clsx(
                        champ,
                        "w-28 max-w-full text-sm font-semibold",
                        erreur("options", "delaiLecture") && "border-red-400",
                    )}
                    value={afficher(options.delaiLecture)}
                    onChange={(e) =>
                        modifier({ delaiLecture: nombre(e.target.value) })
                    }
                />

                <span className="text-xs text-iq-gris">
                {t("manager:quiz.delaiLectureAide", {
                  min: DELAI_LECTURE_MIN,
                  max: DELAI_LECTURE_MAX,
                })}
              </span>
              </div>

              <MessageErreur cle={erreur("options", "delaiLecture")} />
            </label>

            <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-bold text-iq-foret">
              {t("manager:quiz.penalite")}
            </span>

              <div className="flex min-w-0 items-center gap-2">
                <input
                    type="number"
                    min={0}
                    step={50}
                    className={clsx(
                        champ,
                        "w-28 max-w-full text-sm font-semibold",
                        erreur("options", "penalite") && "border-red-400",
                    )}
                    value={afficher(options.penalite)}
                    onChange={(e) => modifier({ penalite: nombre(e.target.value) })}
                />

                <span className="text-xs text-iq-gris">
                {t("manager:quiz.penaliteAide")}
              </span>
              </div>

              <MessageErreur cle={erreur("options", "penalite")} />
            </label>
          </div>

          {/* Modes de calcul */}
          {question.type === "QCM" && (
              <fieldset className="flex min-w-0 flex-col gap-3">
                <legend className="mb-2 text-sm font-bold leading-snug text-iq-foret">
                  {t("manager:quiz.modeScore")}
                </legend>

                <div className="flex flex-col gap-2">
                  {MODES_SCORE.map((mode) => {
                    const selectionne = options.modeScore === mode

                    return (
                        <label
                            key={mode}
                            className={clsx(
                                "flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-colors",
                                selectionne
                                    ? "border-iq-mousse bg-iq-sauge/20"
                                    : "border-iq-bordure bg-white hover:border-iq-mousse hover:bg-iq-champ/50",
                            )}
                        >
                    <span className="flex items-center gap-2">
                      <input
                          type="radio"
                          name="mode-score"
                          className="size-4 shrink-0 accent-iq-olive"
                          checked={selectionne}
                          onChange={() => modifier({ modeScore: mode })}
                      />

                      <span className="text-sm font-bold text-iq-foret">
                        {t(`manager:quiz.modesScore.${mode}`)}
                      </span>

                      {selectionne && (
                          <span className="ml-auto text-xs font-semibold text-iq-olive">
                          ✓
                        </span>
                      )}
                    </span>

                          <span className="pl-6 text-xs leading-relaxed text-iq-gris">
                      {t(`manager:quiz.modesScoreAide.${mode}`)}
                    </span>
                        </label>
                    )
                  })}
                </div>
              </fieldset>
          )}

          {/* Catégorie */}
          <label className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-bold text-iq-foret">
            {t("manager:quiz.categorie")}
          </span>

            <input
                className={clsx(
                    champ,
                    "min-w-0 text-sm",
                    erreur("options", "categorie") && "border-red-400",
                )}
                value={options.categorie}
                maxLength={CATEGORIE_MAX}
                placeholder={t("manager:quiz.categoriePlaceholder")}
                onChange={(e) => modifier({ categorie: e.target.value })}
            />

            <span className="text-xs leading-relaxed text-iq-gris">
            {t("manager:quiz.categorieAide")}
          </span>

            <MessageErreur cle={erreur("options", "categorie")} />
          </label>

          {/* Média */}
          <div className="flex min-w-0 flex-col gap-3">
          <span className="text-sm font-bold text-iq-foret">
            {t("manager:quiz.media")}
          </span>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <select
                  className="max-w-full rounded-lg border border-iq-bordure bg-white px-3 py-2 text-sm font-semibold focus:border-iq-mousse focus:outline-none"
                  value={options.media?.type ?? ""}
                  aria-label={t("manager:quiz.typeMedia")}
                  onChange={(e) =>
                      modifier({
                        media: e.target.value
                            ? {
                              type: e.target.value as TypeMedia,
                              url: options.media?.url ?? "",
                            }
                            : null,
                      })
                  }
              >
                <option value="">{t("manager:quiz.sansMedia")}</option>

                {TYPES_MEDIA.map((type) => (
                    <option key={type} value={type}>
                      {t(`manager:quiz.typesMedia.${type}`)}
                    </option>
                ))}
              </select>

              {options.media && (
                  <input
                      className={clsx(
                          champ,
                          "min-w-0 flex-1 text-sm",
                          erreur("options", "media", "url") && "border-red-400",
                      )}
                      value={options.media.url}
                      placeholder={t("manager:quiz.urlMediaPlaceholder")}
                      aria-label={t("manager:quiz.urlMedia")}
                      onChange={(e) =>
                          modifier({
                            media: {
                              type: options.media?.type ?? "IMAGE",
                              url: e.target.value,
                            },
                          })
                      }
                  />
              )}

              <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-iq-bordure bg-white px-3 py-2 text-sm font-bold transition hover:bg-iq-champ disabled:opacity-50"
                  onClick={() => fichierRef.current?.click()}
                  disabled={envoi.isPending}
              >
                {envoi.isPending ? (
                    <Loader className="size-4 text-iq-olive" />
                ) : (
                    <ImagePlus className="size-4" />
                )}

                {t("manager:quiz.importerMedia")}
              </button>

              {options.media && (
                  <button
                      type="button"
                      className="rounded-lg p-2 text-iq-gris transition hover:bg-red-50 hover:text-red-600"
                      onClick={() => modifier({ media: null })}
                      title={t("manager:quiz.retirerMedia")}
                  >
                    <Trash2 className="size-4" />
                  </button>
              )}

              <input
                  ref={fichierRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={choisirFichier}
              />
            </div>

            <MessageErreur cle={erreur("options", "media", "url")} />

            {options.media?.type === "IMAGE" && options.media.url && (
                <img
                    src={options.media.url}
                    alt=""
                    className="max-h-32 w-fit rounded-lg border border-iq-bordure object-contain"
                />
            )}
          </div>

          {/* Note */}
          <label className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-bold text-iq-foret">
            {t("manager:quiz.note")}
          </span>

            <textarea
                className={clsx(
                    champ,
                    "min-h-20 min-w-0 resize-y text-sm",
                    erreur("options", "note") && "border-red-400",
                )}
                value={options.note}
                maxLength={NOTE_MAX}
                placeholder={t("manager:quiz.notePlaceholder")}
                onChange={(e) => modifier({ note: e.target.value })}
            />

            <MessageErreur cle={erreur("options", "note")} />
          </label>
        </div>
      </details>
  )
}

export default OptionsAvancees
