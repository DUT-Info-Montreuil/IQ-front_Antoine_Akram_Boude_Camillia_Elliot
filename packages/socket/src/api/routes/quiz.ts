import { zValidator } from "@hono/zod-validator"
import { StatusCodes } from "http-status-codes"
import {
  quizParamsValidator,
  quizSaisieSchema,
  suppressionQuizValidator,
} from "@razzia/common/validators/quiz"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { utilisateurCourant } from "@razzia/socket/services/cours"
import {
  modifierQuiz,
  obtenirQuiz,
  supprimerQuiz,
} from "@razzia/socket/services/quiz"

/** Routes du CU 1.3 (dossier de conception, Tableau 29). La création est sous /api/cours/{id}/quiz. */
const routes = apiFactory
  .createApp()
  // En attendant le rôle ENSEIGNANT issu du LDAP (CU 1.1).
  .use(requireManager)
  .get(
    "/:idQuiz",
    zValidator("param", quizParamsValidator, i18nHook),
    async (c) =>
      c.json(
        await obtenirQuiz(
          c.req.valid("param").idQuiz,
          await utilisateurCourant(),
        ),
      ),
  )
  .put(
    "/:idQuiz",
    zValidator("param", quizParamsValidator, i18nHook),
    zValidator("json", quizSaisieSchema, i18nHook),
    async (c) =>
      c.json(
        await modifierQuiz(
          c.req.valid("param").idQuiz,
          await utilisateurCourant(),
          c.req.valid("json"),
        ),
      ),
  )
  .delete(
    "/:idQuiz",
    zValidator("param", quizParamsValidator, i18nHook),
    zValidator("query", suppressionQuizValidator, i18nHook),
    async (c) => {
      await supprimerQuiz(
        c.req.valid("param").idQuiz,
        await utilisateurCourant(),
        c.req.valid("query").forcer === "true",
      )

      return c.body(null, StatusCodes.NO_CONTENT)
    },
  )

export const quizRoutes = routes
