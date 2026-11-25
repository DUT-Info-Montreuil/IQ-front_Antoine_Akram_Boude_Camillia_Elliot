CREATE TYPE "public"."type_element_deroule" AS ENUM('PAGE', 'QUIZ');--> statement-breakpoint
CREATE TABLE "element_deroule" (
	"id_element" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "element_deroule_id_element_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_cours" integer NOT NULL,
	"position" integer NOT NULL,
	"type" "type_element_deroule" NOT NULL,
	"numero_page" integer,
	"id_quiz" integer,
	CONSTRAINT "element_deroule_type_ck" CHECK (("element_deroule"."type" = 'PAGE' AND "element_deroule"."numero_page" >= 1 AND "element_deroule"."id_quiz" IS NULL)
        OR ("element_deroule"."type" = 'QUIZ' AND "element_deroule"."id_quiz" IS NOT NULL AND "element_deroule"."numero_page" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "element_deroule" ADD CONSTRAINT "element_deroule_id_cours_cours_id_cours_fk" FOREIGN KEY ("id_cours") REFERENCES "public"."cours"("id_cours") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "element_deroule" ADD CONSTRAINT "element_deroule_id_quiz_quiz_id_quiz_fk" FOREIGN KEY ("id_quiz") REFERENCES "public"."quiz"("id_quiz") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "element_deroule_position_uq" ON "element_deroule" USING btree ("id_cours","position");--> statement-breakpoint
CREATE UNIQUE INDEX "element_deroule_page_uq" ON "element_deroule" USING btree ("id_cours","numero_page");--> statement-breakpoint
CREATE UNIQUE INDEX "element_deroule_quiz_uq" ON "element_deroule" USING btree ("id_quiz");