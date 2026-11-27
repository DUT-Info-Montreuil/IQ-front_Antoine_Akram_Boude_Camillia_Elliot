import clsx from "clsx"
import { CircleAlert } from "lucide-react"
import { motion, type TargetAndTransition } from "motion/react"

/** Remplissage de la barre de la carte du fichier (modale d'import, E2). */
export type EtatBarre =
  | { type: "vide" }
  | { type: "indetermine" }
  | { type: "partiel"; ratio: number }
  | { type: "complet" }
  | { type: "refuse" }

const largeur = (etat: EtatBarre) => {
  if (etat.type === "partiel") {
    return `${Math.round(etat.ratio * 100)}%`
  }

  return etat.type === "vide" ? "0%" : "100%"
}

/**
 * Barre de progression : segment qui glisse tant que la durée est inconnue
 * (lecture du PDF, enregistrement), remplissage réel pendant l'envoi.
 */
export const BarreProgression = ({ etat }: { etat: EtatBarre }) => (
  <div
    className="relative my-2 h-2 overflow-hidden rounded-full bg-white/70"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={
      etat.type === "partiel" ? Math.round(etat.ratio * 100) : undefined
    }
  >
    {etat.type === "indetermine" ? (
      <span className="absolute inset-y-0 left-0 w-2/5 animate-iq-indetermine rounded-full bg-iq-mousse" />
    ) : (
      <motion.span
        className={clsx(
          "absolute inset-y-0 left-0 rounded-full",
          etat.type === "refuse" ? "bg-red-400" : "bg-[#2f7d3a]",
        )}
        initial={false}
        animate={{ width: largeur(etat) }}
        transition={{ type: "spring", stiffness: 140, damping: 24 }}
      />
    )}
  </div>
)

/** Légère secousse horizontale pour signaler un refus. */
export const SECOUSSE: TargetAndTransition = {
  x: [0, -7, 7, -4, 4, 0],
  transition: { duration: 0.42, ease: "easeInOut" },
}

interface BanniereProps {
  message: string
  aide: string
  /** Change à chaque nouvelle erreur, pour rejouer l'animation. */
  essai: number
  id: string
}

/** Erreur du fichier : ce qui s'est passé, puis quoi faire. */
export const BanniereErreur = ({ message, aide, essai, id }: BanniereProps) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: "auto" }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.22, ease: "easeOut" }}
    className="overflow-hidden"
  >
    <motion.div
      key={essai}
      id={id}
      role="alert"
      animate={SECOUSSE}
      className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 ring-1 ring-red-200">
        <CircleAlert className="size-5" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="leading-snug font-bold text-red-700">{message}</p>
        <p className="mt-1 text-sm leading-snug text-iq-gris">{aide}</p>
      </div>
    </motion.div>
  </motion.div>
)
