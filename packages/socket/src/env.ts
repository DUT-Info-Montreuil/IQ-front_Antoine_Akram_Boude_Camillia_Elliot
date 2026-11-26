import { randomBytes } from "crypto"
import z from "zod"

const MIN_SECRET_LENGTH = 32

const optional = (schema: z.ZodString) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional())

const envSchema = z.object({
  MANAGER_PASSWORD: optional(
    z.string().min(1, "MANAGER_PASSWORD cannot be empty"),
  ),
  JWT_SECRET: optional(
    z
      .string()
      .min(
        MIN_SECRET_LENGTH,
        `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`,
      ),
  ),
  GAME_SPEED: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce
      .number()
      .positive("GAME_SPEED must be a positive number")
      .default(1),
  ),
  DATABASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().default("postgres://iq:iq@localhost:5432/iq"),
  ),
  PDF_TAILLE_MAX_MO: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce
      .number()
      .positive("PDF_TAILLE_MAX_MO must be a positive number")
      .default(50),
  ),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `Invalid environment:\n${parsed.error.issues
      .map((issue) => `  - ${issue.message}`)
      .join("\n")}`,
  )
}

export const managerPassword = parsed.data.MANAGER_PASSWORD

export const gameSpeed = parsed.data.GAME_SPEED

export const databaseUrl = parsed.data.DATABASE_URL

export const pdfTailleMaxOctets = parsed.data.PDF_TAILLE_MAX_MO * 1024 * 1024

export const jwtSecret =
  parsed.data.JWT_SECRET ?? randomBytes(32).toString("hex")
