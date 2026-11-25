import { queryOptions } from "@tanstack/react-query"
import type { ImportCoursSaisie } from "@razzia/web/features/cours/types"
import { coursHttp } from "@razzia/web/features/cours/api/http"
import { coursMock } from "@razzia/web/features/cours/api/mock"

/** Mock par défaut ; VITE_API_MOCK=false branche les vraies routes /api/cours. */
export const API_COURS_MOCK = import.meta.env.VITE_API_MOCK !== "false"

const source = API_COURS_MOCK ? coursMock : coursHttp

export const coursKeys = {
  all: ["cours"] as const,
  detail: (idCours: number) => ["cours", idCours] as const,
  fichier: (idCours: number, numero: number) =>
    ["cours", idCours, "fichier", numero] as const,
}

export const coursListQuery = () =>
  queryOptions({
    queryKey: coursKeys.all,
    queryFn: () => source.lister(),
  })

export const coursQuery = (idCours: number) =>
  queryOptions({
    queryKey: coursKeys.detail(idCours),
    queryFn: () => source.obtenir(idCours),
  })

export const fichierCoursQuery = (idCours: number, numero: number) =>
  queryOptions({
    queryKey: coursKeys.fichier(idCours, numero),
    queryFn: () => source.lireFichier(idCours, numero),
    staleTime: Infinity,
  })

export const importerCours = (saisie: ImportCoursSaisie) => source.creer(saisie)
