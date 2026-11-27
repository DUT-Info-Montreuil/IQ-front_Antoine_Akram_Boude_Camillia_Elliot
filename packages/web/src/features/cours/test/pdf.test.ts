import { describe, expect, it } from "vitest"
import { aSignaturePdf } from "@razzia/web/features/cours/pdf"

const blob = (contenu: string) => new Blob([contenu])

describe("aSignaturePdf", () => {
  it("accepte un fichier qui commence par %PDF-", async () => {
    expect(await aSignaturePdf(blob("%PDF-1.7\n…"))).toBe(true)
  })

  it("refuse un en-tête décalé, comme PdfService côté back", async () => {
    expect(await aSignaturePdf(blob("GARBAGE\n%PDF-1.4\n"))).toBe(false)
  })

  it("refuse un fichier vide ou d'un autre format", async () => {
    expect(await aSignaturePdf(blob(""))).toBe(false)
    expect(await aSignaturePdf(blob("\u0089PNG\r\n"))).toBe(false)
  })
})
