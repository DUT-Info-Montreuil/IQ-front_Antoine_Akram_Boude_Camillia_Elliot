import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { ElementOrdre } from "@razzia/common/validators/deroule"
import { type Db, getDb } from "@razzia/socket/db"
import {
  cours,
  elementDeroule,
  lancement,
  question,
  quiz,
  versionPdf,
} from "@razzia/socket/db/schema"
import { verifierAcces } from "@razzia/socket/services/cours"
import { conflict, invalidInput } from "@razzia/socket/services/errors"

/**
 * DerouleService (Tableau 38), étendu par SCRUM-17 : ordre global du déroulé,
 * pages du PDF et quiz mêlés. Voir BD.md, table element_deroule.
 */

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0]

type Lecteur = Db | Transaction

export const nbPagesCourant = async (db: Lecteur, idCours: number) => {
  const versions = await db
    .select({ nbPages: versionPdf.nbPages })
    .from(versionPdf)
    .where(eq(versionPdf.idCours, idCours))
    .orderBy(desc(versionPdf.numero))
    .limit(1)

  return versions.at(0)?.nbPages ?? 0
}

/** Ordre historique, sans réorganisation : pages dans l'ordre du PDF, quiz après leur page selon leur rang. */
const ordreDeduit = async (
  db: Lecteur,
  idCours: number,
): Promise<ElementOrdre[]> => {
  const nbPages = await nbPagesCourant(db, idCours)
  const places = await db
    .select({ id: quiz.idQuiz, apresPage: quiz.apresPage })
    .from(quiz)
    .where(and(eq(quiz.idCours, idCours), eq(quiz.statutPlacement, "PLACE")))
    .orderBy(asc(quiz.apresPage), asc(quiz.rang))
  const quizApres = (page: number): ElementOrdre[] =>
    places
      .filter((q) => (q.apresPage ?? 0) === page)
      .map((q) => ({ type: "QUIZ", id: q.id }))

  return [
    ...quizApres(0),
    ...Array.from({ length: nbPages }, (_, index): ElementOrdre[] => [
      { type: "PAGE", numeroPdf: index + 1 },
      ...quizApres(index + 1),
    ]).flat(),
  ]
}

/** Ordre enregistré du cours, ou à défaut l'ordre déduit de apres_page et rang. */
export const lireOrdre = async (
  db: Lecteur,
  idCours: number,
): Promise<ElementOrdre[]> => {
  const lignes = await db
    .select()
    .from(elementDeroule)
    .where(eq(elementDeroule.idCours, idCours))
    .orderBy(asc(elementDeroule.position))

  if (lignes.length === 0) {
    return ordreDeduit(db, idCours)
  }

  return lignes.map((ligne) =>
    ligne.type === "PAGE"
      ? { type: "PAGE", numeroPdf: ligne.numeroPage ?? 0 }
      : { type: "QUIZ", id: ligne.idQuiz ?? 0 },
  )
}

/** Ordre renvoyé au front : la position est le rang dans le tableau (0, 1, 2…). */
export const avecPositions = (ordre: ElementOrdre[]) =>
  ordre.map((element, position) => ({ ...element, position }))

/**
 * Enregistre l'ordre, puis en recalcule apres_page et rang de chaque quiz :
 * apres_page = dernière page qui le précède (0 s'il est avant la page 1),
 * rang = sa place parmi les quiz qui suivent cette page. Un quiz rangé
 * redevient PLACE (CU 1.4 : éléments mis de côté replacés).
 */
const ecrireOrdre = async (
  tx: Transaction,
  idCours: number,
  ordre: ElementOrdre[],
) => {
  await tx.delete(elementDeroule).where(eq(elementDeroule.idCours, idCours))

  if (ordre.length === 0) {
    return
  }

  await tx.insert(elementDeroule).values(
    ordre.map((element, position) => ({
      idCours,
      position,
      type: element.type,
      numeroPage: element.type === "PAGE" ? element.numeroPdf : null,
      idQuiz: element.type === "QUIZ" ? element.id : null,
    })),
  )

  const placements: Array<{ id: number; apresPage: number; rang: number }> = []
  let page = 0
  let rang = 0

  for (const element of ordre) {
    if (element.type === "PAGE") {
      page = element.numeroPdf
      rang = 0
    } else {
      placements.push({ id: element.id, apresPage: page, rang })
      rang += 1
    }
  }

  await Promise.all(
    placements.map(({ id, apresPage, rang: rangQuiz }) =>
      tx
        .update(quiz)
        .set({
          apresPage,
          rang: rangQuiz,
          statutPlacement: "PLACE",
          ordreMiseDeCote: null,
        })
        .where(eq(quiz.idQuiz, id)),
    ),
  )
}

