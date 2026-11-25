# Contexte du projet IQ

Synthèse du dossier de conception et d'architecture V2.1 (`docs/Dossier-de-conception-et-architecture_IQ_V2.1.docx`), des maquettes V1 (`docs/maquettes/IQ-Maquettes-V1-ecrans.pdf`), du Jira et de l'état du code. En cas de doute, le dossier de conception fait foi.

## 1. Le projet

**IQ** est un outil de quiz dynamique pour les enseignants de l'IUT de Montreuil (SAÉ 5.01A, BUT Informatique). Client : M. Aurélien Bossard.

Aujourd'hui, les cours sont des PDF projetés. IQ permet de :

1. **Préparer** : importer le PDF du cours, glisser des quiz entre ses pages, mettre à jour le PDF sans perdre les quiz, partager un cours avec un collègue.
2. **Animer** : projeter le cours en plein écran, ouvrir un quiz (QR code + code à 6 chiffres), lancer les questions une par une. Les étudiants répondent depuis leur téléphone.
3. **Classer** : leaderboard d'un quiz, page de classement placée dans le cours, leaderboard cumulé sur plusieurs quiz, podium animé.
4. **Exploiter** : résultats, export CSV au format Moodle, indices de difficulté et de discrimination, comparaison d'une année à l'autre, anonymisation en fin de formation.

Tout est hébergé sur un serveur de l'IUT, sans service extérieur.

**Équipe** : Elliot Musart, Camillia Emtir, Antoine Chen, Akram Barra, Boude Hanoune.

**Jalons** :
- Sprint 1 : du 05/11 au 26/11/2026.
- V1 (lot 1) : soutenance du 16/12/2026, tag `1.0.0`, Swagger.
- V2 (lots 2 et 3) : soutenance finale du 15/01/2027, tag `2.0.0`.

## 2. Rôles

| Rôle | Identification | Peut |
|---|---|---|
| Enseignant | Compte LDAP de l'IUT, membre du groupe `LDAP_GROUPE_ENSEIGNANTS` | Gérer ses cours, quiz et leaderboards, partager, animer, corriger, exporter, analyser, anonymiser |
| Étudiant | Compte LDAP, puis un pseudo par séance | Rejoindre une séance, répondre, voir son résultat et son rang |
| Annuaire LDAP | Système externe | Vérifier les identifiants, fournir le profil et la date de fin de formation |
| Moodle | Système externe | Recevoir les notes par import manuel du CSV |

## 3. Contraintes et décisions de conception

- Jusqu'à **100 étudiants par séance**, **10 séances simultanées** (1 000 connexions temps réel), une seule instance Node.
- Question affichée et réponse accusée en **moins d'1 s**, leaderboard en moins de 2 s. Le **minuteur fait foi côté serveur**.
- Navigateurs récents, interface responsive, pas d'application à installer.

| Sujet | Décision |
|---|---|
| Architecture | **Fork de Razzia 4.1.0**, renommé IQ, étendu (PDF, LDAP, PostgreSQL, nouveaux types de questions, résultats) |
| Barème | Points par question et par proposition, paire ou expression. Mauvaise réponse = 0 par défaut |
| Points de rapidité | `classement = arrondi(points × (1 + temps restant / durée))`. Ils comptent pour le classement, **pas** pour la note exportée |
| Ex æquo | Départagés au temps de réponse cumulé |
| Leaderboard cumulé | Somme, par étudiant (login LDAP), du meilleur score de chaque quiz rattaché |
| Taille d'un PDF | **50 Mo** max (`PDF_TAILLE_MAX_MO`), contrôlée par le front, Nginx et l'API |
| Durée d'une question | **5 à 300 s**. Réponses ouvertes **3 s** après l'énoncé (délai de lecture Razzia) |
| Enchaînement | Les questions **ne s'enchaînent pas** automatiquement (avance auto de Razzia désactivée) |
| Conservation | Nominatif pendant la formation, puis anonymisation irréversible (date de fin de formation, ou 36 mois) |
| Export Moodle | 2 CSV : les notes et l'analyse des questions |
| Correction manuelle | Réservée aux réponses libres |
| Doc API | Swagger sur `/api/docs` |

## 4. Architecture

