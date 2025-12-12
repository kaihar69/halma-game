const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- GLOBALE VARIABLEN ---
let board = [];
let myPlayerId = null;
let isMyTurn = false;
let currentRoom = "";
let tileSize, offsetX, offsetY;
let selectedPiece = null;
let validMoves = [];
let shouldRotateBoard = false;
let goals = { player1: [], player2: [] };

// --- BUTTONS SICHER VERKABELN (DER FIX) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Join Button
    const btnJoin = document.getElementById('btnJoin');
    if (btnJoin) {
        btnJoin.addEventListener('click', () => {
            const input = document.getElementById('roomInput');
            if (input.value) joinRoom(input.value);
        });
    }

    // Start Button
    const btnStart = document.getElementById('btnStart');
    if (btnStart) {
        btnStart.addEventListener('click', sendStartSignal);
    }
    
    // Init game setup
    initGame();
});


// --- NETZWERK & LOBBY ---

function joinRoom(roomName) {
    currentRoom = roomName;
    socket.emit('joinGame', currentRoom);
    document.getElementById('joinControls').style.display = 'none';
    document.getElementById('statusMsg').innerText = "Verbinde...";
}

function sendStartSignal() {
    const choice = document.getElementById('startSelection').value;
    socket.emit('requestGameStart', { 
        roomName: currentRoom, 
        startChoice: choice 
    });
}

socket.on('playerAssignment', (id) => {
    myPlayerId = id;
    shouldRotateBoard = (id === 2); // Spieler 2 sieht das Brett gedreht
    
    const msg = id === 1 ? "Warte auf Gegner..." : "Warte auf Spielstart durch Host...";
    document.getElementById('statusMsg').innerText = msg;
    
    resizeGame(); // Einmal neu zeichnen
});

socket.on('player2Joined', () => {
    if (myPlayerId === 1) {
        document.getElementById('adminControls').style.display = 'block';
        document.getElementById('statusMsg').innerText = "Gegner ist da! Bitte Start wählen.";
    } else {
        document.getElementById('statusMsg').innerText = "Gegner (Host) wählt Einstellungen...";
    }
});

socket.on('gameStart', (starterId) => {
    document.getElementById('lobbyScreen').style.display = 'none';
    isMyTurn = (myPlayerId === starterId);
    
    const text = isMyTurn ? "Du bist dran!" : "Gegner beginnt.";
    alert("Spiel startet! " + text);
    
    drawBoard(board);
});

socket.on('opponentMove', (data) => {
    // Zug anwenden
    board[data.from.y][data.from.x] = 0;
    board[data.to.y][data.to.x] = data.player;
    
    // Prüfen ob Gegner gewonnen hat
    if(checkWin(data.player)) { 
        setTimeout(() => alert("Der Gegner hat gewonnen!"), 100);
    }
    
    isMyTurn = true; // Jetzt bin ich dran
    drawBoard(board);
});

socket.on('error', (msg) => {
    alert("Fehler: " + msg);
    document.getElementById('joinControls').style.display = 'block';
});


// --- INITIALISIERUNG ---

function initGame() {
    board = createStartBoard();
    resizeGame();
}

function createStartBoard() {
    // 0=Leer, 1=Spieler1, 2=Spieler2, null=Kein Feld
    // Einfache Visualisierung im Code (Leerzeichen = null)
    const levelMap = [
        "            2            ", 
        "           2 2           ",
        "          2 2 2          ",
        "         2 2 2 2         ",
        "0 0 0 0 0 0 0 0 0 0 0 0 0",
        " 0 0 0 0 0 0 0 0 0 0 0 0 ",
        "  0 0 0 0 0 0 0 0 0 0 0  ",
        "   0 0 0 0 0 0 0 0 0 0   ",
        "    0 0 0 0 0 0 0 0 0    ",
        "   0 0 0 0 0 0 0 0 0 0   ",
        "  0 0 0 0 0 0 0 0 0 0 0  ",
        " 0 0 0 0 0 0 0 0 0 0 0 0 ",
        "0 0 0 0 0 0 0 0 0 0 0 0 0",
        "         1 1 1 1         ",
        "          1 1 1          ",
        "           1 1           ",
        "            1            " 
    ];

    const newBoard = [];
    goals.player1 = [];
    goals.player2 = [];

    for (let y = 0; y < levelMap.length; y++) {
        const rowString = levelMap[y];
        const rowArray = [];
        for (let x = 0; x < rowString.length; x++) {
            const char = rowString[x];
            let val = null;
            if (char === '1') { val = 1; goals.player2.push({x,y}); } // P1 steht hier -> Ziel für P2
            else if (char === '2') { val = 2; goals.player1.push({x,y}); } // P2 steht hier -> Ziel für P1
            else if (char === '0') { val = 0; }
            
            rowArray.push(val);
        }
        newBoard.push(rowArray);
    }
    return newBoard;
}


