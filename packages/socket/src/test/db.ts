import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { fileURLToPath } from "url"
import { setDb } from "@razzia/socket/db"
import * as schema from "@razzia/socket/db/schema"

const MIGRATIONS = fileURLToPath(new URL("../db/migrations", import.meta.url))

/** Base PostgreSQL en mémoire (PGlite) avec les vraies migrations, branchée sur getDb(). */
export const creerBaseTest = async () => {
  const client = new PGlite()
  const db = drizzle(client, { schema })

  await migrate(db, { migrationsFolder: MIGRATIONS })
  setDb(db)

  return client
}
