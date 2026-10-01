// Serveur des parties privées 3v3 (Search & Destroy 3D)
// - sert le jeu (index.html) et gère les salons par code à 5 caractères
// - l'hôte fait tourner la partie ; le serveur relaie les touches et l'état
// - les places libres sont jouées par l'IA chez l'hôte
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');
const SLOTS = [0, 1, 2, 3, 4, 5];          // 0-2 : bleus, 3-5 : rouges
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
const teamOf = slot => (slot < 3 ? 0 : 1);
const publicPlayers = room => room.players.map(p => ({ id: p.id, name: p.name, slot: p.slot, team: teamOf(p.slot), host: p.id === room.hostId }));
const lobby = room => room.players.forEach(p => send(p.ws, { type: 'lobby', code: room.code, players: publicPlayers(room) }));

// première place libre : par défaut on rejoint l'équipe de l'hôte (jouer entre amis contre l'IA),
// le bouton « changer d'équipe » permet ensuite de passer en face
function freeSlot(room, preferTeam) {
  const used = new Set(room.players.map(p => p.slot));
  const host = room.players.find(p => p.id === room.hostId);
  const team = preferTeam !== undefined ? preferTeam : (host ? teamOf(host.slot) : 0);
  const order = team === 0 ? [0, 1, 2, 3, 4, 5] : [3, 4, 5, 0, 1, 2];
  return order.find(s => !used.has(s));
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  const p = room.players.find(x => x.ws === ws);
  if (!p) return;
  room.players = room.players.filter(x => x !== p);
  if (room.players.length === 0) { rooms.delete(room.code); return; }
  if (p.id === room.hostId) {
    if (room.started) {
      // l'état de la partie est chez l'hôte : sans lui, la partie s'arrête
      room.players.forEach(x => { send(x.ws, { type: 'closed' }); x.ws.room = null; });
      rooms.delete(room.code);
      return;
    }
    room.hostId = room.players[0].id;   // dans le salon d'attente, on passe la main
  }
  room.players.forEach(x => send(x.ws, { type: 'peer_left', slot: p.slot }));
  if (!room.started) lobby(room);
}

// ---------- messages ----------
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.budget = 0;

  ws.on('message', raw => {
    // limite anti-abus : 120 messages par seconde maximum
    ws.budget++;
    if (ws.budget > 120) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const room = ws.room;

    switch (m.type) {
      case 'ping':
        return send(ws, { type: 'pong', t: m.t });

      case 'create': {
        if (room) return;
        const code = newCode(), id = newId();
        const r = { code, hostId: id, started: false, players: [] };
        r.players.push({ id, ws, name: cleanName(m.name), slot: 0 });
        rooms.set(code, r);
        ws.room = r;
        send(ws, { type: 'created', code, id, slot: 0, host: true });
        return lobby(r);
      }

      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return send(ws, { type: 'error', message: 'Aucune partie avec ce code.' });
        if (r.started) return send(ws, { type: 'error', message: 'La partie a déjà commencé.' });
        const slot = freeSlot(r);
        if (slot === undefined) return send(ws, { type: 'error', message: 'La partie est pleine (6 joueurs).' });
        const id = newId();
        r.players.push({ id, ws, name: cleanName(m.name), slot });
        ws.room = r;
        send(ws, { type: 'joined', code: r.code, id, slot, host: false });
        return lobby(r);
      }

      case 'switch': {                      // changer d'équipe dans le salon
        if (!room || room.started) return;
        const p = room.players.find(x => x.ws === ws);
        if (!p) return;
        const slot = freeSlot(room, 1 - teamOf(p.slot));
        if (slot === undefined || teamOf(slot) === teamOf(p.slot)) return;
        p.slot = slot;
        return lobby(room);
      }

      case 'start': {
        if (!room || room.started) return;
        const p = room.players.find(x => x.ws === ws);
        if (!p || p.id !== room.hostId) return;
        room.started = true;
        const players = publicPlayers(room);
        return room.players.forEach(x => send(x.ws, { type: 'start', players }));
      }

      case 'input': {                       // invité -> hôte
        if (!room || !room.started) return;
        const p = room.players.find(x => x.ws === ws);
        const host = room.players.find(x => x.id === room.hostId);
        if (p && host && p !== host) send(host.ws, { type: 'remote_input', slot: p.slot, input: m.input });
        return;
      }

      case 'state': {                       // hôte -> invités
        if (!room || !room.started) return;
        const p = room.players.find(x => x.ws === ws);
        if (!p || p.id !== room.hostId) return;
        const msg = JSON.stringify({ type: 'state', state: m.state });
        room.players.forEach(x => { if (x !== p && x.ws.readyState === 1) x.ws.send(msg); });
        return;
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
