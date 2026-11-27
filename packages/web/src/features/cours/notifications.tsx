import { toast } from "react-hot-toast"

/**
 * Notifications des écrans IQ. Elles passent par react-hot-toast (déjà utilisé
 * par Razzia) mais dans leur propre conteneur, IqToaster, à la charte IQ :
 * le Toaster global de Razzia n'est pas touché.
 */
export const IQ_TOASTER = "iq"

const DUREE_SUCCES_MS = 4500

const DUREE_ERREUR_MS = 7000

interface Contenu {
  titre: string
  description?: string
}

const Texte = ({ titre, description }: Contenu) => (
  <div className="min-w-0">
    <p className="leading-snug font-extrabold">{titre}</p>
    {description && (
      <p className="mt-1 text-sm leading-snug text-iq-gris">{description}</p>
    )}
  </div>
)

/** `id` remplace une notification existante (par exemple un chargement qui aboutit). */
export const notifier = {
  succes: (contenu: Contenu, id?: string) =>
    toast.success(<Texte {...contenu} />, {
      id,
      toasterId: IQ_TOASTER,
      duration: DUREE_SUCCES_MS,
    }),

  erreur: (contenu: Contenu, id?: string) =>
    toast.error(<Texte {...contenu} />, {
      id,
      toasterId: IQ_TOASTER,
      duration: DUREE_ERREUR_MS,
      ariaProps: { role: "alert", "aria-live": "assertive" },
    }),

  chargement: (contenu: Contenu, id?: string) =>
    toast.loading(<Texte {...contenu} />, { id, toasterId: IQ_TOASTER }),

  fermer: (id: string) => toast.dismiss(id, IQ_TOASTER),
}
