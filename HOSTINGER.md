# Mettre La.Koiff en ligne chez Hostinger

## Formule Cloud (votre cas) : sans VPS, tout depuis hPanel

Hostinger Cloud fait tourner les applications Node.js. Tout se fait dans hPanel, même depuis un téléphone.

**Avant de commencer**
- Fichier à envoyer : **lakoiff-hostinger.zip** (le code du site, prêt pour Hostinger).
- Fichier de réglages : **hostinger.env** (à modifier avec votre domaine et votre mot de passe administrateur).
- Si votre domaine a **déjà un site** sur votre formule, Hostinger demande de le supprimer avant d'y mettre une application Node.js : sauvegardez-le d'abord.

**Étapes**
1. hPanel → **Sites web** → **Ajouter un site web** → **Application web Node.js**.
2. Choisissez **« Importer vos fichiers »** (Upload your files) et envoyez **lakoiff-hostinger.zip**.
3. Réglages de déploiement :

| Champ | Valeur |
|---|---|
| Framework preset | **Express** |
| Node.js version | **24** (ou 22) |
| Build command | *(laisser vide)* |
| Package manager | **npm** |
| Entry file | **server.js** |

4. **Variables d'environnement** → **Import .env** : importez **hostinger.env** (le domaine lakoifff.com y est déjà), après avoir choisi `ADMIN_PASSWORD` (10 caractères minimum, gardez-le pour vous).
5. Choisissez votre **nom de domaine**, puis **Déployer**.
6. Vérifiez dans **Runtime Logs** la ligne « La.Koiff en ligne sur https://lakoifff.com ».
7. Si le cadenas HTTPS n'apparaît pas, activez le certificat **SSL** du domaine dans hPanel (rubrique Sécurité / SSL).

**Ce que le site gère tout seul chez Hostinger**
- La base de données et les photos sont rangées dans votre dossier personnel (`~/lakoiff-data`), **hors du dossier de l'application** que Hostinger remplace à chaque déploiement : rien n'est perdu quand vous mettez le site à jour.
- `www.lakoifff.com` renvoie vers `lakoifff.com`.
- Le suivi en direct se reconnecte tout seul (Hostinger coupe les connexions au bout de 120 secondes).

**Gérer La.Koiff : l'espace administrateur**
Sur la formule Cloud, on ne peut pas lancer de commandes (`npm run …`). Tout se fait sur **https://lakoifff.com/admin.html**, avec le mot de passe `ADMIN_PASSWORD` :
- valider les nouveaux coiffeurs (avec leur photo et leurs réalisations sous les yeux) ;
- activer **Simple** ou **Pro** après paiement (avec la référence), passer un coiffeur à la **commission** ;
- enregistrer un **paiement de commissions** ;
- donner un **nouveau mot de passe** à un coiffeur ;
- voir les chiffres du jour (coiffeurs, clients, commandes, commissions dues).

**Mettre à jour le site plus tard** : site → **Settings & Redeploy**, envoyez le nouveau zip. Les données sont conservées.

**Avant d'ouvrir au public**
- Dans l'espace administrateur, donnez un nouveau mot de passe aux 5 coiffeurs d'exemple, ou retirez leur vérification.
- Branchez WhatsApp, Google et Facebook (README.md) en ajoutant leurs clés dans les variables d'environnement.
- Pensez à sauvegarder régulièrement le dossier `lakoiff-data` (Gestionnaire de fichiers → compresser → télécharger).

---

## Autre possibilité : un VPS Hostinger


La.Koiff a besoin d'un serveur qui tourne en permanence (Node.js). Chez Hostinger, la formule sûre est un **VPS**. Les hébergements web classiques (Premium, Single) ne peuvent pas faire tourner l'application.

Dans ce guide, remplacez `lakoifff.com` par votre nom de domaine et `IP-DU-VPS` par l'adresse IP de votre VPS.

---

## Étape 1 : prendre un VPS

1. Dans **hPanel**, ouvrez **VPS** et choisissez une formule **KVM 1** (suffisant pour démarrer) ou **KVM 2**.
2. Système d'exploitation : **Ubuntu 24.04** (le système seul, sans panneau de contrôle).
3. Choisissez un **mot de passe root** solide et notez-le.
4. Notez l'**adresse IP** du VPS, affichée sur sa page (par exemple `82.25.xx.xx`).

## Étape 2 : faire pointer le domaine (acheté chez Amen) vers le VPS

Le domaine reste chez **Amen** : vous ne changez que deux réglages DNS. Pas besoin de transférer le domaine chez Hostinger.

