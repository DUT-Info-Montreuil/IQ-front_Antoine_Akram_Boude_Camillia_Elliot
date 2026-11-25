import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm"
import type { ImportCours } from "@razzia/common/validators/cours"
import { getDb } from "@razzia/socket/db"
import {
  cours,
  partageCours,
  question,
  quiz,
  utilisateur,
  versionPdf,
} from "@razzia/socket/db/schema"
import { forbidden, notFound } from "@razzia/socket/services/errors"
import {
  analyserPdf,
  enregistrerPdf,
  lirePdf,
  supprimerPdf,
} from "@razzia/socket/services/pdf"

/**
 * CoursService du dossier de conception (Tableau 38) pour le CU 1.2.
 * Les objets renvoyés suivent le Tableau 36 et les types du front
 * (features/cours/types.ts), nbPages compris.
 */

export type Droit = "PROPRIETAIRE" | "EDITION" | "LECTURE"

const RANG_DROIT: Record<Droit, number> = {
  LECTURE: 0,
  EDITION: 1,
  PROPRIETAIRE: 2,
}

/**
 * Enseignant unique, propriétaire de tous les cours.
 * shortcut: tant que le LDAP (CU 1.1) n'existe pas, tout gestionnaire Razzia
 * est cet enseignant ; remplacer par l'utilisateur du jeton avec le LDAP.
 */
const ENSEIGNANT_PROVISOIRE = {
  login: "enseignant",
  nom: "Démo",
  prenom: "Enseignant",
  role: "ENSEIGNANT",
} as const

export const utilisateurCourant = async () => {
  const [ligne] = await getDb()
    .insert(utilisateur)
    .values(ENSEIGNANT_PROVISOIRE)
    .onConflictDoUpdate({
      target: utilisateur.login,
      set: { login: ENSEIGNANT_PROVISOIRE.login },
    })
    .returning({ idUtilisateur: utilisateur.idUtilisateur })

  return ligne.idUtilisateur
}

/** CoursService.verifierAcces : 404 si le cours n'existe pas, 403 si le droit manque. */
export const verifierAcces = async (
  idCours: number,
  idUtilisateur: number,
  droitMinimal: Droit,
): Promise<Droit> => {
  const lignes = await getDb()
    .select({
      idProprietaire: cours.idProprietaire,
      partage: partageCours.droit,
    })
    .from(cours)
    .leftJoin(
      partageCours,
      and(
        eq(partageCours.idCours, cours.idCours),
        eq(partageCours.idUtilisateur, idUtilisateur),
      ),
    )
    .where(eq(cours.idCours, idCours))
  const ligne = lignes.at(0)

  if (!ligne) {
    throw notFound("errors:cours.introuvable")
  }

  const droit: Droit | null =
    ligne.idProprietaire === idUtilisateur ? "PROPRIETAIRE" : ligne.partage

  if (!droit || RANG_DROIT[droit] < RANG_DROIT[droitMinimal]) {
    throw forbidden("errors:cours.accesRefuse")
  }

  return droit
}

const lireResumes = async (idUtilisateur: number, idCours?: number) => {
  const db = getDb()
  const lignes = await db
    .select({
      cours,
      login: utilisateur.login,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      partage: partageCours.droit,
    })
    .from(cours)
    .innerJoin(utilisateur, eq(utilisateur.idUtilisateur, cours.idProprietaire))
    .leftJoin(
      partageCours,
      and(
        eq(partageCours.idCours, cours.idCours),
        eq(partageCours.idUtilisateur, idUtilisateur),
      ),
    )
    .where(
      and(
        or(
          eq(cours.idProprietaire, idUtilisateur),
          isNotNull(partageCours.idUtilisateur),
        ),
        idCours === undefined ? undefined : eq(cours.idCours, idCours),
      ),
    )
    .orderBy(desc(cours.dateModification))

  const ids = lignes.map((ligne) => ligne.cours.idCours)

  if (ids.length === 0) {
    return []
  }

  const versions = await db
    .select()
    .from(versionPdf)
    .where(inArray(versionPdf.idCours, ids))
    .orderBy(asc(versionPdf.numero))
  const nbQuiz = await db
    .select({ idCours: quiz.idCours, nb: count() })
    .from(quiz)
    .where(inArray(quiz.idCours, ids))
    .groupBy(quiz.idCours)

  return lignes.map((ligne) => {
    const sesVersions = versions.filter(
      (version) => version.idCours === ligne.cours.idCours,
    )
    // La version courante est celle de plus grand numéro (versions triées).
    const courante = sesVersions.at(-1)
    const droit: Droit =
      ligne.cours.idProprietaire === idUtilisateur
        ? "PROPRIETAIRE"
        : (ligne.partage ?? "LECTURE")

    return {
      resume: {
        id: ligne.cours.idCours,
        titre: ligne.cours.titre,
        codeRessource: ligne.cours.codeRessource,
        proprietaire: {
          login: ligne.login,
          nom: `${ligne.prenom} ${ligne.nom}`,
        },
        droit,
        versionCourante: courante?.numero ?? 0,
        nbPages: courante?.nbPages ?? 0,
        nbQuiz:
          nbQuiz.find((ligneQuiz) => ligneQuiz.idCours === ligne.cours.idCours)
            ?.nb ?? 0,
        dateModification: ligne.cours.dateModification.toISOString(),
      },
      versions: sesVersions.map((version) => ({
        numero: version.numero,
        nbPages: version.nbPages,
        dateImport: version.dateImport.toISOString(),
      })),
    }
  })
}

