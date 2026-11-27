import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { ArrowRight, Check, CircleCheck, FileUp, X } from "lucide-react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { Dialog } from "radix-ui"
import {
  type ChangeEvent,
  type DragEvent,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import type {
  ImportCoursSaisie,
  ProgressionImport,
} from "@razzia/web/features/cours/types"
import Loader from "@razzia/web/components/Loader"
import {
  BanniereErreur,
  BarreProgression,
  type EtatBarre,
  SECOUSSE,
} from "@razzia/web/features/cours/components/RetoursImport"
import { notifier } from "@razzia/web/features/cours/notifications"
import { analyserPdf } from "@razzia/web/features/cours/pdf"
import { coursKeys, importerCours } from "@razzia/web/features/cours/queries"
import { bouton, champ } from "@razzia/web/features/cours/ui"
import {
  aideErreurImport,
  champDeLErreur,
  CODE_RESSOURCE_MAX,
  formaterTaille,
  importCoursSchema,
  PDF_TAILLE_MAX_MO,
  TITRE_MAX,
  titreDepuisNomFichier,
  validerFichierPdf,
} from "@razzia/web/features/cours/validation"
import { ApiError } from "@razzia/web/lib/api"

interface Erreurs {
  fichier?: string
  titre?: string
  codeRessource?: string
}

type Verification =
  | { etat: "en-cours" }
  | { etat: "ok"; nbPages: number }
  | { etat: "refuse" }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const APPARITION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.24, ease: "easeOut" },
} as const

