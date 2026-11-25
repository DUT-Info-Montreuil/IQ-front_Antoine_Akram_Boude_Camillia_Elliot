CREATE TYPE "public"."droit_partage" AS ENUM('LECTURE', 'EDITION');--> statement-breakpoint
CREATE TYPE "public"."mode_affichage" AS ENUM('CLASSEMENT', 'STATISTIQUES', 'AUCUN');--> statement-breakpoint
CREATE TYPE "public"."mode_anonymisation" AS ENUM('AUTO', 'MANUEL');--> statement-breakpoint
CREATE TYPE "public"."mode_correction" AS ENUM('AUTO', 'A_CORRIGER', 'MANUELLE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ENSEIGNANT', 'ETUDIANT');--> statement-breakpoint
CREATE TYPE "public"."statut_lancement" AS ENUM('OUVERTE', 'CLOSE');--> statement-breakpoint
CREATE TYPE "public"."statut_placement" AS ENUM('PLACE', 'MIS_DE_COTE');--> statement-breakpoint
CREATE TYPE "public"."statut_seance" AS ENUM('OUVERTE', 'TERMINEE');--> statement-breakpoint
CREATE TYPE "public"."type_leaderboard" AS ENUM('QUIZ', 'CUMULE');--> statement-breakpoint
CREATE TYPE "public"."type_question" AS ENUM('QCM', 'RELIER', 'LIBRE');--> statement-breakpoint
CREATE TABLE "correction" (
	"id_correction" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "correction_id_correction_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_reponse" integer NOT NULL,
	"id_correcteur" integer NOT NULL,
	"anciens_points" integer,
	"nouveaux_points" integer NOT NULL,
	"date_correction" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cours" (
	"id_cours" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cours_id_cours_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titre" varchar(200) NOT NULL,
	"code_ressource" varchar(20),
	"date_creation" timestamp with time zone DEFAULT now() NOT NULL,
	"date_modification" timestamp with time zone DEFAULT now() NOT NULL,
	"id_proprietaire" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expression_correction" (
	"id_expression" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expression_correction_id_expression_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_question" integer NOT NULL,
	"ordre" integer NOT NULL,
	"motif" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_anonymisation" (
	"id_journal" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_anonymisation_id_journal_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date_traitement" timestamp with time zone DEFAULT now() NOT NULL,
	"mode" "mode_anonymisation" NOT NULL,
	"id_seance" integer,
	"nb_participations" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancement" (
	"id_lancement" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lancement_id_lancement_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_seance" integer NOT NULL,
	"id_question" integer NOT NULL,
	"date_ouverture" timestamp with time zone DEFAULT now() NOT NULL,
	"date_cloture_prevue" timestamp with time zone NOT NULL,
	"date_cloture" timestamp with time zone,
	"statut" "statut_lancement" DEFAULT 'OUVERTE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard" (
	"id_leaderboard" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leaderboard_id_leaderboard_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_proprietaire" integer NOT NULL,
	"titre" varchar(200) NOT NULL,
	"type" "type_leaderboard" NOT NULL,
	"date_creation" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_quiz" (
	"id_leaderboard" integer NOT NULL,
	"id_quiz" integer NOT NULL,
	CONSTRAINT "leaderboard_quiz_id_leaderboard_id_quiz_pk" PRIMARY KEY("id_leaderboard","id_quiz")
);
--> statement-breakpoint
CREATE TABLE "page_classement" (
	"id_page" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "page_classement_id_page_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_cours" integer NOT NULL,
	"id_leaderboard" integer NOT NULL,
	"apres_page" integer,
	"rang" integer,
	"statut_placement" "statut_placement" DEFAULT 'MIS_DE_COTE' NOT NULL,
	"ordre_mise_de_cote" integer
);
--> statement-breakpoint
CREATE TABLE "paire" (
	"id_paire" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "paire_id_paire_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_question" integer NOT NULL,
	"ordre" integer NOT NULL,
	"element_gauche" text NOT NULL,
	"element_droit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partage_cours" (
	"id_cours" integer NOT NULL,
	"id_utilisateur" integer NOT NULL,
	"droit" "droit_partage" NOT NULL,
	"date_partage" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partage_cours_id_cours_id_utilisateur_pk" PRIMARY KEY("id_cours","id_utilisateur")
);
--> statement-breakpoint
CREATE TABLE "participation" (
	"id_participation" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "participation_id_participation_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_seance" integer NOT NULL,
	"id_etudiant" integer,
	"pseudo" varchar(32) NOT NULL,
	"date_arrivee" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymise" boolean DEFAULT false NOT NULL,
	CONSTRAINT "participation_etudiant_ck" CHECK ("participation"."id_etudiant" IS NOT NULL OR "participation"."anonymise")
);
--> statement-breakpoint
CREATE TABLE "proposition" (
	"id_proposition" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proposition_id_proposition_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_question" integer NOT NULL,
	"ordre" integer NOT NULL,
	"libelle" text NOT NULL,
	"est_correcte" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id_question" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_id_question_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_quiz" integer NOT NULL,
	"ordre" integer NOT NULL,
	"type" "type_question" NOT NULL,
	"enonce" text NOT NULL,
	"duree_secondes" integer DEFAULT 30 NOT NULL,
	"points_max" integer DEFAULT 1000 NOT NULL,
	CONSTRAINT "question_duree_secondes_ck" CHECK ("question"."duree_secondes" BETWEEN 5 AND 300),
	CONSTRAINT "question_points_max_ck" CHECK ("question"."points_max" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quiz" (
	"id_quiz" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_id_quiz_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_cours" integer NOT NULL,
	"titre" varchar(200) NOT NULL,
	"mode_affichage" "mode_affichage" DEFAULT 'CLASSEMENT' NOT NULL,
	"afficher_leaderboard" boolean DEFAULT false NOT NULL,
	"sert_notation" boolean DEFAULT false NOT NULL,
	"statut_placement" "statut_placement" DEFAULT 'MIS_DE_COTE' NOT NULL,
	"apres_page" integer,
	"rang" integer,
	"ordre_mise_de_cote" integer
);
--> statement-breakpoint
CREATE TABLE "reponse" (
	"id_reponse" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reponse_id_reponse_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_lancement" integer NOT NULL,
	"id_participation" integer NOT NULL,
	"contenu" jsonb NOT NULL,
	"date_reponse" timestamp with time zone DEFAULT now() NOT NULL,
	"temps_restant_ms" integer NOT NULL,
	"taux_reussite" real,
	"points_reponse" integer,
	"points_classement" integer,
	"mode_correction" "mode_correction" DEFAULT 'AUTO' NOT NULL,
	"date_correction" timestamp with time zone,
	CONSTRAINT "reponse_taux_reussite_ck" CHECK ("reponse"."taux_reussite" BETWEEN 0 AND 1),
	CONSTRAINT "reponse_points_reponse_ck" CHECK ("reponse"."points_reponse" >= 0),
	CONSTRAINT "reponse_temps_restant_ck" CHECK ("reponse"."temps_restant_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "seance" (
	"id_seance" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "seance_id_seance_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_version" integer NOT NULL,
	"id_animateur" integer NOT NULL,
	"code_acces" varchar(6) NOT NULL,
	"date_debut" timestamp with time zone DEFAULT now() NOT NULL,
	"date_fin" timestamp with time zone,
	"statut" "statut_seance" DEFAULT 'OUVERTE' NOT NULL,
	CONSTRAINT "seance_code_acces_ck" CHECK ("seance"."code_acces" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "utilisateur" (
	"id_utilisateur" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "utilisateur_id_utilisateur_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"login" varchar(64) NOT NULL,
	"nom" varchar(100) NOT NULL,
	"prenom" varchar(100) NOT NULL,
	"email" varchar(255),
	"role" "role" NOT NULL,
	"date_premiere_connexion" timestamp with time zone DEFAULT now() NOT NULL,
	"date_fin_formation" date,
	CONSTRAINT "utilisateur_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "version_pdf" (
	"id_version" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "version_pdf_id_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_cours" integer NOT NULL,
	"numero" integer NOT NULL,
	"chemin_fichier" text NOT NULL,
	"nb_pages" integer NOT NULL,
	"taille_octets" integer NOT NULL,
	"date_import" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "version_pdf_nb_pages_ck" CHECK ("version_pdf"."nb_pages" > 0)
);
--> statement-breakpoint
ALTER TABLE "correction" ADD CONSTRAINT "correction_id_reponse_reponse_id_reponse_fk" FOREIGN KEY ("id_reponse") REFERENCES "public"."reponse"("id_reponse") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction" ADD CONSTRAINT "correction_id_correcteur_utilisateur_id_utilisateur_fk" FOREIGN KEY ("id_correcteur") REFERENCES "public"."utilisateur"("id_utilisateur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cours" ADD CONSTRAINT "cours_id_proprietaire_utilisateur_id_utilisateur_fk" FOREIGN KEY ("id_proprietaire") REFERENCES "public"."utilisateur"("id_utilisateur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expression_correction" ADD CONSTRAINT "expression_correction_id_question_question_id_question_fk" FOREIGN KEY ("id_question") REFERENCES "public"."question"("id_question") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_anonymisation" ADD CONSTRAINT "journal_anonymisation_id_seance_seance_id_seance_fk" FOREIGN KEY ("id_seance") REFERENCES "public"."seance"("id_seance") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancement" ADD CONSTRAINT "lancement_id_seance_seance_id_seance_fk" FOREIGN KEY ("id_seance") REFERENCES "public"."seance"("id_seance") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancement" ADD CONSTRAINT "lancement_id_question_question_id_question_fk" FOREIGN KEY ("id_question") REFERENCES "public"."question"("id_question") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_id_proprietaire_utilisateur_id_utilisateur_fk" FOREIGN KEY ("id_proprietaire") REFERENCES "public"."utilisateur"("id_utilisateur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_quiz" ADD CONSTRAINT "leaderboard_quiz_id_leaderboard_leaderboard_id_leaderboard_fk" FOREIGN KEY ("id_leaderboard") REFERENCES "public"."leaderboard"("id_leaderboard") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_quiz" ADD CONSTRAINT "leaderboard_quiz_id_quiz_quiz_id_quiz_fk" FOREIGN KEY ("id_quiz") REFERENCES "public"."quiz"("id_quiz") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_classement" ADD CONSTRAINT "page_classement_id_cours_cours_id_cours_fk" FOREIGN KEY ("id_cours") REFERENCES "public"."cours"("id_cours") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_classement" ADD CONSTRAINT "page_classement_id_leaderboard_leaderboard_id_leaderboard_fk" FOREIGN KEY ("id_leaderboard") REFERENCES "public"."leaderboard"("id_leaderboard") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paire" ADD CONSTRAINT "paire_id_question_question_id_question_fk" FOREIGN KEY ("id_question") REFERENCES "public"."question"("id_question") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partage_cours" ADD CONSTRAINT "partage_cours_id_cours_cours_id_cours_fk" FOREIGN KEY ("id_cours") REFERENCES "public"."cours"("id_cours") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partage_cours" ADD CONSTRAINT "partage_cours_id_utilisateur_utilisateur_id_utilisateur_fk" FOREIGN KEY ("id_utilisateur") REFERENCES "public"."utilisateur"("id_utilisateur") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_id_seance_seance_id_seance_fk" FOREIGN KEY ("id_seance") REFERENCES "public"."seance"("id_seance") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_id_etudiant_utilisateur_id_utilisateur_fk" FOREIGN KEY ("id_etudiant") REFERENCES "public"."utilisateur"("id_utilisateur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_id_question_question_id_question_fk" FOREIGN KEY ("id_question") REFERENCES "public"."question"("id_question") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_id_quiz_quiz_id_quiz_fk" FOREIGN KEY ("id_quiz") REFERENCES "public"."quiz"("id_quiz") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_id_cours_cours_id_cours_fk" FOREIGN KEY ("id_cours") REFERENCES "public"."cours"("id_cours") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_id_lancement_lancement_id_lancement_fk" FOREIGN KEY ("id_lancement") REFERENCES "public"."lancement"("id_lancement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_id_participation_participation_id_participation_fk" FOREIGN KEY ("id_participation") REFERENCES "public"."participation"("id_participation") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seance" ADD CONSTRAINT "seance_id_version_version_pdf_id_version_fk" FOREIGN KEY ("id_version") REFERENCES "public"."version_pdf"("id_version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seance" ADD CONSTRAINT "seance_id_animateur_utilisateur_id_utilisateur_fk" FOREIGN KEY ("id_animateur") REFERENCES "public"."utilisateur"("id_utilisateur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_pdf" ADD CONSTRAINT "version_pdf_id_cours_cours_id_cours_fk" FOREIGN KEY ("id_cours") REFERENCES "public"."cours"("id_cours") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancement_seance_idx" ON "lancement" USING btree ("id_seance");--> statement-breakpoint
CREATE INDEX "leaderboard_quiz_quiz_idx" ON "leaderboard_quiz" USING btree ("id_quiz");--> statement-breakpoint
CREATE UNIQUE INDEX "participation_seance_pseudo_uq" ON "participation" USING btree ("id_seance","pseudo");--> statement-breakpoint
CREATE UNIQUE INDEX "participation_seance_etudiant_uq" ON "participation" USING btree ("id_seance","id_etudiant");--> statement-breakpoint
CREATE INDEX "participation_etudiant_idx" ON "participation" USING btree ("id_etudiant");--> statement-breakpoint
CREATE UNIQUE INDEX "reponse_lancement_participation_uq" ON "reponse" USING btree ("id_lancement","id_participation");--> statement-breakpoint
CREATE INDEX "reponse_lancement_idx" ON "reponse" USING btree ("id_lancement");--> statement-breakpoint
CREATE INDEX "reponse_participation_idx" ON "reponse" USING btree ("id_participation");--> statement-breakpoint
CREATE UNIQUE INDEX "seance_code_acces_ouverte_uq" ON "seance" USING btree ("code_acces") WHERE "seance"."statut" = 'OUVERTE';--> statement-breakpoint
CREATE UNIQUE INDEX "version_pdf_cours_numero_uq" ON "version_pdf" USING btree ("id_cours","numero");