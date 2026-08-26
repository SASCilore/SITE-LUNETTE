# MONTURE — prototype

Site e-commerce de lunettes de marque (site public + interface admin), construit avec React + Vite + Tailwind CSS. Rendu 3D via Three.js, import CSV/Excel via PapaParse et SheetJS.

## Développement local

```bash
npm install
npm run dev
```

Le site est alors accessible sur `http://localhost:5173`.

## Build de production

```bash
npm run build
npm run preview   # pour tester le build localement
```

## Déployer sur GitHub + Vercel

### 1. Pousser le code sur GitHub

Depuis ce dossier :

```bash
git init
git add .
git commit -m "Initial commit — prototype MONTURE"
git branch -M main
git remote add origin https://github.com/<votre-utilisateur>/<nom-du-repo>.git
git push -u origin main
```

(Créez d'abord un dépôt vide sur [github.com/new](https://github.com/new) — ne cochez pas "Add a README", sinon `git push` sera refusé pour cause d'historique divergent.)

### 2. Connecter Vercel

1. Allez sur [vercel.com/new](https://vercel.com/new)
2. Importez le dépôt GitHub que vous venez de créer
3. Vercel détecte automatiquement **Vite** — aucune configuration nécessaire (build command : `npm run build`, output : `dist`)
4. Cliquez sur **Deploy**

Le site sera en ligne en moins d'une minute, avec une URL du type `monture-site.vercel.app`. Chaque `git push` sur `main` redéploiera automatiquement.

## À savoir

- **Données en mémoire uniquement** : produits, marques, fournisseurs et commandes sont réinitialisés à chaque rechargement de page (pas de base de données réelle à ce stade).
- **Pas de paiement réel** : le tunnel de commande est simulé.
- **Authentification admin simulée** : n'importe quel identifiant fonctionne dans l'espace pro.
- Le bundle JS avoisine 1,1 Mo (essentiellement Three.js + xlsx + les icônes) — largement acceptable pour un prototype, mais à découper en chargement différé (`import()` dynamique) avant une mise en production réelle à fort trafic.
