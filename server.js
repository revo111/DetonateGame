// Serveur des parties privées (Detonate)
// Le serveur est autoritaire : il fait tourner la simulation de la partie.
// Les joueurs envoient leurs commandes et reçoivent régulièrement l'état de la partie.
//
// - sert le jeu (index.html) et gère les salons par code à 5 caractères
// - le serveur calcule la simulation à 60 Hz
// - les joueurs envoient leurs inputs à 60 Hz
// - le serveur envoie les snapshots à environ 30 Hz
// - les places libres sont contrôlées par l'IA côté serveur

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createGame } = require('./game_sim');
const { performance } = require('perf_hooks');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

// Taille d'équipe selon la carte :
// nuit = 3v3
// desert = 4v4
const MAP_SIZE = {
  nuit: 3,
  desert: 4
};

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------- plusieurs serveurs (une machine Fly.io par region) ----------
// FLY_REGION est fourni par Fly.io (ex. « cdg »). REGIONS (fly.toml) liste les regions deployees.
const HERE = process.env.FLY_REGION || '';
const APP = process.env.FLY_APP_NAME || '';
const ENV_REGIONS = String(process.env.REGIONS || '').split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
// lettre de region en tete de chaque code de salon (doit correspondre a la table du jeu, index.html)
const REGION_LETTER = { cdg: 'F', sjc: 'C', lax: 'L', iad: 'V', sin: 'S', fra: 'G', ams: 'A', lhr: 'B', ord: 'H', dfw: 'D',
  sea: 'W', ewr: 'E', yyz: 'Y', gru: 'R', nrt: 'N', syd: 'Z', bom: 'M', jnb: 'J' };
const isRegion = r => /^[a-z]{3}$/.test(r);
const rooms = new Map(); // code -> salon


// ---------- serveur web : jeu + test de santé ----------

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/regions') {
    // ne reveille aucun autre serveur : simple liste lue dans la configuration
    const list = ENV_REGIONS.length ? ENV_REGIONS.slice() : (HERE ? [HERE] : []);
    if (HERE && !list.includes(HERE)) list.push(HERE);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ here: HERE, regions: list }));
  }

  // Pre-requete du navigateur (jeu ouvert depuis GitHub Pages) : on autorise l'en-tete de routage Fly
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'fly-force-region, fly-prefer-region', 'Access-Control-Max-Age': '600' });
    return res.end();
  }

  // Reveil : le jeu appelle /wake avec l'en-tete « fly-force-region: cdg ». Le proxy Fly.io envoie
  // la requete directement dans cette region et demarre la machine si elle etait arretee.
  // La connexion WebSocket qui suit trouve donc une machine allumee.
  if (url === '/wake') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ region: HERE, machine: process.env.FLY_MACHINE_ID || null }));
  }

  // Diagnostic : https://playdetonate.fly.dev/where?region=cdg
  // Fly.io renvoie la demande vers la machine de cette region ; la reponse dit qui a repondu,
  // ou pourquoi Fly.io n'a pas pu joindre la machine.
  if (url === '/where') {
    let want = '';
    try { want = (new URL(req.url, 'http://x').searchParams.get('region') || '').toLowerCase(); } catch (e) {}
    const failed = req.headers['fly-replay-failed'];
    if (HERE && isRegion(want) && want !== HERE && !req.headers['fly-replay-src'] && !failed) {
      res.writeHead(307, { 'fly-replay': 'region=' + want + ';timeout=20s;fallback=force_self', 'Content-Length': '0' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({
      demande: want || null,
      repondu_par_region: HERE || null,
      machine: process.env.FLY_MACHINE_ID || null,
      ok: !failed && (!want || want === HERE),
      echec_fly: failed || null
    }, null, 1));
  }

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (url === '/' || url === '/index.html') {
    fs.readFile(INDEX, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('index.html introuvable');
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });

      res.end(data);
    });

    return;
  }

  res.writeHead(404);
  res.end('Introuvable');
});


const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 256 * 1024
});

