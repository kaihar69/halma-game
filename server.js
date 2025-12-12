const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Neuer Spieler: ' + socket.id);

    // Raum betreten
    socket.on('joinGame', (roomName) => {
        const room = io.sockets.adapter.rooms.get(roomName);
        const numClients = room ? room.size : 0;

        if (numClients === 0) {
            socket.join(roomName);
            socket.emit('playerAssignment', 1); // Host
        } else if (numClients === 1) {
            socket.join(roomName);
            socket.emit('playerAssignment', 2); // Gast
            io.to(roomName).emit('player2Joined'); // Info an alle
        } else {
            socket.emit('error', 'Raum ist voll!');
        }
    });

    // Spiel starten (vom Host)
    socket.on('requestGameStart', (data) => {
        let starter = parseInt(data.startChoice);
        // Zufall
        if (data.startChoice === 'random') {
            starter = Math.random() < 0.5 ? 1 : 2;
        }
        // Alle informieren
        io.to(data.roomName).emit('gameStart', starter);
    });

    // Zug machen
    socket.on('makeMove', (data) => {
        // Den Zug an den Gegner weiterleiten
        socket.to(data.roomName).emit('opponentMove', data);
    });
});

// WICHTIG für Render: Port dynamisch nehmen
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
