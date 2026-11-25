/**
 * Objets échangés avec l'API Cours (dossier de conception, tableau 36).
 * À déplacer dans @razzia/common quand le back exposera les routes /api/cours.
 */

export type DroitCours = "PROPRIETAIRE" | "EDITION" | "LECTURE"

export interface VersionPdf {
  numero: number
  nbPages: number
  dateImport: string
}

export interface ElementDeroule {
  type: "QUIZ" | "PAGE_CLASSEMENT"
  id: number
  titre: string
  apresPage: number | null
  rang: number
  ordreMiseDeCote: number | null
}

export interface CoursResume {
  id: number
  titre: string
  codeRessource: string | null
  proprietaire: { login: string; nom: string }
  droit: DroitCours
  versionCourante: number
  /** Pages de la version courante : ajouté pour la carte de E2, à confirmer avec le back. */
  nbPages: number
  nbQuiz: number
  dateModification: string
}

export interface CoursDetail extends CoursResume {
  versions: VersionPdf[]
  deroule: ElementDeroule[]
  misDeCote: ElementDeroule[]
}

/** Corps multipart de POST /api/cours. */
export interface ImportCoursSaisie {
  fichier: File
  titre: string
  codeRessource?: string
}

/** Contrat commun à l'implémentation HTTP et au mock. */
export interface CoursSource {
  lister: () => Promise<CoursResume[]>
  obtenir: (idCours: number) => Promise<CoursDetail>
  creer: (saisie: ImportCoursSaisie) => Promise<CoursDetail>
  lireFichier: (idCours: number, numero: number) => Promise<Blob>
}
