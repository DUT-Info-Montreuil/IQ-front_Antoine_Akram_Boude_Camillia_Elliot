import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { SESSION_ROLES } from "@razzia/common/constants"
import { getRole } from "@razzia/web/lib/session"

export const Route = createFileRoute("/manager/quizz")({
  beforeLoad: () => {
    if (getRole() !== SESSION_ROLES.MANAGER) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({ to: "/manager" })
    }

    // IQ : les quiz se créent et se modifient dans un cours (écran E4,
    // /manager/cours/quiz/$coursId). L'éditeur Razzia d'origine n'est plus exposé.
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ to: "/manager/cours" })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
