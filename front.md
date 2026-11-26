# Front IQ — documentation technique

Ce que contient le front d'IQ (`packages/web`), comment il est organisé, et ce qui reste branché sur des simulations en attendant le back. Pour le contexte du projet, voir `context.md`. Pour les règles de travail, voir `CLAUDE.md`.

> État au 25/11/2026 (fin du sprint 1). Le code IQ est sur les branches `feat-front/*`, pas encore fusionnées dans `dev`. Voir la section 9.

## 1. Vue d'ensemble

- **Stack** (reprise de Razzia) : React 19, TypeScript, Vite, TanStack Router (routes en fichiers) et TanStack Query, Zustand, Tailwind CSS 4, i18next, zod, Radix UI, lucide-react.
- **Ajoutés par IQ** : `pdfjs-dist` pour lire et afficher les PDF, `@fontsource-variable/montserrat` pour la police de la charte.
- **Principe** : le code IQ vit dans des modules à part (`features/cours`, `features/quiz`, `features/seance`, `pages/manager/cours`). Les fichiers Razzia sont touchés le moins possible. Il y en a 4, listés en section 8.
- **Back** : le back IQ n'existe pas encore. Le front fonctionne avec une **API simulée dans le navigateur (mock IndexedDB)** qui respecte les contrats du dossier de conception. Le temps réel passe par le **moteur de partie Razzia** existant.

## 2. Écrans et routes

Toutes les pages enseignant IQ sont sous `/manager/cours`. Le layout `pages/manager/cours/layout.tsx` vérifie le rôle (gestionnaire Razzia, en attendant le rôle ENSEIGNANT issu du LDAP), et applique la police Montserrat et le fond de la charte.

| Écran (maquette) | Route | Fichier | Story |
|---|---|---|---|
| E2 « Mes cours » + modale d'import | `/manager/cours` | `pages/manager/cours/index.tsx` | SCRUM-11 |
| E3 éditeur du cours (déroulé) | `/manager/cours/$coursId` | `pages/manager/cours/$coursId.tsx` | SCRUM-11, SCRUM-12 |
| E4 paramétrer un quiz | `/manager/cours/quiz/$coursId?apresPage=&quiz=` | `pages/manager/cours/quiz.$coursId.tsx` | SCRUM-12, 14, 15, 16, 17 |
| Présentation du cours (E5) | `/manager/cours/presenter/$coursId?etape=` | `pages/manager/cours/presenter.$coursId.tsx` | SCRUM-22 |
| E5 salle d'attente du quiz | `/party/manager/$gameId?cours=&page=&etape=&quiz=` | `pages/party/manager/$gameId.tsx` (Razzia) + `features/seance/components/SalleAttente.tsx` | SCRUM-24 |

Parcours :

1. Connexion gestionnaire (`/manager`, mot de passe Razzia). Après connexion, on arrive sur **E2**.
2. **E2** : importer un PDF (modale), puis ouvrir un cours (E3) ou le présenter.
3. **E3** : déroulé du PDF en vignettes. Un « + » entre deux pages ou le bouton « Ajouter un quiz » ouvre **E4**. Un clic sur une carte de quiz le rouvre dans E4.
4. **E4** : saisie du quiz. « Enregistrer » ramène à E3.
5. **Présenter** : plein écran, une étape par page. Les quiz sont des étapes, et « Ouvrir le quiz » mène à la **salle d'attente E5**.
6. **E5** : « Lancer la question 1 » enchaîne sur les écrans de partie Razzia. « Terminer la séance » revient à la même étape de la présentation.

Les maquettes sont dans `docs/maquettes/IQ-Maquettes-V1-ecrans.pdf`.

## 3. Modules

