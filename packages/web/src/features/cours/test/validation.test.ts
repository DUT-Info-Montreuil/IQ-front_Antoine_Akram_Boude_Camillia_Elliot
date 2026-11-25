import { describe, expect, it } from "vitest"
import {
  importCoursSchema,
  PDF_TAILLE_MAX_OCTETS,
  titreDepuisNomFichier,
  validerFichierPdf,
} from "@razzia/web/features/cours/validation"

const fichier = (name: string, size = 1024, type = "application/pdf") => ({
  name,
  size,
  type,
})

describe("validerFichierPdf", () => {
  it("accepte un PDF sous la taille maximale", () => {
    expect(validerFichierPdf(fichier("cours.pdf"))).toBeNull()
    expect(validerFichierPdf(fichier("COURS.PDF"))).toBeNull()
    expect(validerFichierPdf(fichier("cours.pdf", 1024, ""))).toBeNull()
    expect(
      validerFichierPdf(fichier("cours.pdf", PDF_TAILLE_MAX_OCTETS)),
    ).toBeNull()
  })

  it("refuse l'absence de fichier", () => {
    expect(validerFichierPdf(null)).toBe("errors:cours.fichierManquant")
  })

  it("refuse un fichier qui n'est pas un PDF", () => {
    expect(validerFichierPdf(fichier("cours.docx"))).toBe(
      "errors:cours.pasUnPdf",
    )
    expect(validerFichierPdf(fichier("cours.pdf", 1024, "image/png"))).toBe(
      "errors:cours.pasUnPdf",
    )
    expect(validerFichierPdf(fichier("cours.pdf", 0))).toBe(
      "errors:cours.pasUnPdf",
    )
  })

  it("refuse un PDF de plus de 50 Mo", () => {
    expect(
      validerFichierPdf(fichier("cours.pdf", PDF_TAILLE_MAX_OCTETS + 1)),
    ).toBe("errors:cours.tropVolumineux")
  })
})

describe("importCoursSchema", () => {
  it("nettoie le titre et rend le code facultatif", () => {
    expect(
      importCoursSchema.parse({ titre: "  Cours NoSQL ", codeRessource: "" }),
    ).toEqual({ titre: "Cours NoSQL", codeRessource: undefined })
  })

  it("refuse un titre vide", () => {
    const resultat = importCoursSchema.safeParse({ titre: "   " })

    expect(resultat.success).toBe(false)
    expect(resultat.error?.issues[0]?.message).toBe("errors:cours.titreVide")
  })
})

describe("titreDepuisNomFichier", () => {
  it("propose un titre lisible", () => {
    expect(titreDepuisNomFichier("R5.A.10_cours-nosql.pdf")).toBe(
      "R5.A.10 cours nosql",
    )
  })
})