/** Modale « Importer un cours » (maquette E2, CU 1.2). */
const ImportCoursDialog = ({ open, onOpenChange }: Props) => {
  const [fichier, setFichier] = useState<File | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [progression, setProgression] = useState<ProgressionImport | null>(null)
  const [titre, setTitre] = useState("")
  const [codeRessource, setCodeRessource] = useState("")
  const [erreurs, setErreurs] = useState<Erreurs>({})
  // Compte les erreurs de fichier, pour rejouer l'animation à chaque refus.
  const [essai, setEssai] = useState(0)
  const [survol, setSurvol] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef(0)
  // Dernier titre proposé à partir d'un nom de fichier, pour le remplacer
  // quand on change de fichier sans l'avoir retouché.
  const titreProposeRef = useRef("")
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const id = useId()

  const traduire = (cle?: string) =>
    cle ? t(cle, { max: PDF_TAILLE_MAX_MO }) : undefined

  const signalerFichier = (cle: string) => {
    setErreurs((e) => ({ ...e, fichier: cle }))
    setEssai((n) => n + 1)
  }

  const reinitialiser = () => {
    selectionRef.current += 1
    titreProposeRef.current = ""
    setFichier(null)
    setVerification(null)
    setProgression(null)
    setTitre("")
    setCodeRessource("")
    setErreurs({})
    setSurvol(false)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (saisie: ImportCoursSaisie) =>
      importerCours(saisie, setProgression),
    onMutate: () => setProgression({ etape: "envoi", ratio: 0 }),
    onSuccess: (cours) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all })
      queryClient.setQueryData(coursKeys.detail(cours.id), cours)
      notifier.succes({
        titre: t("manager:cours.importReussi"),
        description: t("manager:cours.importReussiDetail", {
          titre: cours.titre,
          nb: cours.nbPages,
        }),
      })
      onOpenChange(false)
      reinitialiser()
      navigate({
        to: "/manager/cours/$coursId",
        params: { coursId: String(cours.id) },
      })
    },
    onError: (error) => {
      const cle =
        error instanceof ApiError ? error.key : "errors:cours.importEchoue"
      const champErreur = champDeLErreur(cle)

      setProgression(null)

      // Les erreurs de titre ou de code renvoyées par l'API vont sous leur champ.
      if (champErreur === "fichier") {
        signalerFichier(cle)
      } else {
        setErreurs((e) => ({ ...e, [champErreur]: cle }))
      }
    },
  })

  const choisirFichier = async (choisi: File | undefined) => {
    if (!choisi) {
      return
    }

    const erreur = validerFichierPdf(choisi)

    // Le nouveau choix remplace toujours le précédent : un fichier refusé ne
    // laisse pas l'ancien en place (sinon c'est lui qui partirait à l'envoi).
    selectionRef.current += 1

    if (erreur) {
      setFichier(null)
      setVerification(null)
      signalerFichier(erreur)

      return
    }

    const selection = selectionRef.current

    setFichier(choisi)
    setVerification({ etat: "en-cours" })
    setErreurs((e) => ({ ...e, fichier: undefined }))

    if (!titre.trim() || titre === titreProposeRef.current) {
      const propose = titreDepuisNomFichier(choisi.name)

      titreProposeRef.current = propose
      setTitre(propose)
      setErreurs((e) => ({ ...e, titre: undefined }))
    }

    // Lecture locale avec pdf.js : nombre de pages et PDF lisible avant l'envoi.
    const analyse = await analyserPdf(choisi)

    if (selection !== selectionRef.current) {
      return
    }

    if (analyse.ok) {
      setVerification({ etat: "ok", nbPages: analyse.nbPages })
    } else {
      setVerification({ etat: "refuse" })
      signalerFichier(analyse.erreur)
    }
  }

  const retirerFichier = () => {
    selectionRef.current += 1
    setFichier(null)
    setVerification(null)
    setErreurs((e) => ({ ...e, fichier: undefined }))
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    void choisirFichier(e.target.files?.[0])
    e.target.value = ""
  }

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setSurvol(false)

    if (!isPending) {
      void choisirFichier(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    const erreurFichier =
      validerFichierPdf(fichier) ??
      (verification?.etat === "refuse" ? erreurs.fichier : null)
    const champs = importCoursSchema.safeParse({ titre, codeRessource })
    const suivantes: Erreurs = { fichier: erreurFichier ?? undefined }

    if (!champs.success) {
      for (const issue of champs.error.issues) {
        const nom = issue.path[0] as keyof Erreurs

        suivantes[nom] ??= issue.message
      }
    }

    setErreurs(suivantes)

    if (erreurFichier) {
      setEssai((n) => n + 1)
    }

    if (
      erreurFichier ||
      !champs.success ||
      !fichier ||
      verification?.etat !== "ok"
    ) {
      return
    }

    mutate({ fichier, ...champs.data })
  }

  const handleOpenChange = (valeur: boolean) => {
    if (isPending) {
      return
    }

    onOpenChange(valeur)

    if (!valeur) {
      reinitialiser()
    }
  }

  const enCours = isPending || verification?.etat === "en-cours"
  const pourcentage =
    progression?.etape === "envoi" ? Math.round(progression.ratio * 100) : null

  const etatBarre = (): EtatBarre => {
    if (progression?.etape === "envoi") {
      return { type: "partiel", ratio: progression.ratio }
    }

    if (progression?.etape === "enregistrement" || enCours) {
      return { type: "indetermine" }
    }

    if (verification?.etat === "refuse") {
      return { type: "refuse" }
    }

    return verification?.etat === "ok" ? { type: "complet" } : { type: "vide" }
  }

  const statutFichier = () => {
    if (progression?.etape === "envoi") {
      return t("manager:cours.envoiPdf", { pct: pourcentage })
    }

    if (progression?.etape === "enregistrement") {
      return t("manager:cours.enregistrementCours")
    }

    if (verification?.etat === "ok") {
      return t("manager:cours.pdfVerifie")
    }

    return verification?.etat === "refuse"
      ? t("manager:cours.pdfRefuse")
      : t("manager:cours.verificationEnCours")
  }

  const verifie = verification?.etat === "ok" && !isPending

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-iq-foret/55 data-[state=open]:animate-fade" />

        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white font-iq text-iq-texte shadow-2xl data-[state=open]:animate-fade-up data-[state=open]:animate-duration-300 data-[state=open]:animate-ease-out"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          // Un clic sur une notification IQ ne ferme pas la modale.
          onPointerDownOutside={(e) => {
            if (
              e.target instanceof Element &&
              e.target.closest("[data-iq-toaster]")
            ) {
              e.preventDefault()
            }
          }}
        >
          <MotionConfig reducedMotion="user">
            <div className="flex items-center justify-between gap-4 bg-iq-foret px-6 py-5 sm:px-9 sm:py-6">
              <Dialog.Title className="text-2xl font-extrabold text-iq-creme sm:text-3xl">
                {t("manager:cours.importer")}
              </Dialog.Title>
              <Dialog.Close
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-iq-foret-clair text-iq-creme hover:brightness-125 disabled:opacity-50 sm:size-12"
                disabled={isPending}
                title={t("common:close")}
              >
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              {t("manager:cours.importDescription", { max: PDF_TAILLE_MAX_MO })}
            </Dialog.Description>

            <form
              className="flex flex-col gap-6 p-6 sm:p-9"
              onSubmit={handleSubmit}
            >
              <div>
                <div
                  className={clsx(
                    "flex flex-col items-center justify-center gap-3 rounded-2xl border-[3px] border-dashed bg-iq-champ px-6 py-8 text-center transition-colors duration-200",
                    survol
                      ? "border-iq-mousse bg-iq-sauge/20"
                      : "border-iq-sauge",
                    erreurs.fichier && !fichier && !survol && "border-red-300",
                    isPending && "pointer-events-none opacity-60",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setSurvol(true)
                  }}
                  onDragLeave={(e) => {
                    // Le dragleave part aussi en passant sur un élément enfant.
                    if (
                      !(e.relatedTarget instanceof Node) ||
                      !e.currentTarget.contains(e.relatedTarget)
                    ) {
                      setSurvol(false)
                    }
                  }}
                >
                  <motion.span
                    className="flex size-16 items-center justify-center rounded-2xl bg-iq-sauge/40 text-iq-foret"
                    animate={
                      survol ? { y: -5, scale: 1.08 } : { y: 0, scale: 1 }
                    }
                    transition={{ type: "spring", stiffness: 380, damping: 20 }}
                  >
                    <FileUp className="size-7" />
                  </motion.span>
                  <p className="text-lg font-bold">
                    {survol ? (
                      t("manager:cours.relacher")
                    ) : (
                      <>
                        {t("manager:cours.deposer")}{" "}
                        <button
                          type="button"
                          className="rounded text-iq-olive underline underline-offset-2 hover:text-iq-mousse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iq-mousse"
                          onClick={() => inputRef.current?.click()}
                          disabled={isPending}
                        >
                          {t("manager:cours.parcourir")}
                        </button>
                      </>
                    )}
                  </p>
                  <p className="text-sm text-iq-gris">
                    {t("manager:cours.formatAccepte", {
                      max: PDF_TAILLE_MAX_MO,
                    })}
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    aria-describedby={`${id}-fichier-erreur`}
                    onChange={handleChange}
                  />
                </div>

                <AnimatePresence initial={false}>
                  {fichier && (
                    <motion.div
                      key={`${fichier.name}-${fichier.size}-${fichier.lastModified}`}
                      {...APPARITION}
                      className="overflow-hidden"
                    >
                      <motion.div
                        key={verification?.etat === "refuse" ? essai : "ok"}
                        animate={
                          verification?.etat === "refuse" ? SECOUSSE : undefined
                        }
                        className={clsx(
                          "mt-4 flex items-center gap-4 rounded-2xl border-2 p-4 transition-colors duration-300",
                          verification?.etat === "refuse"
                            ? "border-red-300 bg-red-50"
                            : "border-iq-sauge bg-iq-sauge/25",
                        )}
                      >
                        <span className="relative flex h-14 w-12 shrink-0 items-center justify-center rounded-md bg-iq-olive text-xs font-extrabold text-white">
                          PDF
                          <AnimatePresence>
                            {verifie && (
                              <motion.span
                                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-iq-citron text-iq-foret ring-2 ring-white"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 600,
                                  damping: 18,
                                }}
                              >
                                <Check className="size-3" strokeWidth={4} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate font-bold">{fichier.name}</p>
                            <AnimatePresence>
                              {verification?.etat === "ok" && (
                                <motion.p
                                  className="shrink-0 font-extrabold text-iq-olive"
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                >
                                  {t("manager:cours.nbPages", {
                                    nb: verification.nbPages,
                                  })}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                          <BarreProgression etat={etatBarre()} />
                          <p
                            className="flex items-center gap-1.5 text-sm text-iq-gris"
                            aria-live="polite"
                          >
                            {verifie && (
                              <CircleCheck className="size-4 text-iq-olive" />
                            )}
                            <span>{formaterTaille(fichier.size)}</span>
                            <span aria-hidden>·</span>
                            <span
                              className={clsx(
                                "tabular-nums",
                                verifie && "font-semibold text-iq-olive",
                              )}
                            >
                              {statutFichier()}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-iq-gris transition-colors hover:bg-white/70 hover:text-iq-texte disabled:opacity-50"
                          onClick={retirerFichier}
                          disabled={isPending}
                          title={t("manager:cours.retirerFichier")}
                        >
                          <X className="size-4" />
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {erreurs.fichier && (
                    <BanniereErreur
                      key="erreur-fichier"
                      id={`${id}-fichier-erreur`}
                      message={traduire(erreurs.fichier) ?? ""}
                      aide={t(aideErreurImport(erreurs.fichier), {
                        max: PDF_TAILLE_MAX_MO,
                      })}
                      essai={essai}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="font-bold">{t("manager:cours.titre")}</span>
                  <input
                    className={clsx(
                      champ,
                      "transition-colors",
                      erreurs.titre && "border-red-400",
                    )}
                    value={titre}
                    maxLength={TITRE_MAX}
                    placeholder={t("manager:cours.titrePlaceholder")}
                    aria-invalid={Boolean(erreurs.titre)}
                    disabled={isPending}
                    onChange={(e) => {
                      setTitre(e.target.value)
                      setErreurs((er) => ({ ...er, titre: undefined }))
                    }}
                  />
                  {erreurs.titre && (
                    <span className="animate-fade text-sm font-semibold text-red-600">
                      {traduire(erreurs.titre)}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-2">
                  <span className="font-bold">
                    {t("manager:cours.codeRessource")}{" "}
                    <span className="font-normal text-iq-gris">
                      {t("manager:cours.facultatif")}
                    </span>
                  </span>
                  <input
                    className={clsx(
                      champ,
                      "transition-colors",
                      erreurs.codeRessource && "border-red-400",
                    )}
                    value={codeRessource}
                    maxLength={CODE_RESSOURCE_MAX}
                    placeholder={t("manager:cours.codeRessourcePlaceholder")}
                    aria-invalid={Boolean(erreurs.codeRessource)}
                    disabled={isPending}
                    onChange={(e) => {
                      setCodeRessource(e.target.value)
                      setErreurs((er) => ({ ...er, codeRessource: undefined }))
                    }}
                  />
                  {erreurs.codeRessource && (
                    <span className="animate-fade text-sm font-semibold text-red-600">
                      {traduire(erreurs.codeRessource)}
                    </span>
                  )}
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className={bouton.contour}
                    disabled={isPending}
                  >
                    {t("common:cancel")}
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className={clsx(
                    bouton.principal,
                    "min-w-64",
                    // Pendant l'envoi, le bouton montre le chargement, il ne paraît pas éteint.
                    isPending && "disabled:cursor-wait disabled:opacity-100",
                  )}
                  disabled={enCours}
                >
                  {isPending ? (
                    <>
                      <Loader className="size-5" />
                      {t("manager:cours.importEnCours")}
                      {pourcentage !== null && (
                        <span className="tabular-nums opacity-80">
                          {pourcentage} %
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {t("manager:cours.importerEtAjouter")}
                      <ArrowRight className="size-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </MotionConfig>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default ImportCoursDialog
