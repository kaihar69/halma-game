function createStartBoard() {
    // Der visuelle Bauplan für einen klassischen Halma-Stern.
    // Wir nutzen hier logische Positionen im Array.
    // Durch den Versatz (Hex-Grid) sieht das hier im Code schief aus,
    // wird aber durch unser 'drawBoard' später perfekt gerade gerückt.
    
    const levelMap = [
        "            2            ", // Zeile 0 (Spitze Oben)
        "           2 2           ", // Zeile 1
        "          2 2 2          ", // Zeile 2
        "         2 2 2 2         ", // Zeile 3
        "0 0 0 0 0 0 0 0 0 0 0 0 0", // Zeile 4 (Der breite Balken)
        " 0 0 0 0 0 0 0 0 0 0 0 0 ", // Zeile 5
        "  0 0 0 0 0 0 0 0 0 0 0  ", // Zeile 6
        "   0 0 0 0 0 0 0 0 0 0   ", // Zeile 7
        "    0 0 0 0 0 0 0 0 0    ", // Zeile 8 (Die Mitte)
        "   0 0 0 0 0 0 0 0 0 0   ", // Zeile 9
        "  0 0 0 0 0 0 0 0 0 0 0  ", // Zeile 10
        " 0 0 0 0 0 0 0 0 0 0 0 0 ", // Zeile 11
        "0 0 0 0 0 0 0 0 0 0 0 0 0", // Zeile 12
        "         1 1 1 1         ", // Zeile 13 (Basis Unten)
        "          1 1 1          ", // Zeile 14
        "           1 1           ", // Zeile 15
        "            1            "  // Zeile 16
    ];

    const newBoard = [];
    
    // Wir wandeln den Text-Plan in echte Zahlen um
    for (let y = 0; y < levelMap.length; y++) {
        const rowString = levelMap[y];
        const rowArray = [];
        
        // Wir gehen jeden Buchstaben durch
        // WICHTIG: Da wir im String Leerzeichen zur Formatierung nutzen,
        // müssen wir das String-Format etwas intelligent parsen.
        // Der Einfachheit halber: Wir nehmen die Map oben wörtlich.
        
        // Bessere Methode: Wir bauen das Array basierend auf den sichtbaren Zeichen
        // Da 'levelMap' oben Leerzeichen enthält, die im Array 'null' sein sollen:
        
        for (let x = 0; x < rowString.length; x++) {
            const char = rowString[x];
            
            if (char === '1') rowArray.push(1);       // Spieler 1
            else if (char === '2') rowArray.push(2);  // Spieler 2
            else if (char === '0') rowArray.push(0);  // Leeres Feld
            else rowArray.push(null);                 // Kein Feld (Lücke)
        }
        
        newBoard.push(rowArray);
    }

    // --- AUTOMATISCHE ZIEL-ERKENNUNG ---
    // Damit Sie die Ziele nicht manuell abtippen müssen, 
    // merken wir uns hier einfach, wo die 1er und 2er am Start standen.
    // Das ist dann automatisch das Ziel für den jeweils ANDEREN.
    detectGoals(newBoard);

    return newBoard;
}

// Hilfsvariable für die Siegbedingung
let goals = { player1: [], player2: [] };

function detectGoals(tempBoard) {
    goals.player1 = [];
    goals.player2 = [];

    for (let y = 0; y < tempBoard.length; y++) {
        for (let x = 0; x < tempBoard[y].length; x++) {
            const val = tempBoard[y][x];
            
            if (val === 2) {
                // Wo jetzt Spieler 2 steht, will Spieler 1 hin!
                goals.player1.push({x, y});
            } else if (val === 1) {
                // Wo jetzt Spieler 1 steht, will Spieler 2 hin!
                goals.player2.push({x, y});
            }
        }
    }
    console.log("Ziele automatisch berechnet, Chef!", goals);
}
