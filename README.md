# Detonate

Jeu de tir tactique en vue du dessus, jouable dans le navigateur (PC et mobile).

## Modes
- **Contre l'IA** : toi et tes alliés IA contre une équipe d'IA.
- **Partie privée** : salon avec un code à 5 caractères, places vides complétées par l'IA.

## Cartes
- **Nuit** : 3 contre 3, bleus contre rouges.
- **Désert — Oasis d'Al-Rimal** : 4 contre 4, Black Ops contre Vipers, avec un drapeau central à capturer (bonus de cadence, de vie et de vitesse pour 3 joueurs pendant la manche).

## Commandes (PC)
| Touche | Action |
|---|---|
| Z Q S D / W A S D | Se déplacer |
| Souris | Viser |
| Clic gauche / F | Tirer |
| R | Recharger |
| Espace / E (maintenir) | Poser / désamorcer la bombe |
| G (maintenir puis relâcher) | Lancer la grenade |
| C (maintenir) | Revoir les commandes |

Sur mobile : stick gauche pour bouger, stick droit pour viser et tirer, boutons R et grenade à droite.

## Fichiers
- `index.html` : le jeu complet (Three.js r128 chargé depuis cdnjs).
- `server.js` : serveur Node.js (fichiers du jeu + salons des parties privées).
- `game_sim.js` : la partie calculée par le serveur (autorité) : déplacements, tirs, dégâts, bombe, grenades, drapeau, IA, scores. Les joueurs n'envoient que leurs commandes.
- `package.json` : dépendance `ws` et commande de démarrage.

## Lancer en local
```
npm install
npm start
```
Puis ouvrir `http://localhost:3000`.

## Mise en ligne (Render)
- Type : Web Service, environnement Node.
- Build Command : `npm install`
- Start Command : `npm start`
Render redéploie automatiquement à chaque modification sur GitHub.
