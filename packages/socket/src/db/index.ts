import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@razzia/socket/db/schema"
import { databaseUrl } from "@razzia/socket/env"

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

let db: Db | null = null

/** Connexion ouverte au premier appel : le moteur Razzia démarre sans PostgreSQL. */
export const getDb = (): Db => {
  db ??= drizzle(databaseUrl, { schema })

  return db
}

/** Pour les tests, qui branchent une base PGlite en mémoire. */
export const setDb = (value: Db) => {
  db = value
}