// Chaque connexion demande sa region (?region=cdg). Si cette machine n'est pas dans la bonne region,
// on repond « fly-replay » : le proxy Fly.io rejoue la demande vers la machine de cette region
// (et la demarre si elle etait arretee). La negociation WebSocket se fait uniquement sur la bonne machine.
server.on('upgrade', (req, socket, head) => {
  let want = '';
  try { want = (new URL(req.url, 'http://x').searchParams.get('region') || '').toLowerCase(); } catch (e) {}
  const replayed = !!req.headers['fly-replay-src'];
  const failed = req.headers['fly-replay-failed'];
  if (HERE && isRegion(want) && want !== HERE && !replayed && !failed) {
    // si la machine de cette region est injoignable, Fly.io nous renvoie la demande (fallback)
    socket.write('HTTP/1.1 307 Temporary Redirect\r\n' +
      'fly-replay: region=' + want + ';timeout=20s;fallback=force_self\r\n' +
      'Content-Length: 0\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  if (failed) {
    // le serveur demande n'a pas pu etre joint : on previent le joueur avec la raison donnee par Fly.io
    const reason = (/reason=([a-z_]+)/.exec(failed) || [])[1] || 'inconnue';
    console.error('Serveur ' + want + ' injoignable depuis ' + HERE + ' : ' + failed);
    return wss.handleUpgrade(req, socket, head, ws => {
      send(ws, { type: 'error', message: 'Serveur ' + want.toUpperCase() + ' injoignable (' + reason + ').' });
      setTimeout(() => ws.close(), 300);
    });
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});


// ---------- outils ----------

const newCode = () => {
  let c;

  do {
    c = Array.from(
      { length: 5 },
      () => ALPHA[Math.random() * ALPHA.length | 0]
    ).join('');
    if (REGION_LETTER[HERE]) c = REGION_LETTER[HERE] + c.slice(1);
  } while (rooms.has(c));

  return c;
};

const newId = () =>
  Math.random().toString(36).slice(2, 10);

const cleanName = n =>
  String(n || 'Joueur')
    .replace(/[<>&"']/g, '')
    .trim()
    .slice(0, 14) || 'Joueur';

const send = (ws, o) => {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(o));
  }
};

const teamOf = (room, slot) =>
  slot < room.size ? 0 : 1;

const publicPlayers = room =>
  room.players.map(p => ({
    id: p.id,
    name: p.name,
    slot: p.slot,
    team: teamOf(room, p.slot),
    host: p.id === room.hostId
  }));

const lobby = room =>
  room.players.forEach(p =>
    send(p.ws, {
      type: 'lobby',
      code: room.code,
      region: HERE,
      map: room.map,
      size: room.size,
      players: publicPlayers(room)
    })
  );


// Première place libre.
// Par défaut, le joueur rejoint l'équipe de l'hôte.
// Le bouton « changer d'équipe » permet ensuite de passer dans l'autre équipe.

function freeSlot(room, preferTeam) {
  const used = new Set(room.players.map(p => p.slot));
  const host = room.players.find(p => p.id === room.hostId);

  const team =
    preferTeam !== undefined
      ? preferTeam
      : (host ? teamOf(room, host.slot) : 0);

  const n = room.size;
  const all = [...Array(2 * n).keys()];

  const order =
    team === 0
      ? all
      : all.slice(n).concat(all.slice(0, n));

  return order.find(s => !used.has(s));
}


// ---------- quitter une partie ----------

function leave(ws) {
  const room = ws.room;

  if (!room) return;

  ws.room = null;

  const p = room.players.find(x => x.ws === ws);

  if (!p) return;

  room.players = room.players.filter(x => x !== p);

  if (room.players.length === 0) {
    stopGame(room);
    rooms.delete(room.code);
    return;
  }

  if (p.id === room.hostId) {
    room.hostId = room.players[0].id;
  }

  // La partie continue.
  // La place libérée peut être reprise par l'IA.
  if (room.game) {
    room.game.leave(p.slot);
  }

  room.players.forEach(x =>
    send(x.ws, {
      type: 'peer_left',
      slot: p.slot
    })
  );

  if (!room.started) {
    lobby(room);
  }
}


// ---------- partie calculée par le serveur ----------
//
// Simulation serveur : 60 Hz
// Inputs joueurs : ~60 Hz
// Snapshots envoyés aux joueurs : ~30 Hz

function startGame(room) {

  const sendAll = msg => {
    const data = JSON.stringify(msg);

    room.players.forEach(x => {
      if (x.ws.readyState === 1) {
        x.ws.send(data);
      }
    });
  };

  try {
    room.game = createGame(
      room.map,
      publicPlayers(room),
      sendAll
    );
  } catch (e) {
    console.error(
      'Impossible de lancer la partie :',
      e
    );

    room.players.forEach(x =>
      send(x.ws, {
        type: 'closed'
      })
    );

    return;
  }

  // Boucle à pas fixe, calée sur l'horloge haute précision :
  // - la simulation avance toujours de 1/60 s par pas (rattrapage si le serveur a pris du retard,
  //   au lieu de ralentir la partie) ;
  // - un snapshot exactement tous les 2 pas (30 Hz réguliers), au lieu d'un envoi
  //   « dès que 33 ms sont passées » qui tombait une fois sur deux à 48 ms avec une boucle de 16 ms.
  const STEP = 1000 / 60;
  const t0 = performance.now();
  let n = 0;          // nombre de pas simulés
  let endAt = 0;
  let lagMax = 0;     // plus gros retard de la boucle sur la dernière seconde (diagnostic)
  let lagShown = 0, lagReset = t0;

  const tick = () => {
    if (!room.game) return;
    const now = performance.now();
    const due = Math.floor((now - t0) / STEP);       // nombre de pas qui devraient être faits
    lagMax = Math.max(lagMax, now - (t0 + (n + 1) * STEP));   // retard par rapport à l'heure prévue du pas
    if (now - lagReset > 1000) { lagShown = Math.round(lagMax); lagMax = 0; lagReset = now; }

    let steps = 0, sendNow = false;
    while (n < due && steps < 6) {                   // au plus 6 pas d'un coup (100 ms de rattrapage)
      try { room.game.step(1 / 60); } catch (e) { console.error('Erreur de simulation :', e); }
      n++; steps++;
      if (n % 2 === 0) sendNow = true;               // 30 Hz
    }
    if (n < due) n = due;                            // retard énorme (serveur gelé) : on repart à l'heure

    if (sendNow) {
      try { const st = room.game.snapshot(); st.sl = lagShown; sendAll({ type: 'state', state: st }); }
      catch (e) { console.error('Erreur lors de l’envoi du snapshot :', e); }
    }

    // Conserver le salon 10 minutes après la fin, pour pouvoir recommencer
    if (room.game.state() === 'end') {
      endAt = endAt || now;
      if (now - endAt > 600000) { stopGame(room); rooms.delete(room.code); return; }
    }
    room.timer = setTimeout(tick, Math.max(0, t0 + (n + 1) * STEP - performance.now()));
  };
  room.timer = setTimeout(tick, STEP);
}


function stopGame(room) {
  if (room.timer) {
    clearTimeout(room.timer);
  }

  room.timer = null;
  room.game = null;
}


// ---------- messages WebSocket ----------

wss.on('connection', ws => {

  // Désactive l'algorithme Nagle :
  // les petits messages sont envoyés immédiatement.
  try {
    ws._socket.setNoDelay(true);
  } catch (e) {}

  ws.alive = true;

  ws.on('pong', () => {
    ws.alive = true;
  });

  // Compteur anti-abus
  ws.budget = 0;


  ws.on('message', raw => {

    // Limite anti-abus :
    // les joueurs envoient normalement leurs inputs à ~60 Hz.
    ws.budget++;

    if (ws.budget > 150) {
      return;
    }

    let m;

    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }

    const room = ws.room;


    switch (m.type) {

      // ---------- ping ----------

      case 'ping':
        return send(ws, {
          type: 'pong',
          t: m.t
        });


      // ---------- créer une partie ----------

      case 'create': {

        if (room) return;

        const code = newCode();
        const id = newId();

        const map =
          MAP_SIZE[m.map]
            ? m.map
            : 'nuit';

        const r = {
          code,
          hostId: id,
          started: false,
          players: [],
          map,
          size: MAP_SIZE[map]
        };

        r.players.push({
          id,
          ws,
          name: cleanName(m.name),
          slot: 0
        });

        rooms.set(code, r);
        ws.room = r;

        send(ws, {
          type: 'created',
          code,
          id,
          slot: 0,
          host: true,
          map: r.map,
          size: r.size
        });

        return lobby(r);
      }


      // ---------- rejoindre une partie ----------

      case 'join': {

        if (room) return;

        const r =
          rooms.get(
            String(m.code || '').toUpperCase()
          );

        if (!r) {
          return send(ws, {
            type: 'error',
            message: 'Aucune partie avec ce code.'
          });
        }

        if (r.started) {
          return send(ws, {
            type: 'error',
            message: 'La partie a déjà commencé.'
          });
        }

        const slot = freeSlot(r);

        if (slot === undefined) {
          return send(ws, {
            type: 'error',
            message:
              'La partie est pleine (' +
              (2 * r.size) +
              ' joueurs).'
          });
        }

        const id = newId();

        r.players.push({
          id,
          ws,
          name: cleanName(m.name),
          slot
        });

        ws.room = r;

        send(ws, {
          type: 'joined',
          code: r.code,
          id,
          slot,
          host: false,
          map: r.map,
          size: r.size
        });

        return lobby(r);
      }


      // ---------- changer d'équipe ----------

      case 'switch': {

        if (!room || room.started) return;

        const p =
          room.players.find(
            x => x.ws === ws
          );

        if (!p) return;

        const slot =
          freeSlot(
            room,
            1 - teamOf(room, p.slot)
          );

        if (
          slot === undefined ||
          teamOf(room, slot) === teamOf(room, p.slot)
        ) {
          return;
        }

        p.slot = slot;

        return lobby(room);
      }


      // ---------- démarrer la partie ----------

      case 'start': {

        if (!room || room.started) return;

        const p =
          room.players.find(
            x => x.ws === ws
          );

        if (!p || p.id !== room.hostId) {
          return;
        }

        room.started = true;

        const players =
          publicPlayers(room);

        room.players.forEach(x =>
          send(x.ws, {
            type: 'start',
            players,
            map: room.map,
            size: room.size,
            server: true
          })
        );

        return startGame(room);
      }


      // ---------- input joueur -> serveur ----------

      case 'input': {

        if (
          !room ||
          !room.started ||
          !room.game
        ) {
          return;
        }

        const p =
          room.players.find(
            x => x.ws === ws
          );

        if (
          p &&
          m.input &&
          typeof m.input === 'object'
        ) {
          room.game.input(
            p.slot,
            m.input
          );
        }

        return;
      }


      // ---------- ancien mode client-hôte ----------
      // Conservé uniquement pour compatibilité.
      // Le nouveau mode serveur-autoritaire ne l'utilise pas.

      case 'state': {

        if (
          !room ||
          !room.started ||
          room.game
        ) {
          return;
        }

        const p =
          room.players.find(
            x => x.ws === ws
          );

        if (
          !p ||
          p.id !== room.hostId
        ) {
          return;
        }

        const msg =
          JSON.stringify({
            type: 'state',
            state: m.state
          });

        room.players.forEach(x => {
          if (
            x !== p &&
            x.ws.readyState === 1
          ) {
            x.ws.send(msg);
          }
        });

        return;
      }


      // ---------- recommencer ----------

      case 'rematch': {

        if (
          !room ||
          !room.started ||
          !room.game ||
          room.game.state() !== 'end'
        ) {
          return;
        }

        const p =
          room.players.find(
            x => x.ws === ws
          );

        if (!p) return;

        p.ready = true;

        // Le chef du salon relance pour tout le monde
        if (p.id === room.hostId) {

          stopGame(room);

          room.players.forEach(
            x => {
              x.ready = false;
            }
          );

          const players =
            publicPlayers(room);

          room.players.forEach(x =>
            send(x.ws, {
              type: 'start',
              players,
              map: room.map,
              size: room.size,
              server: true
            })
          );

          return startGame(room);
        }

        const ids =
          room.players
            .filter(x => x.ready)
            .map(x => x.id);

        return room.players.forEach(x =>
          send(x.ws, {
            type: 'ready',
            ids
          })
        );
      }


      // ---------- quitter ----------

      case 'leave':
        return leave(ws);
    }
  });


  ws.on('close', () => {
    leave(ws);
  });
});


// ---------- maintenance ----------

// Remise à zéro du budget de messages chaque seconde
setInterval(() => {

  wss.clients.forEach(ws => {
    ws.budget = 0;
  });

}, 1000);


// Détection des connexions mortes
setInterval(() => {

  wss.clients.forEach(ws => {

    if (!ws.alive) {
      return ws.terminate();
    }

    ws.alive = false;

    try {
      ws.ping();
    } catch {}
  });

}, 25000);


// ---------- démarrage ----------

// Arret demande par Fly.io (deploiement, redemarrage) : on previent les joueurs avant de fermer.
// Le proxy n'arrete jamais de lui-meme une machine qui a des joueurs connectes (voir fly.toml).
function shutdown() {
  wss.clients.forEach(ws => send(ws, { type: 'closed' }));
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(
    'Serveur prêt sur le port ' + PORT + (HERE ? ' · région ' + HERE : '') + (APP ? ' · application ' + APP : '')
  );
});