export const listerCours = async (idUtilisateur: number) =>
  (await lireResumes(idUtilisateur)).map(({ resume }) => resume)

/** ElementDeroule, avec nbQuestions et dureeSecondes pour les cartes de quiz de E3. */
const elementQuiz = ({
  quiz: ligne,
  nbQuestions,
  dureeSecondes,
}: {
  quiz: typeof quiz.$inferSelect
  nbQuestions: number
  dureeSecondes: number
}) => ({
  type: "QUIZ" as const,
  id: ligne.idQuiz,
  titre: ligne.titre,
  apresPage: ligne.apresPage,
  rang: ligne.rang ?? 0,
  ordreMiseDeCote: ligne.ordreMiseDeCote,
  nbQuestions,
  dureeSecondes,
})

/** CoursDetail. Les pages de classement rejoindront le déroulé avec SCRUM-18. */
export const obtenirCours = async (idCours: number, idUtilisateur: number) => {
  await verifierAcces(idCours, idUtilisateur, "LECTURE")

  const [{ resume, versions }] = await lireResumes(idUtilisateur, idCours)
  const sesQuiz = await getDb()
    .select({
      quiz,
      nbQuestions: count(question.idQuestion),
      dureeSecondes: sql<number>`coalesce(sum(${question.dureeSecondes}), 0)::int`,
    })
    .from(quiz)
    .leftJoin(question, eq(question.idQuiz, quiz.idQuiz))
    .where(eq(quiz.idCours, idCours))
    .groupBy(quiz.idQuiz)
    .orderBy(asc(quiz.apresPage), asc(quiz.rang), asc(quiz.ordreMiseDeCote))

  return {
    ...resume,
    versions,
    deroule: sesQuiz
      .filter((ligne) => ligne.quiz.statutPlacement === "PLACE")
      .map(elementQuiz),
    misDeCote: sesQuiz
      .filter((ligne) => ligne.quiz.statutPlacement === "MIS_DE_COTE")
      .map(elementQuiz),
  }
}

/** CU 1.2 : analyse du PDF, dépôt du fichier, puis cours et version n° 1 dans une transaction. */
export const importerCours = async (
  { fichier, titre, codeRessource }: ImportCours,
  idUtilisateur: number,
) => {
  const contenu = Buffer.from(await fichier.arrayBuffer())
  const { nbPages, taille } = await analyserPdf(contenu)
  let idDepose: number | null = null

  const idCours = await getDb()
    .transaction(async (tx) => {
      const [cree] = await tx
        .insert(cours)
        .values({ titre, codeRessource, idProprietaire: idUtilisateur })
        .returning({ idCours: cours.idCours })

      idDepose = cree.idCours

      await tx.insert(versionPdf).values({
        idCours: cree.idCours,
        numero: 1,
        cheminFichier: enregistrerPdf(contenu, cree.idCours, 1),
        nbPages,
        tailleOctets: taille,
      })

      return cree.idCours
    })
    .catch((error: unknown) => {
      // 5a : la base a refusé l'enregistrement, le fichier déposé ne doit pas rester.
      if (idDepose !== null) {
        supprimerPdf(idDepose, 1)
      }

      throw error
    })

  return obtenirCours(idCours, idUtilisateur)
}

export const lireFichierCours = async (
  idCours: number,
  numero: number,
  idUtilisateur: number,
) => {
  await verifierAcces(idCours, idUtilisateur, "LECTURE")

  const versions = await getDb()
    .select({ numero: versionPdf.numero })
    .from(versionPdf)
    .where(and(eq(versionPdf.idCours, idCours), eq(versionPdf.numero, numero)))

  if (versions.length === 0) {
    throw notFound("errors:cours.introuvable")
  }

  return lirePdf(idCours, numero)
}
