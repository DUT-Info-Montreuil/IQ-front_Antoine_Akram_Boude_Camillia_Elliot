import "@fontsource-variable/montserrat/wght.css"
import { useQuery } from "@tanstack/react-query"
import clsx from "clsx"
import { Play, X } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Player } from "@razzia/common/types/game"
import { EVENTS } from "@razzia/common/constants"
import AlertDialog from "@razzia/web/components/AlertDialog"
import { coursQuery } from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { quizQuery } from "@razzia/web/features/quiz/queries"
import {
  type ContexteSeance,
  formaterCode,
} from "@razzia/web/features/seance/contexte"

const COULEURS_PSEUDO = [
  "bg-iq-creme",
  "bg-iq-or",
  "bg-iq-saumon",
  "bg-iq-ciel",
  "bg-iq-sauge",
]

const PSEUDOS_VISIBLES = 16

const ETAPES = [
  { cle: "manager:seance.etapeScanner", couleur: "bg-iq-citron" },
  { cle: "manager:seance.etapeConnexion", couleur: "bg-iq-saumon" },
  { cle: "manager:seance.etapePseudo", couleur: "bg-iq-ciel" },
]

type Joueur = Player & { timedOut?: boolean }

interface Props {
  inviteCode: string
  contexte: ContexteSeance
  onLancer: () => void
  onTerminer: () => void
}

