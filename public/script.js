const socket = io();

// --- SOUNDS ---
const sounds = {
    move: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'), // Click sound placeholder
    win: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3')   // Win sound placeholder
};

// --- GLOBALE VARIABLEN ---
let myColor = null;
let currentPlayers = {};
let selectedPieceIndex = null; // Welchen Stein habe ich angeklickt?
let validMoves = []; // Wohin darf er?

// --- BOARD INITIALISIERUNG (DER STERN) ---
// ASCII Map des Sterns (0 = Feld, Leer = Nix)
const starMap = [
    "            0            ", // Zeile 0 (Grün Start)
    "           0 0           ", 
    "          0 0 0          ", 
    "         0 0 0 0         ", 
    "0 0 0 0 0 0 0 0 0 0 0 0 0", // Zeile 4 (Balken)
    " 0 0 0 0 0 0 0 0 0 0 0 0 ", 
    "  0 0 0 0 0 0 0 0 0 0 0  ", 
    "   0 0 0 0 0 0 0 0 0 0   ", 
    "    0 0 0 0 0 0 0 0 0    ", // Mitte
    "   0 0 0 0 0 0 0 0 0 0   ", 
    "  0 0 0 0 0 0 0 0 0 0 0  ", 
    " 0 0 0 0 0 0 0 0 0 0 0 0 ", 
    "0 0 0 0 0 0 0 0 0 0 0 0 0", 
    "         0 0 0 0         ", // Zeile 13 (Rot Start)
    "          0 0 0          ", 
    "           0 0           ", 
    "            0            "  // Zeile 16
];

const boardElement = document.getElementById('board');

function initBoard() {
    boardElement.innerHTML = '';
    
    for (let y = 0; y < starMap.length; y++) {
        const rowStr = starMap[y];
        // Wir nehmen an, der String ist 25 chars lang.
        // Ein '0' ist ein Feld. Ein ' ' ist leer.
        
        for (let x = 0; x < rowStr.length; x++) {
            const cell = document.createElement('div');
            
            // Logik: Ist hier ein Spielfeld?
            if (rowStr[x] === '0') {
                cell.classList.add('cell');
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                // Event Listener für Bewegung (Ziel auswählen)
                cell.addEventListener('click', () => onCellClick(x, y));
            } else {
                cell.classList.add('cell', 'void'); // Unsichtbarer Platzhalter
            }
            boardElement.appendChild(cell);
        }
    }
}
initBoard();

// --- LOGIK: ZÜGE BERECHNEN ---

function onCellClick(x, y) {
    // 1. Habe ich schon einen Stein ausgewählt?
    if (selectedPieceIndex !== null) {
        // Ist das geklickte Feld ein gültiges Ziel?
        const move = validMoves.find(m => m.x === x && m.y === y);
        if (move) {
            // ZUG AUSFÜHREN!
            socket.emit('movePiece', {
                pieceIndex: selectedPieceIndex,
                target: {x, y}
            });
            clearSelection();
        } else {
            // Klick ins Leere -> Auswahl aufheben
            clearSelection();
        }
    }
}

function onPieceClick(e, playerColor, pieceIndex) {
    e.stopPropagation(); // Klick nicht an Zelle weitergeben

    if (playerColor !== myColor) return; // Nicht mein Stein

    // Stein auswählen
    selectedPieceIndex = pieceIndex;
    
    // Visuelles Feedback
    document.querySelectorAll('.piece').forEach(p => p.classList.remove('selected'));
    e.target.classList.add('selected');

    // Mögliche Züge berechnen
    const piecePos = currentPlayers[socket.id].pieces[pieceIndex];
    validMoves = calculateValidMoves(piecePos.x, piecePos.y);

    // Züge auf dem Brett anzeigen
    highlightMoves();
}

function clearSelection() {
    selectedPieceIndex = null;
    validMoves = [];
    document.querySelectorAll('.piece').forEach(p => p.classList.remove('selected'));
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('valid-move'));
}

function highlightMoves() {
    // Erst alle alten Highlights weg
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('valid-move'));

    validMoves.forEach(move => {
        // Finde die Zelle im DOM
        // Da wir grid nutzen, ist die Reihenfolge linear: index = y * 25 + x
        // Aber sicherer ist Selektor:
        const cell = document.querySelector(`.cell[data-x="${move.x}"][data-y="${move.y}"]`);
        if (cell) cell.classList.add('valid-move');
    });
}

