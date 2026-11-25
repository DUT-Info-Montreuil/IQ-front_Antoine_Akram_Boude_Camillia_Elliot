import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { AlertCircle, Check, ChevronLeft } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type {
  QuestionSaisie,
  QuizSaisie,
} from "@razzia/web/features/quiz/types"
import Loader from "@razzia/web/components/Loader"
import { coursKeys, coursQuery } from "@razzia/web/features/cours/queries"
import { bouton } from "@razzia/web/features/cours/ui"
import EditeurQuestion from "@razzia/web/features/quiz/components/EditeurQuestion"
import ListeQuestions from "@razzia/web/features/quiz/components/ListeQuestions"
import ParametresQuiz from "@razzia/web/features/quiz/components/ParametresQuiz"
import {
  creerQuiz,
  modifierQuiz,
  quizKeys,
  quizQuery,
  supprimerQuiz,
} from "@razzia/web/features/quiz/queries"
import {
  completerQuiz,
  erreursDeQuestion,
  nettoyerQuestion,
  nouveauQuiz,
  nouvelleQuestion,
  validerQuiz,
} from "@razzia/web/features/quiz/validation"
import { ApiError } from "@razzia/web/lib/api"

const searchSchema = z.object({
  apresPage: z.coerce.number().int().positive().optional(),
  quiz: z.coerce.number().int().positive().optional(),
})

interface EditeurProps {
  idCours: number
  idQuiz?: number
  initial: QuizSaisie
  nbPages: number
  numero: number
}

/** Paramétrer un quiz QCM (maquette E4, CU 1.3). */
const EditeurQuiz = ({
  idCours,
  idQuiz,
  initial,
  nbPages,
  numero,
}: EditeurProps) => {
  const [saisie, setSaisie] = useState(initial)
  const [courante, setCourante] = useState(0)
  const [tentative, setTentative] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const erreurs = validerQuiz(saisie)
  const visibles = tentative ? erreurs : []

  const retour = () =>
    navigate({
      to: "/manager/cours/$coursId",
      params: { coursId: String(idCours) },
    })

  const apresEnregistrement = (cle: string) => {
    queryClient.invalidateQueries({ queryKey: coursKeys.all })

    if (idQuiz) {
      queryClient.removeQueries({ queryKey: quizKeys.detail(idQuiz) })
    }

    toast.success(t(cle))
    retour()
  }

  const enEchec = (error: Error) =>
    toast.error(
      t(
        error instanceof ApiError
          ? error.key
          : "errors:quiz.enregistrementEchoue",
      ),
    )

  const creation = useMutation({
    mutationFn: creerQuiz,
    onSuccess: () => apresEnregistrement("manager:quiz.enregistre"),
    onError: enEchec,
  })
  const modification = useMutation({
    mutationFn: modifierQuiz,
    onSuccess: () => apresEnregistrement("manager:quiz.enregistre"),
    onError: enEchec,
  })
  const suppression = useMutation({
    mutationFn: supprimerQuiz,
    onSuccess: () => apresEnregistrement("manager:quiz.supprime"),
    onError: enEchec,
  })
  const enCours =
    creation.isPending || modification.isPending || suppression.isPending

  const modifierQuestion = (index: number, question: QuestionSaisie) =>
    setSaisie((s) => ({
      ...s,
      questions: s.questions.map((q, i) => (i === index ? question : q)),
    }))

  const ajouterQuestion = () => {
    setSaisie((s) => ({
      ...s,
      questions: [...s.questions, nouvelleQuestion()],
    }))
    setCourante(saisie.questions.length)
  }

  const supprimerQuestion = (index: number) => {
    setSaisie((s) => ({
      ...s,
      questions: s.questions.filter((_, i) => i !== index),
    }))
    setCourante((c) =>
      Math.max(0, c > index ? c - 1 : Math.min(c, saisie.questions.length - 2)),
    )
  }

  const enregistrer = () => {
    setTentative(true)

    if (erreurs.length > 0) {
      const premiere = erreurs.find((e) => e.chemin[0] === "questions")

      if (typeof premiere?.chemin[1] === "number") {
        setCourante(premiere.chemin[1])
      }

      toast.error(t("manager:quiz.reglesNonRespectees", { nb: erreurs.length }))

      return
    }

    const propre = {
      ...saisie,
      questions: saisie.questions.map(nettoyerQuestion),
    }

    if (idQuiz) {
      modification.mutate({ idQuiz, saisie: propre })
    } else {
      creation.mutate({ idCours, saisie: propre })
    }
  }

  const question = saisie.questions.at(courante)
  const erreurTitre = visibles.find((e) => e.chemin[0] === "titre")?.cle
  const erreurQuestions = visibles.find(
    (e) => e.chemin[0] === "questions" && e.chemin.length === 1,
  )?.cle

  return (
    <>
      <header className="sticky top-0 z-20 border-b-4 border-iq-olive bg-iq-foret">
        <div className="mx-auto flex min-h-24 max-w-[96rem] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3">
          <button
            className="inline-flex items-center gap-1 rounded-xl bg-iq-foret-clair px-4 py-3 font-bold text-iq-creme hover:brightness-125"
            onClick={retour}
          >
            <ChevronLeft className="size-5" />
            {t("manager:quiz.deroule")}
          </button>

          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-iq-olive bg-iq-foret-clair px-4 py-2 sm:max-w-md">
            <span className="shrink-0 text-2xl font-extrabold text-iq-creme">
              {t("manager:quiz.numero", { numero })} ·
            </span>
            <input
              className={clsx(
                "min-w-0 flex-1 bg-transparent text-2xl font-extrabold text-iq-creme placeholder:text-white/40 focus:outline-none",
                erreurTitre && "underline decoration-red-400 decoration-wavy",
              )}
              value={saisie.titre}
              placeholder={t("manager:quiz.titrePlaceholder")}
              aria-label={t("manager:quiz.titre")}
              maxLength={80}
              onChange={(e) =>
                setSaisie((s) => ({ ...s, titre: e.target.value }))
              }
            />
          </label>

          <p
            className={clsx(
              "ml-auto flex items-center gap-2",
              erreurs.length === 0 ? "text-white/75" : "text-iq-saumon",
            )}
            role="status"
          >
            {erreurs.length === 0 ? (
              <>
                <Check className="size-4 text-iq-sauge" />
                {t("manager:quiz.reglesRespectees")}
              </>
            ) : (
              <>
                <AlertCircle className="size-4" />
                {t("manager:quiz.reglesNonRespectees", { nb: erreurs.length })}
              </>
            )}
          </p>

          <button
            className={bouton.principal}
            onClick={enregistrer}
            disabled={enCours}
          >
            {enCours && <Loader className="size-5" />}
            {t("manager:quiz.enregistrer")}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[96rem] gap-7 px-6 py-8 lg:grid-cols-[16rem_1fr] xl:grid-cols-[16rem_1fr_22rem]">
        <ListeQuestions
          questions={saisie.questions}
          courante={courante}
          enErreur={(index) => erreursDeQuestion(visibles, index).length > 0}
          onChoisir={setCourante}
          onAjouter={ajouterQuestion}
          onSupprimer={supprimerQuestion}
        />

        <div className="flex flex-col gap-3">
          {erreurTitre && (
            <p className="font-semibold text-red-600">{t(erreurTitre)}</p>
          )}
          {erreurQuestions && (
            <p className="font-semibold text-red-600">{t(erreurQuestions)}</p>
          )}
          {question && (
            <EditeurQuestion
              key={courante}
              question={question}
              numero={courante + 1}
              erreurs={erreursDeQuestion(visibles, courante).map((e) => ({
                ...e,
                chemin: e.chemin.slice(2),
              }))}
              onChange={(q) => modifierQuestion(courante, q)}
            />
          )}
        </div>

        <div className="lg:col-span-2 xl:col-span-1">
          <ParametresQuiz
            saisie={saisie}
            nbPages={nbPages}
            onChange={(changements) =>
              setSaisie((s) => ({ ...s, ...changements }))
            }
            onSupprimer={idQuiz ? () => suppression.mutate(idQuiz) : undefined}
          />
        </div>
      </main>
    </>
  )
}

