// --- Game Configurations & State ---
let gameMode = 'PvP';
let players = [];
let activePlayerIndex = 0;   
let evaluationPhase = 0;     
let currentRollTotal = 0;
let activeColorsRolled = [];
let hasRolledThisTurn = false;
let isTransitioning = false;
let activePlayerPlaced = false; 
let isGameOver = false;

// --- Your Perfect 12-Element Unified Layout Mapping ---
// 1 = Circle, 2 = Pentagon, 0 = Background Empty Buffer Slot
const rowLayouts = {
    orange: [0, 0, 1, 2, 1, 0, 1, 2, 1, 1, 1, 1],
    yellow: [0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 0],
    purple: [1, 1, 2, 1, 0, 1, 1, 1, 1, 2, 0, 0]
};

class Player {
    constructor(name, isAi = false) {
        this.name = name;
        this.isAi = isAi;
        this.missteps = 0;
        // Boards now track all 12 slots seamlessly
        this.boards = {
            orange: Array(12).fill(null),
            yellow: Array(12).fill(null),
            purple: Array(12).fill(null)
        };
        this.score = 0;
    }
}

function startGame(mode) {
    gameMode = mode;
    isGameOver = false;
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
    evaluationPhase = activePlayerIndex; 
    
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
    if (hasRolledThisTurn || isTransitioning || isGameOver) return;
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
        document.getElementById('passBtn').innerText = "Take Misstep Penalty";
        document.getElementById('statusBanner').innerText = 
            `[ROLLER] ${evaluatingPlayer.name}: You rolled ${currentRollTotal}! Place it on a valid cell or accept a Misstep penalty.`;
    } else {
        document.getElementById('passBtn').innerText = "Skip / Do Nothing";
        document.getElementById('statusBanner').innerText = 
            `[PASSIVE] ${evaluatingPlayer.name}: You can optionally use ${activePlayerIndex === 0 ? 'Player 1' : 'Player 2'}'s roll of ${currentRollTotal}.`;
    }
    
    renderActiveBoard();
}

function handleCellClick(color, index) {
    if (!hasRolledThisTurn || isTransitioning || isGameOver) return;

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
    if (!hasRolledThisTurn || isTransitioning || isGameOver) return;
    
    const player = players[evaluationPhase];
    
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
        evaluationPhase = (activePlayerIndex + 1) % players.length;
        
        isTransitioning = true;
        document.getElementById('dicePanel').style.display = 'none';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('statusBanner').style.display = 'none';
        
        document.getElementById('transitionMessage').innerText = `Pass device to ${players[evaluationPhase].name} to use the roll of ${currentRollTotal}`;
        document.getElementById('transitionScreen').style.display = 'block';
    } else {
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

    activePlayerIndex = (activePlayerIndex + 1) % players.length;
    startNewTurnCycle();
}

function isValidMove(player, color, index, value) {
    if (!activeColorsRolled.includes(color)) return false;
    if (rowLayouts[color][index] === 0) return false;
    
    const row = player.boards[color];
    if (row[index] !== null) return false;

    // Left-to-right math progression validator
    for (let i = 0; i < index; i++) {
        if (rowLayouts[color][i] !== 0 && row[i] !== null && row[i] >= value) return false;
    }
    for (let i = index + 1; i < row.length; i++) {
        if (rowLayouts[color][i] !== 0 && row[i] !== null && row[i] <= value) return false;
    }

    // Since indices are 100% unified, vertical overlap checks are dead-simple direct lookups
    if (rowLayouts.orange[index] !== 0 && player.boards.orange[index] === value) return false;
    if (rowLayouts.yellow[index] !== 0 && player.boards.yellow[index] === value) return false;
    if (rowLayouts.purple[index] !== 0 && player.boards.purple[index] === value) return false;

    return true;
}

function checkRowsFilled(p) {
    let fullRows = 0;
    for (let col in p.boards) {
        const spacesCount = rowLayouts[col].filter(x => x !== 0).length;
        const filledCount = p.boards[col].filter((x, idx) => x !== null && rowLayouts[col][idx] !== 0).length;
        if(filledCount === spacesCount) fullRows++;
    }
    return fullRows;
}

