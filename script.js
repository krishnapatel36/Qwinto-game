// --- Game Configurations & State ---
let gameMode = 'PvP';
let players = [];
let activePlayerIndex = 0;   // The player who actually rolled the dice
let evaluationPhase = 0;     // Tracks who is currently looking at the board to place the number
let currentRollTotal = 0;
let activeColorsRolled = [];
let hasRolledThisTurn = false;
let isTransitioning = false;
let activePlayerPlaced = false; // Tracks if the roller used the number

const rowLayouts = {
    orange: [1, 2, 1, 0, 1, 2, 1, 1, 1, 1], 
    yellow: [1, 1, 1, 1, 1, 0, 1, 2, 1, 1],
    purple: [1, 1, 2, 1, 0, 1, 1, 1, 1, 2]
};

class Player {
    constructor(name, isAi = false) {
        this.name = name;
        this.isAi = isAi;
        this.missteps = 0;
        this.boards = {
            orange: Array(10).fill(null),
            yellow: Array(10).fill(null),
            purple: Array(10).fill(null)
        };
        this.score = 0;
    }
}

function startGame(mode) {
    gameMode = mode;
    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('statusBanner').style.display = 'block';
    document.getElementById('dicePanel').style.display = 'flex';
    
    players = [new Player("Player 1")];
    if (mode === 'PvP') {
        players.push(new Player("Player 2"));
    } else {
        players.push(new Player("Qwinto AI", true));
    }

    activePlayerIndex = 0;
    startNewTurnCycle();
}

function startNewTurnCycle() {
    hasRolledThisTurn = false;
    activePlayerPlaced = false;
    evaluationPhase = activePlayerIndex; // The roller always evaluates first
    
    document.getElementById('rollResult').innerText = "-";
    document.getElementById('rollBtn').disabled = false;
    document.getElementById('passBtn').style.display = 'block';
    document.getElementById('passBtn').innerText = "Pass Turn";
    
    const activePlayer = players[activePlayerIndex];
    document.getElementById('statusBanner').innerText = `${activePlayer.name}'s Turn to Roll!`;
    
    document.querySelectorAll('.die').forEach(d => d.classList.add('selected'));
    renderActiveBoard();

    if (activePlayer.isAi) {
        setTimeout(executeAiTurn, 1000);
    }
}

function toggleDie(dieEl) {
    if (hasRolledThisTurn || isTransitioning) return;
    dieEl.classList.toggle('selected');
}

function rollDice() {
    const selectedDice = document.querySelectorAll('.die.selected');
    if(selectedDice.length === 0) {
        alert("Select at least one die color to roll!");
        return;
    }

    activeColorsRolled = [];
    currentRollTotal = 0;

    selectedDice.forEach(die => {
        const color = die.getAttribute('data-color');
        const val = Math.floor(Math.random() * 6) + 1;
        currentRollTotal += val;
        activeColorsRolled.push(color);
    });

    document.getElementById('rollResult').innerText = currentRollTotal;
    hasRolledThisTurn = true;
    document.getElementById('rollBtn').disabled = true;

    promptCurrentEvaluatingPlayer();
}

function promptCurrentEvaluatingPlayer() {
    const evaluatingPlayer = players[evaluationPhase];
    
    if (evaluationPhase === activePlayerIndex) {
        // The player who rolled must use it or take a penalty
        document.getElementById('passBtn').innerText = "Take Misstep Penalty";
        document.getElementById('statusBanner').innerText = 
            `[ROLLER] ${evaluatingPlayer.name}: You rolled ${currentRollTotal}! Place it on a valid cell or accept a Misstep penalty.`;
    } else {
        // The passive player gets a free optional choice
        document.getElementById('passBtn').innerText = "Skip / Do Nothing";
        document.getElementById('statusBanner').innerText = 
            `[PASSIVE] ${evaluatingPlayer.name}: You can optionally use ${activePlayerIndex === 0 ? 'Player 1' : 'Player 2'}'s roll of ${currentRollTotal}.`;
    }
    
    renderActiveBoard();
}

