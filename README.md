# La.Koiff : coiffeur à domicile à Kinshasa

Application web et mobile (installable sur l'écran d'accueil) :

- **Page d'accueil** (`/`) : présentation, coiffures, mariages, « Devenir coiffeur » avec formulaire de candidature, questions fréquentes, contact.
- **Application client** (`/app.html`) : catalogue de modèles, coiffeurs vérifiés près de l'adresse, commande, suivi du trajet en direct sur la carte de Kinshasa, contact WhatsApp.
- **Espace coiffeur** (`/pro.html`) : connexion par numéro + code, demandes en direct (Accepter / Refuser), trajet avec partage de la position GPS, services et prix.
- **WhatsApp** : le coiffeur reçoit chaque demande sur WhatsApp et peut répondre **OUI** ou **NON**. Le client reçoit la confirmation puis chaque étape (accepté, en route, arrivé, terminé) avec le lien de suivi.

Rien à compiler : Node.js et deux petits modules (`express`, `dotenv`). La base de données est un fichier SQLite intégré à Node.js.

---

## 1. Lancer sur votre ordinateur

Il faut **Node.js 22.13 ou plus récent** ([nodejs.org](https://nodejs.org)).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm start
```

Ouvrez http://localhost:3000 (page d'accueil), http://localhost:3000/app.html (application client) et http://localhost:3000/pro.html (coiffeur).

**Comptes coiffeurs d'exemple** (créés au premier démarrage) :

| Coiffeur | Numéro | Code |
|---|---|---|
| Patrick M. (Kalamu) | 0810000001 | 1234 |
| Grâce K. (Lemba) | 0810000002 | 1234 |
| Studio Nova (Gombe) | 0810000003 | 1234 |
| Divine L. (Bandalungwa) | 0810000004 | 1234 |
| Junior B. (Limete, hors ligne) | 0810000005 | 1234 |

Leurs demandes arrivent sur le WhatsApp indiqué dans `DEMO_WHATSAPP`. Pour lancer sans ces exemples, mettez `SEED_DEMO=0` avant le premier démarrage.

Sans clé WhatsApp, les messages ne partent pas : ils s'affichent dans la console du serveur.

## 2. Gérer les coiffeurs

Ajouter un coiffeur vérifié :

```bash
npm run add-pro -- --nom "Grâce K." --tel 0812345678 --commune Lemba --code 4821 --services "tresse,vanill,nattes"
```

Changer un code :

```bash
npm run set-pin -- 0810000001 5739
```

La commande `npm run add-pro` sans paramètre affiche la liste des communes et des services.

Anciennes candidatures envoyées par l'ancien formulaire de la page d'accueil (remplacé par la création de compte) :

```bash
npm run candidatures
```

Chaque candidature est aussi envoyée sur le WhatsApp de `CONTACT_WHATSAPP`.

## Comptes

**Page Connexion** (`/connexion.html`) : une seule page pour se connecter ou créer un compte, avec le choix « Je suis client » ou « Je suis coiffeur ». Liens directs : `connexion.html#client-inscription`, `connexion.html#coiffeur-inscription`, `connexion.html#coiffeur`. Le bouton « Se connecter » de la page d'accueil et de l'application y mène.

**Comptes clients** (obligatoires pour commander) : un visiteur peut parcourir le catalogue et voir les coiffeurs sans compte. Mais quand il choisit un coiffeur, il est envoyé sur la page Connexion (`connexion.html#commande`) avec le message « Pour commander, créez votre compte ». Une fois inscrit ou connecté, il revient directement au récapitulatif de sa commande. Le compte garde l'adresse, remplit la commande tout seul et affiche l'historique des commandes avec leur suivi. Le serveur refuse aussi toute commande sans compte.

**Comptes coiffeurs** : sur `/pro.html`, onglet **Créer un compte** (nom ou salon, numéro WhatsApp, mot de passe, commune, type, services). La page d'accueil y renvoie avec le bouton « Créer mon compte coiffeur ». Un nouveau compte est **en attente de vérification** : le coiffeur n'apparaît pas aux clients tant que vous ne l'avez pas validé et qu'il n'a pas d'abonnement. Vous êtes prévenu sur WhatsApp à chaque nouveau compte.

**Photo de profil obligatoire** : le coiffeur l'ajoute dans son espace (carte « Ma photo de profil », depuis sa galerie ou l'appareil photo). La photo est recadrée et réduite sur le téléphone avant l'envoi (512 px, quelques dizaines de Ko). **Sans photo, il n'apparaît pas aux clients**, même vérifié et avec une formule active. Les photos sont rangées dans le dossier `photos-coiffeurs`, à côté de la base de données : pensez à les inclure dans vos sauvegardes. Les coiffeurs d'exemple ont une image provisoire avec leurs initiales.

**Photos de réalisations obligatoires** : dans son espace (carte « Mes réalisations »), le coiffeur ajoute des photos des coiffures qu'il a faites, plusieurs à la fois, avec la coiffure concernée. Il faut **au moins 3 réalisations** pour apparaître aux clients, et 20 au maximum (réglable dans `public/data.js`, bloc `WORKS`). Les clients voient un aperçu sur chaque fiche de coiffeur et toute la galerie sur sa page profil (« Voir ses réalisations »), avec agrandissement des photos. Pensez à vérifier ces photos au moment de valider le compte : elles doivent être de vraies réalisations du coiffeur.

Voir les comptes coiffeurs (tous, ou seulement ceux à vérifier) :

```bash
npm run coiffeurs
```

```bash
npm run coiffeurs -- attente
```

Valider un coiffeur après vérification (pièce d'identité, expérience, photos). Il est prévenu sur WhatsApp :

```bash
npm run valider -- 0812345678
```

Puis activez son abonnement après paiement (`npm run abonnement`, voir plus bas).

**Connexion avec Google** : la page Connexion propose « Continuer avec Google » (clients et coiffeurs). La première fois, la personne ajoute seulement son numéro WhatsApp, indispensable pour les commandes : il n'y a pas de mot de passe à choisir. Les fois suivantes, un geste suffit. Pour l'activer :

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com) et créez un projet « La.Koiff ».
2. **API et services → Écran de consentement OAuth** : type **Externe**, nom « La.Koiff », votre e-mail d'assistance, le logo, et votre domaine. Les informations demandées (openid, e-mail, profil) ne nécessitent pas de vérification par Google. Passez l'application **en production**.
3. **API et services → Identifiants → Créer des identifiants → ID client OAuth** : type **Application Web**. Dans **Origines JavaScript autorisées**, ajoutez `https://votre-domaine.com` et `https://www.votre-domaine.com` (et `http://localhost:3000` pour vos essais).
4. Copiez l'**ID client** (il se termine par `.apps.googleusercontent.com`) dans `GOOGLE_CLIENT_ID` du fichier `.env`, puis redémarrez le site.

Sans `GOOGLE_CLIENT_ID`, le bouton Google reste visible mais indique que la connexion Google n'est pas encore activée. Un numéro déjà utilisé par un compte avec mot de passe ne peut pas être repris par un compte Google : la personne se connecte alors avec son mot de passe.

**Connexion avec Facebook** : même fonctionnement que Google (bouton « Continuer avec Facebook », puis seulement le numéro WhatsApp la première fois). Pour l'activer :

1. Sur [developers.facebook.com](https://developers.facebook.com), **Créer une app**, cas d'usage « Authentifier et demander des données aux utilisateurs avec **Facebook Login** ». Vous pouvez la rattacher au même compte Meta Business que WhatsApp.
2. **Paramètres de l'app → Général** : renseignez le domaine (`votre-domaine.com`), l'URL de la **politique de confidentialité** et l'URL des instructions de **suppression des données** (deux pages obligatoires), l'icône et la catégorie.
3. **Facebook Login → Paramètres** : activez « Connexion avec le SDK JavaScript » et ajoutez `https://votre-domaine.com` et `https://www.votre-domaine.com` dans **Domaines autorisés pour le SDK JavaScript**.
4. Copiez l'**ID de l'app** dans `FACEBOOK_APP_ID` et la **clé secrète** dans `FACEBOOK_APP_SECRET` du fichier `.env`, puis passez l'app en mode **Live** (En ligne) et redémarrez le site.

Les autorisations demandées sont le profil public et l'adresse e-mail : elles ne demandent pas d'examen de Meta. Sans ces réglages, le bouton Facebook reste visible mais indique que la connexion Facebook n'est pas encore activée.

**Vérification du numéro et mot de passe oublié** : dès que WhatsApp est branché, un **code à 6 chiffres** est envoyé sur WhatsApp à l'inscription, et « Mot de passe oublié » envoie aussi un code. Sans WhatsApp, les comptes sont créés sans code, et « Mot de passe oublié » invite à vous écrire sur WhatsApp (changez alors le mot de passe d'un coiffeur avec `npm run set-pin`). Pour tester les codes sans WhatsApp, mettez `VERIFY_PHONE=1` : les codes s'affichent dans la console du serveur.

## Prix des coiffures

Pour commencer, **c'est La.Koiff qui fixe les prix**, les mêmes chez tous les coiffeurs. Les prix sont dans `public/data.js`, liste `SERVICES` (champ `price`, en FC). Le coiffeur choisit seulement les services qu'il propose.

Pour laisser plus tard chaque coiffeur fixer ses propres prix, mettez `PRICES_FIXED = false` dans `public/data.js` : l'espace coiffeur affichera alors un champ de prix pour chaque service.

## Formules des coiffeurs : abonnement ou commission

Le coiffeur **choisit la formule qui lui convient** : à l'inscription (champ « Votre formule »), puis à tout moment dans son espace (« Voir les autres formules »).

| Formule | Prix | Clients |
|---|---|---|
| **La.Koiff Simple** | 10 000 FC | 4 clients garantis, sans date limite, sans commission |
| **La.Koiff Pro** | 15 $ par mois | clients illimités pendant le mois, sans commission |
| **La.Koiff Commission** | 15 % de chaque prestation réalisée (hors déplacement) | clients illimités, rien à payer d'avance |

**Formule commission**
- Le coiffeur la choisit lui-même, sans paiement d'avance : elle est active tout de suite (une fois son compte vérifié). Il ne peut pas la choisir pendant qu'un abonnement payé est en cours.
- Sur chaque demande, il voit ce qu'il gagne après commission. Une fois la prestation terminée, 15 % du prix (hors déplacement) s'ajoutent à son **montant dû**, visible dans son espace.
- Il paie par mobile money et vous envoie la référence par WhatsApp. Au-delà de **50 000 FC** non payés, son profil est **suspendu** jusqu'au paiement. Il est prévenu sur WhatsApp à 80 % de la limite, puis à la suspension.
- Le taux et la limite se règlent dans `public/data.js`, bloc `PLANS.commission`.

Enregistrer un paiement de commissions reçu :

```bash
npm run commission -- 0810000001 payer 20000 MP12345
```

Voir le montant dû et l'historique d'un coiffeur :

```bash
npm run commission -- 0810000001 voir
```

Lister tous les coiffeurs à la commission et ce qu'ils doivent :

```bash
npm run commission -- liste
```

Pour passer un coiffeur à la commission vous-même : `npm run commission -- 0810000001 activer`. Pour le passer à un abonnement après paiement : `npm run abonnement` (voir ci-dessous). L'abonnement remplace alors la commission ; un éventuel montant dû reste à payer.

### Abonnements (Simple et Pro)

Avec un abonnement, il n'y a **pas de commission** : le coiffeur garde 100 % du prix de ses prestations et des frais de déplacement.

| Abonnement | Prix | Clients |
|---|---|---|
| **La.Koiff Simple** | 10 000 FC | 4 clients garantis, sans date limite |
| **La.Koiff Pro** | 15 $ par mois | clients illimités pendant le mois |

- Les prix, le nombre de clients et le numéro de paiement se règlent dans `public/data.js`, blocs `PLANS` et `PAYMENT`.
- **Simple = 4 clients garantis.** Une place n'est utilisée que pour une prestation réalisée : si le client annule, ou si le coiffeur le déclare **absent** à son arrivée (bouton « Le client est absent »), la place est rendue. Les places Simple **n'ont pas de date limite** : le coiffeur reste visible jusqu'à ses 4 clients.
- Pour que les coiffeurs Simple reçoivent bien leurs clients, ils passent devant les autres dans la liste quand leur heure d'arrivée est proche (même tranche de 10 minutes).
- **Après ses 4 prestations Simple, le profil du coiffeur n'est plus disponible** : il n'apparaît plus aux clients, ne peut plus recevoir ni accepter de demande, et son espace affiche « Profil indisponible ». Il redevient disponible dès que vous activez son renouvellement (Simple ou Pro) ; son espace se met à jour tout seul dans la minute. Pour Pro, même chose à la fin du mois.
- **Rappels WhatsApp** : quand il reste 1 client (Simple), puis quand les 4 clients sont reçus ; pour Pro, 3 jours avant la fin du mois, puis à la fin.
- Dans son espace, le coiffeur voit sa formule, sa date de fin et ses clients restants. Il peut vous envoyer la référence de son paiement mobile money par WhatsApp, pour Simple ou pour Pro.

Après avoir vérifié le paiement, activez l'abonnement :

```bash
npm run abonnement -- 0810000001 simple
```

```bash
npm run abonnement -- 0810000001 pro
```

Pour plusieurs mois d'un coup, avec la référence du paiement (ici 3 mois de Pro) :

```bash
npm run abonnement -- 0810000001 pro 3 MP12345
```

Pour voir la formule en cours et l'historique d'un coiffeur :

```bash
npm run abonnement -- 0810000001 voir
```

Si le coiffeur renouvelle la même formule avant la fin du mois, le nouveau mois s'ajoute à la suite. Pour Simple, les clients non utilisés sont conservés. S'il change de formule, la nouvelle commence le jour de l'activation.

Les nouveaux coiffeurs ajoutés avec `npm run add-pro` n'ont pas d'abonnement : activez-le après leur paiement. Les coiffeurs d'exemple commencent avec un mois de Simple, et Studio Nova avec un mois de Pro.

## Espace administrateur

**https://lakoifff.com/admin.html**, protégé par le mot de passe `ADMIN_PASSWORD` (réglage du site, 10 caractères minimum ; sans ce réglage, l'espace est désactivé). Vous y validez les coiffeurs (photo et réalisations sous les yeux), activez Simple / Pro / Commission, enregistrez les paiements de commissions, donnez un nouveau mot de passe à un coiffeur et voyez les chiffres du jour. Les commandes `npm run …` font la même chose en ligne de commande, quand l'hébergement le permet (VPS).

## 3. Mettre en ligne

**Chez Hostinger avec votre nom de domaine : suivez le guide pas à pas [HOSTINGER.md](HOSTINGER.md).** Un script installe tout sur le VPS en une commande.


L'appli doit être en **HTTPS** : c'est obligatoire pour l'installer sur le téléphone, pour la position GPS et pour WhatsApp. Les hébergeurs ci-dessous le fournissent automatiquement.

### Exemple avec Render (render.com)

1. Mettez ce dossier sur GitHub (dépôt privé).
2. Sur Render : **New → Web Service**, choisissez le dépôt.
   - Build command : `npm install`
   - Start command : `npm start`
3. **Disks** : ajoutez un disque (1 Go suffit) monté sur `/var/data`. Sans disque, la base est effacée à chaque redémarrage. Le disque demande une offre payante (environ 7 $ par mois).
4. **Environment** : ajoutez les variables de `.env.example`, avec `DB_FILE=/var/data/lakoiff.db` et `BASE_URL=https://votre-adresse.onrender.com`.
5. Plus tard, branchez votre nom de domaine (par exemple `lakoiff.com`) dans **Settings → Custom Domains**, puis mettez `BASE_URL` à jour.

Railway, Fly.io ou un petit serveur (VPS) conviennent aussi : il faut Node.js 22.13+, un disque qui garde le fichier de la base, et HTTPS.

## 4. Brancher WhatsApp (API WhatsApp Cloud de Meta)

1. Créez un compte sur [business.facebook.com](https://business.facebook.com) (Meta Business), si possible vérifié.
2. Sur [developers.facebook.com](https://developers.facebook.com) : **Créer une app → Entreprise**, puis ajoutez le produit **WhatsApp**.
3. Dans **WhatsApp → Configuration de l'API** :
   - ajoutez le numéro de La.Koiff. Un numéro branché sur l'API ne s'utilise en général plus dans l'appli WhatsApp normale : prenez de préférence un numéro dédié ;
   - copiez l'**identifiant du numéro** dans `WHATSAPP_PHONE_ID` ;
   - créez une **clé d'accès permanente** (utilisateur système dans Paramètres de l'entreprise) et copiez-la dans `WHATSAPP_TOKEN`.
4. Dans **Paramètres de l'app → Général**, copiez la **clé secrète** dans `WHATSAPP_APP_SECRET`.
5. Dans **WhatsApp → Configuration → Webhook** :
   - URL de rappel : `https://votre-adresse/webhook` ;
   - jeton de vérification : la valeur de `WHATSAPP_VERIFY_TOKEN` ;
   - abonnez-vous au champ **messages**.
6. Créez ces **6 modèles de messages** (WhatsApp Manager → Modèles, catégorie **Utilitaire**, langue **Français**), avec exactement ces noms :

**`lk_nouvelle_demande`** (envoyé au coiffeur)
```
Nouvelle demande La.Koiff : {{1}}
Adresse : {{2}}
Quand : {{3}}
Vous gagnez : {{4}}
Répondez OUI pour accepter ou NON pour refuser. Votre espace : {{5}}
```

**`lk_confirmation`** (envoyé au client)
```
Bonjour {{1}}, votre demande La.Koiff ({{2}}) est envoyée à {{3}}. Total : {{4}}, déplacement compris. Suivez votre coiffeur ici : {{5}}
```

**`lk_statut`** (envoyé au client à chaque étape)
```
La.Koiff : {{1}}. Suivi : {{2}}
```

**`lk_candidature`** (envoyé à La.Koiff quand un coiffeur postule)
```
Nouvelle candidature coiffeur : {{1}}, {{2}}, commune {{3}}. Spécialités : {{4}}. Expérience : {{5}}.
```

**`lk_code`** (code de vérification) : créez-le dans la catégorie **Authentification**, avec le bouton **« Copier le code »**. Meta fournit le texte, par exemple : « *{{1}}* est votre code de vérification. »

**`lk_abonnement`** (envoyé au coiffeur quand son abonnement se termine)
```
La.Koiff : {{1}}. Votre espace : {{2}}
```

Meta valide les modèles en quelques minutes à quelques heures. Redémarrez ensuite le serveur : la console affiche « WhatsApp : activé ».

**Appels WhatsApp :** l'appli envoie des messages. Le client et le coiffeur s'appellent depuis la discussion WhatsApp (bouton dans l'appli). Les appels lancés par l'API WhatsApp ont des conditions particulières, à vérifier dans votre compte Meta pour la RDC.

## 5. Installer l'appli sur le téléphone

- **Android (Chrome)** : bouton **Installer l'appli** en haut de l'application client (`/app.html`).
- **iPhone (Safari)** : bouton **Installer l'appli**, qui explique : Partager → Sur l'écran d'accueil → Ajouter.

Le coiffeur installe son espace depuis `/pro.html` : il obtient une icône à part, « La.Koiff Coiffeur ».
Une fois installée, l'appli s'ouvre en plein écran et se charge vite même avec une connexion faible. Les pages et les images sont gardées sur le téléphone. Les commandes passent toujours par Internet.

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `server.js` | API, temps réel (suivi en direct), règles des commandes, webhook WhatsApp |
| `db.js` | Base de données SQLite (coiffeurs, sessions, commandes) |
| `whatsapp.js` | Envoi et réception des messages WhatsApp |
| `public/data.js` | Catalogue, prix, communes, trajets sur la carte (partagé client et serveur) |
| `public/index.html`, `landing.css`, `landing.js` | Page d'accueil |
| `public/app.html`, `app.js` | Application client |
| `public/pro.html`, `pro.js` | Espace coiffeur |
| `public/sw.js`, `*.webmanifest`, `icons/` | Appli installable et hors connexion |
| `scripts/` | Ajout de coiffeurs, changement de code |

## À faire ensuite

- Espace administrateur : valider les coiffeurs, voir les commandes, activer les abonnements depuis un écran plutôt qu'en ligne de commande.
- Paiement de l'abonnement directement dans l'appli (mobile money).
- Avis et notes, bouton d'alerte, paiement mobile (M-Pesa, Orange Money, Airtel Money).
- Trajets exacts sur la carte pour les nouveaux coiffeurs (aujourd'hui, leur distance est estimée).
- Photos des coiffures : utilisez des photos dont vous avez les droits (idéalement celles de vos coiffeurs).
- Carte : © contributeurs OpenStreetMap (mention obligatoire, déjà affichée).
