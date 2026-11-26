import { zValidator } from "@hono/zod-validator"
import { StatusCodes } from "http-status-codes"
import {
  ouvrirSeanceValidator,
  seanceParamsValidator,
} from "@razzia/common/validators/seance"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { utilisateurCourant } from "@razzia/socket/services/cours"
import { ouvrirSeance, terminerSeance } from "@razzia/socket/services/seance"

/** Routes du CU 2.1 (dossier de conception, Tableau 30), périmètre de SCRUM-64. */
const routes = apiFactory
  .createApp()
  // En attendant le rôle ENSEIGNANT issu du LDAP (CU 1.1).
  .use(requireManager)
  .post("/", zValidator("json", ouvrirSeanceValidator, i18nHook), async (c) =>
    c.json(
      await ouvrirSeance(
        c.req.valid("json").idCours,
        await utilisateurCourant(),
        c.get("claims").sub,
      ),
      StatusCodes.CREATED,
    ),
  )
  .post(
    "/:idSeance/fin",
    zValidator("param", seanceParamsValidator, i18nHook),
    async (c) =>
      c.json(
        await terminerSeance(
          c.req.valid("param").idSeance,
          await utilisateurCourant(),
        ),
      ),
  )

export const seancesRoutes = routes