```
packages/web/src/
├─ features/cours/            cours, PDF, écrans E2 et E3
│  ├─ types.ts                CoursResume, CoursDetail, ElementDeroule, VersionPdf, CoursSource
│  ├─ validation.ts           contrôles d'import (extension, 50 Mo, titre, code ressource)
│  ├─ pdf.ts                  pdf.js : ouvrirPdf, aSignaturePdf, analyserPdf (signature + nb de pages)
│  ├─ hooks/usePdfDocument.ts ouvre un PDF et le libère au démontage
│  ├─ queries.ts              TanStack Query + choix mock / HTTP (API_COURS_MOCK)
│  ├─ api/http.ts             vraies routes /api/cours + helper `requete` (jeton, erreurs)
│  ├─ api/mock.ts             mock IndexedDB (cours, fichiers PDF, quiz), UTILISATEUR_MOCK
│  ├─ api/erreurs.ts          codes HTTP → clés i18n
│  ├─ ui.ts                   styles de la charte : bouton.*, champ, couleurBadge, initiales
│  └─ components/             IqHeader, CoursCard, ImportCoursDialog, DerouleCours, PdfPageCanvas
├─ features/quiz/             quiz d'un cours, écran E4
│  ├─ types.ts                QuizSaisie, QuestionSaisie (QCM | RELIER | LIBRE), options moteur
│  ├─ validation.ts           règles RG-06 / RG-07, barème, réponse libre (normaliser, évaluer)
│  ├─ api/index.ts            QuizSource : quizHttp (routes /api/quiz) et quizMock (IndexedDB)
│  ├─ queries.ts              quizQuery, creerQuiz, modifierQuiz, supprimerQuiz
│  └─ components/             ListeQuestions, EditeurQuestion, EditeurPropositions, EditeurPaires,
│                             EditeurExpressions, OptionsAvancees, ParametresQuiz, champs
├─ features/seance/           séance en salle
│  ├─ contexte.ts             contexte de séance passé dans l'URL (cours, page, étape, quiz)
│  ├─ moteur.ts               adaptateur quiz IQ → moteur Razzia (voir section 5)
│  └─ components/SalleAttente.tsx   écran E5 (QR code, code, étudiants en direct)
├─ pages/manager/cours/       routes IQ (section 2)
└─ assets/iq/                 logo-iq.png, plume.png (découpés dans les maquettes)
```

## 4. API simulée (mock) et passage au vrai back

`features/cours/queries.ts` choisit la source :

```ts
export const API_COURS_MOCK = import.meta.env.VITE_API_MOCK !== "false"
```

- **Par défaut (mock)** : tout est stocké dans l'**IndexedDB** du navigateur (base `iq-mock-cours`, stores `cours`, `fichiers`, `quiz`). Les données survivent au rechargement, mais restent propres à chaque navigateur. Un badge « Mode démo » l'indique dans E2 et E3. Le mock reproduit les contrôles du serveur (signature `%PDF`, PDF lisible, règles du quiz, codes 400, 404, 413 et 422) et une petite latence.
- **Vraies routes** : lancer le front avec `VITE_API_MOCK=false`. Les clients `coursHttp` et `quizHttp` appellent alors :

| Besoin | Route (dossier de conception) | Client |
|---|---|---|
| Lister les cours | `GET /api/cours` | `coursHttp.lister` |
| Importer un PDF | `POST /api/cours` (multipart `fichier, titre, codeRessource?`) | `coursHttp.creer` |
| Détail d'un cours | `GET /api/cours/{id}` | `coursHttp.obtenir` |
| Fichier PDF | `GET /api/cours/{id}/versions/{n}/fichier` | `coursHttp.lireFichier` |
| Créer un quiz | `POST /api/cours/{id}/quiz` (QuizSaisie) | `quizHttp.creer` |
| Lire, modifier, supprimer un quiz | `GET` / `PUT` / `DELETE /api/quiz/{id}` | `quizHttp.*` |

Les erreurs HTTP deviennent des `ApiError(status, cléI18n)` (`api/erreurs.ts`). Un 401 efface le jeton.

**Ajouts au contrat faits par le front, à valider avec le back :**
- `CoursResume.nbPages` (affiché sur les cartes de E2) ;
- `ElementDeroule.nbQuestions` et `ElementDeroule.dureeSecondes` (cartes de quiz de E3) ;
- `QuestionSaisie.options` : délai de lecture, pénalité, mode de score, catégorie, média, note ;
- `QuizSaisie.optionsPartie` : pseudos générés, réponses seules.

**Encore simulés côté front, sans route appelée :**
- l'utilisateur connecté (`UTILISATEUR_MOCK`, en attendant `GET /api/auth/moi` et le LDAP) ;
- le test d'expressions régulières (fait localement, en attendant `POST /api/quiz/expressions/test`) ;
- les séances (`POST /api/seances` et la suite).

## 5. Temps réel : adaptateur vers le moteur Razzia

En attendant `POST /api/seances` et `manager:openQuiz`, `features/seance/moteur.ts` fait le lien avec le moteur de partie Razzia, qui existe déjà et fonctionne.

