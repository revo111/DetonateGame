```js
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
const rooms = new Map(); // code -> salon


// ---------- serveur web : jeu + test de santé ----------

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

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
  server,
  maxPayload: 256 * 1024
});


// ---------- outils ----------

const newCode = () => {
  let c;

  do {
    c = Array.from(
      { length: 5 },
      () => ALPHA[Math.random() * ALPHA.length | 0]
    ).join('');
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

  let last = Date.now();
  let lastSend = 0;
  let endAt = 0;

  room.timer = setInterval(() => {

    const now = Date.now();

    const dt = Math.min(
      0.05,
      (now - last) / 1000
    );

    last = now;

    // Simulation serveur à environ 60 Hz
    try {
      room.game.step(dt);
    } catch (e) {
      console.error(
        'Erreur de simulation :',
        e
      );
    }

    // Snapshot réseau à environ 30 Hz
    // 1000 / 33 ≈ 30,3 snapshots par seconde
    if (now - lastSend >= 33) {

      lastSend = now;

      try {
        sendAll({
          type: 'state',
          state: room.game.snapshot()
        });
      } catch (e) {
        console.error(
          'Erreur lors de l’envoi du snapshot :',
          e
        );
      }
    }

    // Conserver le salon 10 minutes après la fin
    // afin de permettre un rematch.
    if (room.game.state() === 'end') {

      endAt = endAt || now;

      if (now - endAt > 600000) {
        stopGame(room);
        rooms.delete(room.code);
      }
    }

  }, 16);
}


function stopGame(room) {
  if (room.timer) {
    clearInterval(room.timer);
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

server.listen(PORT, () => {
  console.log(
    'Serveur prêt sur le port ' + PORT
  );
});
```
