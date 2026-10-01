# Search & Destroy 3D — parties privées 3v3

Jeu de tir vu du dessus, jouable sur mobile et PC, contre l'IA ou entre amis sur internet.

## Ce qui est inclus

- Menu **Contre l'IA** et **Partie privée**.
- Salon privé avec un code à 5 caractères, pseudo au choix.
- 3v3 : de 1 à 6 joueurs humains, **les places libres sont jouées par l'IA**.
- Par défaut, les amis rejoignent l'équipe de l'hôte (jouer ensemble contre l'IA). Le bouton **Changer d'équipe** permet de passer en face.
- Si un joueur quitte en cours de partie, l'IA prend sa place.
- L'hôte fait tourner la partie ; les autres envoient leurs commandes et reçoivent l'état (environ 20 fois par seconde), avec un lissage des mouvements.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Le jeu |
| `server.js` | Le serveur des salons (WebSocket) |
| `package.json` | Dépendances du serveur |
| `render.yaml` | Configuration pour l'hébergeur Render |

## Tester en local

1. Installer Node.js (version 18 ou plus).
2. Dans ce dossier :

```
npm install
npm start
```

3. Ouvrir `http://localhost:3000`.
4. Sur le même Wi-Fi, les autres appareils ouvrent `http://ADRESSE-IP-DU-PC:3000`.

## Mise en ligne (Render, gratuit)

1. Créer un compte sur https://render.com avec son compte GitHub.
2. **New → Blueprint**, choisir ce dépôt : Render lit `render.yaml` et crée le service.
3. Attendre la fin du déploiement, puis ouvrir l'adresse fournie, par exemple `https://search-destroy-3v3.onrender.com`.
4. Partager cette adresse à ses amis : le jeu et le serveur sont au même endroit.

Sur l'offre gratuite, le serveur s'endort après 15 minutes sans joueur. La première connexion peut alors prendre 30 à 60 secondes.

## Jouer depuis GitHub Pages (optionnel)

Si le jeu est aussi publié sur GitHub Pages, ouvrir `index.html` et remplir en haut de la partie réseau :

```
const DEFAULT_SERVER='wss://search-destroy-3v3.onrender.com';
```

## Limites

- Si l'hôte quitte en cours de partie, la partie s'arrête pour tout le monde.
- La qualité de la partie dépend de la connexion de l'hôte.
