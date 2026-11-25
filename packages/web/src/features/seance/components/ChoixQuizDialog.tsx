import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { ArrowRight, Check, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { STATUS } from "@razzia/common/types/game/status"
import Loader from "@razzia/web/components/Loader"
import { bouton } from "@razzia/web/features/cours/ui"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import {
  createGame,
  quizzListQuery,
} from "@razzia/web/features/manager/queries"
import { ApiError } from "@razzia/web/lib/api"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  idCours: number
  page: number
}

/**
 * Choix du quiz à ouvrir pendant la présentation.
 * Provisoire : quand les quiz seront placés dans le déroulé (SCRUM-12),
 * le quiz s'ouvrira directement en arrivant sur sa page.
 */
const ChoixQuizDialog = ({ open, onOpenChange, idCours, page }: Props) => {
  const { data, isPending } = useQuery({ ...quizzListQuery(), enabled: open })
  const { updateManager } = useManagerStore()
  const [choisi, setChoisi] = useState<string | null>(null)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { mutate: ouvrir, isPending: ouverture } = useMutation({
    mutationFn: createGame,
    onSuccess: ({ gameId, inviteCode }) => {
      updateManager({
        gameId,
        inviteCode,
        players: [],
        status: createStatus(STATUS.SHOW_ROOM, {
          text: "game:waitingForPlayers",
          inviteCode,
        }),
      })
      navigate({
        to: "/party/manager/$gameId",
        params: { gameId },
        search: { cours: idCours, page, quiz: choisi ?? undefined },
      })
    },
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:quizz.notFound"),
      )
    },
  })

  const quiz = data?.quizz ?? []

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => !ouverture && onOpenChange(o)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-white font-iq text-iq-texte shadow-2xl">
          <div className="flex items-center justify-between gap-4 bg-iq-foret px-8 py-5">
            <Dialog.Title className="text-2xl font-extrabold text-iq-creme">
              {t("manager:seance.ouvrirQuiz")}
            </Dialog.Title>
            <Dialog.Close
              className="flex size-10 items-center justify-center rounded-xl bg-iq-foret-clair text-iq-creme hover:brightness-125"
              title={t("common:close")}
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-8 pt-5 text-iq-gris">
            {t("manager:seance.choixQuizDescription")}
          </Dialog.Description>

          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-8 py-5">
            {isPending && (
              <li className="flex justify-center py-6">
                <Loader className="size-10 text-iq-olive" />
              </li>
            )}
            {quiz.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className={clsx(
                    "flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left font-bold transition-colors",
                    choisi === q.id
                      ? "border-iq-mousse bg-iq-sauge/25"
                      : "border-iq-bordure hover:bg-iq-champ",
                  )}
                  aria-pressed={choisi === q.id}
                  onClick={() => setChoisi(q.id)}
                >
                  <span className="truncate">{q.subject}</span>
                  {choisi === q.id && (
                    <Check className="size-5 shrink-0 text-iq-olive" />
                  )}
                </button>
              </li>
            ))}
            {!isPending && quiz.length === 0 && (
              <li className="py-6 text-center text-iq-gris">
                {t("manager:seance.aucunQuiz")}
              </li>
            )}
          </ul>

          <div className="flex justify-end gap-3 border-t border-iq-bordure px-8 py-5">
            <Dialog.Close asChild>
              <button className={bouton.contour} disabled={ouverture}>
                {t("common:cancel")}
              </button>
            </Dialog.Close>
            <button
              className={bouton.principal}
              disabled={!choisi || ouverture}
              onClick={() => choisi && ouvrir(choisi)}
            >
              {ouverture && <Loader className="size-5" />}
              {t("manager:seance.ouvrir")}
              {!ouverture && <ArrowRight className="size-5" />}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default ChoixQuizDialog
