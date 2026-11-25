import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
// Schéma IQ, traduction du MLD (dossier de conception V2.1, §4.2). Voir BD.md.
import type {
  OptionsPartie,
  OptionsQuestion,
} from "@razzia/common/validators/quiz"

// Domaines de valeurs (Tableau 9)
export const role = pgEnum("role", ["ENSEIGNANT", "ETUDIANT"])

export const droitPartage = pgEnum("droit_partage", ["LECTURE", "EDITION"])

export const modeAffichage = pgEnum("mode_affichage", [
  "CLASSEMENT",
  "STATISTIQUES",
  "AUCUN",
])

export const statutPlacement = pgEnum("statut_placement", [
  "PLACE",
  "MIS_DE_COTE",
])

export const typeQuestion = pgEnum("type_question", ["QCM", "RELIER", "LIBRE"])

export const typeLeaderboard = pgEnum("type_leaderboard", ["QUIZ", "CUMULE"])

export const statutSeance = pgEnum("statut_seance", ["OUVERTE", "TERMINEE"])

export const statutLancement = pgEnum("statut_lancement", ["OUVERTE", "CLOSE"])

export const modeCorrection = pgEnum("mode_correction", [
  "AUTO",
  "A_CORRIGER",
  "MANUELLE",
])

export const modeAnonymisation = pgEnum("mode_anonymisation", [
  "AUTO",
  "MANUEL",
])

const id = (name: string) =>
  integer(name).primaryKey().generatedAlwaysAsIdentity()
const horodatage = (name: string) => timestamp(name, { withTimezone: true })

// --- Contenus pédagogiques ---------------------------------------------------

export const utilisateur = pgTable("utilisateur", {
  idUtilisateur: id("id_utilisateur"),
  login: varchar("login", { length: 64 }).notNull().unique(),
  nom: varchar("nom", { length: 100 }).notNull(),
  prenom: varchar("prenom", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  role: role("role").notNull(),
  datePremiereConnexion: horodatage("date_premiere_connexion")
    .notNull()
    .defaultNow(),
  dateFinFormation: date("date_fin_formation"),
})

export const cours = pgTable("cours", {
  idCours: id("id_cours"),
  titre: varchar("titre", { length: 200 }).notNull(),
  codeRessource: varchar("code_ressource", { length: 20 }),
  dateCreation: horodatage("date_creation").notNull().defaultNow(),
  dateModification: horodatage("date_modification").notNull().defaultNow(),
  idProprietaire: integer("id_proprietaire")
    .notNull()
    .references(() => utilisateur.idUtilisateur),
})

export const partageCours = pgTable(
  "partage_cours",
  {
    idCours: integer("id_cours")
      .notNull()
      .references(() => cours.idCours, { onDelete: "cascade" }),
    idUtilisateur: integer("id_utilisateur")
      .notNull()
      .references(() => utilisateur.idUtilisateur, { onDelete: "cascade" }),
    droit: droitPartage("droit").notNull(),
    datePartage: horodatage("date_partage").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.idCours, t.idUtilisateur] })],
)

export const versionPdf = pgTable(
  "version_pdf",
  {
    idVersion: id("id_version"),
    idCours: integer("id_cours")
      .notNull()
      .references(() => cours.idCours),
    numero: integer("numero").notNull(),
    cheminFichier: text("chemin_fichier").notNull(),
    nbPages: integer("nb_pages").notNull(),
    tailleOctets: integer("taille_octets").notNull(),
    dateImport: horodatage("date_import").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("version_pdf_cours_numero_uq").on(t.idCours, t.numero),
    check("version_pdf_nb_pages_ck", sql`${t.nbPages} > 0`),
  ],
)

export const quiz = pgTable("quiz", {
  idQuiz: id("id_quiz"),
  idCours: integer("id_cours")
    .notNull()
    .references(() => cours.idCours),
  titre: varchar("titre", { length: 200 }).notNull(),
  modeAffichage: modeAffichage("mode_affichage")
    .notNull()
    .default("CLASSEMENT"),
  afficherLeaderboard: boolean("afficher_leaderboard").notNull().default(false),
  sertNotation: boolean("sert_notation").notNull().default(false),
  statutPlacement: statutPlacement("statut_placement")
    .notNull()
    .default("MIS_DE_COTE"),
  apresPage: integer("apres_page"),
  rang: integer("rang"),
  ordreMiseDeCote: integer("ordre_mise_de_cote"),
  // Migration 0001 : réglages de partie repris de Razzia (pseudos générés, réponses seules).
  optionsPartie: jsonb("options_partie")
    .$type<OptionsPartie>()
    .notNull()
    .default({ pseudosGeneres: false, reponsesSeulement: false }),
})

