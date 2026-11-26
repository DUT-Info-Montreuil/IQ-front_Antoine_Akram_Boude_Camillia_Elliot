import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import logoIq from "@razzia/web/assets/iq/logo-iq.png"
import { UTILISATEUR_MOCK } from "@razzia/web/features/cours/api/mock"
import { initiales } from "@razzia/web/features/cours/ui"

/** Barre de navigation de l'espace enseignant (maquette E2). */
const IqHeader = () => {
  const { t } = useTranslation()
  // Remplacé par GET /api/auth/moi avec l'authentification LDAP (CU 1.1).
  const { prenom, nom } = UTILISATEUR_MOCK

  return (
    <header className="border-b-4 border-iq-olive bg-iq-foret">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-6">
        <img src={logoIq} alt="IQ" className="h-14 w-auto" />

        <nav className="flex items-center gap-2">
          <Link
            to="/manager/cours"
            className="rounded-xl px-4 py-2 font-bold text-white/80 hover:text-white"
            activeProps={{
              className:
                "bg-iq-olive !text-white shadow-[0_3px_0_var(--color-iq-sauge)]",
            }}
            activeOptions={{ exact: true }}
          >
            {t("manager:cours.mesCours")}
          </Link>
          {/* Accès temporaire aux écrans Razzia d'origine, utilisés par les autres stories du sprint. */}
          <Link
            to="/manager/config"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white/50 hover:text-white/80"
          >
            {t("manager:cours.espaceRazzia")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-white/85 sm:inline">
            {prenom} {nom}
          </span>
          <span
            className="flex size-11 items-center justify-center rounded-full bg-iq-saumon font-bold text-iq-foret"
            aria-hidden
          >
            {initiales(prenom, nom)}
          </span>
        </div>
      </div>
    </header>
  )
}

export default IqHeader
