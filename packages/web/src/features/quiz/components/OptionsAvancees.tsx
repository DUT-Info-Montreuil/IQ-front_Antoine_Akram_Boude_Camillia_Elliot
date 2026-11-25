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

/** Réglages de question repris de l'éditeur Razzia, repliés par défaut. */
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
      className="group rounded-2xl border-2 border-iq-bordure"
      open={ouvert || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-bold">
        <SlidersHorizontal className="size-5 text-iq-olive" />
        {t("manager:quiz.optionsAvancees")}
        <span className="text-sm font-normal text-iq-gris">
          {t("manager:quiz.optionsAvanceesAide")}
        </span>
        <ChevronDown className="ml-auto size-5 transition group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-6 border-t-2 border-iq-bordure p-5">
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-bold">{t("manager:quiz.delaiLecture")}</span>
            <span className="flex items-center gap-3">
              <input
                type="number"
                min={DELAI_LECTURE_MIN}
                max={DELAI_LECTURE_MAX}
                className={clsx(
                  champ,
                  "w-28 font-bold",
                  erreur("options", "delaiLecture") && "border-red-400",
                )}
                value={afficher(options.delaiLecture)}
                onChange={(e) =>
                  modifier({ delaiLecture: nombre(e.target.value) })
                }
              />
              <span className="text-sm text-iq-gris">
                {t("manager:quiz.delaiLectureAide", {
                  min: DELAI_LECTURE_MIN,
                  max: DELAI_LECTURE_MAX,
                })}
              </span>
            </span>
            <MessageErreur cle={erreur("options", "delaiLecture")} />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-bold">{t("manager:quiz.penalite")}</span>
            <span className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                step={50}
                className={clsx(
                  champ,
                  "w-28 font-bold",
                  erreur("options", "penalite") && "border-red-400",
                )}
                value={afficher(options.penalite)}
                onChange={(e) => modifier({ penalite: nombre(e.target.value) })}
              />
              <span className="text-sm text-iq-gris">
                {t("manager:quiz.penaliteAide")}
              </span>
            </span>
            <MessageErreur cle={erreur("options", "penalite")} />
          </label>
        </div>

        {question.type === "QCM" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">
              {t("manager:quiz.modeScore")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES_SCORE.map((mode) => (
                <label
                  key={mode}
                  className={clsx(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3",
                    options.modeScore === mode
                      ? "border-iq-mousse bg-iq-sauge/20"
                      : "border-iq-bordure hover:bg-iq-champ",
                  )}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <input
                      type="radio"
                      name="mode-score"
                      className="accent-iq-olive"
                      checked={options.modeScore === mode}
                      onChange={() => modifier({ modeScore: mode })}
                    />
                    {t(`manager:quiz.modesScore.${mode}`)}
                  </span>
                  <span className="text-sm text-iq-gris">
                    {t(`manager:quiz.modesScoreAide.${mode}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-2">
          <span className="font-bold">{t("manager:quiz.categorie")}</span>
          <input
            className={clsx(
              champ,
              erreur("options", "categorie") && "border-red-400",
            )}
            value={options.categorie}
            maxLength={CATEGORIE_MAX}
            placeholder={t("manager:quiz.categoriePlaceholder")}
            onChange={(e) => modifier({ categorie: e.target.value })}
          />
          <span className="text-sm text-iq-gris">
            {t("manager:quiz.categorieAide")}
          </span>
          <MessageErreur cle={erreur("options", "categorie")} />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-bold">{t("manager:quiz.media")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-xl border-2 border-iq-bordure bg-white px-3 py-3 font-semibold focus:border-iq-mousse focus:outline-none"
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
                  "min-w-0 flex-1",
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
              className="flex items-center gap-2 rounded-xl border-2 border-iq-bordure bg-white px-4 py-3 font-bold hover:bg-iq-champ disabled:opacity-50"
              onClick={() => fichierRef.current?.click()}
              disabled={envoi.isPending}
            >
              {envoi.isPending ? (
                <Loader className="size-5 text-iq-olive" />
              ) : (
                <ImagePlus className="size-5" />
              )}
              {t("manager:quiz.importerMedia")}
            </button>
            {options.media && (
              <button
                type="button"
                className="rounded-lg p-2 text-iq-gris hover:text-red-600"
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
              className="max-h-40 w-fit rounded-xl border-2 border-iq-bordure object-contain"
            />
          )}
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-bold">{t("manager:quiz.note")}</span>
          <textarea
            className={clsx(
              champ,
              "min-h-20 resize-y",
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