1. Connectez-vous à votre **espace client Amen** (amen.fr).
2. Ouvrez **Domaines** → votre domaine → la gestion de la **zone DNS** (le libellé peut être « Zone DNS », « Gestion DNS » ou « Enregistrements DNS »).
3. Si une **redirection web** ou une **page de parking** Amen est activée sur le domaine, désactivez-la.
4. Dans la zone DNS :
   - modifiez ou remplacez l'enregistrement **A** du domaine (nom vide ou `@`) pour qu'il pointe vers `IP-DU-VPS` ;
   - faites de même pour `www` : un enregistrement **A** vers `IP-DU-VPS` (supprimez l'ancien **CNAME** `www` s'il existe) ;
   - supprimez les enregistrements **AAAA** de `@` et `www` s'il y en a : ils pointent vers Amen et bloqueraient le HTTPS ;
   - **ne touchez pas aux enregistrements MX et TXT** : ils servent à vos e-mails.

| Type | Nom | Pointe vers | TTL |
|---|---|---|---|
| A | `@` (ou vide) | `IP-DU-VPS` | 300 (ou le plus court proposé) |
| A | `www` | `IP-DU-VPS` | 300 |

5. Enregistrez. La mise à jour prend en général de quelques minutes à quelques heures, parfois jusqu'à 24 h.

Pour vérifier depuis le VPS (étape 4), la commande suivante doit afficher l'IP du VPS :

```bash
getent hosts lakoifff.com
```

*Autre possibilité : chez Amen, remplacer les serveurs de noms par ceux de Hostinger (`ns1.dns-parking.com` et `ns2.dns-parking.com`), puis gérer le DNS dans hPanel. C'est utile si vous voulez tout gérer au même endroit, mais il faudra alors recréer vos enregistrements e-mail dans hPanel.*

## Étape 3 : envoyer l'application sur le VPS

Depuis un **ordinateur**, dans le dossier où se trouve `lakoiff-app.zip` :

```bash
scp lakoiff-app.zip root@IP-DU-VPS:/root/
```

(Sous Windows, la commande `scp` existe dans PowerShell. Vous pouvez aussi utiliser FileZilla en mode SFTP, avec l'utilisateur `root` et le port 22.)

## Étape 4 : tout installer en une commande

Ouvrez le terminal du VPS : hPanel → VPS → **Terminal du navigateur**, ou depuis l'ordinateur avec `ssh root@IP-DU-VPS`. Puis :

```bash
apt-get update && apt-get install -y unzip
```

```bash
cd /root && unzip -o lakoiff-app.zip && cd lakoiff-app
```

```bash
bash deploy/setup-vps.sh lakoifff.com votre@email.com
```

Le script installe Node.js, l'application, le démarrage automatique, le serveur web, le pare-feu et le **certificat HTTPS** gratuit (Let's Encrypt). À la fin, il affiche « La.Koiff est en ligne : https://lakoifff.com ».

Si le HTTPS échoue, c'est que le domaine ne pointe pas encore vers le VPS (étape 2). Attendez un peu, puis relancez la commande `certbot` affichée par le script.

## Étape 5 : réglages après l'installation

Les réglages sont dans `/opt/lakoiff/app/.env`. Pour les modifier :

```bash
nano /opt/lakoiff/app/.env
```

Puis redémarrez le site :

```bash
systemctl restart lakoiff
```

À faire tout de suite :

1. **Changez les codes des coiffeurs d'exemple**, ou ne gardez pas ces comptes :

```bash
cd /opt/lakoiff/app && sudo -u lakoiff npm run set-pin -- 0810000001 NOUVEAUCODE
```

2. **WhatsApp** : remplissez `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` et `WHATSAPP_APP_SECRET` (voir README.md). Dans Meta, l'adresse du webhook est `https://lakoifff.com/webhook`, et le jeton de vérification est la valeur de `WHATSAPP_VERIFY_TOKEN` dans `.env` (le script en a créé un).

3. **Connexion avec Google et Facebook** (facultatif) : remplissez `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID` et `FACEBOOK_APP_SECRET` (voir README.md, section Comptes).

4. **Ajouter vos vrais coiffeurs** :

```bash
cd /opt/lakoiff/app && sudo -u lakoiff npm run add-pro -- --nom "Grâce K." --tel 0812345678 --commune Lemba --code 4821
```

## Mettre à jour le site plus tard

Envoyez le nouveau `lakoiff-app.zip` comme à l'étape 3, puis dans le terminal du VPS :

```bash
cd /root && unzip -o lakoiff-app.zip && bash lakoiff-app/deploy/update.sh
```

La base de données (commandes, coiffeurs, candidatures) et les réglages sont conservés.

## Commandes utiles

| Pour… | Commande |
|---|---|
| Voir le journal du site en direct | `journalctl -u lakoiff -f` |
| Redémarrer le site | `systemctl restart lakoiff` |
| Activer l'abonnement d'un coiffeur (après paiement) | `cd /opt/lakoiff/app && sudo -u lakoiff npm run abonnement -- 08XXXXXXXX simple` (ou `pro`) |
| Voir les candidatures de coiffeurs | `cd /opt/lakoiff/app && sudo -u lakoiff npm run candidatures` |
| Sauvegarder la base et les photos | `tar czf /root/sauvegarde-$(date +%F).tgz -C /var/lib/lakoiff .` |

Le certificat HTTPS se renouvelle tout seul.
