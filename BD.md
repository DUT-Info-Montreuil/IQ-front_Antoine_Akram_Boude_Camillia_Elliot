# Base de données IQ

PostgreSQL 16, ORM **Drizzle**, migrations **drizzle-kit**. Le schéma traduit le MLD du
*Dossier de conception et d'architecture IQ V2.1* (§4.1 MCD, §4.2 MLD, Tableau 9).

| Élément | Emplacement |
|---|---|
| Schéma (source de vérité) | [`packages/socket/src/db/schema.ts`](packages/socket/src/db/schema.ts) |
| Migrations SQL générées | [`packages/socket/src/db/migrations/`](packages/socket/src/db/migrations/) |
| Config drizzle-kit | [`packages/socket/drizzle.config.ts`](packages/socket/drizzle.config.ts) |
| Service Docker | `postgres` dans [`compose.yml`](compose.yml) (volume `pgdata`) |

## Démarrer en local

```bash
cp .env.example .env          # contient DATABASE_URL=postgres://iq:iq@localhost:5432/iq
pnpm db:up                    # lance le conteneur postgres (Docker Desktop doit tourner)
pnpm db:migrate               # applique les migrations
```

Modifier le schéma : éditer `schema.ts`, puis `pnpm db:generate` (crée un nouveau fichier SQL
dans `migrations/`, à committer), puis `pnpm db:migrate`. Ne jamais modifier une migration déjà
partagée.

## Conventions

- Tables et colonnes en français, sans accent, en `snake_case` (comme le dossier de conception).
  Côté TypeScript, les mêmes noms en `camelCase` (`id_quiz` → `idQuiz`).
- Clés primaires : `integer GENERATED ALWAYS AS IDENTITY`.
- Dates : `timestamp with time zone` (heure du serveur), sauf `date_fin_formation` (`date`).
- Domaines de valeurs : types `ENUM` PostgreSQL.

## Tables

### Contenus pédagogiques

| Table | Colonnes (PK **gras**, FK →) |
|---|---|
| `utilisateur` | **id_utilisateur**, login (unique), nom, prenom, email, role, date_premiere_connexion, date_fin_formation |
| `cours` | **id_cours**, titre, code_ressource, date_creation, date_modification, id_proprietaire → utilisateur |
| `partage_cours` | **id_cours** → cours, **id_utilisateur** → utilisateur, droit, date_partage |
| `version_pdf` | **id_version**, id_cours → cours, numero, chemin_fichier, nb_pages, taille_octets, date_import |
| `quiz` | **id_quiz**, id_cours → cours, titre, mode_affichage, afficher_leaderboard, sert_notation, statut_placement, apres_page, rang, ordre_mise_de_cote, options_partie (jsonb, migration 0001) |
| `question` | **id_question**, id_quiz → quiz, ordre, type, enonce, duree_secondes, points_max, options (jsonb, migration 0001) |
| `proposition` | **id_proposition**, id_question → question, ordre, libelle, est_correcte, points |
| `paire` | **id_paire**, id_question → question, ordre, element_gauche, element_droit |
| `expression_correction` | **id_expression**, id_question → question, ordre, motif, points |
| `leaderboard` | **id_leaderboard**, id_proprietaire → utilisateur, titre, type, date_creation |
| `leaderboard_quiz` | **id_leaderboard** → leaderboard, **id_quiz** → quiz |
| `page_classement` | **id_page**, id_cours → cours, id_leaderboard → leaderboard, apres_page, rang, statut_placement, ordre_mise_de_cote |

### Séances et résultats

| Table | Colonnes (PK **gras**, FK →) |
|---|---|
| `seance` | **id_seance**, id_version → version_pdf, id_animateur → utilisateur, code_acces, date_debut, date_fin, statut |
| `participation` | **id_participation**, id_seance → seance, id_etudiant → utilisateur (NULL si anonymisé), pseudo, date_arrivee, anonymise |
| `lancement` | **id_lancement**, id_seance → seance, id_question → question, date_ouverture, date_cloture_prevue, date_cloture, statut |
| `reponse` | **id_reponse**, id_lancement → lancement, id_participation → participation, contenu (jsonb), date_reponse, temps_restant_ms, taux_reussite, points_reponse, points_classement, mode_correction, date_correction |
| `correction` | **id_correction**, id_reponse → reponse, id_correcteur → utilisateur, anciens_points, nouveaux_points, date_correction |
| `journal_anonymisation` | **id_journal**, date_traitement, mode, id_seance → seance, nb_participations |

`reponse.contenu` : QCM → tableau d'`id_proposition` ; RELIER → couples d'`id_paire` ;
LIBRE → texte saisi.

## Migrations

| Fichier | Contenu |
|---|---|
| `0000_init.sql` | Les 18 tables du MLD, enums, contraintes et index |
| `0001_options_quiz.sql` | Ajoute `question.options` et `quiz.options_partie` (SCRUM-12) |

