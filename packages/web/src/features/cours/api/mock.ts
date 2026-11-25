import { StatusCodes } from "http-status-codes"
import type { CoursDetail, CoursSource } from "@razzia/web/features/cours/types"
import { cleErreurCours } from "@razzia/web/features/cours/api/erreurs"
import { analyserPdf } from "@razzia/web/features/cours/pdf"
import { PDF_TAILLE_MAX_OCTETS } from "@razzia/web/features/cours/validation"
import { ApiError } from "@razzia/web/lib/api"

/**
 * MOCK de l'API Cours, en attendant les routes du back (SCRUM-49).
 * Il reproduit les contrôles de PdfService (signature %PDF, PDF lisible par
 * pdf.js) et garde cours et fichiers dans l'IndexedDB du navigateur, pour
 * qu'ils survivent à un rechargement de la page.
 */

const BASE = "iq-mock-cours"

const VERSION_BASE = 2

export const STORE_COURS = "cours"

const STORE_FICHIERS = "fichiers"

/** Quiz des cours (mock de QuizService, SCRUM-56). */
export const STORE_QUIZ = "quiz"

const LATENCE_MS = 300

/** Enseignant simulé, en attendant l'authentification LDAP (CU 1.1). */
export const UTILISATEUR_MOCK = {
  login: "enseignant",
  prenom: "Enseignant",
  nom: "Démo",
}

const PROPRIETAIRE_MOCK = {
  login: UTILISATEUR_MOCK.login,
  nom: `${UTILISATEUR_MOCK.prenom} ${UTILISATEUR_MOCK.nom}`,
}

let connexion: Promise<IDBDatabase> | null = null

const erreurBase = (error: DOMException | null) =>
  error ?? new Error("IndexedDB indisponible")

const ouvrirBase = () => {
  connexion ??= new Promise((resolve, reject) => {
    const demande = indexedDB.open(BASE, VERSION_BASE)

    demande.onupgradeneeded = () => {
      const base = demande.result
      const stores = base.objectStoreNames

      if (!stores.contains(STORE_COURS)) {
        base.createObjectStore(STORE_COURS, { keyPath: "id" })
      }

      if (!stores.contains(STORE_FICHIERS)) {
        base.createObjectStore(STORE_FICHIERS)
      }

      if (!stores.contains(STORE_QUIZ)) {
        base.createObjectStore(STORE_QUIZ, { keyPath: "id" })
      }
    }
    demande.onsuccess = () => resolve(demande.result)
    demande.onerror = () => reject(erreurBase(demande.error))
  })

  return connexion
}

export const executer = async <T>(
  stores: string[],
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => IDBRequest<T> | undefined,
) => {
  const base = await ouvrirBase()

  return new Promise<T>((resolve, reject) => {
    const tx = base.transaction(stores, mode)
    const demande = action(tx)

    tx.oncomplete = () => resolve(demande?.result as T)
    tx.onerror = () => reject(erreurBase(tx.error))
    tx.onabort = () => reject(erreurBase(tx.error))
  })
}

const cleFichier = (idCours: number, numero: number) => `${idCours}/v${numero}`

export const patienter = () =>
  new Promise((resolve) => {
    setTimeout(resolve, LATENCE_MS)
  })

const erreur = (status: StatusCodes) =>
  new ApiError(status, cleErreurCours(status, "errors:cours.importEchoue"))

const tousLesCours = () =>
  executer<CoursDetail[]>([STORE_COURS], "readonly", (tx) =>
    tx.objectStore(STORE_COURS).getAll(),
  )

const resume = ({
  versions: _versions,
  deroule: _deroule,
  misDeCote: _misDeCote,
  ...cours
}: CoursDetail) => cours

export const coursMock: CoursSource = {
  lister: async () => {
    await patienter()
    const cours = await tousLesCours()

    return cours
      .map(resume)
      .sort((a, b) => b.dateModification.localeCompare(a.dateModification))
  },

  obtenir: async (idCours) => {
    await patienter()
    const cours = await executer<CoursDetail | undefined>(
      [STORE_COURS],
      "readonly",
      (tx) => tx.objectStore(STORE_COURS).get(idCours),
    )

    if (!cours) {
      throw erreur(StatusCodes.NOT_FOUND)
    }

    return cours
  },

  creer: async ({ fichier, titre, codeRessource }) => {
    await patienter()

    if (fichier.size > PDF_TAILLE_MAX_OCTETS) {
      throw erreur(StatusCodes.REQUEST_TOO_LONG)
    }

    const analyse = await analyserPdf(fichier)

    if (!analyse.ok) {
      throw erreur(
        analyse.erreur === "errors:cours.pasUnPdf"
          ? StatusCodes.BAD_REQUEST
          : StatusCodes.UNPROCESSABLE_ENTITY,
      )
    }

    const { nbPages } = analyse
    const existants = await tousLesCours()
    const id = existants.reduce((max, c) => Math.max(max, c.id), 0) + 1
    const maintenant = new Date().toISOString()

    const cours: CoursDetail = {
      id,
      titre,
      codeRessource: codeRessource ?? null,
      proprietaire: PROPRIETAIRE_MOCK,
      droit: "PROPRIETAIRE",
      versionCourante: 1,
      nbPages,
      nbQuiz: 0,
      dateModification: maintenant,
      versions: [{ numero: 1, nbPages, dateImport: maintenant }],
      deroule: [],
      misDeCote: [],
    }

    // Cours et version n° 1 enregistrés dans la même transaction (CU 1.2, étape 5).
    await executer([STORE_COURS, STORE_FICHIERS], "readwrite", (tx) => {
      tx.objectStore(STORE_COURS).add(cours)
      tx.objectStore(STORE_FICHIERS).put(fichier, cleFichier(id, 1))

      return undefined
    })

    return cours
  },

  lireFichier: async (idCours, numero) => {
    const fichier = await executer<Blob | undefined>(
      [STORE_FICHIERS],
      "readonly",
      (tx) => tx.objectStore(STORE_FICHIERS).get(cleFichier(idCours, numero)),
    )

    if (!fichier) {
      throw erreur(StatusCodes.NOT_FOUND)
    }

    return fichier
  },
}
