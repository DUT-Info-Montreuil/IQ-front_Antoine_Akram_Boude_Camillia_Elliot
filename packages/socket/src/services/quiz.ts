import { and, asc, desc, eq, inArray, ne } from "drizzle-orm"
import type { QuestionSaisie, QuizSaisie } from "@razzia/common/validators/quiz"
import { type Db, getDb } from "@razzia/socket/db"
import {
  correction,
  cours,
  expressionCorrection,
  lancement,
  paire,
  proposition,
  question,
  quiz,
  reponse,
  versionPdf,
} from "@razzia/socket/db/schema"
import { verifierAcces } from "@razzia/socket/services/cours"
import {
  conflict,
  invalidInput,
  notFound,
} from "@razzia/socket/services/errors"

/** QuizService du dossier de conception (Tableau 39), CU 1.3. */

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0]

const idCoursDuQuiz = async (idQuiz: number) => {
  const lignes = await getDb()
    .select({ idCours: quiz.idCours })
    .from(quiz)
    .where(eq(quiz.idQuiz, idQuiz))
  const ligne = lignes.at(0)

  if (!ligne) {
    throw notFound("errors:quiz.introuvable")
  }

  return ligne.idCours
}

/** Le quiz se place après une page de la version courante du PDF. */
const verifierPosition = async (idCours: number, apresPage: number) => {
  const versions = await getDb()
    .select({ nbPages: versionPdf.nbPages })
    .from(versionPdf)
    .where(eq(versionPdf.idCours, idCours))
    .orderBy(desc(versionPdf.numero))
    .limit(1)

  if (apresPage > (versions.at(0)?.nbPages ?? 0)) {
    throw invalidInput("errors:quiz.positionInvalide")
  }
}

/**
 * Range le quiz à son rang après sa page en décalant les quiz déjà placés au
 * même endroit, puis renumérote (CU 1.3, étape 5). Renvoie le rang retenu.
 * Les pages de classement rejoindront ce calcul avec SCRUM-18.
 */
const placer = async (
  tx: Transaction,
  idCours: number,
  {
    idQuiz,
    apresPage,
    rang,
  }: { idQuiz: number; apresPage: number; rang: number },
) => {
  const voisins = await tx
    .select({ idQuiz: quiz.idQuiz })
    .from(quiz)
    .where(
      and(
        eq(quiz.idCours, idCours),
        eq(quiz.statutPlacement, "PLACE"),
        eq(quiz.apresPage, apresPage),
        ne(quiz.idQuiz, idQuiz),
      ),
    )
    .orderBy(asc(quiz.rang))
  const ordre = voisins.map((voisin) => voisin.idQuiz)
  const rangRetenu = Math.min(rang, ordre.length)

  ordre.splice(rangRetenu, 0, idQuiz)

  await Promise.all(
    ordre.map((id, index) =>
      tx.update(quiz).set({ rang: index }).where(eq(quiz.idQuiz, id)),
    ),
  )
}

/** Après un retrait, les quiz restants de la page se suivent sans trou. */
const renumeroter = async (
  tx: Transaction,
  idCours: number,
  apresPage: number,
) => {
  const restants = await tx
    .select({ idQuiz: quiz.idQuiz })
    .from(quiz)
    .where(
      and(
        eq(quiz.idCours, idCours),
        eq(quiz.statutPlacement, "PLACE"),
        eq(quiz.apresPage, apresPage),
      ),
    )
    .orderBy(asc(quiz.rang))

  await Promise.all(
    restants.map(({ idQuiz }, index) =>
      tx.update(quiz).set({ rang: index }).where(eq(quiz.idQuiz, idQuiz)),
    ),
  )
}

const toucherCours = (tx: Transaction, idCours: number) =>
  tx
    .update(cours)
    .set({ dateModification: new Date() })
    .where(eq(cours.idCours, idCours))

// Le rang est calculé ensuite par placer() : la saisie peut demander « en dernier » (MAX_SAFE_INTEGER).
const champsQuiz = (saisie: QuizSaisie) => ({
  titre: saisie.titre,
  modeAffichage: saisie.modeAffichage,
  afficherLeaderboard: saisie.afficherLeaderboard,
  sertNotation: saisie.sertNotation,
  optionsPartie: saisie.optionsPartie,
  statutPlacement: "PLACE" as const,
  apresPage: saisie.apresPage,
  ordreMiseDeCote: null,
})

