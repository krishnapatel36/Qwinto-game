// =======================
// GAME STATE
// =======================
const game = {
  mode: null,               // "HUMAN_HUMAN" or "HUMAN_AI"
  activePlayer: 0,          // The player whose turn it is to roll
  currentTurnPlayer: 0,     // The player currently making a choice (Rolling or Placing)
  phase: "ROLL",            // "ROLL" or "PLACE"
  allowedRows: [],          // Rows matching the color of rolled dice
  lastRoll: null,
  players: []
};

// Tracks setup based on official Qwinto boards
// Row 0 = Green, Row 1 = Yellow, Row 2 = Blue
// Columns shifted per row on official sheets, but mapped 0-9 linearly here
const PENTAGONS = [
  { row: 0, col: 1 }, { row: 0, col: 5 },
  { row: 1, col: 2 }, { row: 1, col: 7 },
  { row: 2, col: 3 }, { row: 2, col: 8 }
];

// =======================
// INITIALIZATION
// =======================
document.getElementById("hh").onclick = () => startGame("HUMAN_HUMAN");
document.getElementById("ha").onclick = () => startGame("HUMAN_AI");
document.getElementById("restart").onclick = restartGame;
document.getElementById("rollBtn").onclick = handleRoll;
document.getElementById("passBtn").onclick = handlePass;

function startGame(mode) {
  game.mode = mode;
  game.activePlayer = 0;
  game.currentTurnPlayer = 0;
  game.phase = "ROLL";
  game.lastRoll = null;
  game.allowedRows = [];

  game.players = [
    { type: "human", board: Array.from({ length: 3 }, () => Array(10).fill(null)), penalties: 0 },
    { type: mode === "HUMAN_AI" ? "ai" : "human", board: Array.from({ length: 3 }, () => Array(10).fill(null)), penalties: 0 }
  ];

  document.getElementById("setup").style.display = "none";
  document.getElementById("score-screen").style.display = "none";
  document.querySelector(".controls").style.display = "block";
  document.querySelector(".board-container").style.display = "block";
  document.getElementById("overlay").style.pointerEvents = "auto";

  buildBoardUI();
  updateUI();
}

// =======================
// BOARD UI BUILDER
// =======================
function buildBoardUI() {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = ""; // Clear old elements

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;

      // Position calculations keeping your original geometry intact
      cell.style.width = "8%";
      cell.style.height = "8%";
      cell.style.left = `${7 + col * 9}%`;
      cell.style.top = `${22 + row * 16}%`;

      cell.addEventListener("click", () => handleCellClick(row, col));
      overlay.appendChild(cell);
    }
  }
}

// =======================
// UI REFRESH LAYER
// =======================
function updateUI() {
  const activeP = game.players[game.activePlayer];
  const currentP = game.players[game.currentTurnPlayer];

  // Top header statuses
  if (game.phase === "ROLL") {
    document.getElementById("playerInfo").textContent = 
      `Player ${game.activePlayer + 1} (${activeP.type.toUpperCase()})'s turn to roll!`;
    document.getElementById("rollBtn").style.display = "inline-block";
    document.getElementById("passBtn").style.display = "none";
  } else {
    document.getElementById("playerInfo").textContent = 
      `Viewing/Placing for Player ${game.currentTurnPlayer + 1} (${currentP.type.toUpperCase()})`;
    
    // Non-active human players can voluntarily skip without misplay penalty
    if (game.currentTurnPlayer !== game.activePlayer && currentP.type === "human") {
      document.getElementById("passBtn").textContent = "Skip this roll (No penalty)";
      document.getElementById("passBtn").style.display = "inline-block";
    } else if (game.currentTurnPlayer === game.activePlayer && currentP.type === "human") {
      document.getElementById("passBtn").textContent = "No valid move (Take Misplay Penalty)";
      document.getElementById("passBtn").style.display = "inline-block";
    } else {
      document.getElementById("passBtn").style.display = "none";
    }
    document.getElementById("rollBtn").style.display = "none";
  }

  // Draw penalties summary string
  document.getElementById("penalties-display").textContent = 
    `Penalties -> P1: ${game.players[0].penalties}/4 | P2: ${game.players[1].penalties}/4`;

  // Synchronize board cells visual grid state with the *current choice player's* board matrix
  const boardState = currentP.board;
  document.querySelectorAll(".cell").forEach(cell => {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    const val = boardState[r][c];

    if (val !== null) {
      cell.classList.add("filled");
      cell.innerHTML = `<span>${val}</span>`;
    } else {
      cell.classList.remove("filled");
      cell.innerHTML = "";
    }
  });
}