/**
 * Après la création ou la modification d'un quiz par QuizService : s'il existe un
 * ordre enregistré, le quiz y est replacé selon son apres_page et son rang
 * (sinon l'ordre reste déduit, rien à faire).
 */
export const replacerQuizDansOrdre = async (
  tx: Transaction,
  idCours: number,
  {
    idQuiz,
    apresPage,
    rang,
  }: { idQuiz: number; apresPage: number; rang: number },
) => {
  const enregistre = await tx
    .select({ id: elementDeroule.idElement })
    .from(elementDeroule)
    .where(eq(elementDeroule.idCours, idCours))
    .limit(1)

  if (enregistre.length === 0) {
    return
  }

  const ordre = (await lireOrdre(tx, idCours)).filter(
    (e) => !(e.type === "QUIZ" && e.id === idQuiz),
  )
  let index =
    apresPage === 0
      ? 0
      : ordre.findIndex((e) => e.type === "PAGE" && e.numeroPdf === apresPage) +
        1

  // Le quiz se range après les `rang` premiers quiz qui suivent déjà la page.
  for (
    let passes = 0;
    passes < rang && ordre[index]?.type === "QUIZ";
    passes += 1
  ) {
    index += 1
  }

  ordre.splice(index, 0, { type: "QUIZ", id: idQuiz })
  await ecrireOrdre(tx, idCours, ordre)
}

const doublons = (valeurs: number[]) => valeurs.length !== new Set(valeurs).size

/** Règles du .md front (section 2) : pages complètes et uniques, quiz du cours, sans doublon. */
const controlerOrdre = (
  ordre: ElementOrdre[],
  {
    nbPages,
    quizDuCours,
  }: { nbPages: number; quizDuCours: Array<{ id: number; place: boolean }> },
) => {
  const pages = ordre.flatMap((e) => (e.type === "PAGE" ? [e.numeroPdf] : []))
  const quizIds = ordre.flatMap((e) => (e.type === "QUIZ" ? [e.id] : []))
  const connus = new Set(quizDuCours.map((q) => q.id))

  if (pages.some((numero) => numero > nbPages)) {
    throw invalidInput("errors:deroule.pageInvalide")
  }

  if (doublons(pages) || doublons(quizIds)) {
    throw invalidInput("errors:deroule.doublon")
  }

  if (pages.length !== nbPages) {
    throw invalidInput("errors:deroule.pageManquante")
  }

  if (quizIds.some((id) => !connus.has(id))) {
    throw invalidInput("errors:deroule.quizInconnu")
  }

  // Les quiz placés doivent tous figurer ; un quiz mis de côté peut y revenir.
  if (quizDuCours.some((q) => q.place && !quizIds.includes(q.id))) {
    throw invalidInput("errors:deroule.quizManquant")
  }
}

/** DerouleService.reorganiser : PUT /api/cours/{id}/deroule. */
export const reorganiserDeroule = async (
  idCours: number,
  idUtilisateur: number,
  ordre: ElementOrdre[],
) => {
  await verifierAcces(idCours, idUtilisateur, "EDITION")

  const db = getDb()
  const quizDuCours = (
    await db
      .select({ id: quiz.idQuiz, statut: quiz.statutPlacement })
      .from(quiz)
      .where(eq(quiz.idCours, idCours))
  ).map((q) => ({ id: q.id, place: q.statut === "PLACE" }))

  controlerOrdre(ordre, {
    nbPages: await nbPagesCourant(db, idCours),
    quizDuCours,
  })

  const ouverts =
    quizDuCours.length === 0
      ? []
      : await db
          .select({ id: lancement.idLancement })
          .from(lancement)
          .innerJoin(question, eq(question.idQuestion, lancement.idQuestion))
          .where(
            and(
              inArray(
                question.idQuiz,
                quizDuCours.map((q) => q.id),
              ),
              eq(lancement.statut, "OUVERTE"),
            ),
          )
          .limit(1)

  if (ouverts.length > 0) {
    throw conflict("errors:seance.questionOuverte")
  }

  await db.transaction(async (tx) => {
    await ecrireOrdre(tx, idCours, ordre)
    await tx
      .update(cours)
      .set({ dateModification: new Date() })
      .where(eq(cours.idCours, idCours))
  })

  return { ordre: avecPositions(await lireOrdre(db, idCours)) }
}