La migration 0001 ajoute deux colonnes `jsonb NOT NULL` qui ne sont pas dans le MLD du dossier. Elles
stockent les réglages du moteur Razzia que l'éditeur E4 envoie avec `QuizSaisie` (ajouts au contrat
proposés par le front) :

| Colonne | Contenu | Valeur par défaut |
|---|---|---|
| `question.options` | `delaiLecture` (3 à 15 s), `penalite` (0 à points_max), `modeScore` (STRICT, EQUILIBRE, INDULGENT), `categorie` (40 caractères), `note` (300 caractères), `media` (`{type: IMAGE, VIDEO ou AUDIO, url}` ou null) | `{"delaiLecture":3,"penalite":0,"modeScore":"STRICT","categorie":"","note":"","media":null}` |
| `quiz.options_partie` | `pseudosGeneres`, `reponsesSeulement` (booléens) | `{"pseudosGeneres":false,"reponsesSeulement":false}` |

Ces réglages ne servent qu'au moteur de partie et ne sont jamais filtrés en SQL : une colonne jsonb
évite six colonnes et un enum de plus. Leurs règles sont vérifiées avant l'écriture par
`quizSaisieSchema` ([`packages/common/src/validators/quiz.ts`](packages/common/src/validators/quiz.ts)).

Appliquer la migration sur une base existante :

```bash
corepack pnpm --filter socket db:migrate
```

## Domaines de valeurs (enums)

| Enum PostgreSQL | Colonnes | Valeurs |
|---|---|---|
| `role` | utilisateur.role | ENSEIGNANT, ETUDIANT |
| `droit_partage` | partage_cours.droit | LECTURE, EDITION |
| `mode_affichage` | quiz.mode_affichage | CLASSEMENT, STATISTIQUES, AUCUN |
| `statut_placement` | quiz, page_classement | PLACE, MIS_DE_COTE |
| `type_question` | question.type | QCM, RELIER, LIBRE |
| `type_leaderboard` | leaderboard.type | QUIZ, CUMULE |
| `statut_seance` | seance.statut | OUVERTE, TERMINEE |
| `statut_lancement` | lancement.statut | OUVERTE, CLOSE |
| `mode_correction` | reponse.mode_correction | AUTO, A_CORRIGER, MANUELLE |
| `mode_anonymisation` | journal_anonymisation.mode | AUTO, MANUEL |

## Contraintes et index

- **Unicité** : `utilisateur.login`, `(version_pdf.id_cours, numero)`, `(participation.id_seance, pseudo)`,
  `(participation.id_seance, id_etudiant)`, `(reponse.id_lancement, id_participation)` : une seule réponse
  par étudiant et par question lancée.
- **Code d'accès** : index unique partiel sur `seance.code_acces WHERE statut = 'OUVERTE'` (un code
  redevient libre quand la séance est terminée) et `CHECK` sur 6 chiffres.
- **CHECK** : `question.duree_secondes` entre 5 et 300, `question.points_max ≥ 0`,
  `reponse.taux_reussite` entre 0 et 1, `reponse.points_reponse ≥ 0`, `reponse.temps_restant_ms ≥ 0`,
  `version_pdf.nb_pages > 0`.
- **Anonymisation** : `participation.id_etudiant` ne peut être NULL que si `anonymise = true`.
- **Suppressions** :
  - supprimer un quiz supprime en cascade ses questions, propositions, paires et expressions ;
  - `lancement.id_question` est en `RESTRICT` : un quiz déjà joué en séance ne peut pas être
    supprimé directement. Avec la confirmation explicite (`DELETE /api/quiz/{id}?forcer=true`),
    QuizService supprime d'abord ses corrections, réponses et lancements, dans la même transaction ;
  - les tables d'association (`partage_cours`, `leaderboard_quiz`) et `correction` suivent leur parent ;
  - supprimer une séance met `journal_anonymisation.id_seance` à NULL (le journal est conservé).
- **Index** : `reponse(id_lancement)`, `reponse(id_participation)`, `lancement(id_seance)`,
  `participation(id_etudiant)`, `leaderboard_quiz(id_quiz)`.

## Non couvert par la base

- `points_reponse ≤ points_max` de la question : cette règle porte sur deux tables, un `CHECK` ne
  peut donc pas l'exprimer. Elle est à vérifier dans le service de réponse (ou par un trigger si besoin).
- L'application n'exécute pas les migrations au démarrage (prévu par le dossier §2.6) : lancer
  `db:migrate` après chaque mise à jour du dépôt.
- Le rang des quiz placés après une même page est recalculé par QuizService à chaque création,
  modification ou suppression. Il n'y a pas de contrainte d'unicité sur `(id_cours, apres_page, rang)`,
  pour pouvoir décaler les rangs dans une transaction.
