import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { ArrowRight, FileUp, X } from "lucide-react"
import { Dialog } from "radix-ui"
import {
  type ChangeEvent,
  type DragEvent,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import Loader from "@razzia/web/components/Loader"
import { analyserPdf } from "@razzia/web/features/cours/pdf"
import { coursKeys, importerCours } from "@razzia/web/features/cours/queries"
import { bouton, champ } from "@razzia/web/features/cours/ui"
import {
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

/** Modale « Importer un cours » (maquette E2, CU 1.2). */
const ImportCoursDialog = ({ open, onOpenChange }: Props) => {
  const [fichier, setFichier] = useState<File | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [titre, setTitre] = useState("")
  const [codeRessource, setCodeRessource] = useState("")
  const [erreurs, setErreurs] = useState<Erreurs>({})
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

  const reinitialiser = () => {
    selectionRef.current += 1
    titreProposeRef.current = ""
    setFichier(null)
    setVerification(null)
    setTitre("")
    setCodeRessource("")
    setErreurs({})
    setSurvol(false)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: importerCours,
    onSuccess: (cours) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all })
      queryClient.setQueryData(coursKeys.detail(cours.id), cours)
      toast.success(t("manager:cours.importe"))
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

      // Les erreurs de titre ou de code renvoyées par l'API vont sous leur champ.
      setErreurs((e) => ({ ...e, [champDeLErreur(cle)]: cle }))
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
      setErreurs((e) => ({ ...e, fichier: erreur }))

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
      setErreurs((e) => ({ ...e, fichier: analyse.erreur }))
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

  const progression = () => {
    if (enCours) {
      return "w-2/3 animate-pulse"
    }

    return verification?.etat === "ok" ? "w-full" : "w-0"
  }

  const statutFichier = () => {
    if (isPending) {
      return t("manager:cours.importEnCours")
    }

    if (verification?.etat === "ok") {
      return t("manager:cours.pdfVerifie")
    }

    return verification?.etat === "refuse"
      ? t("manager:cours.pdfRefuse")
      : t("manager:cours.verificationEnCours")
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-iq-foret/55 data-[state=open]:animate-fade" />

        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white font-iq text-iq-texte shadow-2xl"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between gap-4 bg-iq-foret px-9 py-6">
            <Dialog.Title className="text-3xl font-extrabold text-iq-creme">
              {t("manager:cours.importer")}
            </Dialog.Title>
            <Dialog.Close
              className="flex size-12 items-center justify-center rounded-xl bg-iq-foret-clair text-iq-creme hover:brightness-125 disabled:opacity-50"
              disabled={isPending}
              title={t("common:close")}
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {t("manager:cours.importDescription", { max: PDF_TAILLE_MAX_MO })}
          </Dialog.Description>

          <form className="flex flex-col gap-6 p-9" onSubmit={handleSubmit}>
            <div
              className={clsx(
                "flex flex-col items-center justify-center gap-3 rounded-2xl border-[3px] border-dashed bg-iq-champ px-6 py-8 text-center transition-colors",
                survol ? "border-iq-mousse bg-iq-sauge/20" : "border-iq-sauge",
                erreurs.fichier && !fichier && "border-red-400",
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
              <span className="flex size-16 items-center justify-center rounded-2xl bg-iq-sauge/40 text-iq-foret">
                <FileUp className="size-7" />
              </span>
              <p className="text-lg font-bold">
                {t("manager:cours.deposer")}{" "}
                <button
                  type="button"
                  className="text-iq-olive underline underline-offset-2 hover:text-iq-mousse"
                  onClick={() => inputRef.current?.click()}
                  disabled={isPending}
                >
                  {t("manager:cours.parcourir")}
                </button>
              </p>
              <p className="text-sm text-iq-gris">
                {t("manager:cours.formatAccepte", { max: PDF_TAILLE_MAX_MO })}
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

            {fichier && (
              <div
                className={clsx(
                  "flex items-center gap-4 rounded-2xl border-2 p-4",
                  verification?.etat === "refuse"
                    ? "border-red-300 bg-red-50"
                    : "border-iq-sauge bg-iq-sauge/25",
                )}
              >
                <span className="flex h-14 w-12 shrink-0 items-center justify-center rounded-md bg-iq-olive text-xs font-extrabold text-white">
                  PDF
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-bold">{fichier.name}</p>
                    {verification?.etat === "ok" && (
                      <p className="shrink-0 font-extrabold text-iq-olive">
                        {t("manager:cours.nbPages", {
                          nb: verification.nbPages,
                        })}
                      </p>
                    )}
                  </div>
                  <div className="my-2 h-2 overflow-hidden rounded-full bg-white/70">
                    <div
                      className={clsx(
                        "h-full rounded-full bg-[#2f7d3a] transition-all duration-500",
                        progression(),
                      )}
                    />
                  </div>
                  <p className="text-sm text-iq-gris">
                    {formaterTaille(fichier.size)} · {statutFichier()}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-iq-gris hover:bg-white/70 hover:text-iq-texte disabled:opacity-50"
                  onClick={retirerFichier}
                  disabled={isPending}
                  title={t("manager:cours.retirerFichier")}
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {erreurs.fichier && (
              <p
                id={`${id}-fichier-erreur`}
                role="alert"
                className="-mt-3 text-sm font-semibold text-red-600"
              >
                {traduire(erreurs.fichier)}
              </p>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="font-bold">{t("manager:cours.titre")}</span>
                <input
                  className={clsx(champ, erreurs.titre && "border-red-400")}
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
                  <span className="text-sm font-semibold text-red-600">
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
                  <span className="text-sm font-semibold text-red-600">
                    {traduire(erreurs.codeRessource)}
                  </span>
                )}
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
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
                className={bouton.principal}
                disabled={enCours}
              >
                {isPending && <Loader className="size-5" />}
                {t("manager:cours.importerEtAjouter")}
                {!isPending && <ArrowRight className="size-5" />}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default ImportCoursDialog
