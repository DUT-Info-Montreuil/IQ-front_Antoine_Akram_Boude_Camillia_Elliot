import { zValidator } from "@hono/zod-validator"
import { bodyLimit } from "hono/body-limit"
import { StatusCodes } from "http-status-codes"
import {
  coursParamsValidator,
  importCoursValidator,
  versionParamsValidator,
} from "@razzia/common/validators/cours"
import { ordreDerouleValidator } from "@razzia/common/validators/deroule"
import { quizSaisieSchema } from "@razzia/common/validators/quiz"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { pdfTailleMaxOctets } from "@razzia/socket/env"
import {
  importerCours,
  lireFichierCours,
  listerCours,
  obtenirCours,
  utilisateurCourant,
} from "@razzia/socket/services/cours"
import { reorganiserDeroule } from "@razzia/socket/services/deroule"
import { creerQuiz } from "@razzia/socket/services/quiz"

const MULTIPART_OVERHEAD = 64 * 1024

/** Routes du CU 1.2 et du déroulé (dossier de conception, Tableau 27 ; SCRUM-17). */
const routes = apiFactory
  .createApp()
  // En attendant le rôle ENSEIGNANT issu du LDAP (CU 1.1).
  .use(requireManager)
  .get("/", async (c) => c.json(await listerCours(await utilisateurCourant())))
  .post(
    "/",
    bodyLimit({
      maxSize: pdfTailleMaxOctets + MULTIPART_OVERHEAD,
      onError: (c) =>
        c.json(
          { error: "errors:cours.tropVolumineux" },
          StatusCodes.REQUEST_TOO_LONG,
        ),
    }),
    zValidator("form", importCoursValidator, i18nHook),
    async (c) =>
      c.json(
        await importerCours(c.req.valid("form"), await utilisateurCourant()),
        StatusCodes.CREATED,
      ),
  )
  .put(
    "/:idCours/deroule",
    zValidator("param", coursParamsValidator, i18nHook),
    zValidator("json", ordreDerouleValidator, i18nHook),
    async (c) =>
      c.json(
        await reorganiserDeroule(
          c.req.valid("param").idCours,
          await utilisateurCourant(),
          c.req.valid("json").ordre,
        ),
      ),
  )
  .post(
    "/:idCours/quiz",
    zValidator("param", coursParamsValidator, i18nHook),
    zValidator("json", quizSaisieSchema, i18nHook),
    async (c) =>
      c.json(
        await creerQuiz(
          c.req.valid("param").idCours,
          await utilisateurCourant(),
          c.req.valid("json"),
        ),
        StatusCodes.CREATED,
      ),
  )
  .get(
    "/:idCours",
    zValidator("param", coursParamsValidator, i18nHook),
    async (c) =>
      c.json(
        await obtenirCours(
          c.req.valid("param").idCours,
          await utilisateurCourant(),
        ),
      ),
  )
  .get(
    "/:idCours/versions/:numero/fichier",
    zValidator("param", versionParamsValidator, i18nHook),
    async (c) => {
      const { idCours, numero } = c.req.valid("param")
      const contenu = await lireFichierCours(
        idCours,
        numero,
        await utilisateurCourant(),
      )

      return c.body(new Uint8Array(contenu), StatusCodes.OK, {
        "Content-Type": "application/pdf",
      })
    },
  )

export const coursRoutes = routes
