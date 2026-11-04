# Clutch

Mes équipes esport sur une seule page : prochains matchs avec horaires et
streams, résultats, face-à-face, classements, poules et brackets. Les données
viennent de [Liquipedia](https://liquipedia.net), le design est le mien, et
seules les compétitions où jouent mes équipes sont suivies.

Équipes suivies (dans [`src/config/follow.ts`](src/config/follow.ts)) :

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

Le site **n'appelle jamais Liquipedia** : il lit un instantané que la
synchronisation est seule à écrire. Les pages s'affichent donc instantanément,
et le rythme des appels ne dépend pas du nombre de visites.

La synchronisation lit deux sortes de pages :

1. **la page de chaque équipe** : matchs à venir (horaire, streams, compétition,
   phase) et derniers résultats ;
2. **la page de chaque compétition** trouvée là, jouée dans les trois dernières
   semaines ou à venir : classements, poules, brackets, tous les matchs.

Elle choisit à chaque tour la page la plus urgente :

| Page | Rechargée |
|---|---|
| équipe | toutes les 30 min |
| compétition avec un match en cours ou imminent | toutes les 10 min |
| compétition en cours | toutes les 3 h |
| compétition terminée | jamais |

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

## Ajouter une équipe

Ajouter une ligne à `FOLLOWED` dans `src/config/follow.ts`, avec le titre exact
de sa page Liquipedia, puis `npm run sync`. Pour écarter une compétition dont
on ne veut pas (une qualification, par exemple), ajouter un motif à
`IGNORE_TOURNAMENTS`.

## Mettre au point un parseur

```bash
npx tsx scripts/dump.ts rocketleague "Gentle Mates"
npx tsx scripts/check-parsers.ts team rocketleague "Gentle Mates" "data/raw/rocketleague--Gentle Mates.html"
```

`dump.ts` enregistre le HTML d'une page (au rythme permis) dans `data/raw/` ;
`check-parsers.ts` montre ce que les parseurs en tirent, sans réseau.