export const question = pgTable(
  "question",
  {
    idQuestion: id("id_question"),
    idQuiz: integer("id_quiz")
      .notNull()
      .references(() => quiz.idQuiz, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull(),
    type: typeQuestion("type").notNull(),
    enonce: text("enonce").notNull(),
    dureeSecondes: integer("duree_secondes").notNull().default(30),
    pointsMax: integer("points_max").notNull().default(1000),
    // Migration 0001 : options avancées (délai de lecture, pénalité, mode de score, catégorie, note, média).
    options: jsonb("options").$type<OptionsQuestion>().notNull().default({
      delaiLecture: 3,
      penalite: 0,
      modeScore: "STRICT",
      categorie: "",
      note: "",
      media: null,
    }),
  },
  (t) => [
    check(
      "question_duree_secondes_ck",
      sql`${t.dureeSecondes} BETWEEN 5 AND 300`,
    ),
    check("question_points_max_ck", sql`${t.pointsMax} >= 0`),
  ],
)

export const proposition = pgTable("proposition", {
  idProposition: id("id_proposition"),
  idQuestion: integer("id_question")
    .notNull()
    .references(() => question.idQuestion, { onDelete: "cascade" }),
  ordre: integer("ordre").notNull(),
  libelle: text("libelle").notNull(),
  estCorrecte: boolean("est_correcte").notNull().default(false),
  points: integer("points").notNull().default(0),
})

export const paire = pgTable("paire", {
  idPaire: id("id_paire"),
  idQuestion: integer("id_question")
    .notNull()
    .references(() => question.idQuestion, { onDelete: "cascade" }),
  ordre: integer("ordre").notNull(),
  elementGauche: text("element_gauche").notNull(),
  elementDroit: text("element_droit").notNull(),
})

export const expressionCorrection = pgTable("expression_correction", {
  idExpression: id("id_expression"),
  idQuestion: integer("id_question")
    .notNull()
    .references(() => question.idQuestion, { onDelete: "cascade" }),
  ordre: integer("ordre").notNull(),
  motif: text("motif").notNull(),
  points: integer("points").notNull().default(0),
})

export const leaderboard = pgTable("leaderboard", {
  idLeaderboard: id("id_leaderboard"),
  idProprietaire: integer("id_proprietaire")
    .notNull()
    .references(() => utilisateur.idUtilisateur),
  titre: varchar("titre", { length: 200 }).notNull(),
  type: typeLeaderboard("type").notNull(),
  dateCreation: horodatage("date_creation").notNull().defaultNow(),
})

export const leaderboardQuiz = pgTable(
  "leaderboard_quiz",
  {
    idLeaderboard: integer("id_leaderboard")
      .notNull()
      .references(() => leaderboard.idLeaderboard, { onDelete: "cascade" }),
    idQuiz: integer("id_quiz")
      .notNull()
      .references(() => quiz.idQuiz, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.idLeaderboard, t.idQuiz] }),
    index("leaderboard_quiz_quiz_idx").on(t.idQuiz),
  ],
)

export const pageClassement = pgTable("page_classement", {
  idPage: id("id_page"),
  idCours: integer("id_cours")
    .notNull()
    .references(() => cours.idCours),
  idLeaderboard: integer("id_leaderboard")
    .notNull()
    .references(() => leaderboard.idLeaderboard),
  apresPage: integer("apres_page"),
  rang: integer("rang"),
  statutPlacement: statutPlacement("statut_placement")
    .notNull()
    .default("MIS_DE_COTE"),
  ordreMiseDeCote: integer("ordre_mise_de_cote"),
})

// --- Séances et résultats ----------------------------------------------------

export const seance = pgTable(
  "seance",
  {
    idSeance: id("id_seance"),
    idVersion: integer("id_version")
      .notNull()
      .references(() => versionPdf.idVersion),
    idAnimateur: integer("id_animateur")
      .notNull()
      .references(() => utilisateur.idUtilisateur),
    codeAcces: varchar("code_acces", { length: 6 }).notNull(),
    dateDebut: horodatage("date_debut").notNull().defaultNow(),
    dateFin: horodatage("date_fin"),
    statut: statutSeance("statut").notNull().default("OUVERTE"),
  },
  (t) => [
    // Un code n'est réservé que pendant la séance : il redevient libre ensuite.
    uniqueIndex("seance_code_acces_ouverte_uq")
      .on(t.codeAcces)
      .where(sql`${t.statut} = 'OUVERTE'`),
    check("seance_code_acces_ck", sql`${t.codeAcces} ~ '^[0-9]{6}$'`),
  ],
)

