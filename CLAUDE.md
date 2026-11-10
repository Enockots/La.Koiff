# La.Koiff : fiche de reprise du projet

Lis ce fichier avant de travailler sur le projet. Il résume les décisions prises avec le propriétaire du projet. Réponds toujours en **français**, simplement : le propriétaire n'est pas développeur.

## Le projet
Site web de **coiffure à domicile à Kinshasa (RDC)**. Le client choisit un modèle de coiffure, voit les coiffeurs vérifiés près de chez lui, commande, et suit l'arrivée du coiffeur sur la carte. Domaine : **https://lakoifff.com** (avec trois « f »), hébergé chez **Hostinger Cloud** (application Node.js, voir HOSTINGER.md). Contact La.Koiff (WhatsApp et paiements) : **+243 859 204 238**.

## Design (à garder)
Thème sombre unique bleu nuit et jaune. Fond #0A1222, surfaces #111B2E et #18243B, bordures #25324B, texte #EEF2F8, texte secondaire #8E9AB2, jaune #F5B800 (texte sur jaune #141008). Polices : Bricolage Grotesque (titres), Figtree (texte), JetBrains Mono (prix). Logo « La.Koiff » avec le point jaune. Les styles sont dans `public/style.css`, `public/landing.css`, `public/connexion.css` et `public/admin.css`.

## Pages
| Page | Fichiers |
|---|---|
| Accueil | `public/index.html`, `landing.js` |
| Connexion / inscription (client ou coiffeur, Google, Facebook) | `public/connexion.html`, `connexion.js` |
| Catalogue, commande, suivi, compte client | `public/app.html`, `app.js` |
| Espace coiffeur | `public/pro.html`, `pro.js` |
| Espace administrateur (mot de passe `ADMIN_PASSWORD`) | `public/admin.html`, `admin.js` |
| Données partagées : catalogue, prix, communes, formules, trajets | `public/data.js` |
| Serveur, API, WhatsApp, base SQLite | `server.js`, `db.js`, `whatsapp.js` |

## Règles décidées avec le propriétaire (ne pas changer sans lui demander)
- **Prix fixés par La.Koiff**, identiques chez tous les coiffeurs (`SERVICES` dans `data.js`, `PRICES_FIXED = true`). Affichage en FC et en dollars (1 $ = 2 400 FC).
- **Déplacement** : 2 000 FC + 1 000 FC par km, arrondi à 500 FC. Coiffeurs à plus de 25 km non proposés.
- **Compte client obligatoire pour commander** : au clic sur « Choisir », un visiteur est envoyé sur l'inscription, puis il revient au récapitulatif.
- **Formules coiffeur, au choix** (`PLANS` dans `data.js`) :
  - **Simple** : 10 000 FC pour **4 clients garantis**, sans date limite. Une place n'est utilisée que pour une prestation réalisée ; elle est rendue si le client annule ou s'il est absent. Après 4 prestations : « Profil indisponible » jusqu'au renouvellement.
  - **Pro** : 15 $ par mois, clients illimités.
  - **Commission** : 15 % par prestation, rien à payer d'avance ; profil suspendu au-delà de 50 000 FC non payés.
- **Visibilité d'un coiffeur** : il faut un compte vérifié, une formule active, le mode « Disponible », une photo de profil, et au moins 3 photos de réalisations (20 au maximum).
- **Paiements** des formules : mobile money (M-Pesa, Orange Money, Airtel Money). L'administrateur les valide dans `/admin.html`.
- **WhatsApp** : notifications par l'API WhatsApp Cloud de Meta (modèles décrits dans README.md). Le coiffeur peut répondre OUI ou NON.

## Lancer et tester
```bash
npm install
```
```bash
ADMIN_PASSWORD=MotDePasseLocal2026 npm start
```
Le site s'ouvre sur http://localhost:3000. Coiffeurs d'exemple : numéros 0810000001 à 0810000005, mot de passe 1234. Il faut Node.js 22.13 ou plus récent.

## Hébergement Hostinger Cloud : points à respecter
- Le dossier de l'application est remplacé à chaque déploiement. La base et les photos sont donc dans `~/lakoiff-data` (détection automatique dans `db.js`).
- Les connexions sont coupées après 120 s : le suivi en direct se reconnecte tout seul.
- `www` redirige vers le domaine principal.
- Aucune commande ne peut être lancée sur le serveur : tout se gère depuis `/admin.html`.
- Pour mettre à jour le site, créer le zip sans `node_modules`, `data` ni `.env`, puis l'envoyer dans hPanel avec **Settings & Redeploy**.

## État du projet et suite prévue
Fait : tout ce qui est décrit ci-dessus, testé de bout en bout.

À faire :
- mise en ligne réelle chez Hostinger ;
- branchement de WhatsApp, Google et Facebook (clés à créer par le propriétaire) ;
- pages de politique de confidentialité et de suppression des données (exigées par Facebook) ;
- avis et notes ;
- paiement mobile money intégré.

## Façon de travailler
- Faire chaque changement sur une **branche**, puis ouvrir une **pull request** que le propriétaire valide.
- Tester avant de livrer : lancer le site, vérifier les écrans touchés et le parcours de commande complet.
- Ne jamais écrire de mots de passe ou de clés dans le code : ils vont dans les variables d'environnement.
