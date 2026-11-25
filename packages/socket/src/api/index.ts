import { Hono } from "hono"
import { auth } from "@razzia/socket/api/routes/auth"
import { coursRoutes } from "@razzia/socket/api/routes/cours"
import { games } from "@razzia/socket/api/routes/games"
import { media } from "@razzia/socket/api/routes/media"
import { quizRoutes } from "@razzia/socket/api/routes/quiz"
import { quizz } from "@razzia/socket/api/routes/quizz"
import { results } from "@razzia/socket/api/routes/results"

const routes = new Hono()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", auth)
  .route("/quizz", quizz)
  .route("/results", results)
  .route("/games", games)
  .route("/media", media)
  .route("/cours", coursRoutes)
  .route("/quiz", quizRoutes)

export const api = routes

export type ApiType = typeof routes
