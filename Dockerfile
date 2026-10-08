# Image du serveur Detonate pour Fly.io
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# dépendances (seulement « ws »)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
# le jeu et le serveur (le serveur lit index.html pour faire tourner les parties)
COPY index.html server.js game_sim.js ./
EXPOSE 8080
CMD ["node", "server.js"]