// --- MATHEMATIK: BEWEGUNG ---
function calculateValidMoves(sx, sy) {
    let moves = [];
    
    // Alle Felder belegt? (Map für schnellen Zugriff)
    let occupied = new Set();
    Object.values(currentPlayers).forEach(p => {
        p.pieces.forEach(pos => occupied.add(`${pos.x},${pos.y}`));
    });

    // 1. Einfache Schritte (Nachbarn)
    const neighbors = getNeighbors(sx, sy);
    neighbors.forEach(n => {
        if (!occupied.has(`${n.x},${n.y}`) && isBoardField(n.x, n.y)) {
            moves.push(n);
        }
    });

    // 2. Sprünge (Rekursiv)
    let jumpTargets = getJumps(sx, sy, occupied, new Set([`${sx},${sy}`]));
    moves.push(...jumpTargets);

    return moves;
}

function getNeighbors(x, y) {
    // Im String-Grid ("0 0") sind Nachbarn immer +/- 2 horizontal
    // und +/- 1 vertikal versetzt.
    return [
        {x: x-2, y: y}, {x: x+2, y: y},     // Links/Rechts
        {x: x-1, y: y-1}, {x: x+1, y: y-1}, // Oben L/R
        {x: x-1, y: y+1}, {x: x+1, y: y+1}  // Unten L/R
    ];
}

function getJumps(x, y, occupied, visited) {
    let jumps = [];
    const neighbors = getNeighbors(x, y);

    neighbors.forEach(n => {
        // Ist da ein Stein zum Überspringen?
        if (occupied.has(`${n.x},${n.y}`)) {
            // Das Feld HINTER dem Stein berechnen
            const dx = n.x - x;
            const dy = n.y - y;
            const target = {x: n.x + dx, y: n.y + dy};

            // Ist das Zielfeld frei und auf dem Brett?
            const key = `${target.x},${target.y}`;
            if (!occupied.has(key) && isBoardField(target.x, target.y) && !visited.has(key)) {
                visited.add(key);
                jumps.push(target);
                // Von dort weiter springen?
                jumps.push(...getJumps(target.x, target.y, occupied, visited));
            }
        }
    });
    return jumps;
}

function isBoardField(x, y) {
    if (y < 0 || y >= starMap.length) return false;
    if (x < 0 || x >= starMap[y].length) return false;
    return starMap[y][x] === '0';
}


// --- SOCKET EVENTS & RENDER ---

socket.on('updateBoard', (players) => {
    currentPlayers = players;
    renderPieces();
});

function renderPieces() {
    // Alte Steine weg
    document.querySelectorAll('.piece').forEach(e => e.remove());

    Object.values(currentPlayers).forEach(player => {
        player.pieces.forEach((pos, index) => {
            // Finde die Zelle
            const cell = document.querySelector(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (cell) {
                const piece = document.createElement('div');
                piece.classList.add('piece', player.color);
                
                // Klick Event auf den Stein
                piece.addEventListener('click', (e) => onPieceClick(e, player.color, index));
                
                cell.appendChild(piece);
            }
        });
    });
}

// --- LOBBY & SYSTEM (Vom Original übernommen) ---

const landingView = document.getElementById('landing-view');
const gameView = document.getElementById('game-view');
const landingName = document.getElementById('landingNameInput');
const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const landingMsg = document.getElementById('landing-msg');
const startBtn = document.getElementById('startBtn');

createGameBtn.addEventListener('click', () => {
    const name = landingName.value;
    if(!name) return;
    socket.emit('createGame', name);
});

joinGameBtn.addEventListener('click', () => {
    const name = landingName.value;
    const code = roomCodeInput.value;
    if(!name || !code) return;
    socket.emit('requestJoin', {name, roomId: code});
});

startBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

socket.on('joinSuccess', (data) => {
    landingView.style.display = 'none';
    gameView.style.display = 'block';
    myColor = data.players[data.id].color;
    document.getElementById('current-room-code').innerText = data.roomId;
});

socket.on('gameStarted', () => {
    startBtn.style.display = 'none';
    document.getElementById('log-container').innerText = "Spiel gestartet!";
});

socket.on('turnUpdate', (color) => {
    const nameEl = document.getElementById('current-player-name');
    nameEl.innerText = color.toUpperCase();
    nameEl.style.color = color === 'red' ? '#e74c3c' : '#2ecc71';
});

socket.on('joinError', (msg) => { landingMsg.innerText = msg; });

socket.on('playSound', (type) => {
    if(sounds[type]) sounds[type].play().catch(e=>{});
});

socket.on('gameLog', (msg) => {
    document.getElementById('log-container').innerText = msg;
});

// Emotes
document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => socket.emit('sendEmote', btn.innerText));
});
socket.on('emoteReceived', (emoji) => {
    const el = document.createElement('div');
    el.innerText = emoji;
    el.classList.add('floating-emoji');
    el.style.left = Math.random() * 80 + 10 + '%'; // Random horizontal
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
});