/** Salle d'attente projetée à l'ouverture d'un quiz (maquette E5, CU 2.1). */
const SalleAttente = ({
  inviteCode,
  contexte,
  onLancer,
  onTerminer,
}: Props) => {
  const { gameId, players, updateManager } = useManagerStore()
  const { socket } = useSocket()
  const [joueurs, setJoueurs] = useState<Joueur[]>(players)
  const { t } = useTranslation()

  const cours = useQuery({
    ...coursQuery(contexte.cours ?? 0),
    enabled: Boolean(contexte.cours),
  })
  const quiz = useQuery({
    ...quizQuery(contexte.quiz ?? 0),
    enabled: Boolean(contexte.quiz),
  })

  // Étudiants inscrits d'office (quiz suivant de la séance) avant l'affichage
  // de la salle : la reconnexion du gestionnaire renvoie la liste complète.
  useEvent(EVENTS.MANAGER.SUCCESS_RECONNECT, ({ players: inscrits }) => {
    setJoueurs(inscrits)
  })

  // Mêmes événements que la salle d'attente de Razzia (features/game/.../Room).
  useEvent(EVENTS.MANAGER.NEW_PLAYER, (joueur) => {
    setJoueurs((liste) => [...liste, joueur])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (id) => {
    setJoueurs((liste) => liste.filter((j) => j.id !== id))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (id) => {
    setJoueurs((liste) => liste.filter((j) => j.id !== id))
  })

  useEvent(
    EVENTS.MANAGER.PLAYER_UPDATED,
    ({ previousId, player, timedOut }) => {
      setJoueurs((liste) =>
        liste.map((j) => (j.id === previousId ? { ...player, timedOut } : j)),
      )
    },
  )

  // Le compteur des écrans Razzia suivants lit les joueurs dans le store.
  useEffect(() => {
    updateManager({ players: joueurs })
  }, [joueurs, updateManager])

  const retirer = (playerId: string) => () => {
    if (gameId) {
      socket.emit(EVENTS.MANAGER.KICK_PLAYER, { gameId, playerId })
    }
  }

  const urlAcces = `${window.location.origin}?pin=${inviteCode}`
  const hote = window.location.host
  // Seuls les QCM sont joués en séance (RELIER et LIBRE : lot 2).
  const nbQuestions = quiz.data?.questions.filter(
    (q) => q.type === "QCM",
  ).length
  const surtitre = [
    cours.data?.codeRessource,
    t("manager:seance.quiz"),
    quiz.data?.titre,
  ]
    .filter(Boolean)
    .join(" · ")
  const visibles = joueurs.slice(0, PSEUDOS_VISIBLES)
  const autres = joueurs.length - visibles.length

  const piedDePage = [
    contexte.page &&
      cours.data &&
      t("manager:seance.pageDuDeroule", {
        page: contexte.page,
        total: cours.data.nbPages,
      }),
    nbQuestions !== undefined &&
      t("manager:seance.nbQuestions", { nb: nbQuestions }),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex min-h-svh flex-col bg-iq-foret bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[22px_22px] font-iq text-iq-creme antialiased">
      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-8 py-12 lg:grid-cols-[1fr_auto]">
        <section className="flex flex-col gap-8">
          <div>
            <p className="mb-3 text-lg font-extrabold tracking-[0.15em] text-iq-citron uppercase">
              {surtitre}
            </p>
            <h1 className="text-5xl leading-tight font-black lg:text-7xl">
              {t("manager:seance.sortezTelephones")}
            </h1>
          </div>

          <ol className="flex flex-col gap-4 text-xl lg:text-2xl">
            {ETAPES.map(({ cle, couleur }, index) => (
              <li key={cle} className="flex items-center gap-4">
                <span
                  className={clsx(
                    "flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-black text-iq-foret",
                    couleur,
                  )}
                >
                  {index + 1}
                </span>
                {t(cle)}
              </li>
            ))}
          </ol>

          <div className="rounded-3xl bg-iq-foret-clair p-6">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <p className="text-2xl font-bold">
                <span className="mr-2 text-4xl font-black text-iq-citron">
                  {joueurs.length}
                </span>
                {t("manager:seance.etudiantsConnectes")}
              </p>
              <p className="flex items-center gap-2 text-white/70">
                <span className="size-2.5 animate-pulse rounded-full bg-iq-sauge" />
                {t("manager:seance.enDirect")}
              </p>
            </div>

            {joueurs.length === 0 ? (
              <p className="text-white/60">{t("manager:seance.enAttente")}</p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {visibles.map((joueur, index) => (
                  <li key={joueur.id}>
                    <button
                      type="button"
                      className={clsx(
                        "group flex items-center gap-1 rounded-full px-4 py-2 text-lg font-bold text-iq-foret transition hover:line-through",
                        COULEURS_PSEUDO[index % COULEURS_PSEUDO.length],
                        !joueur.connected && "opacity-50",
                      )}
                      onClick={retirer(joueur.id)}
                      title={t("manager:seance.retirer", {
                        pseudo: joueur.username,
                      })}
                    >
                      {joueur.username}
                      <X className="hidden size-4 group-hover:block" />
                    </button>
                  </li>
                ))}
                {autres > 0 && (
                  <li className="rounded-full border-2 border-dashed border-iq-sauge/60 px-4 py-2 text-lg font-bold text-iq-creme/80">
                    {t("manager:seance.autres", { nb: autres })}
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        <aside className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 text-iq-foret shadow-[0_10px_0_rgba(0,0,0,0.25)]">
          <QRCodeSVG
            value={urlAcces}
            className="h-auto w-full"
            fgColor="#1e3318"
            marginSize={0}
            title={t("manager:seance.qrCode")}
          />
          <p className="text-center text-iq-gris">
            {t("manager:seance.ouSur")} <b className="text-iq-foret">{hote}</b>{" "}
            {t("manager:seance.avecLeCode")}
          </p>
          <p className="text-6xl font-black tracking-tight tabular-nums">
            {formaterCode(inviteCode)}
          </p>
        </aside>
      </main>

      <footer className="bg-black/25">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-8 py-4">
          <AlertDialog
            trigger={
              <button
                className={`${bouton.base} border-2 border-iq-olive bg-transparent px-5 py-3 text-iq-creme hover:bg-iq-foret-clair`}
              >
                {t("manager:seance.terminer")}
              </button>
            }
            title={t("manager:seance.terminer")}
            description={t("manager:seance.terminerConfirmation")}
            confirmLabel={t("manager:seance.terminer")}
            onConfirm={onTerminer}
          />
          <p className="text-white/60">{piedDePage}</p>
          <button className={bouton.citron} onClick={onLancer}>
            <Play className="size-4 fill-current" />
            {t("manager:seance.lancerQuestion", { numero: 1 })}
          </button>
        </div>
      </footer>
    </div>
  )
}

export default SalleAttente