// --- Your 12-Element Array Scoring Engine Engine ---
function calculateScore(player) {
    let total = 0;

    // 1. Natural Row Points
    for (let rowColor in player.boards) {
        const layout = rowLayouts[rowColor];
        const boardRow = player.boards[rowColor];
        
        const totalPlayableSlots = layout.filter(x => x !== 0).length;
        let filledCount = 0;
        let rightmostValue = 0;
        
        for (let i = 0; i < boardRow.length; i++) {
            if (layout[i] !== 0 && boardRow[i] !== null) {
                filledCount++;
                rightmostValue = boardRow[i];
            }
        }

        if (filledCount === totalPlayableSlots) {
            total += rightmostValue;
        } else {
            total += filledCount;
        }
    }

    // 2. Vertical Column Pentagon Rewards (Based on your exact 12-element definitions)
    
    // Column Index 2: o[2] y[2] p[2] => reward is p[2]
    if (player.boards.orange[2] !== null && player.boards.yellow[2] !== null && player.boards.purple[2] !== null) {
        total += player.boards.purple[2]; 
    }
    
    // Column Index 3: o[3] y[3] p[3] => reward is o[3]
    if (player.boards.orange[3] !== null && player.boards.yellow[3] !== null && player.boards.purple[3] !== null) {
        total += player.boards.orange[3]; 
    }
    
    // Column Index 7: o[7] y[7] p[7] => reward is o[7]
    if (player.boards.orange[7] !== null && player.boards.yellow[7] !== null && player.boards.purple[7] !== null) {
        total += player.boards.orange[7]; 
    }
    
    // Column Index 8: o[8] y[8] p[8] => reward is y[8]
    if (player.boards.orange[8] !== null && player.boards.yellow[8] !== null && player.boards.purple[8] !== null) {
        total += player.boards.yellow[8]; 
    }
    
    // Column Index 9: o[9] y[9] p[9] => reward is p[9]
    if (player.boards.orange[9] !== null && player.boards.yellow[9] !== null && player.boards.purple[9] !== null) {
        total += player.boards.purple[9]; 
    }

    // 3. Penalty Subtract
    total -= (player.missteps * 5);
    player.score = total;
}

function endGame() {
    isGameOver = true;
    document.getElementById('dicePanel').style.display = 'none';
    
    let winnerText = "🏆 Game Over! Final Results:\n";
    players.forEach(p => {
        winnerText += `${p.name}: ${p.score} points\n`;
    });
    document.getElementById('statusBanner').innerText = winnerText;

    renderAllBoardsAtEnd();
}

function executeAiTurn() {
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
        for (let i = 0; i < 12; i++) {
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

function generateBoardHTML(player) {
    const boardWrap = document.createElement('div');
    boardWrap.className = `player-board`;
    boardWrap.innerHTML = `<div class="player-name">${player.name}'s Scorecard</div>`;

    ['orange', 'yellow', 'purple'].forEach(color => {
        const container = document.createElement('div');
        container.className = 'row-container';

        const rowDiv = document.createElement('div');
        rowDiv.className = `grid-row ${color}-bar`;

        // Render straight down the 12 unified structural tracking paths
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

                if (!isGameOver && player.isAi === false) {
                    cell.onclick = () => handleCellClick(color, index);
                }
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
    return boardWrap;
}

function renderActiveBoard() {
    const area = document.getElementById('gameArea');
    area.innerHTML = '';
    const activePlayerBoard = generateBoardHTML(players[evaluationPhase]);
    area.appendChild(activePlayerBoard);
}

function renderAllBoardsAtEnd() {
    const area = document.getElementById('gameArea');
    area.innerHTML = '';
    area.style.flexDirection = 'column';
    area.style.gap = '40px';

    players.forEach(player => {
        const finishedBoard = generateBoardHTML(player);
        area.appendChild(finishedBoard);
    });
}
