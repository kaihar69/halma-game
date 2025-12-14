const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// --- HALMA KONFIGURATION ---
const TURN_ORDER = ['red', 'green'];

// Startpositionen für 2 Spieler (17x25 Grid)
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

// Sieg-Zonen (Das Ziel ist das Haus des Gegners)
const WIN_ZONES = {
    'red': START_POSITIONS['green'],
    'green': START_POSITIONS['red']
};

let games = {}; 

io.on('connection', (socket) => {
    
    // Spiel erstellen
    socket.on('createGame', (playerName) => {
        const roomId = generateRoomId();
        games[roomId] = createNewGame();
        joinRoom(socket, roomId, playerName);
    });

    // Beitreten
    socket.on('requestJoin', (data) => {
        const roomId = (data.roomId || "").toUpperCase();
        if (!games[roomId]) { socket.emit('joinError', 'Raum nicht gefunden!'); return; }
        if (Object.keys(games[roomId].players).length >= 2) { socket.emit('joinError', 'Raum ist voll!'); return; }
        joinRoom(socket, roomId, data.name);
    });

    // STARTEN
    socket.on('startGame', () => {
        const roomId = socket.data.roomId;
        if(roomId && games[roomId]) {
            games[roomId].running = true;
            io.to(roomId).emit('gameStarted');
            io.to(roomId).emit('gameLog', 'LOS GEHTS! Rot beginnt.');
            io.to(roomId).emit('turnUpdate', TURN_ORDER[games[roomId].turnIndex]);
        }
    });

    // ZUG MACHEN
    socket.on('movePiece', (data) => {
        const roomId = socket.data.roomId;
        if (!roomId || !games[roomId]) return;

        const game = games[roomId];
        const player = game.players[socket.id];

        if (!game.running) { socket.emit('gameLog', 'Spiel muss erst gestartet werden!'); return; }
        if (player.color !== TURN_ORDER[game.turnIndex]) { socket.emit('gameLog', 'Nicht dein Zug!'); return; }

        // Zug anwenden
        player.pieces[data.pieceIndex] = data.target;

        // Sieg prüfen
        if (checkWin(player)) {
            io.to(roomId).emit('gameLog', `${player.name} GEWINNT! 🏆`);
            io.to(roomId).emit('playSound', 'win');
            game.running = false;
        } else {
            io.to(roomId).emit('playSound', 'move');
            game.turnIndex = (game.turnIndex + 1) % 2;
        }

        io.to(roomId).emit('updateBoard', game.players);
        io.to(roomId).emit('turnUpdate', TURN_ORDER[game.turnIndex]);
    });

    socket.on('sendEmote', (emoji) => {
        const roomId = socket.data.roomId;
        if(roomId) io.to(roomId).emit('emoteReceived', emoji);
    });

    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        if (roomId && games[roomId]) {
            delete games[roomId].players[socket.id];
            if (Object.keys(games[roomId].players).length === 0) delete games[roomId];
        }
    });
});

function createNewGame() {
    return { players: {}, turnIndex: 0, running: false };
}

function joinRoom(socket, roomId, playerName) {
    const game = games[roomId];
    socket.join(roomId);
    socket.data.roomId = roomId;

    const playerIdx = Object.keys(game.players).length;
    const color = TURN_ORDER[playerIdx];
    
    const myPieces = JSON.parse(JSON.stringify(START_POSITIONS[color]));

    game.players[socket.id] = {
        id: socket.id,
        name: playerName || `Spieler ${playerIdx+1}`,
        color: color,
        pieces: myPieces
    };

    socket.emit('joinSuccess', { id: socket.id, roomId: roomId, players: game.players });
    io.to(roomId).emit('updateBoard', game.players);
    
    // Ermöglicht Solo-Test und Spielstart
    io.to(roomId).emit('readyToStart', true);
}

function checkWin(player) {
    const targetZone = WIN_ZONES[player.color];
    let count = 0;
    player.pieces.forEach(p => {
        if (targetZone.some(t => t.x === p.x && t.y === p.y)) count++;
    });
    return count === 10;
}

function generateRoomId() { return Math.random().toString(36).substring(2, 6).toUpperCase(); }

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server läuft auf ${PORT}`));
