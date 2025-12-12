const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.static('public'));

// --- HALMA KONFIGURATION ---
// Wir unterstützen hier erst mal 2 Spieler (Red vs Green) für den Start
const TURN_ORDER = ['red', 'green'];
const DATA_FILE = 'halma_state.json';

// GLOBALE SPIELVERWALTUNG
let games = {}; 

// Startaufstellung für 2 Spieler (Spitze unten vs Spitze oben)
// Ein 17x17 Grid wird angenommen
const START_POSITIONS = {
    'red': [ // Unten (Spitze)
        {x: 12, y: 16}, 
        {x: 11, y: 15}, {x: 13, y: 15},
        {x: 10, y: 14}, {x: 12, y: 14}, {x: 14, y: 14},
        {x: 9, y: 13},  {x: 11, y: 13}, {x: 13, y: 13}, {x: 15, y: 13}
    ],
    'green': [ // Oben (Spitze)
        {x: 12, y: 0},
        {x: 11, y: 1}, {x: 13, y: 1},
        {x: 10, y: 2}, {x: 12, y: 2}, {x: 14, y: 2},
        {x: 9, y: 3},  {x: 11, y: 3}, {x: 13, y: 3}, {x: 15, y: 3}
    ]
};

// Ziel-Zonen definieren (Für Siegbedingung)
const WIN_ZONES = {
    'red': START_POSITIONS['green'], // Rot will dahin, wo Grün startet
    'green': START_POSITIONS['red']  // Grün will dahin, wo Rot startet
};

io.on('connection', (socket) => {
    
    // --- LOBBY LOGIK (Identisch zu MADN) ---
    socket.on('createGame', (playerName) => {
        const roomId = generateRoomId();
        games[roomId] = createNewGame();
        joinRoom(socket, roomId, playerName);
    });

    socket.on('requestJoin', (data) => {
        const roomId = (data.roomId || "").toUpperCase();
        if (!games[roomId]) { socket.emit('joinError', 'Raum nicht gefunden!'); return; }
        if (Object.keys(games[roomId].players).length >= 2) { socket.emit('joinError', 'Raum ist voll (Max 2)!'); return; }
        joinRoom(socket, roomId, data.name);
    });

    socket.on('startGame', () => {
        const roomId = socket.data.roomId;
        if(roomId && games[roomId]) {
            games[roomId].running = true;
            io.to(roomId).emit('gameStarted');
            io.to(roomId).emit('turnUpdate', TURN_ORDER[games[roomId].turnIndex]);
        }
    });

    // --- HALMA SPIELZÜGE ---
    socket.on('movePiece', (data) => {
        const roomId = socket.data.roomId;
        if (!roomId || !games[roomId]) return;

        const game = games[roomId];
        const player = game.players[socket.id];

        // 1. Validierung: Ist der Spieler dran?
        if (!game.running) return;
        if (player.color !== TURN_ORDER[game.turnIndex]) return;

        // data enthält: { fromIndex: 0, to: {x,y} }
        const pieceIndex = data.pieceIndex;
        const target = data.target; // {x, y}

        // 2. Zug ausführen (Wir vertrauen hier der Client-Validierung für den Fluss)
        // Update der Position
        player.pieces[pieceIndex] = target;

        // 3. Siegprüfung
        if (checkWin(player)) {
            io.to(roomId).emit('gameLog', `${player.name} HAT GEWONNEN! 🏆`);
            io.to(roomId).emit('playSound', 'win');
            game.running = false;
        } else {
            io.to(roomId).emit('playSound', 'move');
            // Spielerwechsel
            game.turnIndex = (game.turnIndex + 1) % 2;
        }

        // 4. Update an alle
        io.to(roomId).emit('updateBoard', game.players);
        io.to(roomId).emit('turnUpdate', TURN_ORDER[game.turnIndex]);
    });

    // --- EMOTES ---
    socket.on('sendEmote', (emoji) => {
        const roomId = socket.data.roomId;
        if(roomId) io.to(roomId).emit('emoteReceived', emoji);
    });

    socket.on('disconnect', () => {
        // Einfaches Cleanup für dieses Beispiel
        const roomId = socket.data.roomId;
        if (roomId && games[roomId]) {
            delete games[roomId].players[socket.id];
            if (Object.keys(games[roomId].players).length === 0) delete games[roomId];
        }
    });
});

// --- HELPER FUNCTIONS ---
function createNewGame() {
    return { players: {}, turnIndex: 0, running: false };
}

function joinRoom(socket, roomId, playerName) {
    const game = games[roomId];
    socket.join(roomId);
    socket.data.roomId = roomId;

    // Farbe zuweisen (0=Rot, 1=Grün)
    const playerIdx = Object.keys(game.players).length;
    const color = TURN_ORDER[playerIdx];

    // Kopie der Startpositionen erstellen
    const myPieces = JSON.parse(JSON.stringify(START_POSITIONS[color]));

    game.players[socket.id] = {
        id: socket.id,
        name: playerName || `Spieler ${playerIdx+1}`,
        color: color,
        pieces: myPieces
    };

    socket.emit('joinSuccess', { id: socket.id, roomId: roomId, players: game.players });
    io.to(roomId).emit('updateBoard', game.players);
    
    // Wenn 2 Spieler da sind, Info update
    if (Object.keys(game.players).length === 2) {
        io.to(roomId).emit('gameLog', 'Bereit zum Start!');
    }
}

function checkWin(player) {
    const targetZone = WIN_ZONES[player.color];
    // Zählen, wie viele Steine im Ziel sind
    let count = 0;
    player.pieces.forEach(p => {
        // Ist p in targetZone enthalten?
        const isIn = targetZone.some(t => t.x === p.x && t.y === p.y);
        if (isIn) count++;
    });
    // Tolerante Regel: Wenn 10 Steine im Ziel (oder blockiert durch Gegner) -> Sieg
    // Hier vereinfacht: Wenn alle 10 Positionen erreicht sind.
    return count === 10;
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Halma Server läuft auf Port ${PORT}`));