function handleCellClick(color, index) {
    if (!hasRolledThisTurn || isTransitioning) return;

    const player = players[evaluationPhase];
    
    if (isValidMove(player, color, index, currentRollTotal)) {
        player.boards[color][index] = currentRollTotal;
        calculateScore(player);
        
        if (evaluationPhase === activePlayerIndex) {
            activePlayerPlaced = true;
        }
        
        advanceEvaluation();
    } else {
        alert("Invalid Move! Numbers must strictly increase from left to right, and no duplicate values are allowed in the same column alignment.");
    }
}

function handlePassTurn() {
    if (!hasRolledThisTurn || isTransitioning) return;
    
    const player = players[evaluationPhase];
    
    // Penalty only applies if you are the active roller and choose to pass
    if (evaluationPhase === activePlayerIndex) {
        if (player.missteps < 4) {
            player.missteps++;
            calculateScore(player);
        }
    }
    
    advanceEvaluation();
}

function advanceEvaluation() {
    if (gameMode === 'PvP' && evaluationPhase === activePlayerIndex) {
        // Move to the passive player's selection phase
        evaluationPhase = (activePlayerIndex + 1) % players.length;
        
        // Trigger screen block transition to hand over device secretly
        isTransitioning = true;
        document.getElementById('dicePanel').style.display = 'none';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('statusBanner').style.display = 'none';
        
        document.getElementById('transitionMessage').innerText = `Pass device to ${players[evaluationPhase].name} to use the roll of ${currentRollTotal}`;
        document.getElementById('transitionScreen').style.display = 'block';
    } else {
        // Both players have evaluated this roll, check game end status or switch turn cycle
        checkAndCleanTurnCycle();
    }
}

function revealNextTurn() {
    isTransitioning = false;
    document.getElementById('transitionScreen').style.display = 'none';
    document.getElementById('dicePanel').style.display = 'flex';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('statusBanner').style.display = 'block';

    promptCurrentEvaluatingPlayer();
}

function checkAndCleanTurnCycle() {
    const over = players.some(p => p.missteps >= 4 || checkRowsFilled(p) >= 2);
    if (over) {
        endGame();
        return;
    }

    // Change the primary active roller pointer to the next player
    activePlayerIndex = (activePlayerIndex + 1) % players.length;
    startNewTurnCycle();
}

function isValidMove(player, color, index, value) {
    if (!activeColorsRolled.includes(color)) return false;
    
    const row = player.boards[color];
    if (row[index] !== null) return false;

    for (let i = 0; i < index; i++) {
        if (row[i] !== null && row[i] >= value) return false;
    }
    for (let i = index + 1; i < row.length; i++) {
        if (row[i] !== null && row[i] <= value) return false;
    }

    const checkVerticalOverlap = (otherColor, adjIndex) => {
        if (adjIndex >= 0 && adjIndex < 10) {
            if (player.boards[otherColor][adjIndex] === value) return false;
        }
        return true;
    };

    if (color === 'orange') {
        if (!checkVerticalOverlap('yellow', index + 1)) return false;
        if (!checkVerticalOverlap('purple', index + 2)) return false;
    } else if (color === 'yellow') {
        if (!checkVerticalOverlap('orange', index - 1)) return false;
        if (!checkVerticalOverlap('purple', index + 1)) return false;
    } else if (color === 'purple') {
        if (!checkVerticalOverlap('orange', index - 2)) return false;
        if (!checkVerticalOverlap('yellow', index - 1)) return false;
    }

    return true;
}

function checkRowsFilled(p) {
    let fullRows = 0;
    for (let col in p.boards) {
        const spacesCount = rowLayouts[col].filter(x => x !== 0).length;
        const filledCount = p.boards[col].filter(x => x !== null).length;
        if(spacesCount === filledCount) fullRows++;
    }
    return fullRows;
}