// =======================
// DICE ROLLING LOGIC
// =======================
function handleRoll() {
  if (game.phase !== "ROLL") return;

  const checkboxes = [
    document.getElementById("die-green"),
    document.getElementById("die-yellow"),
    document.getElementById("die-blue")
  ];

  const selectedRows = [];
  checkboxes.forEach((cb, idx) => {
    if (cb.checked) selectedRows.push(idx);
  });

  if (selectedRows.length === 0) {
    alert("Select at least one die color to roll!");
    return;
  }

  let sum = 0;
  selectedRows.forEach(() => {
    sum += Math.floor(Math.random() * 6) + 1;
  });

  game.lastRoll = sum;
  game.allowedRows = selectedRows;
  game.phase = "PLACE";
  
  // Start action flow with the active roller
  game.currentTurnPlayer = game.activePlayer;

  document.getElementById("rollResult").textContent = `Rolled Sum: ${sum} (Allowed Tracks: ${selectedRows.map(r => ['Green','Yellow','Blue'][r]).join(', ')})`;
  
  updateUI();

  if (game.players[game.currentTurnPlayer].type === "ai") {
    setTimeout(aiTurn, 900);
  }
}

// =======================
// MOVE VALIDATION ENGINE
// =======================
function isValidPlacement(playerIdx, row, col, value) {
  // 1. Is the track color matched by chosen rolled dice?
  if (!game.allowedRows.includes(row)) return false;

  const board = game.players[playerIdx].board;
  if (board[row][col] !== null) return false;

  // 2. Row Ascending Validation (Left-to-Right strict sort)
  // Check Left side boundaries
  for (let c = col - 1; c >= 0; c--) {
    if (board[row][c] !== null) {
      if (board[row][c] >= value) return false;
      break; 
    }
  }
  // Check Right side boundaries
  for (let c = col + 1; c < 10; c++) {
    if (board[row][c] !== null) {
      if (board[row][c] <= value) return false;
      break;
    }
  }

  // 3. Vertical Column Duplication Check
  for (let r = 0; r < 3; r++) {
    if (r !== row && board[r][col] === value) {
      return false; 
    }
  }

  return true;
}

// Checks if any valid cell exists on the board for a specific player
function hasAnyValidMoves(playerIdx, value) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      if (isValidPlacement(playerIdx, r, c, value)) return true;
    }
  }
  return false;
}

// =======================
// CELL CLICK / ACTION
// =======================
function handleCellClick(row, col) {
  if (game.phase !== "PLACE") return;
  
  const currentP = game.players[game.currentTurnPlayer];
  if (currentP.type !== "human") return;

  const value = game.lastRoll;

  if (!isValidPlacement(game.currentTurnPlayer, row, col, value)) {
    alert("Invalid move! Must be ascending color track, matching rolled dice color, and no duplicated numbers in the column.");
    return;
  }

  // Commit placement update
  currentP.board[row][col] = value;
  advanceTurnFlow();
}

function handlePass() {
  if (game.phase !== "PLACE") return;

  const currentP = game.players[game.currentTurnPlayer];
  
  // Active player handles misplay penalty box ticks
  if (game.currentTurnPlayer === game.activePlayer) {
    if (hasAnyValidMoves(game.currentTurnPlayer, game.lastRoll)) {
      const confirmForce = confirm("You have valid placement spaces. Are you sure you want to pass and receive a Misplay Penalty (-5 pts)?");
      if (!confirmForce) return;
    }
    currentP.penalties++;
  }

  advanceTurnFlow();
}

