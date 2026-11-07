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
   phase), derniers résultats, effectif et derniers mouvements, carte d'identité,
   anciens joueurs, distinctions et records ;
2. **la page de chaque compétition** trouvée là, jouée dans les trois dernières
   semaines ou à venir : classements, poules, brackets, tous les matchs ;
3. **la page d'historique**, une fois par semaine : `Équipe/Matches`, ou
   `Équipe/Played Matches` selon le wiki (Rocket League, CDL). Tout l'historique,
   pour les face-à-face et les [statistiques](#statistiques-dune-équipe) ;
4. **la page `Équipe/Results`**, tous les 3 jours : le palmarès ;
5. **les compétitions des 12 derniers mois**, une seule fois chacune (S, A et
   B-Tier, 6 pages par équipe et par passe au plus) : les manches déjà jouées ;
6. **la page de chaque adversaire** des 7 prochains jours, une fois par jour :
   son effectif, sa forme et sa carte d'identité, pour la [page de match](#page-de-match) ;
7. les classements de saison (voir [Classements et forme](#classements-et-forme)) ;
8. les listes de compétitions et les saisons (voir [Calendrier](#calendrier)).

Elle choisit à chaque tour la page la plus urgente :

| Page | Rechargée |
|---|---|
| équipe | toutes les 30 min ; de 3 h avant à 5 h après un de ses matchs, à chaque passe de la synchro régulière (5 min) |
| compétition avec un match en cours ou imminent | à chaque passe de la synchro régulière (5 min) |
| compétition où mon équipe attend son horaire, joue d'ici 24 h ou vient de jouer | toutes les 10 min |
| compétition en cours | toutes les 3 h |
| compétition terminée | jamais |
| historique complet | chaque semaine |
| palmarès | tous les 3 jours |
| adversaire de la semaine | chaque jour |
| classement de saison | chaque jour |

**Pendant un match**, la page se recharge seule chaque minute (tant qu'elle
est visible) pour suivre le score.

**Les horaires viennent de la page de la compétition.** Liquipedia y publie l'heure
d'un tour au fil de la compétition, souvent peu avant. Celle de l'équipe peut garder
des heures un match déjà joué : elle ne suffit pas à suivre un tournoi rapide. Dès
qu'une équipe suivie attend un horaire, la page de la compétition est donc relue toutes
les 10 min. Elle affiche ensuite les heures à trois endroits : le **programme** en haut
(jour par jour, à l'heure de Paris), le **bracket** et le **parcours** de l'équipe. Un
match sans heure indique « Horaire à venir ».

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
cron-job.org, toutes les 5 min ──► /api/sync (Vercel) ──► Vercel Blob (snapshot.json) ──► le site
```

La synchronisation **ne committe jamais rien** : elle publie l'instantané dans
**Vercel Blob**, où le site le lit (`SNAPSHOT_URL`). Sans `SNAPSHOT_URL`, en
local, le site lit `data/snapshot.json`.

### La synchro régulière : un cron externe

Un service de cron gratuit, [cron-job.org](https://cron-job.org), appelle
`/api/sync` toutes les 5 minutes. La réponse part aussitôt, la passe continue
ensuite sur Vercel ([`src/lib/sync/auto.ts`](src/lib/sync/auto.ts)) : elle lit
les pages dues (6 au plus, en moins de 3 minutes), et pendant un match relit le
score à chaque passe. Elle ne publie que si les données ont changé.

**Son calendrier ne dépend pas de l'âge des données.** Une page relue sans
changement ne publie rien : l'âge noté dans l'instantané ne bouge donc pas, et le
cron, qui repart de cet instantané à chaque passe, croirait la page toujours en
retard. Il la relirait à chaque passe, pour rien. Le cron tire donc les créneaux
d'une page de son nom et de l'heure (`isDue`, dans
[`engine.ts`](src/lib/sync/engine.ts)) : une fois par période, à un moment qui
varie d'une page à l'autre. Les autres passes (locale, GitHub, visites) gardent
leur état ou écrivent ce qu'elles lisent : pour elles, seul l'âge compte.

Mise en place, une fois :

1. Vercel → projet `clutch` → Settings → Environment Variables : ajouter
   `CRON_SECRET`, une longue chaîne aléatoire, puis redéployer ;
2. sur cron-job.org, créer une tâche : adresse
   `https://clutch-ochre.vercel.app/api/sync`, toutes les 5 minutes, et dans
   « Advanced » un en-tête `Authorization` qui vaut `Bearer ` suivi du secret.

Le cron quotidien de Vercel ([`vercel.json`](vercel.json), 5 h 15 UTC) appelle la
même adresse avec le même secret, que Vercel ajoute de lui-même.

**Le quota de Blob.** Le plan Hobby compte 2 000 écritures et 10 000 lectures
hors cache par mois, et coupe l'accès à Blob 30 jours au-delà : le site
s'arrêterait. D'où trois règles :

- la synchro régulière n'écrit rien tant que rien ne change, pas même un verrou ;
- le CDN garde l'instantané une heure (`CDN_MAX_AGE`) : les lectures sont
  servies par le cache et ne comptent pas, et une publication s'y voit quand
  même en moins d'une minute ;
- même sans changement, l'instantané est republié toutes les 2 h : c'est le
  signal de vie de la synchro.

### Les secours

Si la synchro régulière se tait plus de 2 h 30, un bandeau le signale en haut
du site, et deux secours prennent le relais, sous un verrou dans Blob :

- **à la visite** : la page s'affiche tout de suite puis, la réponse envoyée,
  le serveur lit au plus 4 pages et publie ;
- **GitHub Actions** ([`.github/workflows/sync.yml`](.github/workflows/sync.yml)) :
  toutes les 15 minutes en théorie, mais GitHub lance ses tâches planifiées très
  irrégulièrement, et ses machines partagent leurs adresses avec beaucoup
  d'autres projets (Liquipedia leur répond parfois 429). Le workflow vérifie
  donc d'abord la fraîcheur des données (`scripts/ci.ts fresh`) et ne
  synchronise que si elles ont plus de 2 h 30. Il garde l'état de passe en
  passe dans son cache, et se réactive lui-même une fois par jour (GitHub
  désactive les tâches planifiées d'un dépôt public sans activité).

Sans `CRON_SECRET`, c'est l'ancien fonctionnement : les visites déclenchent la
synchro quand un match est en cours ou que les équipes ont changé.

Le secret `BLOB_READ_WRITE_TOKEN` du dépôt GitHub donne au workflow le droit
d'écrire dans Blob. Lancer une passe GitHub à la main : `gh workflow run sync.yml`.

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

## Page de match

Chaque match de mes équipes a sa page (`/match/…`), ouverte depuis « Détails du
match » sur l'accueil ou depuis le nom de l'adversaire dans les listes :

- le score, en direct pendant le match (la page se recharge seule), ou l'heure
  et le compte à rebours ;
- **Regarder** : le stream dans la page, une heure avant le début et pendant le
  match, avec un onglet par chaîne. Twitch et Kick s'intègrent ; YouTube reste
  un lien, Liquipedia ne donnant pas l'identifiant de chaîne que son lecteur
  réclame. Pendant un match, le bouton « Regarder » de l'accueil y mène ;
- les **manches** : arène et buts en Rocket League, carte et rounds en CS2 ;
- la **forme du moment** des deux équipes (10 derniers matchs, série en cours) ;
- le **face-à-face** complet et les **effectifs**.

On l'ouvre aussi depuis la page d'une compétition : toute la ligne (ou la
case de bracket) d'un match de mes équipes y mène, et le nom de chaque équipe
ouvre sa page.

**Chaînes françaises.** Chaque équipe suivie a ses chaînes Twitch
francophones, proposées en premier pour tous ses matchs (onglets du lecteur,
boutons marqués « FR ») avant les diffusions officielles : RocketBaguette pour
la Rocket League, CroissantStrike et KRL_Stream pour CS2, et les cofondateurs
de Gentle Mates (Gotaga, Squeezie, Brawks) pour les matchs du club. La liste se
règle équipe par équipe dans les Réglages.

**Fiches d'équipe.** Une équipe que je ne suis pas a sa fiche
(`/equipes/<jeu>/<équipe>`) : prochains matchs contre mes équipes,
face-à-face, classements et matchs dans les compétitions suivies, rang VRS ;
et, pour les adversaires des 7 prochains jours, forme, derniers résultats et
effectif lus sur sa page Liquipedia.

L'effectif et la forme de l'adversaire viennent de sa page Liquipedia, que la
synchro lit une fois par jour pour les adversaires des 7 prochains jours
(8 au plus). La forme de mes équipes s'affiche aussi sur leur page.

## Classements et forme

La page de chaque équipe montre sa **forme du moment** (10 derniers matchs,
bilan, série en cours) et son **classement de saison**, lu une fois par jour :

- **CS2** : le classement régional de Valve (VRS), recalculé chaque semaine :
  rang mondial, rang dans sa région, points, et les 10 premiers ;
- **CDL** : le classement de la saison régulière, dès que Liquipedia publie sa
  page (`Call of Duty League/Season N/Regular Season`), en général au début de
  la saison ;
- **Rocket League** : pas de tableau pour l'instant. Le circuit RLCS 2027 (Club
  Championship) n'a pas de classement à points sur Liquipedia : sa page
  « Qualification » ne liste que les équipes qualifiées. La note Liquipedia
  (LPRating) de la page de l'équipe donne quand même son rang.

Le haut du classement et les places de mes équipes et de leurs adversaires sont
gardés ; la page de match affiche le rang des deux équipes.

## Statistiques d'une équipe

Tout vient de Liquipedia, et les calculs sont dans
[`src/lib/stats.ts`](src/lib/stats.ts). La page d'une équipe suivie montre, dans
[`src/components/team-stats.tsx`](src/components/team-stats.tsx) :

- **sa carte d'identité** : classement, gains, titres, âge du club, encadrement ;
- **ses bilans** par période et par niveau de compétition, et **sa courbe de
  forme** : la part de victoires sur les 10 matchs précédents, à chaque match ;
- **ses records** : meilleure et pire séries, balayages, manches décisives. Un Bo1
  de CS2 donne le score de la carte (13-4) : il compte dans les bilans, pas ici ;
- **ses victimes et ses bêtes noires**, à partir de 3 matchs ;
- **ses manches** : cartes en CS2, modes et cartes en CDL, buts et arènes en Rocket
  League. Elles sont relevées dans les pages de compétition, sur 400 jours au plus,
  donc un match sans score de manche sur Liquipedia n'y figure pas. La section dit
  combien de manches elle couvre ;
- **son palmarès** : seule une première place exacte compte comme titre (« 1st -
  3rd » est une phase de groupes, pas un titre) ;
- **ses anciens joueurs**, leur passage au club et leur équipe suivante. Un
  changement de rôle dans le club n'est pas un départ : ses deux lignes n'en font
  qu'une ;
- **ses distinctions et records**, dans le texte de Liquipedia, donc en anglais.

**Pas de statistiques par joueur** : Liquipedia n'en publie pas pour ces jeux (ni
K/D, ni rating). La page `Statistics` de la RLCS 2027 ne compte que les pays
représentés. Les seules données individuelles sont les distinctions et le temps
passé au club. Clutch n'invente rien à la place.

La fiche d'une équipe non suivie reprend la carte d'identité, si elle affronte une
de mes équipes dans les 7 jours. La feuille de match les compare dans **le duel**.

## Pronostics

Sur la page d'un match à venir, on choisit un score parmi ceux que permet le
format (en Bo5 : 3-0, 3-1, 3-2, 2-3, 1-3, 0-3), modifiable jusqu'au coup
d'envoi. Score exact : 3 points, bon vainqueur : 1 point. La page
**Pronostics** (`/pronostics`) tient le bilan : points, scores exacts, taux de
bons vainqueurs, par jeu.

Le site étant public, pronostiquer demande le même code que les réglages
(navigateur déverrouillé). Les pronostics sont enregistrés dans Blob
(`predictions.json`), pour les retrouver sur tous les appareils. Chacun garde
l'équipe, l'adversaire et l'heure du match : le résultat se retrouve même si
Liquipedia corrige l'horaire.

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
