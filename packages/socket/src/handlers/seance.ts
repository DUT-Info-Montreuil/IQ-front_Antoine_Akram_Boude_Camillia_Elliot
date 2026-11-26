import type { SocketHandler } from "@razzia/socket/handlers/types"
import { EVENTS } from "@razzia/common/constants"
import { DomainError } from "@razzia/socket/services/errors"
import { ouvrirQuiz } from "@razzia/socket/services/seance"

/** Événements IQ de la séance (Tableau 35) : manager:openQuiz. */
export const seanceSocketHandlers: SocketHandler = ({ socket }) => {
  socket.on(EVENTS.MANAGER.OPEN_QUIZ, (message) => {
    ouvrirQuiz(message, socket.data)
      .then((ouverte) => {
        socket.emit(EVENTS.MANAGER.QUIZ_OPENED, ouverte)
      })
      .catch((error: unknown) => {
        // Figure 12 : chaque refus part en game:errorMessage vers l'émetteur.
        if (error instanceof DomainError) {
          socket.emit(EVENTS.GAME.ERROR_MESSAGE, error.key)

          return
        }

        console.error("manager:openQuiz:", error)
        socket.emit(
          EVENTS.GAME.ERROR_MESSAGE,
          "errors:seance.ouvertureImpossible",
        )
      })
  })
}
