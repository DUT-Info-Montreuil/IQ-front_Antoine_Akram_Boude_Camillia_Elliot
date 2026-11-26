import type { PGlite } from "@electric-sql/pglite"
import fs from "fs"
import { StatusCodes } from "http-status-codes"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { SESSION_ROLES } from "@razzia/common/constants"
import { app } from "@razzia/socket/app"
import { mintToken } from "@razzia/socket/services/auth"
import { getPath } from "@razzia/socket/services/config"
import { creerBaseTest } from "@razzia/socket/test/db"

/** PDF minimal de `nbPages` pages, que pdf.js sait ouvrir. */
const pdf = (nbPages: number, trailer = "") => {
  const pages = Array.from(
    { length: nbPages },
    (_, index) =>
      `${index + 3} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj`,
  )
  const kids = pages.map((_, index) => `${index + 3} 0 R`).join(" ")

  return Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      `2 0 obj<</Type/Pages/Kids[${kids}]/Count ${nbPages}>>endobj`,
      ...pages,
      `trailer<</Root 1 0 R${trailer}>>`,
      "%%EOF",
    ].join("\n"),
  )
}

let managerToken = ""
let playerToken = ""

/** Base PGlite du test en cours, recréée avant chaque test. */
const contexte = {} as { base: PGlite }