1. `versMoteur(quiz)` convertit le quiz IQ au **format QCM de Razzia**, celui de SCRUM-13 (`type: "multi"`, `answers`, `solutions`, `answerPoints`, `maxPoints`, `penalty`, `options.scoringMode`, `cooldown`, `time`, `category`, `note`, `media`).
2. `ouvrirDansMoteur(quiz)` crée ou met à jour ce quiz côté Razzia. La correspondance entre l'id IQ et l'id Razzia est gardée dans le `localStorage` (`iq-moteur-quiz`). La fonction crée ensuite la partie (`createGame`) et applique les options de partie (`updateGameSettings`).
3. La présentation redirige vers `/party/manager/$gameId` avec le contexte de séance dans l'URL. La page de partie Razzia affiche alors **la salle d'attente IQ** (statut `SHOW_ROOM`), puis ses propres écrans pour la suite.

Limites actuelles :
- **Seuls les QCM sont joués.** Les questions « relier » et « libre » sont ignorées à l'ouverture, avec un message. Un quiz sans QCM ne s'ouvre pas.
- Chaque quiz ouvert a **son propre code** (celui de la partie Razzia). Avec le back, ce sera le code de la séance.
- Les quiz IQ ouverts apparaissent aussi dans l'onglet « Quiz Razzia ».
- Pour tester en étudiant, il faut **une autre session de navigateur** (fenêtre privée, autre navigateur ou téléphone) : le serveur refuse que le gestionnaire rejoigne sa propre partie.

## 6. Écran E4 : règles du quiz

`features/quiz/validation.ts` regroupe les règles du CU 1.3. Les tests sont dans `features/quiz/test/validation.test.ts`.

| Élément | Règle |
|---|---|
| Quiz | Un titre (80 caractères au plus), au moins une question, placé après une page existante |
| Question | Un énoncé, une durée de **5 à 300 s**, des points maximum ≥ 1 |
| QCM | **2 à 4** propositions (limite du moteur), au moins une bonne réponse qui rapporte au moins 1 point, des points de 0 à `pointsMax`. Cocher ou décocher une bonne réponse répartit les points automatiquement (`repartirPoints`) |
| Points à relier | **2 à 8** paires complètes, sans élément en double. Chaque association juste vaut `pointsMax ÷ nombre de paires` |
| Réponse libre | **0 à 10** expressions régulières valides, chacune avec ses points. Sans expression reconnue, la réponse est corrigée à la main. La réponse est nettoyée avant comparaison (minuscules, sans accents ni espaces superflus) |
| Options avancées | Délai de lecture **3 à 15 s** (3 s par défaut), pénalité de 0 à `pointsMax`, mode de score (QCM), catégorie (40 caractères), note (300 caractères), média (`/media/...` ou `https://...`) |

- Les erreurs s'affichent en direct dans l'en-tête (« Toutes les règles sont respectées » ou « N règle(s) à corriger »). Les champs concernés sont surlignés après une première tentative d'enregistrement.
- Changer de type conserve la saisie des autres types. À l'enregistrement, `nettoyerQuestion` n'envoie que la liste du type choisi.
- `completerQuiz` complète un quiz enregistré avec un ancien format (options manquantes).

## 7. Charte (DA) IQ

- **Couleurs** : tokens Tailwind définis dans `src/index.css` : `iq-foret` (vert foncé des en-têtes), `iq-foret-clair`, `iq-olive` (boutons principaux), `iq-mousse`, `iq-sauge`, `iq-citron` (boutons « Présenter »), `iq-creme`, `iq-fond` (fond des pages), `iq-champ`, `iq-bordure`, `iq-texte`, `iq-gris`, `iq-or`, `iq-saumon`, `iq-ciel`.
- **Police** : `font-iq` (Montserrat), chargée par le layout `/manager/cours` et par la salle d'attente.
- **Composants de style** : `features/cours/ui.ts`, avec `bouton.principal`, `bouton.sombre`, `bouton.contour`, `bouton.citron` et `champ`. Ce sont des classes, pas des composants : on les applique à des `<button>` et des `<input>` natifs.
- **Images** : logo IQ et mascotte Plume dans `src/assets/iq/`, découpés dans les maquettes.
- Les écrans Razzia d'origine (configuration, écrans de partie après le lancement) n'ont pas encore la charte IQ.