// --- GRAFIK & INPUT ---

window.addEventListener('resize', resizeGame);

function resizeGame() {
    // Maximale Breite begrenzen (Desktop) oder voll (Mobile)
    const size = Math.min(window.innerWidth, 600);
    canvas.width = size;
    canvas.height = size;
    
    // 17 Spalten + Rand
    tileSize = size / 19; 
    offsetX = tileSize;
    offsetY = tileSize;
    
    drawBoard(board);
}

// Input Handler (Maus & Touch)
function handleInput(clientX, clientY) {
    if (!isMyTurn || !myPlayerId) return; // Nur wenn man dran ist
    
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    
    const clickedField = getFieldFromPixels(mx, my);
    
    if (clickedField) {
        onFieldClicked(clickedField.x, clickedField.y);
    }
}

canvas.addEventListener('mousedown', e => handleInput(e.clientX, e.clientY));
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handleInput(e.touches[0].clientX, e.touches[0].clientY);
}, {passive: false});


// --- ZEICHNEN ---

function getVisualCoords(logicX, logicY) {
    // Wenn Rotation an ist (Spieler 2), drehen wir die Logik um
    if (shouldRotateBoard) {
        return { x: 16 - logicX, y: 16 - logicY }; // Bei 17 Zeilen (0-16)
    }
    return { x: logicX, y: logicY };
}

function drawBoard(currentBoard) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < currentBoard.length; y++) {
        for (let x = 0; x < currentBoard[y].length; x++) {
            const cell = currentBoard[y][x];
            if (cell === null) continue;

            // Koordinaten berechnen
            const visual = getVisualCoords(x, y);
            
            let px = visual.x * tileSize + offsetX;
            let py = visual.y * (tileSize * 0.9) + offsetY;
            
            // Hex-Versatz basierend auf der visuellen Zeile
            if (visual.y % 2 !== 0) px += (tileSize / 2);

            // Loch malen
            drawCircle(px, py, tileSize/3, '#ccc');

            // Stein malen
            if (cell === 1) drawCircle(px, py, tileSize/2.5, 'red');
            if (cell === 2) drawCircle(px, py, tileSize/2.5, 'green');

            // Auswahl Highlight
            if (selectedPiece && selectedPiece.x === x && selectedPiece.y === y) {
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'gold';
                ctx.beginPath();
                ctx.arc(px, py, tileSize/2.2, 0, Math.PI*2);
                ctx.stroke();
            }

            // Mögliche Züge Highlight
            const isTarget = validMoves.some(m => m.x === x && m.y === y);
            if (isTarget) {
                drawCircle(px, py, tileSize/5, 'rgba(0,0,0,0.5)');
            }
        }
    }
}

function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
}

function getFieldFromPixels(mx, my) {
    // Rückwärtssuche durch das Grid
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] === null) continue;

            const visual = getVisualCoords(x, y);
            let px = visual.x * tileSize + offsetX;
            let py = visual.y * (tileSize * 0.9) + offsetY;
            if (visual.y % 2 !== 0) px += (tileSize / 2);

            const dist = Math.sqrt((mx-px)**2 + (my-py)**2);
            if (dist < tileSize/2) {
                return { x, y };
            }
        }
    }
    return null;
}


// --- SPIELLOGIK ---