// =======================
// TURN & PHASE CONTROL
// =======================
function advanceTurnFlow() {
  if (checkEndGameConditions()) {
    endGame();
    return;
  }

  // If active roller finished processing, pass opportunity to passive player next
  if (game.currentTurnPlayer === game.activePlayer) {
    game.currentTurnPlayer = game.activePlayer === 0 ? 1 : 0;
    updateUI();

    if (game.players[game.currentTurnPlayer].type === "ai") {
      setTimeout(aiTurn, 900);
    }
  } else {
    // Both players processed this roll result -> Switch turn to next round active roller
    game.phase = "ROLL";
    game.activePlayer = game.activePlayer === 0 ? 1 : 0;
    game.currentTurnPlayer = game.activePlayer;
    game.lastRoll = null;
    document.getElementById("rollResult").textContent = "";
    updateUI();

    if (game.players[game.activePlayer].type === "ai") {
      setTimeout(() => {
        // Auto pick a random dice composition configuration for AI turn
        const checkboxes = [
          document.getElementById("die-green"),
          document.getElementById("die-yellow"),
          document.getElementById("die-blue")
        ];
        checkboxes.forEach(cb => cb.checked = Math.random() > 0.4);
        // Force at least 1 checked
        if (!checkboxes.some(cb => cb.checked)) checkboxes[0].checked = true;
        handleRoll();
      }, 1000);
    }
  }
}

// =======================
// COMPUTER AI LOGIC
// =======================
function aiTurn() {
  const value = game.lastRoll;
  const playerIdx = game.currentTurnPlayer;
  const isRoller = (playerIdx === game.activePlayer);

  // Search for the first compliant valid position matrix entry
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      if (isValidPlacement(playerIdx, r, c, value)) {
        game.players[playerIdx].board[r][c] = value;
        advanceTurnFlow();
        return;
      }
    }
  }

  // If AI is active roller and could not place anywhere, register penalty misplay block
  if (isRoller) {
    game.players[playerIdx].penalties++;
  }
  advanceTurnFlow();
}

// =======================
// GAME OVER DETECTION
// =======================
function checkEndGameConditions() {
  for (let p = 0; p < game.players.length; p++) {
    const player = game.players[p];
    
    // Rule Condition 1: 4 Misplay blocks crossed out
    if (player.penalties >= 4) return true;

    // Rule Condition 2: 2 completely filled tracks
    let filledRowsCount = 0;
    for (let r = 0; r < 3; r++) {
      let isFilled = true;
      for (let c = 0; c < 10; c++) {
        if (player.board[r][c] === null) {
          isFilled = false;
          break;
        }
      }
      if (isFilled) filledRowsCount++;
    }
    if (filledRowsCount >= 2) return true;
  }
  return false;
}

// =======================
// SCORING ENGINE
// =======================
function calculateScore(playerIdx) {
  const player = game.players[playerIdx];
  const board = player.board;
  let totalScore = 0;

  // 1. Compute Tracks Rows Scores
  for (let r = 0; r < 3; r++) {
    let filledCount = 0;
    let rightmostVal = 0;
    for (let c = 0; c < 10; c++) {
      if (board[r][c] !== null) {
        filledCount++;
        rightmostVal = board[r][c]; // Safely catches last absolute entry inside row mapping array order
      }
    }
    if (filledCount === 10) {
      totalScore += rightmostVal; // Score value of rightmost number if complete
    } else {
      totalScore += filledCount;  // Score 1 pt per space filled if incomplete
    }
  }

  // 2. Shaded Column Pentagon Scores
  PENTAGONS.forEach(pentagon => {
    const { row, col } = pentagon;
    // Check if entire column index contains inputs across all 3 color tracks
    if (board[0][col] !== null && board[1][col] !== null && board[2][col] !== null) {
      totalScore += board[row][col];
    }
  });

  // 3. Deduct Misplay Penalty Points
  totalScore -= (player.penalties * 5);

  return totalScore;
}

function endGame() {
  document.querySelector(".controls").style.display = "none";
  document.querySelector(".board-container").style.display = "none";
  document.getElementById("overlay").style.pointerEvents = "none";

  const score1 = calculateScore(0);
  const score2 = calculateScore(1);

  let resultsHtml = `
    <p><strong>Player 1 Score:</strong> ${score1} pts (Penalties taken: ${game.players[0].penalties})</p>
    <p><strong>Player 2 Score:</strong> ${score2} pts (Penalties taken: ${game.players[1].penalties})</p>
    <h3>${score1 === score2 ? "It's a Draw Match!" : (score1 > score2 ? "Player 1 Wins!" : "Player 2 Wins!")}</h3>
  `;

  document.getElementById("score-details").innerHTML = resultsHtml;
  document.getElementById("score-screen").style.display = "block";
}

function restartGame() {
  document.getElementById("score-screen").style.display = "none";
  document.getElementById("setup").style.display = "block";
  document.getElementById("playerInfo").textContent = "";
  document.getElementById("rollResult").textContent = "";
  game.mode = null;
}