/** Seule la liste du type choisi est enregistrée, comme le fait l'éditeur E4. */
const insererQuestions = async (
  tx: Transaction,
  idQuiz: number,
  questions: QuestionSaisie[],
) => {
  for (const [ordre, saisie] of questions.entries()) {
    // Séquentiel : l'ordre des identifiants suit l'ordre des questions.
    // oxlint-disable-next-line no-await-in-loop
    const [creee] = await tx
      .insert(question)
      .values({
        idQuiz,
        ordre,
        type: saisie.type,
        enonce: saisie.enonce,
        dureeSecondes: saisie.dureeSecondes,
        pointsMax: saisie.pointsMax,
        options: saisie.options,
      })
      .returning({ idQuestion: question.idQuestion })
    const { idQuestion } = creee

    if (saisie.type === "QCM") {
      // oxlint-disable-next-line no-await-in-loop
      await tx.insert(proposition).values(
        saisie.propositions.map((p, index) => ({
          idQuestion,
          ordre: index,
          libelle: p.libelle,
          estCorrecte: p.estCorrecte,
          points: p.points,
        })),
      )
    }

    if (saisie.type === "RELIER") {
      // oxlint-disable-next-line no-await-in-loop
      await tx.insert(paire).values(
        saisie.paires.map((p, index) => ({
          idQuestion,
          ordre: index,
          elementGauche: p.gauche,
          elementDroit: p.droite,
        })),
      )
    }

    if (saisie.type === "LIBRE" && saisie.expressions.length > 0) {
      // oxlint-disable-next-line no-await-in-loop
      await tx.insert(expressionCorrection).values(
        saisie.expressions.map((e, index) => ({
          idQuestion,
          ordre: index,
          motif: e.motif,
          points: e.points,
        })),
      )
    }
  }
}

/** Quiz du Tableau 36 : la saisie, avec bonnes réponses et barème. */
const lireQuiz = async (idQuiz: number) => {
  const db = getDb()
  const [ligne] = await db.select().from(quiz).where(eq(quiz.idQuiz, idQuiz))
  const questions = await db
    .select()
    .from(question)
    .where(eq(question.idQuiz, idQuiz))
    .orderBy(asc(question.ordre))
  const ids = questions.map((q) => q.idQuestion)
  const [propositions, paires, expressions] =
    ids.length === 0
      ? [[], [], []]
      : await Promise.all([
          db
            .select()
            .from(proposition)
            .where(inArray(proposition.idQuestion, ids))
            .orderBy(asc(proposition.ordre)),
          db
            .select()
            .from(paire)
            .where(inArray(paire.idQuestion, ids))
            .orderBy(asc(paire.ordre)),
          db
            .select()
            .from(expressionCorrection)
            .where(inArray(expressionCorrection.idQuestion, ids))
            .orderBy(asc(expressionCorrection.ordre)),
        ])

  return {
    id: ligne.idQuiz,
    idCours: ligne.idCours,
    titre: ligne.titre,
    apresPage: ligne.apresPage,
    rang: ligne.rang ?? 0,
    modeAffichage: ligne.modeAffichage,
    afficherLeaderboard: ligne.afficherLeaderboard,
    sertNotation: ligne.sertNotation,
    optionsPartie: ligne.optionsPartie,
    questions: questions.map((q) => ({
      type: q.type,
      enonce: q.enonce,
      dureeSecondes: q.dureeSecondes,
      pointsMax: q.pointsMax,
      propositions: propositions
        .filter((p) => p.idQuestion === q.idQuestion)
        .map((p) => ({
          libelle: p.libelle,
          estCorrecte: p.estCorrecte,
          points: p.points,
        })),
      paires: paires
        .filter((p) => p.idQuestion === q.idQuestion)
        .map((p) => ({ gauche: p.elementGauche, droite: p.elementDroit })),
      expressions: expressions
        .filter((e) => e.idQuestion === q.idQuestion)
        .map((e) => ({ motif: e.motif, points: e.points })),
      options: q.options,
    })),
  }
}

/** Lancements des questions du quiz : ouverts, et nombre de réponses reçues. */
const etatEnSeance = async (idQuiz: number) => {
  const lignes = await getDb()
    .select({ statut: lancement.statut, idReponse: reponse.idReponse })
    .from(lancement)
    .innerJoin(question, eq(question.idQuestion, lancement.idQuestion))
    .leftJoin(reponse, eq(reponse.idLancement, lancement.idLancement))
    .where(eq(question.idQuiz, idQuiz))

  return {
    joue: lignes.length > 0,
    ouvert: lignes.some((ligne) => ligne.statut === "OUVERTE"),
    avecReponses: lignes.some((ligne) => ligne.idReponse !== null),
  }
}