const EditeurQuizPage = () => {
  const { coursId } = Route.useParams()
  const { apresPage, quiz: idQuiz } = Route.useSearch()
  const idCours = Number(coursId)
  const { t } = useTranslation()

  const cours = useQuery(coursQuery(idCours))
  const quiz = useQuery({ ...quizQuery(idQuiz ?? 0), enabled: Boolean(idQuiz) })

  if (cours.isError || quiz.isError) {
    return (
      <p className="p-10 text-center font-semibold text-red-600">
        {t(idQuiz ? "errors:quiz.introuvable" : "errors:cours.introuvable")}
      </p>
    )
  }

  if (!cours.data || (idQuiz && !quiz.data)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader className="size-12 text-iq-olive" />
      </div>
    )
  }

  const quizDuCours = cours.data.deroule
    .filter((e) => e.type === "QUIZ")
    .sort((a, b) => (a.apresPage ?? 0) - (b.apresPage ?? 0) || a.rang - b.rang)
  const position = idQuiz ? quizDuCours.findIndex((e) => e.id === idQuiz) : -1
  const { nbPages } = cours.data
  const page = Math.min(Math.max(apresPage ?? nbPages, 1), nbPages)
  const initial: QuizSaisie = quiz.data
    ? (({ id: _id, idCours: _idCours, ...saisie }) => saisie)(
        completerQuiz(quiz.data),
      )
    : { ...nouveauQuiz(page), rang: Number.MAX_SAFE_INTEGER }

  return (
    <EditeurQuiz
      key={idQuiz ?? "nouveau"}
      idCours={idCours}
      idQuiz={idQuiz}
      initial={initial}
      nbPages={nbPages}
      numero={position >= 0 ? position + 1 : quizDuCours.length + 1}
    />
  )
}

export const Route = createFileRoute("/manager/cours/quiz/$coursId")({
  validateSearch: searchSchema,
  component: EditeurQuizPage,
})