function calculateScore(player) {
    let total = 0;
    for (let rowColor in player.boards) {
        const layout = rowLayouts[rowColor];
        const boardRow = player.boards[rowColor];
        const totalSlots = layout.filter(x => x !== 0).length;
        const filledSlots = boardRow.filter(x => x !== null).length;

        if (filledSlots === totalSlots) {
            total += boardRow[boardRow.length - 1];
        } else {
            total += filledSlots;
        }
    }
    total -= (player.missteps * 5);
    player.score = total;
}

function endGame() {
    document.getElementById('dicePanel').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    // Force final complete visual render of the final player scorecard panel
    evaluationPhase = 0; 
    renderActiveBoard(); 
    
    let winnerText = "Game Over! Final Results:\n";
    players.forEach(p => {
        winnerText += `${p.name}: ${p.score} points\n`;
    });
    document.getElementById('statusBanner').innerText = winnerText;
    alert(winnerText);
}

function executeAiTurn() {
    // Basic Simulation AI for single player mode remains straightforward
    activeColorsRolled = ['orange', 'yellow', 'purple'].filter(() => Math.random() > 0.3);
    if (activeColorsRolled.length === 0) activeColorsRolled = ['yellow'];

    currentRollTotal = 0;
    activeColorsRolled.forEach(() => {
        currentRollTotal += Math.floor(Math.random() * 6) + 1;
    });

    document.getElementById('rollResult').innerText = currentRollTotal;
    hasRolledThisTurn = true;
    
    const ai = players[activePlayerIndex];
    let moved = false;

    for (let color of activeColorsRolled) {
        for (let i = 0; i < 10; i++) {
            if (rowLayouts[color][i] !== 0 && isValidMove(ai, color, i, currentRollTotal)) {
                ai.boards[color][i] = currentRollTotal;
                calculateScore(ai);
                moved = true;
                break;
            }
        }
        if (moved) break;
    }

    if (!moved) {
        ai.missteps++;
        calculateScore(ai);
    }

    setTimeout(() => {
        checkAndCleanTurnCycle();
    }, 1500);
}

function renderActiveBoard() {
    const area = document.getElementById('gameArea');
    area.innerHTML = '';

    // Render the board of the player whose turn it currently is to make a decision
    const player = players[evaluationPhase];
    if (!player) return;
    
    const boardWrap = document.createElement('div');
    boardWrap.className = `player-board`;
    boardWrap.innerHTML = `<div class="player-name">${player.name}'s Scorecard</div>`;

    ['orange', 'yellow', 'purple'].forEach(color => {
        const container = document.createElement('div');
        container.className = 'row-container';

        const rowDiv = document.createElement('div');
        rowDiv.className = `grid-row ${color}-bar`;

        rowLayouts[color].forEach((type, index) => {
            const cell = document.createElement('div');
            if (type === 0) {
                cell.className = 'cell empty-slot';
            } else {
                const shapeClass = (type === 1) ? 'circle' : 'pentagon';
                cell.className = `cell ${shapeClass}`;
                
                const val = player.boards[color][index];
                if (val !== null) {
                    cell.innerText = val;
                    cell.classList.add('filled');
                }

                cell.onclick = () => handleCellClick(color, index);
            }
            rowDiv.appendChild(cell);
        });

        container.appendChild(rowDiv);
        boardWrap.appendChild(container);
    });

    const summary = document.createElement('div');
    summary.style.display = 'flex';
    summary.style.justifyContent = 'space-between';
    summary.style.alignItems = 'center';
    summary.style.marginTop = '20px';

    let misstepHtml = '';
    for(let m = 1; m <= 4; m++) {
        misstepHtml += `<div class="misstep-box ${m <= player.missteps ? 'checked' : ''}">${m <= player.missteps ? 'X' : ''}</div>`;
    }

    summary.innerHTML = `
        <div class="misstep-container">
            <span style="font-size:15px; font-weight:bold; margin-right:8px; color:#555">Missteps (-5pt):</span>
            ${misstepHtml}
        </div>
        <div class="score-display">Total Score: ${player.score}</div>
    `;
    
    boardWrap.appendChild(summary);
    area.appendChild(boardWrap);
}
