# CLAUDE.md — IQ (SAÉ 5.01A)

IQ est un outil de quiz intégré aux cours PDF, construit comme un **fork de Razzia 4.1.0** (monorepo pnpm : `packages/web` pour le front, `packages/socket` pour l'API Hono et le temps réel Socket.IO, `packages/common` pour le code partagé, `packages/e2e` pour Playwright).
**Lis `context.md`** pour le métier, l'architecture, le modèle de données, les contrats d'API et l'état d'avancement. La référence reste `docs/Dossier-de-conception-et-architecture_IQ_V2.1.docx`, et les écrans sont dans `docs/maquettes/IQ-Maquettes-V1-ecrans.pdf` (E1 à E10 enseignant, S0 à S4 étudiant).

## Règles de travail

- **Périmètre front** : la personne qui utilise cette session fait le DevFront. **Ne modifie pas `packages/socket`** (back). Quand une route manque, ajoute un **mock** côté front qui respecte le contrat du dossier de conception, avec un client HTTP prêt à prendre le relais (`VITE_API_MOCK=false`).
- **Fichiers Razzia** : modifie-les le moins possible et mets le code IQ dans de nouveaux modules (`features/cours`, `features/quiz`, `features/seance`, `pages/manager/cours`). Ne touche pas aux fichiers d'Antoine (`features/quizz/**`, `features/questions/**`, `common/src/validators/quizz.ts`) sans accord.
- **Branches** : `feat-front/<nom-de-la-feature>` pour une feature, `docs/<sujet>` pour la doc. Pars de la branche de la feature précédente quand elle n'est pas encore fusionnée dans `dev`, pour garder la charte (DA) IQ.
- **Commits** : messages en français (`feat(front): … (SCRUM-xx / SCRUM-yy)`), **sans aucune ligne `Co-Authored-By: Claude` ni mention « Generated with Claude »**. Les commits apparaissent sous le compte de l'utilisatrice.
- **Push** : seulement après que l'utilisatrice a lancé l'app et validé. Ne fusionne jamais une PR toi-même.
- **Jira** (`iqprojet.atlassian.net`, projet SCRUM) : sous-tâche DevFront « En cours » au début, « En cours de revue » avec un commentaire (branche, contenu, besoins du back, limites) une fois poussée.
- **Maquettes** : chaque écran suit la maquette correspondante. Rends le PDF des maquettes en image pour le consulter (Playwright avec le canal `msedge` et pdf.js).

## Commandes

`pnpm` n'est pas dans le PATH de cette machine : utilise `corepack pnpm …`. Le Node local est en v24 alors que le projet demande v26, ce qui donne un avertissement sans effet.

| But | Commande |
|---|---|
| Installer | `corepack pnpm install` |
| Lancer web (3000) + socket (3001) | `corepack pnpm dev` (`.env` avec `MANAGER_PASSWORD` ; `pnpm` doit être appelable, sinon crée un shim vers `corepack pnpm`) |
| Typecheck du front | `cd packages/web && npx tsc -p tsconfig.app.json --noEmit` |
| Tests | `corepack pnpm exec vitest run packages/web` (ou `--project web`) |
| Lint | `node_modules/.bin/oxlint <chemins modifiés>` |
| Format | `node_modules/.bin/oxfmt <chemins modifiés>` |

- **Formate et lint uniquement les fichiers que tu as modifiés.** Avec `core.autocrlf=true`, tout le dépôt sort en CRLF : un `oxfmt` global reformaterait le code des autres, et `oxlint` remonte des erreurs `linebreak-style` partout (ignore-les).
- `route.gen.ts` est régénéré par le plugin TanStack au `vite dev` ou au `vite build`. Commite-le avec les routes.
- Pour ajouter une dépendance au front, utilise `corepack pnpm --filter @razzia/web add <pkg>`. Attention : le lockfile peut aussi monter `oxlint` et `@stylistic`, déclarés en `latest` à la racine.

## Conventions du code IQ

- **Nommage en français, sans accent** (types, fonctions, composants, clés i18n), comme le dossier de conception : `CoursDetail`, `QuizSaisie`, `validerQuiz`, `apresPage`. Les éléments repris de Razzia gardent leur nom anglais.
- **Imports** avec l'alias `@razzia/web/...`, `@razzia/common/...`.
- **Routes** TanStack Router en fichiers (`src/pages`, `layout.tsx` pour les layouts). Les pages enseignant IQ sont sous `/manager/cours` (layout avec garde de rôle et police Montserrat).
- **Données** : TanStack Query (fichiers `queries.ts` par feature) et un objet `ApiError(status, cleI18n)` pour les erreurs.
- **Validation** : schémas zod. Les messages d'erreur sont des **clés i18n** (`errors:quiz.enonceVide`), comme dans Razzia.
- **Charte IQ** : tokens Tailwind `iq-*` dans `src/index.css` (`iq-foret`, `iq-olive`, `iq-sauge`, `iq-citron`, `iq-creme`, `iq-fond`, `iq-or`…), police `font-iq`. Styles de boutons et de champs dans `features/cours/ui.ts`. Logo et mascotte Plume dans `src/assets/iq/`.
- **i18n** : le test `locales.test.ts` exige **chaque clé dans les 9 langues** (en est la référence) et que chaque clé utilisée dans le code existe. Ajoute les clés en `fr` et `en` (l'anglais sert aussi aux autres langues) avec un petit script de fusion JSON. Évite les pluriels i18next (`count`) : utilise `{{nb}}` et « question(s) ». Une clé ne peut pas être une chaîne qui désigne un objet JSON.
- **Tests** : Vitest à côté du code (`features/<x>/test/*.test.ts`) pour la logique pure (validation, barème).
- **Lint** (oxlint, strict) : `Array<T>` pour les types non simples, pas de `++`, pas de ternaire imbriqué, 3 paramètres max par fonction, ligne vide entre les déclarations, `SubmitEvent` au lieu de `FormEvent`.

## Vérifier dans le vrai navigateur

Après une modification d'UI, lance l'app et rejoue le parcours avec un script Playwright (dans le scratchpad, `chromium.launch({ channel: "msedge" })`, en important `@playwright/test` depuis `packages/e2e`). Fais des captures d'écran et compare-les à la maquette.
Connexion gestionnaire : `/manager` avec le mot de passe du `.env`. Un étudiant doit utiliser **une autre session** (contexte de navigateur séparé ou fenêtre privée) : le serveur refuse que le gestionnaire rejoigne sa propre partie.

## Problèmes connus (hors de notre périmètre)

- Le moteur Razzia ne joue que les QCM. Les questions RELIER et LIBRE attendent le back du lot 2.