export const participation = pgTable(
  "participation",
  {
    idParticipation: id("id_participation"),
    idSeance: integer("id_seance")
      .notNull()
      .references(() => seance.idSeance),
    idEtudiant: integer("id_etudiant").references(
      () => utilisateur.idUtilisateur,
    ),
    pseudo: varchar("pseudo", { length: 32 }).notNull(),
    dateArrivee: horodatage("date_arrivee").notNull().defaultNow(),
    anonymise: boolean("anonymise").notNull().default(false),
  },
  (t) => [
    uniqueIndex("participation_seance_pseudo_uq").on(t.idSeance, t.pseudo),
    uniqueIndex("participation_seance_etudiant_uq").on(
      t.idSeance,
      t.idEtudiant,
    ),
    index("participation_etudiant_idx").on(t.idEtudiant),
    check(
      "participation_etudiant_ck",
      sql`${t.idEtudiant} IS NOT NULL OR ${t.anonymise}`,
    ),
  ],
)

export const lancement = pgTable(
  "lancement",
  {
    idLancement: id("id_lancement"),
    idSeance: integer("id_seance")
      .notNull()
      .references(() => seance.idSeance),
    // RESTRICT : une question déjà jouée bloque la suppression de son quiz.
    idQuestion: integer("id_question")
      .notNull()
      .references(() => question.idQuestion, { onDelete: "restrict" }),
    dateOuverture: horodatage("date_ouverture").notNull().defaultNow(),
    dateCloturePrevue: horodatage("date_cloture_prevue").notNull(),
    dateCloture: horodatage("date_cloture"),
    statut: statutLancement("statut").notNull().default("OUVERTE"),
  },
  (t) => [index("lancement_seance_idx").on(t.idSeance)],
)

export const reponse = pgTable(
  "reponse",
  {
    idReponse: id("id_reponse"),
    idLancement: integer("id_lancement")
      .notNull()
      .references(() => lancement.idLancement),
    idParticipation: integer("id_participation")
      .notNull()
      .references(() => participation.idParticipation),
    // QCM : ids des propositions ; RELIER : couples ; LIBRE : texte.
    contenu: jsonb("contenu").notNull(),
    dateReponse: horodatage("date_reponse").notNull().defaultNow(),
    tempsRestantMs: integer("temps_restant_ms").notNull(),
    tauxReussite: real("taux_reussite"),
    pointsReponse: integer("points_reponse"),
    pointsClassement: integer("points_classement"),
    modeCorrection: modeCorrection("mode_correction").notNull().default("AUTO"),
    dateCorrection: horodatage("date_correction"),
  },
  (t) => [
    uniqueIndex("reponse_lancement_participation_uq").on(
      t.idLancement,
      t.idParticipation,
    ),
    index("reponse_lancement_idx").on(t.idLancement),
    index("reponse_participation_idx").on(t.idParticipation),
    check("reponse_taux_reussite_ck", sql`${t.tauxReussite} BETWEEN 0 AND 1`),
    // Shortcut: borne haute (points_max de la question) contrôlée par le service, pas en base ; passer à un trigger si d'autres écrivains apparaissent.
    check("reponse_points_reponse_ck", sql`${t.pointsReponse} >= 0`),
    check("reponse_temps_restant_ck", sql`${t.tempsRestantMs} >= 0`),
  ],
)

export const correction = pgTable("correction", {
  idCorrection: id("id_correction"),
  idReponse: integer("id_reponse")
    .notNull()
    .references(() => reponse.idReponse, { onDelete: "cascade" }),
  idCorrecteur: integer("id_correcteur")
    .notNull()
    .references(() => utilisateur.idUtilisateur),
  anciensPoints: integer("anciens_points"),
  nouveauxPoints: integer("nouveaux_points").notNull(),
  dateCorrection: horodatage("date_correction").notNull().defaultNow(),
})

export const journalAnonymisation = pgTable("journal_anonymisation", {
  idJournal: id("id_journal"),
  dateTraitement: horodatage("date_traitement").notNull().defaultNow(),
  mode: modeAnonymisation("mode").notNull(),
  idSeance: integer("id_seance").references(() => seance.idSeance, {
    onDelete: "set null",
  }),
  nbParticipations: integer("nb_participations").notNull(),
})
