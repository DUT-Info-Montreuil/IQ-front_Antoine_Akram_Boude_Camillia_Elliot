import { StatusCodes } from "http-status-codes"
import i18n from "i18next"
import type {
  CoursDetail,
  CoursResume,
  CoursSource,
  ElementOrdre,
} from "@razzia/web/features/cours/types"
import { cleErreurCours } from "@razzia/web/features/cours/api/erreurs"
import { ApiError } from "@razzia/web/lib/api"
import { clearToken, ensureSession } from "@razzia/web/lib/session"

/**
 * Clé i18n d'une réponse en erreur : celle du corps `{ error }` renvoyé par
 * l'API (PdfService, validateurs zod…) quand le front sait la traduire,
 * sinon une clé déduite du code HTTP. Sans ça, un 400 sur le titre
 * s'affichait « Ce fichier n'est pas un PDF ».
 */
const lireCleErreur = async (reponse: Response, repli: string) => {
  const parStatut = cleErreurCours(reponse.status, repli)

  try {
    const corps = (await reponse.json()) as { error?: unknown }

    return typeof corps.error === "string" && i18n.exists(corps.error)
      ? corps.error
      : parStatut
  } catch {
    return parStatut
  }
}

/**
 * Appels réels aux routes /api/cours du dossier de conception (tableau 27).
 * Utilisé par défaut (VITE_API_MOCK=true repasse sur le mock).
 */
export const requete = async (
  chemin: string,
  init: RequestInit = {},
  repli = "errors:route.description",
) => {
  const { token } = await ensureSession()
  const headers = new Headers(init.headers)

  headers.set("Authorization", `Bearer ${token}`)

  const reponse = await fetch(`/api${chemin}`, { ...init, headers })
  const status: StatusCodes = reponse.status

  if (status === StatusCodes.UNAUTHORIZED) {
    clearToken()

    throw new ApiError(StatusCodes.UNAUTHORIZED, "errors:auth.unauthorized")
  }

  if (!reponse.ok) {
    throw new ApiError(reponse.status, await lireCleErreur(reponse, repli))
  }

  return reponse
}

export const coursHttp: CoursSource = {
  lister: async () => (await (await requete("/cours")).json()) as CoursResume[],

  obtenir: async (idCours) =>
    (await (await requete(`/cours/${idCours}`)).json()) as CoursDetail,

  creer: async ({ fichier, titre, codeRessource }) => {
    const form = new FormData()

    form.append("fichier", fichier)
    form.append("titre", titre)

    if (codeRessource) {
      form.append("codeRessource", codeRessource)
    }

    const reponse = await requete(
      "/cours",
      { method: "POST", body: form },
      "errors:cours.importEchoue",
    )

    return (await reponse.json()) as CoursDetail
  },

  lireFichier: async (idCours, numero) =>
    (await requete(`/cours/${idCours}/versions/${numero}/fichier`)).blob(),
}

/** Enregistre l'ordre global des pages et des quiz du cours. */
export const reorganiserDeroule = async (
  idCours: number,
  ordre: ElementOrdre[],
) => {
  const reponse = await requete(
    `/cours/${idCours}/deroule`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordre }),
    },
    "errors:route.description",
  )

  return (await reponse.json()) as {
    ordre: Array<ElementOrdre & { position: number }>
  }
}
