import clsx from "clsx"
import { CircleAlert, Info, X } from "lucide-react"
import {
  AnimatePresence,
  motion,
  MotionConfig,
  type PanInfo,
} from "motion/react"
import { useSyncExternalStore } from "react"
import { resolveValue, type Toast, useToaster } from "react-hot-toast"
import { useTranslation } from "react-i18next"
import Loader from "@razzia/web/components/Loader"
import { IQ_TOASTER, notifier } from "@razzia/web/features/cours/notifications"

const MAX_VISIBLES = 3

/** Distance de balayage (px) au-delà de laquelle un toast est fermé au doigt. */
const SEUIL_BALAYAGE = 90

const ECRAN_LARGE = "(min-width: 640px)"

const ecouterLargeur = (rappel: () => void) => {
  const requete = window.matchMedia(ECRAN_LARGE)

  requete.addEventListener("change", rappel)

  return () => requete.removeEventListener("change", rappel)
}

/** Les toasts arrivent du haut sur mobile, du bas (coin droit) sur ordinateur. */
const useEcranLarge = () =>
  useSyncExternalStore(
    ecouterLargeur,
    () => window.matchMedia(ECRAN_LARGE).matches,
    () => true,
  )

const COULEUR_DECOMPTE: Partial<Record<Toast["type"], string>> = {
  success: "bg-iq-mousse",
  error: "bg-red-400",
  blank: "bg-iq-ciel",
}

const IconeSucces = () => (
  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-iq-citron text-iq-foret">
    <motion.span
      aria-hidden
      className="absolute inset-0 rounded-xl bg-iq-citron"
      initial={{ scale: 1, opacity: 0.7 }}
      animate={{ scale: 1.55, opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
    />
    <svg
      viewBox="0 0 24 24"
      className="relative size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.15 }}
      />
    </svg>
  </span>
)

const IconeErreur = () => (
  <motion.span
    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200"
    initial={{ rotate: 0 }}
    animate={{ rotate: [0, -12, 10, -6, 0] }}
    transition={{ duration: 0.5, delay: 0.12 }}
  >
    <CircleAlert className="size-5" />
  </motion.span>
)

const Icone = ({ type }: { type: Toast["type"] }) => {
  if (type === "success") {
    return <IconeSucces />
  }

  if (type === "error") {
    return <IconeErreur />
  }

  if (type === "loading") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-iq-sauge/40">
        <Loader className="size-5 text-iq-olive" />
      </span>
    )
  }

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-iq-ciel/40 text-iq-foret">
      <Info className="size-5" />
    </span>
  )
}

interface CarteProps {
  toast: Toast
  depuisLeBas: boolean
}

const CarteToast = ({ toast, depuisLeBas }: CarteProps) => {
  const { t } = useTranslation()
  const fermer = () => notifier.fermer(toast.id)
  const couleur = COULEUR_DECOMPTE[toast.type]
  const decalage = depuisLeBas ? 16 : -16

  const balayer = (_: PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SEUIL_BALAYAGE) {
      fermer()
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: decalage, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.94,
        transition: { duration: 0.18, ease: "easeIn" },
      }}
      transition={{ type: "spring", stiffness: 460, damping: 34 }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.5}
      onDragEnd={balayer}
      {...toast.ariaProps}
      className="pointer-events-auto relative flex touch-pan-y items-start gap-3 overflow-hidden rounded-2xl border border-iq-bordure/80 bg-white py-4 pr-12 pl-4 font-iq text-iq-texte shadow-[0_16px_36px_-12px_rgba(30,51,24,0.38)]"
    >
      <motion.div
        key={toast.type}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 26 }}
      >
        <Icone type={toast.type} />
      </motion.div>

      <div className="min-w-0 flex-1 pt-0.5">
        {resolveValue(toast.message, toast)}
      </div>

      <button
        type="button"
        className="absolute top-3 right-3 rounded-lg p-1.5 text-iq-gris transition-colors hover:bg-iq-champ hover:text-iq-texte focus-visible:outline-2 focus-visible:outline-iq-mousse"
        onClick={fermer}
        title={t("common:close")}
        aria-label={t("common:close")}
      >
        <X className="size-4" />
      </button>

      {couleur && Number.isFinite(toast.duration) && (
        <span
          key={`decompte-${toast.type}`}
          aria-hidden
          className={clsx(
            "absolute inset-x-0 bottom-0 h-1 origin-left animate-iq-decompte group-hover:[animation-play-state:paused]",
            couleur,
          )}
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      )}
    </motion.li>
  )
}

/**
 * Conteneur des notifications IQ (voir `notifier`) : cartes blanches aux
 * arrondis et à la typo de la charte, icône animée, décompte de la durée.
 * Le survol met les toasts en pause ; on peut les fermer en les balayant.
 */
const IqToaster = () => {
  const { toasts, handlers } = useToaster(undefined, IQ_TOASTER)
  const ecranLarge = useEcranLarge()
  const visibles = toasts.filter((t) => t.visible).slice(0, MAX_VISIBLES)

  return (
    <MotionConfig reducedMotion="user">
      <ol
        data-iq-toaster
        className="group pointer-events-none fixed inset-x-3 top-3 z-[70] flex flex-col gap-3 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:w-[25rem] sm:flex-col-reverse"
        onMouseEnter={handlers.startPause}
        onMouseLeave={handlers.endPause}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visibles.map((toast) => (
            <CarteToast key={toast.id} toast={toast} depuisLeBas={ecranLarge} />
          ))}
        </AnimatePresence>
      </ol>
    </MotionConfig>
  )
}

export default IqToaster
