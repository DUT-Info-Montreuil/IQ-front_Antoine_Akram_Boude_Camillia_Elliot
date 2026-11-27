import { queryOptions } from "@tanstack/react-query"
import type {
  ElementOrdre,
  ImportCoursSaisie,
  SuiviImport,
} from "@razzia/web/features/cours/types"
import {
  coursHttp,
  reorganiserDeroule as reorganiserDerouleHttp,
} from "@razzia/web/features/cours/api/http"
import {
  coursMock,
  reorganiserDerouleMock,
} from "@razzia/web/features/cours/api/mock"

/** Vraies routes /api/cours par défaut ; VITE_API_MOCK=true repasse sur le mock IndexedDB (démo sans back). */
export const API_COURS_MOCK = import.meta.env.VITE_API_MOCK === "true"

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

export const importerCours = (saisie: ImportCoursSaisie, suivi?: SuiviImport) =>
  source.creer(saisie, suivi)

/** Enregistre l'ordre du déroulé dans l'API réelle ou dans le mock IndexedDB. */
export const reorganiserDeroule = (idCours: number, ordre: ElementOrdre[]) =>
  API_COURS_MOCK
    ? reorganiserDerouleMock(idCours, ordre)
    : reorganiserDerouleHttp(idCours, ordre)
