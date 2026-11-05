# Detonate — prototype V3.5

## Contenu
| Fichier | Rôle |
|---|---|
| `index.html` | Le jeu complet (solo contre bots et client en ligne). C'est aussi le code que le serveur exécute pour simuler les parties. |
| `server.js` | Serveur des parties privées (WebSocket, salons par code, simulation à 60 Hz). |
| `game_sim.js` | Lance la simulation du jeu (le dernier `<script>` de `index.html`) côté serveur, sans affichage. |
| `package.json` | Dépendance unique : `ws`. |
| `Dockerfile` | Image Node 20 pour Fly.io. |
| `fly.toml` | Application Fly.io `detonate-prototype` (régions cdg, lax, iad, sin). |

## Nouveau en V3.5 : mode Zombie (étape 1)
Carte **Forêt · mode Zombie** dans le menu : 5 équipes de 2, carte sombre, poignard + briquet (3 min),
une vague de zombies par minute (20 vagues), la dernière équipe en vie gagne.
Étape 2 : sac de 3 emplacements, butin aléatoire (armes, munitions, ressources), fouille des voitures (4 s),
pistolet et fusil d'assaut (le bruit attire les zombies), bandages, sac laissé au sol à la mort.
Étape 3 : faim et soif (6 et 9 min ; sous 20 % on ralentit, à zéro on perd 1 PV toutes les 2 s), saignement après une morsure
(bandage, aussi sur un coéquipier en 5 s), animaux (poulet, cochon, vache : viande et cuir), boire et pêcher aux étangs,
**essence** pour recharger le briquet (+1:30), **torche** fabriquée avec 1 bois au feu de camp (grande lumière 2 min),
menu d'artisanat (touche C ou bouton 🔨) : feu de camp, torche, raviver, cuire, lance, canne à pêche, barricades (les zombies
les frappent, les brutes les cassent vite ; E maintenu pour démonter), cocktail Molotov, bandages, sac en cuir (arme de rechange).
Sons du mode Zombie refaits : voix des zombies (grognements selon le type, râle avant de frapper, morsure, cri du hurleur, mort et chute),
pas des zombies proches, coup de poignard et de lance (souffle + impact dans la chair), briquet, objets, feux qui crépitent, ambiance de forêt (vent, grillons, chouette). Début de vague : deux coups de cloche au loin (plus discrets que l'ancienne corne).
Touches PC du mode Zombie : objets é " ' (et ( pour la 4e case), A = changer d'arme (maintenir : la lâcher), V = grenade / Molotov, W = alliance, X = refuser une alliance,
G = briquet, E = ramasser / fouiller / boire, B = bandage, C = artisanat, H = aide. Canne à pêche : touche de son emplacement (ou E au bord
de l'eau quand on n'a pas soif), 4 s sans bouger, elle casse au 2e poisson. Sac en cuir (1 cuir) : à utiliser, +1 case dans le sac.
Étape 4 : à zéro PV, on reste **à terre** 30 s (on rampe) si un coéquipier ou un allié debout peut nous **relever** (E maintenu 4 s, on repart avec 35 PV) ;
**alliances** entre deux équipes (touche W ou bouton 🤝 : proposer, accepter, rompre) : pas de dégâts entre alliés, on se voit dans le noir et on peut se relever ;
quand il ne reste que deux équipes alliées, l'alliance prend fin après 10 s. Après la vague 20, **brouillard toxique** : la zone sûre se resserre par paliers
(dégâts croissants dehors). Bots : déplacements par la grille de navigation (ils ne tournent plus autour des maisons), ils suivent le joueur humain, relèvent leurs alliés.
Emotes d'alliance au-dessus des personnages : 🤝? (doré) une équipe propose une alliance, 💭 elle réfléchit à ta proposition,
🤝✔ (vert) alliance conclue, ✖ refus ; en t'approchant des bots : 🤝 (contour vert) ils accepteraient, ⚔️ ils n'en veulent pas. Refuser : touche X (bouton ✖).
Tir allié : pendant une alliance, on peut blesser ses alliés ; toucher un allié (balle, poignard, lance) est une **trahison** : l'alliance est rompue
sur-le-champ, 🗡️ au-dessus des traîtres, et les bots trahis deviennent hostiles. Les bots ne tirent pas quand un ami est dans la ligne de tir et trahissent
parfois un allié affaibli en fin de partie. Panneau des commandes (H) refait : toutes les touches, textes ajustés.
Étape 5 (bots et équilibrage) : les bots lancent leurs grenades sur les groupes, gardent leurs balles (poignard sur les rôdeurs isolés),
fabriquent une lance quand leur arme est vide, font un feu de camp pour cuire la viande, remplissent leurs bouteilles, défendent puis relèvent
leurs coéquipiers, et ne fuient pas quand leur joueur humain est à terre. Équilibrage : plus de munitions (butin, voitures, et sur les zombies :
14 % ; brutes 70 %), brute 280 PV et un peu plus rare, vagues un peu moins nombreuses, horde plafonnée selon le nombre d'équipes en vie,
saignement qui s'arrête après 25 s, faim 11 min, soif 7 min, à terre 40 s. Sur 12 parties de bots : vague finale moyenne 18,5 (avant : 13,9).
Manger et boire sur place : près d'une nourriture ou d'une eau au sol, appui court sur E = la ramasser, maintenir E (0,4 s) = la manger / la boire
tout de suite sans passer par le sac (sac plein : un simple appui suffit) ; les bots font de même quand ils ont faim ou soif.
Manger et boire prennent 2 s (on est ralenti ; un coup reçu ou une attaque interrompt, la portion prise au sol y est reposée) ; la cuisson prend
5 s par aliment près du feu. Entraide : un bot donne à son coéquipier (toi ou un autre bot) un bandage, de l'eau ou de la nourriture dès qu'il en a
besoin (🎁 au-dessus du bot), en gardant le minimum pour lui.
Correctifs du mode Zombie : les bots ne restent plus bloqués à ramasser puis lâcher une bouteille vide (sac plein), ne reprennent plus
une arme à feu vide à la place de leur lance, ni le bandage ou la nourriture qu'ils viennent de poser à tes pieds quand ton sac est plein
(le cadeau t'est réservé 60 s). Bandage : on se soigne soi-même quand on a moins de vie que son coéquipier (avant, on soignait parfois
l'autre). Le saignement, la faim ou la soif à zéro et le brouillard n'interrompent plus le repas (2 s) ni la pêche. À terre ou mort pendant
un repas : la portion prise au sol y retombe. Maintenir E près d'une nourriture qu'on ne peut pas manger ne bloque plus les autres actions
(boire à l'étang, ramasser). Un joueur à terre ne saigne plus après une morsure. Briquet vide : un message s'affiche. Bouton tactile :
« BOIRE » pour l'eau au sol. À terre : plus de coup ni de tir affiché côté client ; le menu d'artisanat se ferme. « Cuire » explique
pourquoi c'est impossible pendant un repas. Menu d'artisanat et tableau des équipes plus opaques (les annonces ne passent plus au travers).
**Arbalète** (artisanat : 2 bois + 2 métal) : arme de tir rapide (un carreau toutes les 0,3 s, 38 dégâts, précise), presque silencieuse
(les zombies ne l'entendent qu'à 160 px, contre 600 pour le pistolet), sans rechargement ; 60 carreaux, puis elle casse. Elle se prend en main
à la fabrication (l'arme tenue tombe au sol) ; posée au sol, son nom indique les carreaux restants. Les bots en fabriquent une quand ils n'ont plus
d'arme de tir utilisable. Sons « personnels » (manger, boire, ramasser, soin, artisanat, toux, à terre, alliance) : ils étaient muets, ils sont rétablis.
Mini-carte de la Forêt : 20 % plus petite, sans les voitures.
Bots : ils se soignent plus tôt (au calme dès qu'il leur manque 35 PV, et même avec des zombies à distance quand leur vie est très basse),
vont chercher un bandage au sol quand ils sont blessés, et prennent ce que leur coéquipier humain leur pose (bandage, nourriture, eau, munitions,
grenade) même avec un sac plein : ils lâchent alors ce qui leur sert le moins (pierre, bois, bouteille...). Carte du coéquipier sous la mini-carte :
nom, vie (ou « À TERRE »), saignement, faim et soif ; une icône clignote au-dessus de lui quand il a faim ou soif. Sac : la molette ou un clic
choisit un objet (clic sur l'objet déjà choisi : l'utiliser) ; touche T : lâcher 1 objet choisi (munitions : 10), maintenir T : toute la pile.
Plus de munitions : boîtes plus fréquentes dans les chalets, les voitures et la forêt (+50 à +70 %) et plus grosses (24 à 42 balles),
fouille de voiture 30 à 45 balles, zombies 21 % (10 à 19 balles), brutes 80 % (18 à 30). Sur 10 parties de bots : temps sans munitions
6 % (avant 23 %), vague finale moyenne 23,6 (avant 20,5).
Bot coéquipier : il boit vraiment au lac (il s'arrêtait 4 px trop loin de l'eau, puis abandonnait l'étang pour toute la partie), boit en passant
quand il est au bord de l'eau, et sa soif presque vide passe avant un combat à distance ; face à une horde, il se replie vers toi au lieu de
s'enfuir ailleurs et ne s'éloigne plus à plus de 240 px en combattant ; il t'aide à achever un animal que tu viens de frapper ; il fouille les
voitures proches de toi (il n'en fouillait jamais, et ceux qui essayaient restaient parfois trop loin de la voiture). À terre : on est à plat ventre,
tourné dans le sens où l'on rampe (plus vers la visée), bras qui tirent et jambes qui poussent en alternance ; on rampe un peu plus vite (45 px/s) ;
un bot à terre rampe vers son coéquipier pour être relevé plus vite.
Fouille des voitures par les bots : ils ne choisissent plus une voiture que quelqu'un fouille déjà, se placent sur un point libre à portée de
fouille, et s'arrêtent dès que la voiture est à portée (avant, ils pouvaient faire du surplace contre la carrosserie sans jamais fouiller).
Éclair de tir : il s'éteint maintenant 0,06 s après le coup (en mode Zombie il restait allumé en permanence au bout de l'arme).
Bandage au sol : comme la nourriture, on peut s'en servir sans le mettre dans le sac (maintenir E ; sac plein : un simple appui) ; interrompu,
il retombe au sol. Les bots blessés font de même. Carte de la Forêt : 6 chalets de plus (19 au total), placés dans les plus grands vides (coins et
bords de la carte, loin des points de départ), porte tournée vers la route la plus proche, clairière dégagée autour ; le reste de la carte est
identique ; un peu plus d'objets de départ dans les chalets (même quantité par chalet).
Mobile (mode Zombie) : barre de vie (ATH) et inventaire deux fois plus petits.
- **ATH mobile** : barre de vie et inventaire agrandis de 15 % ; l'inventaire a la même largeur que la barre de vie et il est centré dessus ; la carte du coéquipier est centrée sous la mini-carte ; mini-carte mobile réduite de 15 %.

- **Chiffres de l'inventaire sur mobile** : taille minimale de police, pastille sombre derrière les quantités et les munitions ; l'état du briquet et le texte « fabriquer » sont masqués sur mobile pour libérer la place.

- **Case de l'arme sur mobile** : nouvelle mise en page, avec l'icône à gauche et les munitions « chargeur/réserve » à droite, sans chevauchement. La taille du texte s'adapte. L'icône du poignard se retire quand la place manque.

- **Son** : les tirs, les impacts et les sons du joueur sont prioritaires. Les grognements, les pas et l'ambiance ne peuvent plus leur prendre leur place. Le nombre de sons simultanés est limité, plus fortement sur mobile. Les voix des zombies sont plus légères sur mobile (2 formants) et il y a moins de bruits de pas. Les sons sont planifiés un peu en avance, ce qui évite les clics. Sur mobile, le tampon audio est plus grand. Le son reprend après une interruption (appel, autre application, relâchement du doigt sur l'écran).
- **Brouillard de fin de partie** : sur la mini-carte, il reste dans le cadre. Il est hachuré, avec un liseré lumineux et la prochaine zone en pointillés qui défilent. À l'écran, le cercle est calculé sur la partie visible de la carte. Cela corrige l'écran entièrement vert au début du brouillard, et le « trou » de la zone sûre qui n'apparaissait pas sur la mini-carte. Le brouillard a maintenant des volutes qui dérivent, un halo le long du bord et un mur de brume animé.
- **Munitions** : environ 45 % de munitions en moins sur la carte. Poids : maisons 48→30, véhicules 46→30, forêt 24→14, voitures 36→26. Quantités : au sol 18 à 32, voitures fouillées 22 à 34.

- **Sac du joueur mort** : quand un joueur meurt, ses armes (avec leurs munitions) et tout son sac restent dans un sac au sol, à son nom. On l'ouvre avec E (PC) ou le bouton OUVRIR LE SAC (mobile) pour voir son contenu. On touche un objet pour le prendre, ou TOUT PRENDRE. Une arme prise remplace celle qu'on tient, qui va dans le sac. Sac plein : on touche l'objet voulu puis la case de son sac à échanger. Les bots fouillent aussi ces sacs.
- **Manger** : il faut maintenir l'action pour manger ou boire au sol (0,8 s ; 1,5 s pour la viande ou le poisson crus). Un appui court ne fait plus manger, même sac plein. La viande et le poisson crus pris dans le sac demandent un deuxième appui pour confirmer. Appuyer de nouveau sur E (ou sur ANNULER) pendant un repas l'arrête, sans perdre l'aliment.
- **Échanger un objet** : sac plein, sur PC, E prend l'objet au sol à la place de la case choisie (molette ou clic) ; l'ancien objet reste au sol. Sur mobile, le bouton ÉCHANGER puis un toucher sur la case à remplacer.
- **Munitions** : +20 % d'apparition (maisons 30→36, véhicules 30→36, forêt 14→17, voitures 26→31).

- **Équipes du mode Zombie** : ALPHA (bleu), DELTA (orange), SIERRA (violet), COBRA (jaune) et GHOST (vert). Avant : Loups, Renards, Corbeaux, Lynx, Vipères. Les bots s'appellent « Delta 1 », « Sierra 2 », etc.

- **Rangs d'équipe (mode Zombie)** : le rang dépend des zombies tués par l'équipe. I Bronze : 20 ; II Argent : 60 ; III Or : 120 ; IV Diamant : 210. Chaque palier demande plus que le précédent (+20, +40, +60, +90). Bonus pour toute l'équipe : I : +8 % vie, +5 % cadence de tir, +5 % vitesse ; II : +12 %, +8 %, +8 % ; III : +15 %, +15 %, +15 % ; IV : +20 %, +20 %, +20 %. La vie gagnée s'ajoute tout de suite. Chaque rang a sa forme d'écusson : I Bronze un bouclier arrondi (sans brillance), II Argent un écusson à pointe, III Or un hexagone, IV Diamant un losange. Argent, Or et Diamant brillent, sans halo autour : reflet en haut et éclat lumineux qui les traverse de temps en temps. L'insigne du rang est visible à gauche de la barre de vie de chaque joueur, à côté de la vie dans l'ATH, sur les pastilles d'équipe et dans le tableau (TAB). La montée de rang est annoncée.
- **ATH du haut refait** : une première carte centrée avec la vague, les zombies en vie au centre, le minuteur et les 5 équipes (joueurs en vie + insigne de rang). Une deuxième carte montre le rang de l'équipe, la progression vers le rang suivant et les bonus (vie, cadence de tir, vitesse) ; sans rang, ce sont ceux du rang I, en gris. Sur mobile, l'ATH du haut est réduit d'environ 25 % (236 px de large au lieu de 300, 89 px de haut au lieu de 108). Avec les bots, on atteint Bronze vers la vague 6, Argent vers la 11, Or vers la 16 et Diamant vers la 21.

- **AR (mode Zombie)** : le fusil d'assaut est remplacé par l'AR de la carte Neige. Même modèle (corps sombre, repère rouge, canon rond), raccourci d'environ un tiers, en main et au sol, avec une nouvelle icône. Il a les effets de tir de la Neige : tracé orange lumineux, éclair au bout du canon, petits nuages d'impact. Il fait 32 dégâts par balle au lieu de 22, donc plus que le pistolet (28), car il est plus rare. Cadence et chargeur inchangés.

- **Moins de texte à l'écran (mode Zombie)** : plus de messages pour la zone qui se resserre (« Brouillard toxique », « La zone se resserre »), ni pour les alliances (propositions, alliance conclue, fin, trahison). Les sons sont gardés, et le bouton d'alliance s'allume toujours sur mobile. Seul l'avertissement « HORS DE LA ZONE ! » reste, et seulement quand on est dehors.

- **AR** : +15 % d'apparition (poids 8→9,2 dans les maisons, 5→5,75 dans les voitures).
- **Visée tactile (mobile)** : portée plus longue, 680 px avec le pistolet ou l'AR (460 avant) et 620 px avec l'arbalète. Un ennemi (joueur) dans la direction visée devient la cible principale, devant les zombies.
- **Fin de partie** (vague 20, 2e resserrement du brouillard, ou 3 équipes au plus) : les bots attaquent. Ils voient plus loin, ne fuient plus les joueurs, tirent sur les ennemis avant les zombies, sauf un zombie collé, et vont chercher l'équipe ennemie la plus proche dans la zone sûre. Sur 8 parties entre bots : morts tués par un joueur 21 → 61, morts dans le brouillard 26 → 2, parties d'environ 21 min au lieu de 24.
- **Essence au sol** : maintenir l'action recharge le briquet (+1:30) sans passer par le sac ; un appui court la ramasse.

- **Vagues toutes les 50 s** (au lieu de 60). **Bois** : +15 % d'apparition en forêt (poids 30 → 34,5).

- **Fusil à pompe (mode Zombie)** : nouvelle arme. 8 plombs en éventail, 18 dégâts chacun à bout portant, 50 % en bout de course (portée d'environ 290 px). Chaque plomb traverse un premier zombie, ce qui en fait une arme de zone contre la horde : un rôdeur meurt en un coup de près. Contre un joueur, les plombs font 60 % de leurs dégâts. 6 cartouches (les munitions normales), un tir toutes les 0,8 s, rechargement en 2,4 s, très bruyant. Il a son modèle en main et au sol, son icône et un son de pompe. On le trouve dans les maisons (poids 5, environ 4 %) et les voitures (poids 4, environ 3,6 %). Les bots le prennent et s'approchent pour tirer.
- **Une arme en réserve dans le sac** : en ramassant une arme alors qu'on en tient déjà une, celle-ci va dans une case libre du sac au lieu de tomber au sol. Une seule arme peut y être rangée à la fois, sinon elle tombe comme avant. Toucher la case (ou sa touche sur PC) échange l'arme rangée avec celle en main. Lâcher la case pose l'arme entière au sol, avec ses balles.
- **Chargeur étendu** : nouvelle recette pour 2 métal. Il s'applique à l'arme en main (pistolet, AR ou fusil à pompe), une seule fois par arme, et donne +50 % de balles (pistolet 18, AR 45, fusil à pompe 9). Il reste sur l'arme au sol, dans le sac et dans le sac d'un joueur mort. Une pastille jaune « + » le signale sur l'arme, et l'étiquette au sol indique « chargeur étendu ». Les bots le fabriquent quand ils ont 2 métal.
- **Largage de ravitaillement (rare)** : à partir de la vague 5, 9 % de chance par vague, 5 vagues d'écart au moins, 2 par partie au plus. Sur 8 parties entre bots, il y en a eu environ 0,75 par partie. Un avion passe avec ses feux de position, et une caisse descend en parachute en 16 s, avec son ombre et le compte à rebours au point d'atterrissage. Elle tombe sur un sol libre, dans la prochaine zone sûre si le brouillard est là. Elle est repérée sur la mini-carte et par une flèche au bord de l'écran, et une fusée rouge l'éclaire. Elle s'ouvre comme un sac (« RAVITAILLEMENT ») et contient un AR ou un fusil à pompe chargé (une fois sur deux avec chargeur étendu), 40 à 60 munitions, 2 ou 3 bandages, 1 ou 2 grenades, 2 métal, de l'eau ou des snacks, parfois de l'essence. Son atterrissage attire les zombies. Les bots vont la chercher.

- **Base Polaire de nuit : reflet des lampes sur les objets** : les lampadaires, projecteurs, portes, fenêtres et tentes éclairent maintenant les arbres (aiguilles, écorce, neige sur les branches), les rochers, les murs, les véhicules, les caisses et les poteaux, et pas seulement le sol. Chaque objet lit la carte de lumière du sol juste devant ses faces : la face tournée vers une lampe prend sa couleur (orangée pour les lampadaires, blanche pour les projecteurs), la face opposée reste dans l'ombre portée de l'objet, et un objet caché derrière un autre reste sombre. La lumière baisse avec la hauteur, et les toits ne la prennent pas. Il n'y a aucune lumière en plus : une seule texture est lue dans le shader. La carte de jour et les autres cartes ne changent pas.

- **Forêt : deux voitures qui se chevauchaient** (au centre de la carte, vers x 3500-3600) : la deuxième est déplacée à côté, sur un sol libre (3770, 2945). Les collisions, la fouille et le butin suivent.
- **Bouton arme (mobile, mode Zombie)** : un nouveau bouton à côté de R passe à l'arme suivante : arme en main → arme de rechange → arme rangée dans le sac → poignard. Son icône montre l'arme qu'on va prendre. La touche Q sur PC suit le même cycle et inclut maintenant l'arme rangée dans le sac.
- **Boutons mobiles réorganisés en arc autour de R** : arme à gauche, grenade en diagonale, action (ramasser, fouiller…) au-dessus, briquet un peu plus loin, alliance au-dessus de la grenade. Les boutons sont espacés pour que le pouce les atteigne sans en toucher deux.

- **Base Polaire en 6 contre 6** (jour et nuit, mode Code Rouge) au lieu de 5 contre 5, pour mieux équilibrer l'attaque et la défense. Il y a 12 places par salon et une apparition de plus par camp. L'ATH (pastilles A1 à A5 / E1 à E6), le tableau des scores, le lobby et le menu affichent 6 contre 6. Contre l'IA, chaque équipe a aussi 6 joueurs. `server.js` change : `MAP_SIZE.neige` et `MAP_SIZE.neigeN` passent de 5 à 6, il faut le redéployer.

- **V3.6 · étape 1 : nouvelle carte de guerre « FRONT » (8 contre 8)**. La carte est symétrique : les deux camps sont exactement équivalents.
  - Une rivière en S traverse la carte du nord au sud. On ne peut pas la franchir à pied, mais les balles et la vue passent au-dessus.
  - Il y a 3 ponts routiers (nord, centre, sud), qui seront destructibles au C4 à l'étape 2, et 2 passerelles en bois pour l'infanterie.
  - Une ligne de tranchées en zigzag protège chaque camp, avec un parapet en sacs de sable côté ennemi et des caillebotis. Des tranchées avancées longent la rivière.
  - Le no man's land contient des herissons tchèques et des barbelés (on ne les franchit pas, les balles passent), des cratères d'obus, des arbres brûlés, des épaves de chars et de camions en feu, et des villages en ruine.
  - Chaque camp a un QG en béton, des tentes, des caisses de munitions, des fûts, des camions, des miradors, des canons sous filet de camouflage et des drapeaux aux couleurs de l'équipe (ACIER contre CENDRE).
  - L'ambiance est chaotique : obus qui tombent au loin (décor, sans dégâts), fumées, feux, rafales et canons au loin.
  - Les emplacements des cibles (lance-missiles et antennes satellite), du tank et du 4x4 sont déjà réservés pour l'étape 2.
  - En attendant le mode Escorte, la carte se joue en match à mort à 8 contre 8 (premier à 80).
  - `server.js` change : `MAP_SIZE.guerre = 8` (16 places).

- **V3.6 · étape 2 : mode « FRONT » (escorte du tank), 8 contre 8**. Contre l'IA comme en ligne, la carte Front se joue maintenant dans ce mode (plus en match à mort).
  - **But** : chaque équipe escorte son tank jusqu'au camp adverse pour détruire au canon les 4 cibles ennemies. Les cibles sont des stations d'antenne satellite (A1, A2…) et des lance-missiles (B1, B2…). Elles sont tirées au sort à chaque manche, dans 4 des 8 emplacements du camp, avec un mélange au hasard de A et de B. Il faut 4 obus pour détruire une cible.
  - **Manche** : elle dure 6 min et la première équipe à 4 manches gagne. Détruire les 4 cibles adverses donne la manche tout de suite. Au chrono, l'équipe qui a détruit le plus de cibles gagne ; en cas d'égalité, celle qui a fait le plus de dégâts, puis celle qui a atteint ce score en premier. On réapparaît 5 s après sa mort.
  - **Tank** (piloté librement par un joueur) :
    - il est lent et plus grand, avec un nouveau modèle détaillé (tourelle, long canon, jupes, trappe du chef) ;
    - son conducteur est invincible et le tank ne craint pas les grenades ;
    - le tireur, debout dans la trappe, peut être visé et tué ;
    - le canon tire des obus explosifs et recharge en 4 s ;
    - le tank écrase les ennemis à pied et pousse un 4x4 qui lui barre la route.
  - **4x4 blindé**, façon Humvee : une mitrailleuse en tourelle, un tireur exposé, une barre de vie visible au-dessus. Il résiste à 4 grenades, un obus en enlève 2 et le C4 le détruit. Il réapparaît au garage 20 s après sa destruction.
  - **Commandes** :
    - **E**, ou le bouton d'action sur mobile : monter, passer au canon, descendre.
    - **E maintenu** : poser le C4.
    - Si un bot occupe une place, le joueur la prend : le bot passe au canon ou descend.
  - **Équipement** : 1 C4 et 1 grenade par vie.
    - **4 C4 sur un pont** le font exploser 8 s plus tard. Le pont reste détruit jusqu'à la fin de la manche : l'eau le remplace et plus personne ne passe. Il faut donc s'organiser en équipe.
    - **C4 sur le tank ennemi** : il est immobilisé 4 s. Ajout d'équilibrage : on ne peut pas reposer de C4 sur ce tank pendant les 3 s qui suivent, pour éviter qu'il reste bloqué en permanence.
  - **La carte Front est plus petite** : 4200 × 2800 (elle faisait 7600 × 4800 à l'étape 1), donc on atteint le camp adverse beaucoup plus vite. Elle est aussi plus chargée :
    - des hameaux en ruine ;
    - des rangées de blocs de béton ;
    - plus d'épaves, de hérissons, de barbelés, de nids de sacs de sable et de dépôts de caisses ;
    - des camps mieux remplis.
    Les ponts routiers sont élargis pour le tank. Le générateur vérifie que le tank et le 4x4 peuvent rejoindre tous les ponts et toutes les cibles adverses.
  - **ATH** :
    - sous le score, l'état des 4 cibles de chaque camp avec leurs points de vie ;
    - au-dessus des cibles et des véhicules, leur nom, leur vie et leur état ;
    - au bord de l'écran, des flèches vers les cibles ennemies et vers votre tank ;
    - sur les ponts, les C4 posés et le compte à rebours ;
    - un panneau du véhicule (rechargement du canon, blindage du 4x4), le compteur de C4, des bandeaux pour les événements (cible détruite, pont détruit…) et une carte de fin de manche ;
    - sur la mini-carte : les cibles, les véhicules et les ponts minés ou détruits.
  - **Bots** : ils ont des rôles (équipage du tank et du 4x4, escorte, défense). Le tank bot choisit un pont différent de celui du tank ennemi, s'arrête à portée pour tirer et contourne les blocages. Les défenseurs vont au-devant du tank ennemi pour tuer le tireur et poser le C4.
  - L'état du mode passe par le réseau : cibles, véhicules, obus, ponts, C4 et effets.
  - **Textures et décor retravaillés** :
    - **Ponts routiers** : tablier en dalles de béton avec joints, chaussée usée (traces de pneus, ligne centrale effacée, rustines, fissures, flaques), bordures, et un vrai treillis d'acier riveté et rouillé avec des contreventements au-dessus. Les piles sont tachées par l'eau.
    - **Passerelles** : planches de bois veinées et clouées, avec des fentes, sur des pilotis.
    - **Pont détruit** : poutres tordues et chaussée effondrée dans l'eau.
    - **Station d'antenne** : dalle de béton avec bandes de danger et marquages, grillage, abri en tôle ondulée avec porte et climatiseurs, groupe électrogène et cuve, chemin de câbles. La parabole a des panneaux et un cornet sur trois bras, et un mât en treillis porte des antennes et un feu rouge.
    - **Lance-missiles** : roues sculptées avec jantes, châssis en acier, réservoirs, cabine vitrée avec calandre, vérins de calage déployés, rampe de lancement levée par deux vérins. Le missile porte des repères de roulis, des inscriptions et une ogive.
    - **Peinture des véhicules** : lignes de panneaux, rivets, coulures et boue en bas de caisse.
    - **Sol** : texture de détail beaucoup plus fine (cailloux en relief, touffes d'herbe sèche, boue sèche fissurée, brindilles) sur deux échelles pour casser la répétition. Plaques d'herbe sèche et de terre humide, traces de chenilles dans les camps.
    - **Arbres morts** : environ 90 grands arbres secs aux branches nues (parfois cassés), en plus des souches brûlées.
  - **Mitrailleuse du 4x4** : nouveau son de mitrailleuse lourde, plus grave et plus puissant. Il combine le claquement du départ, le souffle de la bouche, un coup sourd dans les basses, le bruit métallique de la culasse, la queue qui résonne et, de temps en temps, une douille qui tinte. Il s'assourdit avec la distance et se place à gauche ou à droite. En ligne, les autres joueurs l'entendent aussi (seules les balles de mitrailleuse portent un marqueur en plus).
  - **Ruines variées** : 6 styles de murs (brique rouge, brique jaune, pierre, crépi écaillé, parpaings, béton). Chaque hameau garde son style. Les murs portent de la suie, des impacts, des fissures et des traces d'humidité, et leurs arêtes cassées sont noircies. Des poutres calcinées et des tuiles tombées traînent dans les gravats.
  - **Camps près du spawn** :
    - tentes en 3 toiles (olive, kaki, vert-gris) avec pignons, plancher, mât et haubans ;
    - caisses en bois et caisses de munitions marquées, sous des bâches ;
    - fûts peints et rouillés avec couvercles ;
    - camions militaires détaillés : cabine vitrée, calandre, roues à jantes, bâche tendue sur des arceaux ;
    - miradors en rondins avec toit en tôle ;
    - bunker en béton banché avec meurtrière et porte blindée ;
    - canons d'artillerie.
  - Prévu à l'étape 3 : les lance-missiles utilisables et l'antenne satellite qui révèle les ennemis.

`server.js` a changé à l'étape 1 (salons de 10 places en 5 équipes) : il faut le redéployer avec `index.html`.

## Tester en solo sur GitHub Pages
1. Pousse ces fichiers sur un dépôt GitHub.
2. Settings → Pages → Source : branche `main`, dossier `/ (root)`.
3. Ouvre `https://<ton-compte>.github.io/<dépôt>/` puis « Jouer contre l'IA ».

## Tester en ligne (parties privées)
Le jeu ouvert depuis GitHub Pages se connecte à `wss://detonate-prototype.fly.dev`
(constante `DEFAULT_SERVER` dans `index.html`). Déploie le serveur prototype :

```
fly deploy --config fly.toml
```

Pour viser un autre serveur sans modifier le fichier : ajoute `?server=wss://autre-app.fly.dev` à l'adresse du jeu.

Le serveur doit toujours être déployé avec **le même `index.html`** que celui de GitHub Pages
(il exécute la même logique de jeu).
