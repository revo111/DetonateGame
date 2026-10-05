// Detonate — simulation de la partie côté serveur (autorité).
// Le serveur exécute la même logique de jeu que index.html (déplacements, tirs, dégâts, bombe,
// grenades, drapeau, IA des bots, scores), sans aucun affichage. Les joueurs n'envoient que leurs
// commandes ; le serveur renvoie l'état de la partie à tout le monde.
const fs = require('fs');
const path = require('path');

let GAME_CODE = null;
function loadCode() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const start = html.lastIndexOf('<script>');      // le script du jeu est le dernier de la page
  const end = html.lastIndexOf('</script>');
  // on retire la boucle d'affichage de la fin du script (requestAnimationFrame)
  return html.slice(start + 8, end).replace(/newRound\(\);let last[\s\S]*$/, '');
}

// objets factices pour remplacer le moteur 3D et la page web (rien n'est dessiné sur le serveur)
const mkp = () => {
  const st = {};
  return new Proxy(function () {}, {
    get: (t, k) => (k in st ? st[k] : (k === Symbol.toPrimitive ? () => 0 : mkp())),
    set: (t, k, v) => { st[k] = v; return true; },
    apply: () => mkp(),
    construct: () => mkp()
  });
};
const fakeEl = () => ({ addEventListener() {}, setPointerCapture() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
  getContext: () => mkp(), width: 0, height: 0, appendChild() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
const THREE = new Proxy({ WebGLRenderer: function () { return { domElement: fakeEl(), setPixelRatio() {}, setSize() {}, render() {} }; } },
  { get: (t, k) => (k in t ? t[k] : mkp()) });
const documentStub = { querySelectorAll: () => [], getElementById: () => fakeEl(), body: { prepend() {}, appendChild() {} }, createElement: () => fakeEl(), addEventListener() {} };

/**
 * Crée une partie.
 * @param {string} map  'nuit' ou 'desert'
 * @param {Array} players  [{slot, name, id}]
 * @param {(msg:object)=>void} broadcast  envoie un message à tous les joueurs du salon
 */
function createGame(map, players, broadcast) {
  if (!GAME_CODE) GAME_CODE = loadCode();
  const code = GAME_CODE + `;
  // ---- mode serveur : personne ne joue "en local", tous les humains sont des joueurs distants
  netMode=true;isHost=true;netStarted=true;localSlot=-1;
  netPlayers=__players;sendNet=o=>__out(o);
  loadMap(__map);NM=Array.from({length:2*TS},(_,i)=>slotName(i));
  netInputs={};cRound=0;round=0;score=[0,0];HEAT=[0,0,0];PRES=[0,0,0];newRound();
  return {
    step:dt=>upd(dt),
    snapshot:()=>netSnapshot(),
    input:(slot,inp)=>netMessage({type:'remote_input',slot,input:inp}),
    leave:slot=>netMessage({type:'peer_left',slot}),
    state:()=>st.s
  }`;
  const fn = new Function('THREE', 'document', 'window', 'location', 'innerWidth', 'innerHeight', 'devicePixelRatio',
    'addEventListener', 'requestAnimationFrame', 'navigator', 'localStorage', '__players', '__map', '__out', code);
  const g = fn(THREE, documentStub, {}, { search: '', protocol: 'http:', host: 'serveur', hostname: 'serveur' }, 1280, 720, 1,
    () => {}, () => 0, { userAgent: 'serveur', maxTouchPoints: 0 }, { getItem: () => null, setItem() {} },
    players.map(p => ({ slot: p.slot, name: p.name, id: p.id })), map,
    o => { if (o && o.type === 'state') broadcast(o); });
  return g;
}

module.exports = { createGame };