function onFieldClicked(x, y) {
    const cell = board[y][x];

    // Fall 1: Auswählen (Eigener Stein)
    if (cell === myPlayerId) {
        selectedPiece = {x, y};
        validMoves = getValidMoves(x, y, board);
        drawBoard(board);
        return;
    }

    // Fall 2: Bewegen (wenn ausgewählt)
    if (selectedPiece) {
        const isMove = validMoves.find(m => m.x === x && m.y === y);
        if (isMove) {
            executeMove(selectedPiece, {x, y});
        } else {
            // Klick ins Leere oder auf Gegner -> Abwählen
            selectedPiece = null;
            validMoves = [];
            drawBoard(board);
        }
    }
}

function executeMove(from, to) {
    // Lokal update
    board[from.y][from.x] = 0;
    board[to.y][to.x] = myPlayerId;
    
    // Server informieren
    socket.emit('makeMove', {
        roomName: currentRoom,
        from: from,
        to: to,
        player: myPlayerId
    });

    // Reset
    selectedPiece = null;
    validMoves = [];
    isMyTurn = false;
    
    // Sieg Check
    if (checkWin(myPlayerId)) {
        setTimeout(() => alert("Gewonnen!"), 100);
    }
    
    drawBoard(board);
}

function getValidMoves(sx, sy, currentBoard) {
    const moves = [];
    
    // 1. Nachbarn (Schrittweite 1)
    const neighbors = getNeighborCoordsAll(sx, sy);
    for (let n of neighbors) {
        if (isValid(n.x, n.y) && currentBoard[n.y][n.x] === 0) {
            moves.push(n);
        }
    }

    // 2. Kettensprünge
    const jumps = getJumpsRecursively(sx, sy, currentBoard, new Set([`${sx},${sy}`]));
    moves.push(...jumps);
    
    return moves;
}

function getJumpsRecursively(x, y, brd, visited) {
    let targets = [];
    
    // Alle 6 Richtungen prüfen
    for (let dir = 0; dir < 6; dir++) {
        // Der Nachbar (Bock)
        const mid = getNeighborInDir(x, y, dir);
        
        if (isValid(mid.x, mid.y)) {
            const midVal = brd[mid.y][mid.x];
            // Wenn da wer steht...
            if (midVal !== 0 && midVal !== null) {
                // ... Ziel dahinter berechnen
                const dest = getNeighborInDir(mid.x, mid.y, dir);
                
                if (isValid(dest.x, dest.y) && brd[dest.y][dest.x] === 0) {
                    const key = `${dest.x},${dest.y}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        targets.push(dest);
                        // Rekursion
                        targets = targets.concat(getJumpsRecursively(dest.x, dest.y, brd, visited));
                    }
                }
            }
        }
    }
    return targets;
}

// Hilfsfunktionen für Koordinaten
function isValid(x, y) {
    return y >= 0 && y < board.length && x >= 0 && x < board[y].length && board[y][x] !== null;
}

function getNeighborCoordsAll(x, y) {
    const res = [];
    for(let i=0; i<6; i++) {
        const n = getNeighborInDir(x, y, i);
        if(isValid(n.x, n.y)) res.push(n);
    }
    return res;
}

function getNeighborInDir(x, y, dir) {
    const isEven = (y % 2 === 0);
    let dirs;
    if (isEven) {
        // Gerade Reihen: (TopL, TopR, R, BotR, BotL, L)
        dirs = [[-1,-1], [0,-1], [1,0], [0,1], [-1,1], [-1,0]];
    } else {
        // Ungerade Reihen
        dirs = [[0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,0]];
    }
    return { x: x + dirs[dir][0], y: y + dirs[dir][1] };
}

function checkWin(player) {
    // Weiche Regel: Zielgebiet prüfen
    let targetArr = (player === 1) ? goals.player1 : goals.player2;
    let filledCount = 0;
    const opponent = (player === 1) ? 2 : 1;

    for (let t of targetArr) {
        const val = board[t.y][t.x];
        // Feld gilt als erledigt, wenn ICH drin bin ODER der Gegner blockiert
        if (val === player || val === opponent) {
            filledCount++;
        }
    }
    // Klassisch 10 Steine
    return filledCount === 10;
}
