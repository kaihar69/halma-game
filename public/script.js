const socket = io();

// --- SOUNDS ---
// Wir nutzen bessere Platzhalter-Sounds
const sounds = {
    move: new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'), // Plop sound
    win: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),   // Tada sound
    click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')  // Soft click
};
Object.values(sounds).forEach(s => s.volume = 0.6);

// --- GLOBALE VARIABLEN ---
let myColor = null;
let currentPlayers = {};
let selectedPieceIndex = null;
let validMoves = [];

// --- BOARD INITIALISIERUNG ---
const starMap = [
    "            0            ",
    "           0 0           ", 
    "          0 0 0          ", 
    "         0 0 0 0         ", 
    "0 0 0 0 0 0 0 0 0 0 0 0 0",
    " 0 0 0 0 0 0 0 0 0 0 0 0 ", 
    "  0 0 0 0 0 0 0 0 0 0 0  ", 
    "   0 0 0 0 0 0 0 0 0 0   ", 
    "    0 0 0 0 0 0 0 0 0    ",
    "   0 0 0 0 0 0 0 0 0 0   ", 
    "  0 0 0 0 0 0 0 0 0 0 0  ", 
    " 0 0 0 0 0 0 0 0 0 0 0 0 ", 
    "0 0 0 0 0 0 0 0 0 0 0 0 0", 
    "         0 0 0 0         ",
    "          0 0 0          ", 
    "           0 0           ", 
    "            0            " 
];

const boardElement = document.getElementById('board');

function initBoard() {
    boardElement.innerHTML = '';
    for (let y = 0; y < starMap.length; y++) {
        const rowStr = starMap[y];
        for (let x = 0; x < rowStr.length; x++) {
            const cell = document.createElement('div');
            if (rowStr[x] === '0') {
                cell.classList.add('cell');
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.addEventListener('click', () => onCellClick(x, y));
            } else {
                cell.classList.add('cell', 'void');
            }
            boardElement.appendChild(cell);
        }
    }
}
initBoard();

// --- INTERAKTION ---

function onCellClick(x, y) {
    if (selectedPieceIndex !== null) {
        const move = validMoves.find(m => m.x === x && m.y === y);
        if (move) {
            socket.emit('movePiece', { pieceIndex: selectedPieceIndex, target: {x, y} });
            clearSelection();
        } else {
            clearSelection();
        }
    }
}

function onPieceClick(e, playerColor, pieceIndex) {
    e.stopPropagation();
    if (playerColor !== myColor) return;

    sounds.click.play(); // Sound Feedback beim Auswählen

    if (selectedPieceIndex === pieceIndex) {
        clearSelection(); // Abwählen bei erneutem Klick
        return;
    }

    selectedPieceIndex = pieceIndex;
    
    document.querySelectorAll('.piece').forEach(p => p.classList.remove('selected'));
    e.target.classList.add('selected');

    const piecePos = currentPlayers[socket.id].pieces[pieceIndex];
    validMoves = calculateValidMoves(piecePos.x, piecePos.y);
    highlightMoves();
}

function clearSelection() {
    selectedPieceIndex = null;
    validMoves = [];
    document.querySelectorAll('.piece').forEach(p => p.classList.remove('selected'));
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('valid-move'));
}

function highlightMoves() {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('valid-move'));
    validMoves.forEach(move => {
        const cell = document.querySelector(`.cell[data-x="${move.x}"][data-y="${move.y}"]`);
        if (cell) cell.classList.add('valid-move');
    });
}

// --- LOGIK (Unverändert) ---
function calculateValidMoves(sx, sy) {
    let moves = [];
    let occupied = new Set();
    Object.values(currentPlayers).forEach(p => {
        p.pieces.forEach(pos => occupied.add(`${pos.x},${pos.y}`));
    });

    getNeighbors(sx, sy).forEach(n => {
        if (!occupied.has(`${n.x},${n.y}`) && isBoardField(n.x, n.y)) moves.push(n);
    });

    moves.push(...getJumps(sx, sy, occupied, new Set([`${sx},${sy}`])));
    return moves;
}

function getNeighbors(x, y) {
    return [{x:x-2,y:y},{x:x+2,y:y},{x:x-1,y:y-1},{x:x+1,y:y-1},{x:x-1,y:y+1},{x:x+1,y:y+1}];
}

function getJumps(x, y, occupied, visited) {
    let jumps = [];
    getNeighbors(x, y).forEach(n => {
        if (occupied.has(`${n.x},${n.y}`)) {
            const target = {x: n.x + (n.x - x), y: n.y + (n.y - y)};
            const key = `${target.x},${target.y}`;
            if (!occupied.has(key) && isBoardField(target.x, target.y) && !visited.has(key)) {
                visited.add(key);
                jumps.push(target);
                jumps.push(...getJumps(target.x, target.y, occupied, visited));
            }
        }
    });
    return jumps;
}

function isBoardField(x, y) {
    return y >= 0 && y < starMap.length && x >= 0 && x < starMap[y].length && starMap[y][x] === '0';
}

// --- RENDERING (Angepasst für neue Klassen) ---

socket.on('updateBoard', (players) => {
    currentPlayers = players;
    renderPieces();
});

function renderPieces() {
    document.querySelectorAll('.piece').forEach(e => e.remove());
    Object.values(currentPlayers).forEach(player => {
        player.pieces.forEach((pos, index) => {
            const cell = document.querySelector(`.cell[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (cell) {
                const piece = document.createElement('div');
                // WICHTIG: Die Farb-Klasse (red/green) wird hier hinzugefügt
                piece.classList.add('piece', player.color);
                
                // Wenn dieser Stein gerade ausgewählt ist, Klasse wieder hinzufügen
                if (myColor === player.color && selectedPieceIndex === index) {
                    piece.classList.add('selected');
                }

                piece.addEventListener('click', (e) => onPieceClick(e, player.color, index));
                cell.appendChild(piece);
            }
        });
    });
}

socket.on('playSound', (type) => { if(sounds[type]) sounds[type].play().catch(()=>{}); });

// --- LOBBY (Unverändert) ---
const landingView = document.getElementById('landing-view');
const gameView = document.getElementById('game-view');
const landingName = document.getElementById('landingNameInput');
const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const landingMsg = document.getElementById('landing-msg');
const startBtn = document.getElementById('startBtn');

createGameBtn.addEventListener('click', () => {
    const name = landingName.value; if(!name) { landingMsg.innerText="Name fehlt!"; return;}
    socket.emit('createGame', name);
});
joinGameBtn.addEventListener('click', () => {
    const name = landingName.value; const code = roomCodeInput.value;
    if(!name || !code) { landingMsg.innerText="Daten fehlen!"; return;}
    socket.emit('requestJoin', {name, roomId: code});
});
startBtn.addEventListener('click', () => socket.emit('startGame'));

socket.on('joinSuccess', (data) => {
    landingView.style.display = 'none'; gameView.style.display = 'block';
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
    nameEl.style.color = color === 'red' ? '#ff6b6b' : '#5ecc71';
});
socket.on('joinError', (msg) => { landingMsg.innerText = msg; });
socket.on('gameLog', (msg) => { document.getElementById('log-container').innerText = msg; });

document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => socket.emit('sendEmote', btn.innerText));
});
socket.on('emoteReceived', (emoji) => {
    const el = document.createElement('div'); el.innerText = emoji;
    el.classList.add('floating-emoji'); el.style.left = Math.random() * 80 + 10 + '%';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
});
