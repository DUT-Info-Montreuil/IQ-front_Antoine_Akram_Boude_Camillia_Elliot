import "@fontsource-variable/montserrat/wght.css"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { SESSION_ROLES } from "@razzia/common/constants"
import { getRole } from "@razzia/web/lib/session"

const CoursLayout = () => (
  <div className="min-h-svh bg-iq-fond font-iq text-iq-texte antialiased">
    <Outlet />
  </div>
)

export const Route = createFileRoute("/manager/cours")({
  // Accès gestionnaire Razzia en attendant le rôle ENSEIGNANT issu du LDAP (CU 1.1).
  beforeLoad: () => {
    if (getRole() !== SESSION_ROLES.MANAGER) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({ to: "/manager" })
    }
  },
  component: CoursLayout,
})
