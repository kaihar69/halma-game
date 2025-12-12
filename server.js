const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Neuer Spieler verbunden: ' + socket.id);

    socket.on('joinGame', (roomName) => {
        const room = io.sockets.adapter.rooms.get(roomName);
        const numClients = room ? room.size : 0;

        if (numClients === 0) {
            socket.join(roomName);
            socket.emit('playerAssignment', 1); 
        } else if (numClients === 1) {
            socket.join(roomName);
            socket.emit('playerAssignment', 2);
            io.to(roomName).emit('player2Joined'); 
        } else {
            socket.emit('error', 'Raum ist voll!');
        }
    });

    socket.on('requestGameStart', (data) => {
        let starter = parseInt(data.startChoice);
        if (data.startChoice === 'random') {
            starter = Math.random() < 0.5 ? 1 : 2;
        }
        io.to(data.roomName).emit('gameStart', starter);
    });

    socket.on('makeMove', (data) => {
        socket.to(data.roomName).emit('opponentMove', data);
    });
});

// --- HIER IST DIE ÄNDERUNG FÜR RENDER ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
