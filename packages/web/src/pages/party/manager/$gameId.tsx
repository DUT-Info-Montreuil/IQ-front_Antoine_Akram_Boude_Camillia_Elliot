import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useSocketConnection } from "@razzia/web/features/game/hooks/useSocketConnection"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS_MANAGER,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import SalleAttente from "@razzia/web/features/seance/components/SalleAttente"
import { contexteSeanceSchema } from "@razzia/web/features/seance/contexte"

const ManagerGamePage = () => {
  const navigate = useNavigate()
  const { gameId: gameIdParam } = useParams({ from: "/party/manager/$gameId" })
  const contexte = Route.useSearch()
  const { socket, isConnected } = useSocket()
  const { gameId, status, updateManager, resetManager } = useManagerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  useSocketConnection()

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS_MANAGER) {
      updateManager({ status: createStatus(name, data) })
    }
  })

  useEffect(() => {
    if (isConnected && gameIdParam) {
      socket.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
    }
  }, [isConnected, gameIdParam, socket])

  useEvent(
    EVENTS.MANAGER.SUCCESS_RECONNECT,
    ({
      gameId: reconnectGameId,
      inviteCode,
      settings,
      locked,
      status: reconnectStatus,
      players,
      currentQuestion,
    }) => {
      updateManager({
        gameId: reconnectGameId,
        inviteCode,
        settings,
        locked,
        status: createStatus(reconnectStatus.name, reconnectStatus.data),
        players,
      })
      setQuestionStates(currentQuestion)
    },
  )

  useEvent(EVENTS.MANAGER.LOCK_UPDATED, (locked) => {
    updateManager({ locked })
  })

  useEvent(EVENTS.GAME.RESET, (message) => {
    navigate({ to: "/manager/config" })
    resetManager()
    setQuestionStates(null)
    toast.error(t(message))
  })

  // IQ : un quiz ouvert depuis une présentation y revient, dans la même
  // séance (même code d'accès pour le quiz suivant).
  const retourCours = () => {
    resetManager()
    setQuestionStates(null)

    if (contexte.cours) {
      navigate({
        to: "/manager/cours/presenter/$coursId",
        params: { coursId: String(contexte.cours) },
        search: { etape: contexte.etape, seance: contexte.seance },
      })

      return
    }

    navigate({ to: "/manager/cours" })
  }

  const handleSkip = () => {
    if (!status) {
      return
    }

    if (status.name === STATUS.FINISHED || status.name === STATUS.SUMMARY) {
      if (contexte.cours) {
        retourCours()

        return
      }

      navigate({ to: "/manager/config" })
      resetManager()
      setQuestionStates(null)

      return
    }

    if (!gameId) {
      return
    }

    if (status.name === STATUS.SHOW_ROOM) {
      socket.emit(EVENTS.MANAGER.START_GAME, { gameId })

      return
    }

    socket.emit(EVENTS.MANAGER.ADVANCE, { gameId })
  }

  const handleBack = () => {
    navigate({ to: "/manager/config" })
    resetManager()
    setQuestionStates(null)
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS_MANAGER, status.name)
      ? GAME_STATE_COMPONENTS_MANAGER[status.name]
      : null

  if (!status) {
    return null
  }

  // IQ : salle d'attente habillée selon la maquette E5 (CU 2.1).
  if (status.name === STATUS.SHOW_ROOM && gameId) {
    return (
      <SalleAttente
        inviteCode={status.data.inviteCode ?? ""}
        contexte={contexte}
        onLancer={handleSkip}
        onTerminer={retourCours}
      />
    )
  }

  return (
    <GameWrapper
      statusName={status.name}
      onNext={handleSkip}
      onBack={status.name === STATUS.SHOW_ROOM ? handleBack : undefined}
      manager
    >
      {CurrentComponent && <CurrentComponent data={status.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/manager/$gameId")({
  validateSearch: contexteSeanceSchema,
  component: ManagerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.MANAGER.LEAVE, { gameId })
  },
})