Monorepo pnpm hérité de Razzia. **Deux principes** : le code ajouté vit dans de nouveaux modules, et les fichiers d'origine sont modifiés le moins possible. Razzia reste le remote `upstream`, pour reprendre ses correctifs de sécurité.

| Composant | Technologie | Rôle |
|---|---|---|
| Front (`packages/web`) | React 19, TypeScript, Vite, TanStack Router + Query, Zustand, Tailwind 4, i18next, **pdf.js**, qrcode.react, @dnd-kit, motion | Éditeur cours+quiz, présentation projetée, écrans étudiants |
| API REST (`packages/socket`) | Node, **Hono**, zod, @hono/zod-openapi + Swagger | Services REST, droits, règles métier |
| Temps réel (`packages/socket`) | **Socket.IO** sur `/ws` | Moteur de partie : questions, réponses, compteurs, classements |
| Partagé (`packages/common`) | Validateurs zod et types | Utilisés par le front et le serveur |
| Base | **PostgreSQL 16**, Drizzle (remplace les JSON de Razzia) | Utilisateurs, cours, quiz, séances, réponses, classements |
| Fichiers | Volume `/app/data` | Versions des PDF (`/app/data/pdf/{idCours}/v{n}.pdf`), médias |
| Auth | **LDAP** (ldapts) + JWT (8 h enseignant, 4 h étudiant) | Remplace `MANAGER_PASSWORD` |
| Livraison | GitHub Actions, Docker Compose, Nginx | HTTPS, relais `/api` et `/ws` |
| Qualité | Vitest, Playwright, k6, oxlint, oxfmt | Tests unitaires, intégration, e2e, charge |

Organisation cible (les éléments marqués « + » sont ajoutés par IQ) :

```
packages/
├─ common/src/validators/   + cours.ts, quiz.ts, resultats.ts
├─ web/src/
│  ├─ pages/                routes TanStack (+ manager/cours/…)
│  ├─ features/             + cours/, quiz/, seance/ (code IQ), game/, quizz/… (Razzia)
│  └─ locales/<lang>/       libellés (français par défaut)
├─ socket/src/
│  ├─ api/routes/           + auth, cours, quiz, seances, leaderboards, resultats
│  ├─ services/             game/, scoring/ (remplacé) + ldap, pdf, cours, quiz, seance…
│  └─ db/                   + schema.ts (Drizzle), migrations/
└─ e2e/                     tests Playwright
```

### Reprise de Razzia

| Élément | Dans IQ |
|---|---|
| Moteur de partie Socket.IO | **Modifié** : une partie par quiz rattachée à une séance, 3 types de questions, réponses écrites en base |
| Statuts de partie (SHOW_START … FINISHED) | Repris, plus `SHOW_STATS` |
| Calcul des points (`services/scoring`) | **Remplacé** (barème IQ + rapidité) |
| Code à 6 chiffres, QR code, reconnexion | Repris (le code devient celui de la séance) |
| Écrans joueur et gestionnaire, podium, sons | Repris et **habillés** (charte IQ, écrans S1 à S4, E5, E5b, E6) |
| `MANAGER_PASSWORD`, quiz et résultats en JSON | **Retirés** (remplacés par LDAP et PostgreSQL) |
| Types « estimation » et mode « survey » | Désactivés (le code reste en place) |
| Médias (`/api/media`) | Repris, réservés aux enseignants |

## 5. Modèle de données (MLD)

Noms en français sans accent. Les éléments repris de Razzia gardent leur nom anglais.