## 8. Fichiers Razzia modifiés

| Fichier | Modification |
|---|---|
| `pages/(auth)/manager/index.tsx` | Après connexion, redirection vers `/manager/cours` au lieu de `/manager/config` |
| `features/manager/components/configurations/index.tsx` | Bouton « Mes cours » dans l'écran de configuration Razzia |
| `pages/party/manager/$gameId.tsx` | Statut `SHOW_ROOM` → salle d'attente IQ ; contexte de séance lu dans l'URL (`validateSearch`) |
| `index.css`, `vite-env.d.ts` | Tokens de couleur `iq-*` ; variables `VITE_API_MOCK`, `VITE_PDF_TAILLE_MAX_MO` |

Les fichiers de la story QCM d'Antoine (`features/quizz/**`, `features/questions/**`, `common/src/validators/quizz.ts`) ne sont pas modifiés.

## 9. Branches et état par story

À fusionner dans `dev` **dans cet ordre** (chaque branche part de la précédente) :

1. `docs/maquettes-conception` : maquettes et dossier de conception.
2. `feat-front/importer-support-pdf` : E2, import, E3 (déroulé), charte.
3. `feat-front/ouvrir-quiz` : présentation, salle d'attente E5.
4. `feat-front/inserer-quiz-cours` : E4, quiz dans le déroulé, quiz ouverts depuis la présentation.

| Story | Front | Back attendu |
|---|---|---|
| SCRUM-11 Importer un support PDF | ✅ SCRUM-48 | SCRUM-49 |
| SCRUM-12 Insérer un quiz dans le cours | ✅ SCRUM-57 | SCRUM-56 |
| SCRUM-14 Question « points à relier » | ✅ SCRUM-72 | SCRUM-77 |
| SCRUM-15 Question à réponse libre | 🔄 SCRUM-73 | SCRUM-78 |
| SCRUM-16 Paramétrer le quiz | ✅ SCRUM-74 | SCRUM-79 |
| SCRUM-17 Modifier, déplacer, supprimer un quiz | ✅ SCRUM-75 | SCRUM-80 |
| SCRUM-22 Présenter le cours | ✅ SCRUM-76 | SCRUM-81 |
| SCRUM-24 Ouvrir un quiz | ✅ SCRUM-65 | SCRUM-64 |

Sur Jira, les étiquettes `front-fait`, `front-en-cours` et `attente-back` permettent de filtrer ces stories.

## 10. Lancer et tester

```bash
corepack pnpm install
corepack pnpm dev                      # web sur :3000, API et socket sur :3001 (.env avec MANAGER_PASSWORD)
corepack pnpm exec vitest run packages/web
cd packages/web && npx tsc -p tsconfig.app.json --noEmit
node_modules/.bin/oxlint <fichiers modifiés>
node_modules/.bin/oxfmt  <fichiers modifiés>
```

- **Tests unitaires** : `features/cours/test/validation.test.ts` (import) et `features/quiz/test/validation.test.ts` (règles des 3 types, options, barème, réponse libre).
- **Parcours dans le navigateur** : importer un PDF, insérer un quiz, présenter, ouvrir le quiz, puis rejoindre depuis une autre session avec `http://localhost:3000/?pin=<code>`.
- **Quiz de démonstration Razzia** : `config/quizz/example.json` est refusé par le validateur QCM de SCRUM-13. Ce n'est pas bloquant pour les quiz IQ, qui sont convertis au bon format.
- **Test des traductions** : il exige chaque clé dans les 9 langues. Le seul échec connu (`quizz:question.answerPoints`) vient de SCRUM-13.

## 11. Prochaines étapes côté front

- Brancher chaque écran sur le vrai back dès qu'il est livré (`VITE_API_MOCK=false`), puis retirer les ajouts de contrat non retenus.
- Écran E1 de connexion (CU 1.1) : possible en mock dès maintenant, à brancher sur le LDAP plus tard.
- Écrans étudiant S0 à S4 (rejoindre, attendre, répondre) et habillage IQ des écrans de partie (question en cours, résultats, classement E6).
- Glisser-déposer des quiz dans le déroulé (`PUT /api/cours/{id}/deroule`), mise à jour du PDF (CU 1.4), page de classement (SCRUM-18).
- Harmoniser avec Antoine la saisie QCM de E4 et son éditeur Razzia (SCRUM-13).
