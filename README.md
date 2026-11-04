# Clutch

Mes équipes esport sur une seule page : prochains matchs avec horaires et
streams, résultats, face-à-face, classements, poules et brackets. Les données
viennent de [Liquipedia](https://liquipedia.net), le design est le mien, et
seules les compétitions où jouent mes équipes sont suivies.

Équipes suivies par défaut (dans [`src/config/follow.ts`](src/config/follow.ts)),
modifiables depuis la page **Réglages** du site :

| Jeu | Équipe |
|---|---|
| Rocket League | Gentle Mates |
| Counter-Strike 2 | Team Vitality |
| Call of Duty League | Paris Gentle Mates |

## Lancer

```bash
npm install
npm run dev
```

En local, le site tourne sur <http://localhost:3240>. `npm run dev` lance deux processus :
le site (`site`) et la synchronisation continue (`sync`).

| Commande | Effet |
|---|---|
| `npm run dev` | site + synchronisation continue |
| `npm run dev:site` | le site seul, sur les données déjà synchronisées |
| `npm run sync` | une passe de synchronisation, puis s'arrête |
| `npm run sync -- --force` | recharge toutes les pages une fois, même à jour |

La toute première synchronisation prend quelques minutes : voir plus bas.

## Comment les données arrivent

```
Liquipedia (API MediaWiki, action=parse)
        │   une page toutes les 31 s, au plus
        ▼
scripts/refresh.ts ──► instantané (fichier en local, Vercel Blob en ligne) ──► le site
```

Aucune page du site **n'attend Liquipedia** : elles lisent un instantané que
seule la synchronisation écrit (voir [`src/lib/sync/engine.ts`](src/lib/sync/engine.ts)).
Les pages s'affichent donc instantanément, et le rythme des appels ne dépend
pas du nombre de visites.

La synchronisation lit plusieurs sortes de pages :

1. **la page de chaque équipe** : matchs à venir (horaire, streams, compétition,
   phase), derniers résultats, effectif et derniers mouvements ;
2. **la page de chaque compétition** trouvée là, jouée dans les trois dernières
   semaines ou à venir : classements, poules, brackets, tous les matchs ;
3. **la page `Équipe/Matches`**, une fois par semaine : tout l'historique, pour
   les face-à-face sur plusieurs saisons ;
4. les listes de compétitions et les saisons (voir [Calendrier](#calendrier)).

Elle choisit à chaque tour la page la plus urgente :

| Page | Rechargée |
|---|---|
| équipe | toutes les 30 min (12 min de 3 h avant à 5 h après un de ses matchs) |
| compétition avec un match en cours ou imminent | toutes les 10 min |
| compétition en cours | toutes les 3 h |
| compétition terminée | jamais |
| historique complet | chaque semaine |

**Pendant un match**, la page se recharge seule chaque minute (tant qu'elle
est visible) pour suivre le score.

## Règles de Liquipedia

Les [conditions d'utilisation de l'API](https://liquipedia.net/api-terms-of-use)
sont respectées par construction, dans
[`src/lib/liquipedia/client.ts`](src/lib/liquipedia/client.ts) :

- un **User-Agent** qui nomme le projet et donne un contact ;
- **une requête `action=parse` toutes les 30 s** au plus (31 s par sécurité),
  avec l'horodatage du dernier appel gardé sur disque : relancer le processus
  ne permet pas d'aller plus vite ;
- **gzip** accepté, et un cache aussi long que possible ;
- seule l'API est appelée, jamais les pages HTML du site ;
- les données sont sous **CC BY-SA 3.0** : le pied de page le dit et chaque
  compétition renvoie vers sa page source.

Le contact du User-Agent se règle dans `.env.local` (voir `.env.example`).

L'API structurée de Liquipedia (LPDB) demanderait une clé, accordée sur
demande. Elle n'est pas nécessaire : tout passe par l'API MediaWiki, libre.

## En production

Le site est déployé sur Vercel, relié au dépôt GitHub : **un push sur `main`
déploie**. Pour déployer à la main : `npx vercel --prod --yes`.

```
GitHub Actions, toutes les 15 min ──► Vercel Blob (snapshot.json) ──► le site
```

Vercel sert le site ; la synchronisation tourne dans **GitHub Actions**
([`.github/workflows/sync.yml`](.github/workflows/sync.yml)), toutes les
15 minutes, et **ne committe jamais rien** :

1. elle reprend l'état le plus récent (heure de lecture de chaque page) : celui
   de la passe précédente, gardé dans le cache d'Actions, ou à défaut la
   version publiée (`scripts/ci.ts restore`) ;
2. elle lit au plus 6 pages, les plus urgentes (`refresh.ts --ci`) : une
   compétition où une équipe suivie joue à chaque passe, les équipes une passe
   sur deux, les autres compétitions en cours toutes les 3 h ;
3. elle publie l'instantané dans **Vercel Blob** seulement si les données ont
   changé (`scripts/ci.ts publish`) — le plan Hobby limite les écritures à
   2 000 par mois.

Le site lit l'instantané à l'adresse `SNAPSHOT_URL` (variable Vercel et
variable du dépôt GitHub). Le CDN de Blob le garde 60 s : une donnée publiée
est visible au plus une minute après. Sans `SNAPSHOT_URL`, en local, le site lit
`data/snapshot.json`.

Pourquoi pas un cron Vercel : sur le plan Hobby, il ne tourne qu'une fois par
jour. Le dépôt est public, donc les minutes d'Actions sont illimitées ; en
contrepartie, GitHub désactive les tâches planifiées d'un dépôt public après
60 jours sans activité. Comme la synchro ne committe rien, elle réactive
elle-même son workflow par l'API une fois par jour.

Le secret `BLOB_READ_WRITE_TOKEN` du dépôt donne à la synchro le droit d'écrire
dans Blob ; il vient de la page du store `clutch-data` sur Vercel.

Lancer une passe tout de suite : `gh workflow run sync.yml`, ou le bouton
« Run workflow » de l'onglet Actions.

### Si GitHub ne lance pas la synchro

GitHub ne garantit pas ses tâches planifiées (elles peuvent tarder, voire ne
jamais démarrer sur un dépôt récent). Le site a donc deux secours, qui
utilisent le même moteur et le même rythme d'appels :

- **à la visite** : si l'instantané a plus de 2 h 30, si un match est en cours
  ou imminent, ou si les équipes ont changé, la page s'affiche tout de suite
  puis, une fois la réponse envoyée, le serveur lit au plus 4 pages et publie
  ([`src/lib/sync/auto.ts`](src/lib/sync/auto.ts)). Un verrou dans Blob évite
  deux passes en même temps ;
- **chaque jour à 5 h 15 UTC**, un cron Vercel appelle `/api/sync`
  ([`vercel.json`](vercel.json)). Si la variable `CRON_SECRET` est définie,
  seul le cron peut l'appeler.

Même sans changement, la synchro republie l'instantané toutes les 2 h : c'est
son signal de vie. Au-delà de 2 h 30 sans nouvelles, un bandeau le signale en
haut du site.

## Calendrier

L'onglet **Calendrier** (`/calendrier`) montre le mois : la durée de chaque
compétition en bandes continues, les matchs de mes équipes (heure, ou résultat
une fois joués), puis un agenda jour par jour et la liste des prochaines
compétitions. Une vue **Semaine** détaille sept jours, match par match. Deux
périmètres :

- **Mes équipes** : seulement les compétitions où elles jouent ;
- **Tout le circuit** : aussi les autres grandes compétitions de chaque jeu et
  tous les matchs des compétitions suivies.

Le bouton **Masquer** d'une compétition, dans la liste du calendrier, la retire
de la vue sur ce navigateur ; on la réaffiche depuis les Réglages.

Pour savoir à l'avance où jouent mes équipes, la synchro lit :

- toutes les 6 h, la liste des compétitions de chaque jeu
  (`Liquipedia:Tournaments`, une requête légère) : les prochaines semaines ;
- chaque jour, les listes par niveau (`TIER_LISTS` : S-Tier, et A-Tier pour la
  CDL) : les grandes compétitions, des mois à l'avance ;
- chaque jour, les saisons en cours (`SEASON_PREFIXES` : étapes RLCS, CDL) :
  chaque étape annoncée avec ses dates, avant même son ouverture ;
- la page de chaque compétition à venir ou en cours : dates, lieu, cashprize et
  **participants**.

Une compétition prend l'un de trois niveaux :

| Niveau | Quand | Affichage |
|---|---|---|
| confirmée | une équipe suivie est inscrite ou y joue | bande pleine |
| à surveiller | la règle `watch` de l'équipe la retient, inscription inconnue | bande hachurée, « à confirmer » |
| reste du circuit | le reste | vue « Tout le circuit » seulement |

Les règles `watch` (réglables pour chaque équipe dans les Réglages) : tout le circuit RLCS sauf
les étapes des autres régions pour Gentle Mates, le S-Tier pour Vitality,
toute la CDL pour Paris Gentle Mates. Une compétition surveillée dont la liste
de participants est close sans l'équipe repasse dans le reste du circuit. Le
wiki Call of Duty mêle plusieurs jeux : `OTHER_TITLES` écarte Call of Duty
Mobile et Warzone.

**Matchs sans heure.** Quand Liquipedia ne donne que le jour, le match
s'affiche ce jour-là, « heure à confirmer ». Un match à l'affiche connue mais
sans date du tout est listé dans « Matchs à programmer », avec la période de
sa compétition.

**Abonnement agenda** : `/calendrier.ics` publie les matchs de mes équipes et
leurs compétitions au format iCalendar. Le bouton « S'abonner » de la page
l'ajoute à l'agenda du téléphone, qui le relit tout seul ; dans Google Agenda,
« Autres agendas » → « À partir de l'URL ».

## Sur le téléphone

Clutch s'installe comme une appli (PWA) :

- **Android, Chrome, Edge** : bouton « Installer » dans l'en-tête, ou menu du
  navigateur → « Installer l'application » ;
- **iPhone** : dans Safari, Partager → « Sur l'écran d'accueil ».

Le service worker ([`public/sw.js`](public/sw.js)) passe **d'abord par le
réseau** : en ligne, on voit toujours les données et la version du jour. Le
cache ne sert qu'hors connexion, avec la dernière version vue de chaque page.
Les icônes se régénèrent avec `npx tsx scripts/icons.ts`.

## Réseau Orbit

Clutch fait partie de mon [réseau Orbit](https://orbit-umber-sigma.vercel.app),
où il a sa carte dans la catégorie Jeux. Comme les autres applis, il porte la
signature du réseau, dans [`src/app/layout.tsx`](src/app/layout.tsx) :

- `<orbit-splash>` : l'écran d'ouverture, une fois par onglet ;
- `<orbit-header>` : le bandeau du réseau, avec un lien vers le hub, au-dessus
  de l'en-tête de Clutch (il défile avec la page).

Sa mascotte est le pingouin **esport** (thème `esport`, créé pour Clutch) :
casque-micro de joueur pro et trophée doré, sur l'accent bleu de Clutch.

Les deux scripts sont des copies servies depuis `public/`, et le service
worker les garde en cache : l'appli installée s'ouvre aussi hors connexion.
Après une évolution dans le dépôt Orbit, recopier `orbit-header.js` et
`orbit-splash.js` dans `public/` et incrémenter `VERSION` dans `public/sw.js`.

## Réglages

La page **Réglages** (icône d'engrenage, `/reglages`) ajoute ou retire une
équipe (huit au plus : chaque page coûte 31 s de synchro) et choisit pour
chacune les compétitions à surveiller. La liste est enregistrée dans Blob
(`config.json`, à côté de l'instantané) ; en local, dans `data/config.json`.
Les matchs d'une nouvelle équipe arrivent à la synchro suivante.

Ces réglages valent pour tous les visiteurs : les modifier demande un **code**,
défini dans la variable `CLUTCH_ADMIN_PIN` (Vercel → projet `clutch` →
Settings → Environment Variables, puis redéployer). On le saisit une fois ;
un cookie garde le navigateur déverrouillé 30 jours. Choisir un code long :
la page est publique. Sans la variable, les équipes sont en lecture seule.

Pour écarter une compétition pour tout le monde (une qualification, par
exemple), ajouter un motif à `IGNORE_TOURNAMENTS` dans `src/config/follow.ts`.

## Tests

```bash
npm test
```

Les parseurs sont testés sur de vraies pages Liquipedia, capturées et
compressées dans [`tests/fixtures`](tests/fixtures) : pages d'équipe des trois
jeux, historique complet, compétitions (championnat, format suisse, double
élimination), listes par niveau. La CI GitHub les lance à chaque push, avec le
lint et la vérification des types. Si Liquipedia change sa mise en page, une
nouvelle capture montre tout de suite ce qui casse.

## Mettre au point un parseur

```bash
npx tsx scripts/dump.ts rocketleague "Gentle Mates"
npx tsx scripts/check-parsers.ts team rocketleague "Gentle Mates" "data/raw/rocketleague--Gentle Mates.html"
```

`dump.ts` enregistre le HTML d'une page (au rythme permis) dans `data/raw/`,
`dump-wikitext.ts` son wikitexte ; `check-parsers.ts` montre ce que les
parseurs en tirent, sans réseau. Pour en faire un test, compresser la capture
dans `tests/fixtures/` (`gzip -9`).
