# MONTURE — prototype

Site e-commerce de lunettes de marque (site public + interface admin), construit avec React + Vite + Tailwind CSS. Rendu 3D via Three.js, import CSV/Excel via PapaParse et SheetJS, données et authentification via Supabase.

## 1. Configurer Supabase

Vous avez déjà un compte/projet Supabase. Il reste trois choses à faire dedans :

### a) Exécuter le schéma SQL

Dashboard Supabase → **SQL Editor** → **New query** → collez le contenu de [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.

Cela crée les tables (`brands`, `suppliers`, `products`, `orders`), les règles de sécurité (RLS — lecture publique du catalogue, écriture réservée aux comptes connectés, commandes créables par tout visiteur mais lisibles par l'admin seul), le bucket de stockage `product-photos` (public en lecture, upload réservé à l'admin), et pré-remplit les 6 marques et 3 fournisseurs de référence. **Les produits ne sont pas pré-remplis** — importez votre vrai catalogue une fois connecté à l'admin.

### b) Créer votre utilisateur admin

Dashboard Supabase → **Authentication** → **Users** → **Add user** → renseignez un e-mail et un mot de passe. C'est cet identifiant qui vous connectera à `/` → Espace pro. (Pas d'auto-inscription publique : c'est volontaire, on ne veut pas que n'importe qui puisse créer un compte admin.)

### c) Récupérer les clés API

Dashboard Supabase → **Project Settings** → **API** → notez l'**URL** du projet et la clé **anon public**.

## 2. Configurer le projet en local

```bash
cp .env.example .env
```

Puis éditez `.env` :

```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon-publique
```

```bash
npm install
npm run dev
```

Le site est alors accessible sur `http://localhost:5173`.

## 3. Build de production

```bash
npm run build
npm run preview   # pour tester le build localement
```

## 4. Déployer sur GitHub + Vercel

### Pousser le code sur GitHub

```bash
git init
git add .
git commit -m "Initial commit — prototype MONTURE"
git branch -M main
git remote add origin https://github.com/<votre-utilisateur>/<nom-du-repo>.git
git push -u origin main
```

(Créez d'abord un dépôt vide sur [github.com/new](https://github.com/new) — ne cochez pas "Add a README".)

Le fichier `.env` n'est **jamais poussé** sur GitHub (il est dans `.gitignore`) — c'est normal et voulu, vos clés ne doivent pas se retrouver dans un dépôt public.

### Connecter Vercel

1. [vercel.com/new](https://vercel.com/new) → importez le dépôt GitHub
2. Vercel détecte automatiquement **Vite** — aucune configuration de build nécessaire
3. **Avant de déployer**, dans la section "Environment Variables", ajoutez :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   
   (les mêmes valeurs que dans votre `.env` local)
4. **Deploy**

Chaque `git push` sur `main` redéploiera automatiquement.

## Utiliser l'admin pour importer votre catalogue

1. Sur le site déployé (ou en local), allez dans **Espace pro** (lien dans le header ou le footer)
2. Connectez-vous avec l'utilisateur créé à l'étape 1.b
3. Onglet **Produits** → **Importer CSV / Excel**
4. Déposez votre fichier → vérifiez la correspondance des colonnes détectée automatiquement → vérifiez l'aperçu ligne par ligne → confirmez

Colonnes reconnues : Titre, Marque, Prix (obligatoires), Coût, Catégorie, Genre, Coloris, Teinte (hex), Calibre, Matière, Forme, Stock, Fournisseur, Photo (URL), Description. Un exemple `.csv` est téléchargeable directement depuis l'écran d'import.

Pour ajouter une **photo produit**, deux options dans le formulaire produit (ajout manuel ou modification) : coller une URL d'image, ou envoyer un fichier directement (stocké dans le bucket Supabase `product-photos`). Sans photo, le produit affiche l'illustration stylisée par défaut.

## À savoir

- **Vraie persistance** : les données vivent maintenant dans Supabase (Postgres) — plus de réinitialisation au rechargement.
- **Authentification réelle** : seuls les comptes que vous créez dans Supabase Authentication peuvent accéder à l'espace pro.
- **Pas de paiement réel** : le tunnel de commande reste simulé (aucune donnée bancaire demandée).
- Le bundle JS avoisine 1,3 Mo (Three.js + xlsx + Supabase + icônes) — largement acceptable pour un prototype, à découper en chargement différé avant une mise en production à fort trafic.