- `utilisateur` (id, login, nom, prenom, email, role ENSEIGNANT|ETUDIANT, date_premiere_connexion, date_fin_formation)
- `cours` (id, titre, code_ressource, dates, #id_proprietaire)
- `partage_cours` (#id_cours, #id_utilisateur, droit LECTURE|EDITION, date_partage)
- `version_pdf` (id, #id_cours, numero, chemin_fichier, nb_pages, taille_octets, date_import). La version courante est celle de plus grand numéro.
- `quiz` (id, #id_cours, titre, mode_affichage CLASSEMENT|STATISTIQUES|AUCUN, afficher_leaderboard, sert_notation, statut_placement PLACE|MIS_DE_COTE, apres_page, rang, ordre_mise_de_cote, options_partie jsonb)
- `question` (id, #id_quiz, ordre, type QCM|RELIER|LIBRE, enonce, duree_secondes 5–300, points_max, options jsonb)
- `proposition` (id, #id_question, ordre, libelle, est_correcte, points)
- `paire` (id, #id_question, ordre, element_gauche, element_droit)
- `expression_correction` (id, #id_question, ordre, motif, points)
- `leaderboard` (type QUIZ|CUMULE), `leaderboard_quiz`, `page_classement`
- `seance` (#id_version, #id_animateur, code_acces, statut OUVERTE|TERMINEE), `participation` (pseudo unique dans la séance, anonymise)
- `lancement` (ouverture d'une question en séance, date_cloture_prevue, statut OUVERTE|CLOSE)
- `reponse` (contenu, temps_restant_ms, points_reponse, points_classement, mode_correction AUTO|A_CORRIGER|MANUELLE), `correction`, `journal_anonymisation`

Le schéma est implémenté avec Drizzle dans `packages/socket/src/db/` et décrit dans `BD.md`. La migration `0001` ajoute `question.options` et `quiz.options_partie` (jsonb), absents du dossier, pour les réglages Razzia saisis dans E4.

Règles clés (RG) :
- **RG-06** : un quiz a au moins une question ; une question a une durée et des points max.
- **RG-07** : un QCM a au moins 2 propositions, chacune avec ses points ; un « relier » a au moins 2 paires ; une réponse libre a 0 ou plusieurs expressions avec leurs points.
- **RG-13** : au plus une réponse par participation et par lancement.

## 6. Cas d'utilisation, écrans et lots

| CU | Intitulé | Écrans | Lot |
|---|---|---|---|
| 1.1 | S'authentifier (LDAP) | E1 | 1 |
| 1.2 | Importer un support de cours PDF | E2, E3 | 1 |
| 1.3 | Insérer et paramétrer un quiz | E3, E4 | 1 (QCM), 2 |
| 1.4 | Mettre à jour le PDF et réappliquer les quiz (« À replacer ») | E2, E3 | 2 |
| 1.5 | Partager un cours (LECTURE / EDITION) | E2, E10 | 3 |
| 2.1 | Présenter le cours et lancer un quiz | E5, E5b, E6 | 1 |
| 2.2 | Rejoindre un quiz (QR, LDAP, pseudo) | S1, S2 | 1 |
| 2.3 | Répondre à une question | S3, S4 | 1 (QCM), 2 |
| 2.4 | Consulter et corriger les réponses | E8 | 2 |
| 3.1 | Leaderboard d'un quiz | E6, S4 | 2 |
| 3.2 | Leaderboard cumulé | E6, E7 | 3 |
| 4.1 | Consulter, exporter (Moodle), supprimer les résultats | E9 | 3 |
| 4.2 | Analyser les questions (p, D, point-bisériale, alpha) | E9 | 3 |
| 4.3 | Anonymiser les résultats | E9 | 3 |

Écrans des maquettes : E1 connexion, E2 « Mes cours » et modale d'import, E3 éditeur cours+quiz (déroulé), E4 paramétrage d'un quiz, E5 salle d'attente puis question en cours, E5b bonne réponse et statistiques, E6 classement. Côté étudiant : S0 saisie du code, S1 connexion IUT et pseudo, S2 attente, S3 réponse, S4 bonne ou mauvaise réponse. La mascotte s'appelle **Plume**.

## 7. Contrats d'API (extraits)

Format d'erreur commun : `{ statusCode, code, message, erreurs: [{ champ, message }], horodatage, chemin }`.
Codes de retour : 400 saisie, 401, 403 droit, 404, 409 conflit d'état, 410 trop tard, 413 fichier trop gros, 422 règle métier, 429, 503 annuaire.

| Route | Accès | Notes |
|---|---|---|
| `POST /api/auth/login` | Public | `{login, motDePasse}` → `{jeton, expireLe, utilisateur}` |
| `GET /api/cours` | Enseignant | `CoursResume[]` (cours propres et partagés) |
| `POST /api/cours` | Enseignant | multipart `fichier, titre, codeRessource?` → 201 `CoursDetail` ; 400 pas un PDF, 413, 422 illisible |
| `GET /api/cours/{id}` | Lecture | `CoursDetail` (versions, deroule, misDeCote) |
| `GET /api/cours/{id}/versions/{n}/fichier` | Lecture | `application/pdf` |
| `POST /api/cours/{id}/versions` | Propriétaire | nouvelle version, éléments mis de côté |
| `PUT /api/cours/{id}/deroule` | Édition | positions des quiz et pages de classement |
| `POST /api/cours/{id}/quiz` | Édition | `QuizSaisie` → 201 `Quiz` ; 400 saisie ou page inexistante |
| `GET` / `PUT` / `DELETE /api/quiz/{id}` | Lecture / Édition | 409 si une question est ouverte ; `DELETE ?forcer=true` supprime aussi les réponses (409 sinon) |
| `POST /api/quiz/expressions/test` | Enseignant | `{motif, exemples[]}` |
| `POST /api/seances` | Lecture du cours | `{idCours}` → `{idSeance, codeAcces, urlAcces}` ; 409 cours sans PDF |
| `POST /api/seances/{id}/fin` | Animateur | → `{idSeance, statut, dateDebut, dateFin, nbParticipants}` ; 409 déjà terminée |
| `GET /api/acces/{code}` | Public | `{idSeance, titreCours}` |
| `POST /api/seances/{id}/participants` | Étudiant | `{pseudo}` → `{participation, ticket}` |

Objets principaux :
- `CoursResume` : id, titre, codeRessource, proprietaire, droit, versionCourante, nbPages, nbQuiz, dateModification.
- `ElementDeroule` : type QUIZ|PAGE_CLASSEMENT, id, titre, apresPage, rang, ordreMiseDeCote, nbQuestions, dureeSecondes.
- `QuizSaisie` : titre, apresPage, rang, modeAffichage, afficherLeaderboard, sertNotation, optionsPartie, questions[]. Schéma zod partagé : `common/src/validators/quiz.ts`.
- `QuestionSaisie` : type, enonce, dureeSecondes, pointsMax, propositions[], paires[], expressions[], options.
- `Quiz` : `QuizSaisie` + id, idCours.

Événements temps réel ajoutés par IQ : `manager:openQuiz {idSeance, idQuiz}` (réponse `manager:quizOpened {idSeance, idQuiz, gameId, inviteCode, questionsIgnorees}`, refus en `game:errorMessage`), `manager:endQuiz`, `player:matchedPairs`, `player:freeAnswer`, statut `SHOW_STATS`. Les autres reprennent les noms Razzia (`manager:advance`, `player:login`, `player:selectedAnswer`, `game:status`…).

## 8. État d'avancement du front (sprint 1)

Branches poussées, à fusionner dans `dev` **dans cet ordre**, car chacune part de la précédente :

1. `docs/maquettes-conception` : maquettes et dossier de conception dans `docs/`.
2. `feat-front/importer-support-pdf` (SCRUM-11 / SCRUM-48) : E2 « Mes cours », modale d'import, E3 déroulé du PDF, charte IQ.
3. `feat-front/ouvrir-quiz` (SCRUM-24 / SCRUM-65) : présentation plein écran, salle d'attente E5 (QR, code, étudiants en direct).
4. `feat-front/inserer-quiz-cours` (SCRUM-12 / SCRUM-57) : quiz dans le déroulé, éditeur E4 (QCM, relier, libre, options Razzia), quiz ouvert depuis sa page.

Modules front IQ :
- `features/cours/` : types, API (`api/http.ts`, et `api/mock.ts` sur IndexedDB), pdf.js, composants E2 et E3, styles `ui.ts`.
- `features/quiz/` : types, validation RG-06 / RG-07 (+ tests), API et mock, composants E4.
- `features/seance/` : salle d'attente E5, contexte de séance, `moteur.ts` (adaptateur vers le moteur Razzia).
- `pages/manager/cours/` : `index` (E2), `$coursId` (E3), `quiz.$coursId` (E4), `presenter.$coursId` (présentation).

**État du back** (`packages/socket`, branches `feat-back/*`) :
- Base PostgreSQL et Drizzle (SCRUM-67), décrite dans `BD.md`.
- SCRUM-49 « Importer un support PDF » : `GET/POST /api/cours`, `GET /api/cours/{id}`, `GET …/versions/{n}/fichier` (CoursService, PdfService).
- SCRUM-56 « Insérer un quiz dans le cours » : `POST /api/cours/{id}/quiz`, `GET/PUT/DELETE /api/quiz/{id}` (QuizService). Le quiz est rangé à son rang après sa page, les autres quiz de la page sont décalés.
- SCRUM-64 « Ouvrir un quiz » (CU 2.1, figure 12) : `POST /api/seances`, `POST /api/seances/{id}/fin` et l'événement `manager:openQuiz`. Le serveur lit le quiz en base, le convertit en QCM Razzia et crée la partie **avec le code de la séance**, commun à tous ses quiz. Contrôles : animateur, séance ouverte, aucune question ouverte, quiz du cours. Les joueurs des quiz précédents de la séance sont inscrits d'office (`game:successJoin`). Remplace `features/seance/moteur.ts` côté front. Hors périmètre : réponses et lancements en base (SCRUM-28), `GET /api/acces/{code}` et participants LDAP (CU 2.2), reconstruction après redémarrage, RELIER/LIBRE en séance.
- Limites communes : un seul enseignant provisoire (`enseignant`) en attendant le LDAP, routes réservées au gestionnaire Razzia, PDF rangés dans `config/pdf/`.

Le front fonctionne encore par défaut sur des **mocks** qui respectent les contrats ci-dessus, et `VITE_API_MOCK=false` bascule sur les vraies routes. Le temps réel passe par le moteur Razzia existant : `moteur.ts` copie le quiz IQ au format QCM Razzia et crée la partie, en attendant `manager:openQuiz`. Le moteur ne joue que les QCM : en séance, les questions « relier » et « libre » sont ignorées avec un message.

Ajouts au contrat proposés par le front, **retenus par le back** :
- `nbPages` dans `CoursResume` ;
- `nbQuestions` et `dureeSecondes` dans `ElementDeroule` ;
- `options` par question (délai de lecture, pénalité, mode de score, catégorie, média, note), colonne `question.options` ;
- `optionsPartie` par quiz (pseudos générés, réponses seules), colonne `quiz.options_partie`.

Erreurs 409 du QuizService : `errors:seance.questionOuverte`, `errors:seance.quizDejaJoue` (un quiz déjà joué ne peut plus changer de questions) et `errors:seance.reponsesExistantes` (suppression sans `forcer`).

## 9. Jira

Site `iqprojet.atlassian.net`, projet **SCRUM**, « SCRUM Sprint 1 ». Chaque story a 4 sous-tâches : Conception, DevFront, DevBack, Cahier de recettes. Statuts : À faire → En cours → En cours de revue → Terminé.

| Story | DevFront | DevBack |
|---|---|---|
| SCRUM-11 Importer un support PDF | SCRUM-48 (Camillia) | SCRUM-49 |
| SCRUM-12 Insérer un quiz dans le cours | SCRUM-57 (Camillia) | SCRUM-56 |
| SCRUM-13 Créer une question QCM | SCRUM-52 (Antoine) | — |
| SCRUM-24 Ouvrir un quiz | SCRUM-65 (Camillia) | SCRUM-64 |
| SCRUM-28 Répondre à un QCM | SCRUM-59 (Antoine) | — (Conception : SCRUM-58, Camillia) |
| SCRUM-67 Création BD | SCRUM-70 | — |

## 10. Points ouverts

- Le quiz d'exemple Razzia (`config/quizz/example.json`) est refusé par le validateur QCM de SCRUM-13 : sans quiz QCM créé, la liste des quiz Razzia est vide.
- Le test `locales.test.ts > fr has no unknown key` échoue sur `dev` : la clé `quizz:question.answerPoints` (SCRUM-13) manque en anglais.
- L'éditeur E4 d'IQ recoupe l'éditeur QCM Razzia de SCRUM-13 : choisir lequel garder.
- L'authentification est encore celle de Razzia (`MANAGER_PASSWORD`) : le LDAP (CU 1.1) reste à faire.
