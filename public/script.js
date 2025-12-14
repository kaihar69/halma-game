const socket = io();
const sounds = {
    move: new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'),
    win: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
    click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')
};
Object.values(sounds).forEach(s => s.volume = 0.4);

let myColor = null;
let currentPlayers = {};
let selectedPieceIndex = null;
let validMoves = [];

const rawMap = [
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
const starMap = rawMap.map(row => row.padEnd(25, ' '));
const boardElement = document.getElementById('board');

function initBoard() {
    boardElement.innerHTML = '';
    // Felder generieren
    for (let y = 0; y < starMap.length; y++) {
        const rowStr = starMap[y];
        for (let x = 0; x < rowStr.length; x++) {
            const cell = document.createElement('div');
            if (rowStr[x] === '0') {
                cell.classList.add('cell');
                cell.dataset.x = x;
                cell.dataset.y = y;
                if (y <= 3) cell.classList.add('base-green');
                if (y >= 13) cell.classList.add('base-red');
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

    sounds.click.play().catch(()=>{});

    if (selectedPieceIndex === pieceIndex) {
        clearSelection(); return;
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

// --- LOGIK ---
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
            const dx = n.x - x;
            const dy = n.y - y;
            const target = {x: n.x + dx, y: n.y + dy};
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

// --- RENDER & SOCKET ---
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
                piece.classList.add('piece', player.color);
                if (player.color === myColor) piece.classList.add('mine');
                if (player.color === myColor && selectedPieceIndex === index) piece.classList.add('selected');

                piece.addEventListener('click', (e) => onPieceClick(e, player.color, index));
                cell.appendChild(piece);
            }
        });
    });
}

// --- UI EVENT HANDLER ---
const landingView = document.getElementById('landing-view');
const gameView = document.getElementById('game-view');
const startBtn = document.getElementById('startBtn');

document.getElementById('createGameBtn').addEventListener('click', () => {
    const name = document.getElementById('landingNameInput').value;
    if(name) socket.emit('createGame', name); else document.getElementById('landing-msg').innerText = "Name fehlt!";
});
document.getElementById('joinGameBtn').addEventListener('click', () => {
    const name = document.getElementById('landingNameInput').value;
    const code = document.getElementById('roomCodeInput').value;
    if(name && code) socket.emit('requestJoin', {name, roomId: code}); else document.getElementById('landing-msg').innerText = "Daten fehlen!";
});

startBtn.addEventListener('click', () => socket.emit('startGame'));

socket.on('readyToStart', () => {
    startBtn.style.display = 'inline-block';
    document.getElementById('log-container').innerText = "Warte auf Start...";
});

socket.on('joinSuccess', (data) => {
    landingView.style.display = 'none'; 
    gameView.style.display = 'flex'; 
    myColor = data.players[data.id].color;
    
    const badge = document.getElementById('identity-badge');
    badge.innerText = myColor === 'red' ? "SPIELER ROT" : "SPIELER GRÜN";
    badge.style.color = myColor === 'red' ? "#ffcccc" : "#ccffcc";
    badge.style.borderColor = myColor === 'red' ? "#c0392b" : "#27ae60";

    document.getElementById('current-room-code').innerText = data.roomId;
});

socket.on('gameStarted', () => {
    startBtn.style.display = 'none';
});

socket.on('turnUpdate', (color) => {
    const turnInd = document.getElementById('turn-indicator');
    if (color === myColor) {
        turnInd.innerText = "DU BIST DRAN";
        turnInd.style.color = "#f1c40f";
    } else {
        turnInd.innerText = color === 'red' ? "ROT ZIEHT" : "GRÜN ZIEHT";
        turnInd.style.color = "#888";
    }
});

socket.on('gameLog', (msg) => document.getElementById('log-container').innerText = msg);
socket.on('joinError', (msg) => document.getElementById('landing-msg').innerText = msg);
socket.on('playSound', (type) => { if(sounds[type]) sounds[type].play().catch(()=>{}); });

document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => socket.emit('sendEmote', btn.innerText));
});
socket.on('emoteReceived', (emoji) => {
    const el = document.createElement('div'); el.innerText = emoji;
    el.classList.add('floating-emoji'); el.style.left = Math.random() * 80 + 10 + '%';
    document.body.appendChild(el); setTimeout(() => el.remove(), 3000);
});
