const socket = io();
const sounds = {
    move: new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'),
    win: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
    click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')
};

let myColor = null;
let currentPlayers = {};
let selectedPieceIndex = null;
let validMoves = [];

// --- BRETT STRUKTUR ---
// Wir stellen sicher, dass jede Zeile exakt 25 Zeichen lang ist
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
// Auffüllen mit Leerzeichen, falls beim Kopieren was verloren ging
const starMap = rawMap.map(row => row.padEnd(25, ' '));

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

                if (y <= 3) cell.classList.add('base-green');
                if (y >= 13) cell.classList.add('base-red');

                // Klick auf das Loch (um Stein zu bewegen)
                cell.addEventListener('click', () => onCellClick(x, y));
            } else {
                cell.classList.add('cell', 'void');
            }
            boardElement.appendChild(cell);
        }
    }
}
initBoard();

// --- ZUG-INTERAKTION ---

function onCellClick(x, y) {
    console.log(`Klick auf Zelle: ${x}, ${y}`);
    
    // Wenn ich einen Stein ausgewählt habe...
    if (selectedPieceIndex !== null) {
        // ...prüfe ich, ob das angeklickte Feld in den erlaubten Zügen ist
        const move = validMoves.find(m => m.x === x && m.y === y);
        
        if (move) {
            console.log("Gültiger Zug! Sende an Server...");
            socket.emit('movePiece', { pieceIndex: selectedPieceIndex, target: {x, y} });
            clearSelection();
        } else {
            console.log("Ungültiges Ziel.");
            clearSelection(); // Klick ins Leere hebt Auswahl auf
        }
    }
}

function onPieceClick(e, playerColor, pieceIndex) {
    e.stopPropagation(); // Wichtig: Nicht das Cell-Click Event feuern!
    console.log(`Klick auf Stein: ${playerColor}, Index: ${pieceIndex}. Ich bin: ${myColor}`);

    if (playerColor !== myColor) {
        console.log("Nicht mein Stein.");
        return;
    }

    sounds.click.play().catch(()=>{});

    // Toggle Auswahl
    if (selectedPieceIndex === pieceIndex) {
        clearSelection();
        return;
    }

    selectedPieceIndex = pieceIndex;
    
    // Visuelles Feedback
    document.querySelectorAll('.piece').forEach(p => p.classList.remove('selected'));
    e.target.classList.add('selected');

    // Mögliche Züge berechnen
    const piecePos = currentPlayers[socket.id].pieces[pieceIndex];
    validMoves = calculateValidMoves(piecePos.x, piecePos.y);
    console.log(`Mögliche Züge für diesen Stein:`, validMoves);
    
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

// --- LOGIK: BEWEGUNG & SPRÜNGE ---

function calculateValidMoves(sx, sy) {
    let moves = [];
    let occupied = new Set();
    
    // Wo stehen alle Steine?
    Object.values(currentPlayers).forEach(p => {
        p.pieces.forEach(pos => occupied.add(`${pos.x},${pos.y}`));
    });

    // 1. Nachbarn prüfen (Gehen)
    getNeighbors(sx, sy).forEach(n => {
        // Wenn Nachbar auf Brett UND NICHT besetzt -> Gehen erlaubt
        if (!occupied.has(`${n.x},${n.y}`) && isBoardField(n.x, n.y)) {
            moves.push(n);
        }
    });

    // 2. Sprünge prüfen (Rekursiv)
    moves.push(...getJumps(sx, sy, occupied, new Set([`${sx},${sy}`])));
    
    return moves;
}

function getNeighbors(x, y) {
    // Halma Gitter Versatz Logik
    return [
        {x:x-2, y:y}, {x:x+2, y:y},     // Horizontal
        {x:x-1, y:y-1}, {x:x+1, y:y-1}, // Oben
        {x:x-1, y:y+1}, {x:x+1, y:y+1}  // Unten
    ];
}

function getJumps(x, y, occupied, visited) {
    let jumps = [];
    getNeighbors(x, y).forEach(n => {
        // Ist da ein Stein ("Bock")?
        if (occupied.has(`${n.x},${n.y}`)) {
            // Landeplatz dahinter berechnen
            const dx = n.x - x;
            const dy = n.y - y;
            const target = {x: n.x + dx, y: n.y + dy};
            const key = `${target.x},${target.y}`;

            // Ist Landeplatz frei, auf dem Brett und noch nicht besucht?
            if (!occupied.has(key) && isBoardField(target.x, target.y) && !visited.has(key)) {
                visited.add(key);
                jumps.push(target);
                // Von hier aus weiter springen (Kette)?
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


// --- SOCKET & UI ---

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

// --- MENÜ STEUERUNG ---
const landingView = document.getElementById('landing-view');
const gameView = document.getElementById('game-view');
const startBtn = document.getElementById('startBtn');

document.getElementById('createGameBtn').addEventListener('click', () => {
    const name = document.getElementById('landingNameInput').value;
    if(name) socket.emit('createGame', name);
});
document.getElementById('joinGameBtn').addEventListener('click', () => {
    const name = document.getElementById('landingNameInput').value;
    const code = document.getElementById('roomCodeInput').value;
    if(name && code) socket.emit('requestJoin', {name, roomId: code});
});

startBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

// WICHTIG: Server sagt, wir dürfen starten
socket.on('readyToStart', () => {
    startBtn.style.display = 'inline-block';
    document.getElementById('log-container').innerText = "Bereit zum Start!";
});

socket.on('joinSuccess', (data) => {
    landingView.style.display = 'none'; 
    gameView.style.display = 'block';
    myColor = data.players[data.id].color;
    
    // UI Updates
    const badge = document.getElementById('identity-badge');
    const myColorEl = document.getElementById('my-color-display');
    if(myColor === 'red') {
        myColorEl.innerText = "ROT (Unten)";
        badge.style.border = "2px solid #c0392b";
    } else {
        myColorEl.innerText = "GRÜN (Oben)";
        badge.style.border = "2px solid #27ae60";
    }
    document.getElementById('current-room-code').innerText = data.roomId;
});

socket.on('gameStarted', () => {
    startBtn.style.display = 'none';
});

socket.on('turnUpdate', (color) => {
    const nameEl = document.getElementById('current-player-name');
    nameEl.innerText = color === 'red' ? "ROT" : "GRÜN";
    nameEl.style.color = color === 'red' ? "#c0392b" : "#27ae60";
    
    const logEl = document.getElementById('log-container');
    if (color === myColor) {
        logEl.innerText = "Du bist am Zug!";
        logEl.style.color = "#d35400";
    } else {
        logEl.innerText = "Gegner zieht...";
        logEl.style.color = "#7f8c8d";
    }
});

socket.on('gameLog', (msg) => { document.getElementById('log-container').innerText = msg; });
socket.on('playSound', (type) => { if(sounds[type]) sounds[type].play().catch(()=>{}); });

document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => socket.emit('sendEmote', btn.innerText));
});
socket.on('emoteReceived', (emoji) => {
    const el = document.createElement('div'); el.innerText = emoji;
    el.classList.add('floating-emoji'); el.style.left = Math.random() * 80 + 10 + '%';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
});
