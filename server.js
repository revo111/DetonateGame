// Serveur des parties privées (Detonate) : le serveur fait tourner la partie (autorité) ;
// les joueurs envoient leurs commandes et reçoivent l'état de la partie
// - sert le jeu (index.html) et gère les salons par code à 5 caractères
// - l'hôte fait tourner la partie ; le serveur relaie les touches et l'état
// - les places libres sont jouées par l'IA chez l'hôte
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createGame } = require('./game_sim');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');
// taille d'equipe selon la carte : 3 (nuit, 3v3) ou 4 (desert, 4v4)
const MAP_SIZE = { nuit: 3, desert: 4 };
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();                   // code -> salon

// ---------- serveur web : uniquement le jeu et un test de santé ----------
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url === '/' || url === '/index.html') {
    fs.readFile(INDEX, (err, data) => {
      if (err) { res.writeHead(500); return res.end('index.html introuvable'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('Introuvable');
});

const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });

// ---------- outils ----------
const newCode = () => {
  let c;
  do { c = Array.from({ length: 5 }, () => ALPHA[Math.random() * ALPHA.length | 0]).join(''); } while (rooms.has(c));
  return c;
};
const newId = () => Math.random().toString(36).slice(2, 10);
const cleanName = n => String(n || 'Joueur').replace(/[<>&"']/g, '').trim().slice(0, 14) || 'Joueur';
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const teamOf = (room, slot) => (slot < room.size ? 0 : 1);
const publicPlayers = room => room.players.map(p => ({ id: p.id, name: p.name, slot: p.slot, team: teamOf(room, p.slot), host: p.id === room.hostId }));
const lobby = room => room.players.forEach(p => send(p.ws, { type: 'lobby', code: room.code, map: room.map, size: room.size, players: publicPlayers(room) }));

// première place libre : par défaut on rejoint l'équipe de l'hôte (jouer entre amis contre l'IA),
// le bouton « changer d'équipe » permet ensuite de passer en face
function freeSlot(room, preferTeam) {
  const used = new Set(room.players.map(p => p.slot));
  const host = room.players.find(p => p.id === room.hostId);
  const team = preferTeam !== undefined ? preferTeam : (host ? teamOf(room, host.slot) : 0);
  const n = room.size, all = [...Array(2 * n).keys()];
  const order = team === 0 ? all : all.slice(n).concat(all.slice(0, n));
  return order.find(s => !used.has(s));
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  const p = room.players.find(x => x.ws === ws);
  if (!p) return;
  room.players = room.players.filter(x => x !== p);
  if (room.players.length === 0) { stopGame(room); rooms.delete(room.code); return; }
  if (p.id === room.hostId) room.hostId = room.players[0].id;   // le salon change simplement de responsable
  if (room.game) room.game.leave(p.slot);                        // la partie continue : l'IA prend sa place
  room.players.forEach(x => send(x.ws, { type: 'peer_left', slot: p.slot }));
  if (!room.started) lobby(room);
}

// ---------- partie calculée par le serveur ----------
// 60 calculs par seconde ; l'état est envoyé à tous les joueurs environ 30 fois par seconde.
function startGame(room) {
  const sendAll = msg => { const t = JSON.stringify(msg); room.players.forEach(x => { if (x.ws.readyState === 1) x.ws.send(t); }); };
  try { room.game = createGame(room.map, publicPlayers(room), sendAll); }
  catch (e) { console.error('Impossible de lancer la partie :', e); room.players.forEach(x => send(x.ws, { type: 'closed' })); return; }
  let last = Date.now(), lastSend = 0, endAt = 0;
  room.timer = setInterval(() => {
    const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { room.game.step(dt); } catch (e) { console.error('Erreur de simulation :', e); }
    if (now - lastSend >= 32) {   /* etat envoye ~30 fois par seconde */ lastSend = now; try { sendAll({ type: 'state', state: room.game.snapshot() }); } catch (e) {} }
    if (room.game.state() === 'end') { endAt = endAt || now; if (now - endAt > 600000) { stopGame(room); rooms.delete(room.code); } /* salon gardé 10 min après la fin (pour recommencer) */ }
  }, 16);
}
function stopGame(room) { if (room.timer) clearInterval(room.timer); room.timer = null; room.game = null; }

// ---------- messages ----------
wss.on('connection', ws => {
  try { ws._socket.setNoDelay(true); } catch (e) {}          // envoi immediat des petits messages (pas de regroupement TCP)
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.budget = 0;

  ws.on('message', raw => {
    // limite anti-abus : 150 messages par seconde maximum (commandes ~60/s)
    ws.budget++;
    if (ws.budget > 150) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const room = ws.room;

    switch (m.type) {
      case 'ping':
        return send(ws, { type: 'pong', t: m.t });

      case 'create': {
        if (room) return;
        const code = newCode(), id = newId();
        const map = MAP_SIZE[m.map] ? m.map : 'nuit';
        const r = { code, hostId: id, started: false, players: [], map, size: MAP_SIZE[map] };
        r.players.push({ id, ws, name: cleanName(m.name), slot: 0 });
        rooms.set(code, r);
        ws.room = r;
        send(ws, { type: 'created', code, id, slot: 0, host: true, map: r.map, size: r.size });
        return lobby(r);
      }

      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return send(ws, { type: 'error', message: 'Aucune partie avec ce code.' });
        if (r.started) return send(ws, { type: 'error', message: 'La partie a déjà commencé.' });
        const slot = freeSlot(r);
        if (slot === undefined) return send(ws, { type: 'error', message: 'La partie est pleine (' + (2 * r.size) + ' joueurs).' });
        const id = newId();
        r.players.push({ id, ws, name: cleanName(m.name), slot });
        ws.room = r;
        send(ws, { type: 'joined', code: r.code, id, slot, host: false, map: r.map, size: r.size });
        return lobby(r);
      }

      case 'switch': {                      // changer d'équipe dans le salon
        if (!room || room.started) return;
        const p = room.players.find(x => x.ws === ws);
        if (!p) return;
        const slot = freeSlot(room, 1 - teamOf(room, p.slot));
        if (slot === undefined || teamOf(room, slot) === teamOf(room, p.slot)) return;
        p.slot = slot;
        return lobby(room);
      }

      case 'start': {
        if (!room || room.started) return;
        const p = room.players.find(x => x.ws === ws);
        if (!p || p.id !== room.hostId) return;
        room.started = true;
        const players = publicPlayers(room);
        room.players.forEach(x => send(x.ws, { type: 'start', players, map: room.map, size: room.size, server: true }));
        return startGame(room);
      }

      case 'input': {                       // joueur -> partie du serveur
        if (!room || !room.started || !room.game) return;
        const p = room.players.find(x => x.ws === ws);
        if (p && m.input && typeof m.input === 'object') room.game.input(p.slot, m.input);
        return;
      }

      case 'state': {                       // (ancien mode) ignoré : c'est le serveur qui calcule la partie
        if (!room || !room.started || room.game) return;
        const p = room.players.find(x => x.ws === ws);
        if (!p || p.id !== room.hostId) return;
        const msg = JSON.stringify({ type: 'state', state: m.state });
        room.players.forEach(x => { if (x !== p && x.ws.readyState === 1) x.ws.send(msg); });
        return;
      }

      case 'rematch': {                     // fin de partie : « Recommencer » (même salon, mêmes joueurs, pas de nouveau code)
        if (!room || !room.started || !room.game || room.game.state() !== 'end') return;
        const p = room.players.find(x => x.ws === ws);
        if (!p) return;
        p.ready = true;
        if (p.id === room.hostId) {                       // le chef du salon relance pour tout le monde
          stopGame(room);
          room.players.forEach(x => { x.ready = false; });
          const players = publicPlayers(room);
          room.players.forEach(x => send(x.ws, { type: 'start', players, map: room.map, size: room.size, server: true }));
          return startGame(room);
        }
        const ids = room.players.filter(x => x.ready).map(x => x.id);
        return room.players.forEach(x => send(x.ws, { type: 'ready', ids }));
      }

      case 'leave':
        return leave(ws);
    }
  });

  ws.on('close', () => leave(ws));
});

// remise à zéro du budget de messages + détection des connexions mortes
setInterval(() => { wss.clients.forEach(ws => { ws.budget = 0; }); }, 1000);
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.alive) return ws.terminate();
    ws.alive = false;
    try { ws.ping(); } catch {}
  });
}, 25000);

server.listen(PORT, () => console.log('Serveur prêt sur le port ' + PORT));