export const creerQuiz = async (
  idCours: number,
  idUtilisateur: number,
  saisie: QuizSaisie,
) => {
  await verifierAcces(idCours, idUtilisateur, "EDITION")
  await verifierPosition(idCours, saisie.apresPage)

  const idQuiz = await getDb().transaction(async (tx) => {
    const [cree] = await tx
      .insert(quiz)
      .values({ idCours, ...champsQuiz(saisie), rang: 0 })
      .returning({ idQuiz: quiz.idQuiz })

    await insererQuestions(tx, cree.idQuiz, saisie.questions)
    await placer(tx, idCours, { ...saisie, idQuiz: cree.idQuiz })
    await toucherCours(tx, idCours)

    return cree.idQuiz
  })

  return lireQuiz(idQuiz)
}

export const obtenirQuiz = async (idQuiz: number, idUtilisateur: number) => {
  await verifierAcces(await idCoursDuQuiz(idQuiz), idUtilisateur, "LECTURE")

  return lireQuiz(idQuiz)
}

export const modifierQuiz = async (
  idQuiz: number,
  idUtilisateur: number,
  saisie: QuizSaisie,
) => {
  const idCours = await idCoursDuQuiz(idQuiz)

  await verifierAcces(idCours, idUtilisateur, "EDITION")
  await verifierPosition(idCours, saisie.apresPage)

  const etat = await etatEnSeance(idQuiz)

  if (etat.ouvert) {
    throw conflict("errors:seance.questionOuverte")
  }

  // Un quiz déjà joué garde ses questions.
  // shortcut: les questions sont remplacées en bloc, ce qui perdrait l'historique
  // des séances ; refusé tant que la modification fine n'existe pas (lot 2, CU 2.4).
  if (etat.joue) {
    throw conflict("errors:seance.quizDejaJoue")
  }

  await getDb().transaction(async (tx) => {
    const [ancien] = await tx
      .select({ apresPage: quiz.apresPage })
      .from(quiz)
      .where(eq(quiz.idQuiz, idQuiz))

    await tx
      .update(quiz)
      .set({ ...champsQuiz(saisie), rang: 0 })
      .where(eq(quiz.idQuiz, idQuiz))
    await tx.delete(question).where(eq(question.idQuiz, idQuiz))
    await insererQuestions(tx, idQuiz, saisie.questions)
    await placer(tx, idCours, { ...saisie, idQuiz })

    if (ancien.apresPage !== null && ancien.apresPage !== saisie.apresPage) {
      await renumeroter(tx, idCours, ancien.apresPage)
    }

    await toucherCours(tx, idCours)
  })

  return lireQuiz(idQuiz)
}

/** DELETE ?forcer=true supprime aussi les réponses reçues (409 sinon). */
export const supprimerQuiz = async (
  idQuiz: number,
  idUtilisateur: number,
  forcer: boolean,
) => {
  const idCours = await idCoursDuQuiz(idQuiz)

  await verifierAcces(idCours, idUtilisateur, "EDITION")

  const etat = await etatEnSeance(idQuiz)

  if (etat.ouvert) {
    throw conflict("errors:seance.questionOuverte")
  }

  if (etat.avecReponses && !forcer) {
    throw conflict("errors:seance.reponsesExistantes")
  }

  await getDb().transaction(async (tx) => {
    const [ancien] = await tx
      .select({ apresPage: quiz.apresPage })
      .from(quiz)
      .where(eq(quiz.idQuiz, idQuiz))
    const lancements = tx
      .select({ idLancement: lancement.idLancement })
      .from(lancement)
      .innerJoin(question, eq(question.idQuestion, lancement.idQuestion))
      .where(eq(question.idQuiz, idQuiz))
    const reponses = tx
      .select({ idReponse: reponse.idReponse })
      .from(reponse)
      .where(inArray(reponse.idLancement, lancements))

    // Lancements en RESTRICT : l'historique part d'abord, puis le quiz et ses questions en cascade.
    await tx.delete(correction).where(inArray(correction.idReponse, reponses))
    await tx.delete(reponse).where(inArray(reponse.idLancement, lancements))
    await tx.delete(lancement).where(inArray(lancement.idLancement, lancements))
    await tx.delete(quiz).where(eq(quiz.idQuiz, idQuiz))

    if (ancien.apresPage !== null) {
      await renumeroter(tx, idCours, ancien.apresPage)
    }

    await toucherCours(tx, idCours)
  })
}
