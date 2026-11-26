import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import Skeleton from "@razzia/web/components/Skeleton"
import CoursCard from "@razzia/web/features/cours/components/CoursCard"
import ImportCoursDialog from "@razzia/web/features/cours/components/ImportCoursDialog"
import IqHeader from "@razzia/web/features/cours/components/IqHeader"
import {
  API_COURS_MOCK,
  coursListQuery,
} from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"

/** Écran « Mes cours » (E2). */
const MesCoursPage = () => {
  const { data, isPending, isError } = useQuery(coursListQuery())
  const [importOuvert, setImportOuvert] = useState(false)
  const { t } = useTranslation()

  const cours = data ?? []

  return (
    <>
      <IqHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-black tracking-tight">
              {t("manager:cours.mesCours")}
            </h1>
            <p className="mt-2 text-lg text-iq-gris">
              {t("manager:cours.mesCoursDescription")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {API_COURS_MOCK && (
              <span
                className="rounded-lg bg-iq-or/25 px-3 py-1.5 text-sm font-bold text-iq-foret"
                title={t("manager:cours.mockDescription")}
              >
                {t("manager:cours.mock")}
              </span>
            )}
            <button
              className={bouton.principal}
              onClick={() => setImportOuvert(true)}
            >
              <Upload className="size-5" />
              {t("manager:cours.importer")}
            </button>
          </div>
        </div>

        {isError && (
          <p className="mb-6 rounded-2xl bg-white p-6 font-semibold text-red-600">
            {t("errors:route.description")}
          </p>
        )}

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {isPending &&
            Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-80 rounded-3xl bg-white/70" />
            ))}

          {cours.map((c) => (
            <CoursCard key={c.id} cours={c} />
          ))}

          {!isPending && (
            <button
              className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-3xl border-[3px] border-dashed border-iq-sauge text-iq-gris transition-colors hover:border-iq-mousse hover:bg-white/40"
              onClick={() => setImportOuvert(true)}
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-iq-sauge/30 text-iq-foret">
                <Plus className="size-7" />
              </span>
              <span className="text-lg font-bold">
                {t("manager:cours.nouveauDepuisPdf")}
              </span>
              {cours.length === 0 && (
                <span className="text-sm">{t("manager:cours.aucun")}</span>
              )}
            </button>
          )}
        </div>
      </main>

      <ImportCoursDialog open={importOuvert} onOpenChange={setImportOuvert} />
    </>
  )
}

export const Route = createFileRoute("/manager/cours/")({
  component: MesCoursPage,
})
