import { StatusCodes } from "http-status-codes"
import type {
  CoursDetail,
  CoursResume,
  CoursSource,
} from "@razzia/web/features/cours/types"
import { cleErreurCours } from "@razzia/web/features/cours/api/erreurs"
import { ApiError } from "@razzia/web/lib/api"
import { clearToken, ensureSession } from "@razzia/web/lib/session"

/**
 * Appels réels aux routes /api/cours du dossier de conception (tableau 27).
 * Utilisé quand VITE_API_MOCK=false, une fois le back livré.
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
    throw new ApiError(reponse.status, cleErreurCours(reponse.status, repli))
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