const importer = (
  contenu: Buffer,
  champs: Record<string, string> = { titre: "R5.A.10 Bases NoSQL" },
  token = managerToken,
) => {
  const form = new FormData()

  form.append("fichier", new File([new Uint8Array(contenu)], "cours.pdf"))
  for (const [cle, valeur] of Object.entries(champs)) {
    form.append(cle, valeur)
  }

  return app.request("/api/cours", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
}

const lire = (chemin: string, token = managerToken) =>
  app.request(`/api${chemin}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

beforeAll(async () => {
  managerToken = (await mintToken("manager", SESSION_ROLES.MANAGER)).token
  playerToken = (await mintToken("player", SESSION_ROLES.PLAYER)).token
})

beforeEach(async () => {
  contexte.base = await creerBaseTest()
})

afterEach(async () => {
  await contexte.base.close()
  fs.rmSync(getPath("pdf"), { recursive: true, force: true })
})

describe("POST /api/cours (CU 1.2)", () => {
  it("importe le PDF et renvoie le CoursDetail avec sa version n° 1", async () => {
    const reponse = await importer(pdf(3), {
      titre: "  R5.A.10 Bases NoSQL  ",
      codeRessource: "R5.A.10",
    })

    expect(reponse.status).toBe(StatusCodes.CREATED)
    expect(await reponse.json()).toMatchObject({
      id: 1,
      titre: "R5.A.10 Bases NoSQL",
      codeRessource: "R5.A.10",
      proprietaire: { login: "enseignant", nom: "Enseignant Démo" },
      droit: "PROPRIETAIRE",
      versionCourante: 1,
      nbPages: 3,
      nbQuiz: 0,
      versions: [{ numero: 1, nbPages: 3 }],
      deroule: [],
      misDeCote: [],
    })
    expect(fs.existsSync(getPath("pdf/1/v1.pdf"))).toBe(true)
    expect(
      (await contexte.base.query("SELECT chemin_fichier FROM version_pdf"))
        .rows,
    ).toEqual([{ chemin_fichier: "pdf/1/v1.pdf" }])
  })

  it("enregistre un code ressource vide comme absent", async () => {
    const reponse = await importer(pdf(1), {
      titre: "Cours",
      codeRessource: "",
    })

    expect(await reponse.json()).toMatchObject({ codeRessource: null })
  })

  it.each([
    {
      cas: "un fichier qui n'est pas un PDF",
      contenu: Buffer.from("Bonjour"),
      statut: StatusCodes.BAD_REQUEST,
      erreur: "errors:cours.pasUnPdf",
    },
    {
      cas: "un PDF corrompu",
      contenu: Buffer.from("%PDF-1.4 illisible"),
      statut: StatusCodes.UNPROCESSABLE_ENTITY,
      erreur: "errors:cours.pdfIllisible",
    },
    {
      cas: "un PDF protégé par mot de passe",
      contenu: pdf(1, "/Encrypt<</Filter/Standard/V 1/R 2/O(x)/U(y)/P -4>>"),
      statut: StatusCodes.UNPROCESSABLE_ENTITY,
      erreur: "errors:cours.pdfIllisible",
    },
    {
      cas: "un PDF sans page",
      contenu: pdf(0),
      statut: StatusCodes.UNPROCESSABLE_ENTITY,
      erreur: "errors:cours.pdfIllisible",
    },
  ])("refuse $cas", async ({ contenu, statut, erreur }) => {
    const reponse = await importer(contenu)

    expect(reponse.status).toBe(statut)
    expect(await reponse.json()).toEqual({ error: erreur })
    expect(await (await lire("/cours")).json()).toEqual([])
    expect(fs.existsSync(getPath("pdf"))).toBe(false)
  })

  it.each([
    [{ titre: "   " }, "errors:cours.titreVide"],
    [{ titre: "x".repeat(121) }, "errors:cours.titreTropLong"],
    [
      { titre: "Cours", codeRessource: "x".repeat(21) },
      "errors:cours.codeRessourceTropLong",
    ],
  ])("refuse la saisie %o", async (champs, erreur) => {
    const reponse = await importer(pdf(1), champs)

    expect(reponse.status).toBe(StatusCodes.BAD_REQUEST)
    expect(await reponse.json()).toEqual({ error: erreur })
  })

  it("refuse un fichier de plus de 50 Mo avec un 413", async () => {
    const gros = Buffer.alloc(50 * 1024 * 1024 + 1)

    pdf(1).copy(gros)

    const reponse = await importer(gros)

    expect(reponse.status).toBe(StatusCodes.REQUEST_TOO_LONG)
    expect(await reponse.json()).toEqual({
      error: "errors:cours.tropVolumineux",
    })
  })

  it("supprime le fichier déposé si la base refuse la version (compensation 5a)", async () => {
    await contexte.base.exec("DROP TABLE version_pdf CASCADE")

    const reponse = await importer(pdf(2))

    expect(reponse.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
    expect(fs.existsSync(getPath("pdf/1/v1.pdf"))).toBe(false)
    expect((await contexte.base.query("SELECT * FROM cours")).rows).toEqual([])
  })

  it("est réservé aux enseignants", async () => {
    expect((await importer(pdf(1), undefined, playerToken)).status).toBe(
      StatusCodes.UNAUTHORIZED,
    )
  })
})

describe("lecture des cours", () => {
  it("liste les cours du plus récent au plus ancien", async () => {
    await importer(pdf(1), { titre: "Ancien" })
    await importer(pdf(4), { titre: "Récent" })

    const liste = (await (await lire("/cours")).json()) as Array<
      Record<string, unknown>
    >

    expect(liste).toMatchObject([
      { titre: "Récent", nbPages: 4 },
      { titre: "Ancien", nbPages: 1 },
    ])
    expect(liste[0]).not.toHaveProperty("versions")
  })

  it("renvoie le détail d'un cours et son PDF d'origine, octet pour octet", async () => {
    const contenu = pdf(2)

    await importer(contenu)

    expect(await (await lire("/cours/1")).json()).toMatchObject({
      id: 1,
      versions: [{ numero: 1, nbPages: 2 }],
    })

    const fichier = await lire("/cours/1/versions/1/fichier")

    expect(fichier.status).toBe(StatusCodes.OK)
    expect(fichier.headers.get("Content-Type")).toBe("application/pdf")
    expect(Buffer.from(await fichier.arrayBuffer()).equals(contenu)).toBe(true)
  })

  it("répond 404 pour un cours ou une version inconnus", async () => {
    await importer(pdf(1))

    const reponses = await Promise.all(
      [
        "/cours/99",
        "/cours/1/versions/2/fichier",
        "/cours/99/versions/1/fichier",
      ].map(async (chemin) => {
        const reponse = await lire(chemin)

        return {
          statut: reponse.status,
          corps: (await reponse.json()) as unknown,
        }
      }),
    )

    expect(reponses).toEqual(
      Array.from({ length: 3 }, () => ({
        statut: StatusCodes.NOT_FOUND,
        corps: { error: "errors:cours.introuvable" },
      })),
    )
  })

  it("répond 403 sur le cours d'un autre enseignant non partagé", async () => {
    await contexte.base.exec(`
      INSERT INTO utilisateur(login, nom, prenom, role) VALUES ('collegue', 'C', 'C', 'ENSEIGNANT');
      INSERT INTO cours(titre, id_proprietaire) VALUES ('Privé', 1);
    `)

    const reponse = await lire("/cours/1")

    expect(reponse.status).toBe(StatusCodes.FORBIDDEN)
    expect(await (await lire("/cours")).json()).toEqual([])
  })

  it("refuse un identifiant qui n'est pas un nombre", async () => {
    expect((await lire("/cours/abc")).status).toBe(StatusCodes.BAD_REQUEST)
  })
})
