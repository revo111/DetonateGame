[README-MULTIJOUEUR.md](https://github.com/user-attachments/files/32882979/README-MULTIJOUEUR.md)
# Search & Destroy — 2v2 privé

## Ce qui est inclus

- Menu principal avec **Contre l'IA** et **Partie privée**.
- Création d'une salle privée avec code de 5 caractères.
- Rejoindre une salle avec le code.
- Lobby 4 joueurs : 2 joueurs par équipe.
- Bouton de lancement réservé à l'hôte.
- Synchronisation réseau par WebSocket.
- L'hôte fait tourner la simulation de la partie ; les autres clients envoient leurs commandes et reçoivent l'état de la manche.
- Le mode Contre l'IA reste disponible.

## Tester en local

1. Installer Node.js.
2. Dans ce dossier :

```bash
npm install
npm start
```

3. Sur le PC hôte, ouvrir :

`http://localhost:3000`

4. Pour tester plusieurs joueurs sur le même Wi-Fi, trouver l'adresse IP locale du PC hôte, par exemple `192.168.1.20`, puis ouvrir sur les autres appareils :

`http://192.168.1.20:3000`

5. Créer une partie et partager le code aux trois autres joueurs.

## Mise en ligne

Le serveur Node.js doit être hébergé sur un service qui autorise un serveur WebSocket. Le fichier `server.js` écoute la variable d'environnement `PORT`.

Le client peut être servi par ce même serveur, ou par GitHub Pages. Si le client est sur GitHub Pages et le serveur ailleurs, ouvrir le jeu avec un paramètre `server`, par exemple :

`https://votre-site.example/?server=wss://votre-serveur.example`

Le serveur doit être en HTTPS/WSS quand le site du jeu est en HTTPS.

## Limite actuelle

La première version utilise l'hôte comme autorité de simulation. Si l'hôte quitte pendant une partie, la partie doit être relancée. Une migration d'hôte peut être ajoutée plus tard.
