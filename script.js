/**
 * ============================================================================
 * TIGER KA HUKKUM — Neon Arcade XOX Game
 * Core Engine & Interactive Arcade Logic (Vanilla JavaScript ES6+)
 * ============================================================================
 */

'use strict';

// ----------------------------------------------------------------------------
// 1. Game State & Configuration Constants
// ----------------------------------------------------------------------------
const WINNING_COMBINATIONS = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Column 1
  [1, 4, 7], // Column 2
  [2, 5, 8], // Column 3
  [0, 4, 8], // Diagonal from Top-Left
  [2, 4, 6]  // Diagonal from Top-Right
];

// SVG Strike Line Coordinates mapped to viewBox (0 0 300 300)
const STRIKE_COORDINATES = {
  '0,1,2': { x1: 20, y1: 50,  x2: 280, y2: 50  },
  '3,4,5': { x1: 20, y1: 150, x2: 280, y2: 150 },
  '6,7,8': { x1: 20, y1: 250, x2: 280, y2: 250 },
  '0,3,6': { x1: 50, y1: 20,  x2: 50,  y2: 280 },
  '1,4,7': { x1: 150, y1: 20, x2: 150, y2: 280 },
  '2,5,8': { x1: 250, y1: 20, x2: 250, y2: 280 },
  '0,4,8': { x1: 30, y1: 30,  x2: 270, y2: 270 },
  '2,4,6': { x1: 270, y1: 30, x2: 30,  y2: 270 }
};

const CELL_POSITION_NAMES = [
  'Top-Left',   'Top-Center',    'Top-Right',
  'Middle-Left','Center',        'Middle-Right',
  'Bottom-Left','Bottom-Center', 'Bottom-Right'
];

const gameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',       // 'X' or 'O'
  gameMode: 'two-player',   // 'two-player' or 'vs-cpu'
  humanSymbol: 'X',         // 'X' or 'O' (in vs-cpu mode)
  cpuSymbol: 'O',           // 'O' or 'X' (in vs-cpu mode)
  isGameOver: false,
  isAiThinking: false,
  winningLine: null,
  scores: {
    X: 0,
    O: 0,
    draws: 0
  },
  soundEnabled: true
};

// ----------------------------------------------------------------------------
// 2. Synthesized Web Audio API Sound Effects
// ----------------------------------------------------------------------------
class ArcadeAudioEngine {
  constructor() {
    this.ctx = null;
  }

  // Initialize AudioContext on user gesture to comply with browser autoplay policies
  ensureContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Laser chime for Player X move
  playMoveX() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.12);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Punchy retro synth bass tone for Player O move
  playMoveO() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.15);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  // 80s arcade ascending fanfare arpeggio on victory
  playVictory() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const startTime = ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      const noteStart = startTime + index * 0.085;
      const noteDuration = index === notes.length - 1 ? 0.35 : 0.08;

      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0.18, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration + 0.02);
    });
  }

  // Retro descending warble tone for draws
  playDraw() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [330, 277, 220, 165];
    const startTime = ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const noteStart = startTime + index * 0.09;
      const noteDuration = 0.12;

      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0.14, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration + 0.02);
    });
  }

  // Snappy arcade push button tactile click
  playButtonClick() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Digital sweep for score reset & mode changes
  playSystemReset() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Low warning buzz for invalid cell interaction
  playErrorBuzz() {
    if (!gameState.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(130, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }
}

const audio = new ArcadeAudioEngine();

// ----------------------------------------------------------------------------
// 3. DOM Elements Cache
// ----------------------------------------------------------------------------
const DOM = {
  gameGrid: document.getElementById('game-grid'),
  cells: document.querySelectorAll('.grid-cell'),
  statusDisplay: document.getElementById('status-display'),
  currentModeLabel: document.getElementById('current-mode-label'),
  footerMetaText: document.getElementById('footer-meta-text'),
  bezelModePill: document.getElementById('bezel-mode-pill'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'),
  soundIcon: document.getElementById('sound-icon'),
  soundText: document.getElementById('sound-text'),
  // Scoreboard
  scoreX: document.getElementById('score-x'),
  scoreO: document.getElementById('score-o'),
  scoreDraws: document.getElementById('score-draws'),
  labelPlayerX: document.getElementById('label-player-x'),
  labelPlayerO: document.getElementById('label-player-o'),
  cardPlayerX: document.getElementById('card-player-x'),
  cardPlayerO: document.getElementById('card-player-o'),
  turnPillX: document.getElementById('turn-pill-x'),
  turnPillO: document.getElementById('turn-pill-o'),
  // Action Buttons
  newGameBtn: document.getElementById('new-game-btn'),
  playAgainBtn: document.getElementById('play-again-btn'),
  resetScoreBtn: document.getElementById('reset-score-btn'),
  twoPlayerBtn: document.getElementById('two-player-btn'),
  vsCpuBtn: document.getElementById('vs-cpu-btn'),
  switchSymbolBtn: document.getElementById('switch-symbol-btn'),
  currentHumanSymbolText: document.getElementById('current-human-symbol'),
  // Effects & Modals
  winningStrikeSvg: document.getElementById('winning-strike-svg'),
  winningStrikeLine: document.getElementById('winning-strike-line'),
  screenGlitch: document.getElementById('screen-glitch'),
  particlesOverlay: document.getElementById('particles-overlay'),
  resetConfirmModal: document.getElementById('reset-confirm-modal'),
  modalConfirmBtn: document.getElementById('modal-confirm-btn'),
  modalCancelBtn: document.getElementById('modal-cancel-btn')
};

// ----------------------------------------------------------------------------
// 4. Core Game Engine Functions
// ----------------------------------------------------------------------------

/**
 * Initializes listeners, sets up board DOM, and launches initial round.
 */
function initializeGame() {
  // Attach cell interactions (click and keyboard)
  DOM.cells.forEach(cell => {
    cell.addEventListener('click', () => {
      const index = parseInt(cell.getAttribute('data-index'), 10);
      handleCellClick(index);
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const index = parseInt(cell.getAttribute('data-index'), 10);
        handleCellClick(index);
      } else {
        handleGridKeyboardNavigation(e, cell);
      }
    });
  });

  // Attach button interactions
  DOM.newGameBtn.addEventListener('click', () => {
    audio.playButtonClick();
    resetBoard();
  });

  DOM.playAgainBtn.addEventListener('click', () => {
    audio.playButtonClick();
    resetBoard();
  });

  DOM.resetScoreBtn.addEventListener('click', () => {
    audio.playButtonClick();
    openResetModal();
  });

  DOM.modalConfirmBtn.addEventListener('click', () => {
    confirmResetScore();
  });

  DOM.modalCancelBtn.addEventListener('click', () => {
    audio.playButtonClick();
    closeResetModal();
  });

  // Modal keyboard accessibility (Esc closes modal)
  DOM.resetConfirmModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeResetModal();
    }
  });

  DOM.twoPlayerBtn.addEventListener('click', () => {
    if (gameState.gameMode !== 'two-player') {
      audio.playButtonClick();
      switchGameMode('two-player');
    }
  });

  DOM.vsCpuBtn.addEventListener('click', () => {
    if (gameState.gameMode !== 'vs-cpu') {
      audio.playButtonClick();
      switchGameMode('vs-cpu');
    }
  });

  DOM.switchSymbolBtn.addEventListener('click', () => {
    audio.playButtonClick();
    switchPlayerSymbol();
  });

  DOM.soundToggleBtn.addEventListener('click', () => {
    toggleSound();
  });

  // Render initial clean round
  resetBoard();
}

/**
 * Handles keyboard arrow navigation across the 3x3 grid.
 */
function handleGridKeyboardNavigation(e, currentCell) {
  const currentIndex = parseInt(currentCell.getAttribute('data-index'), 10);
  let targetIndex = null;

  switch (e.key) {
    case 'ArrowUp':
      if (currentIndex >= 3) targetIndex = currentIndex - 3;
      break;
    case 'ArrowDown':
      if (currentIndex <= 5) targetIndex = currentIndex + 3;
      break;
    case 'ArrowLeft':
      if (currentIndex % 3 !== 0) targetIndex = currentIndex - 1;
      break;
    case 'ArrowRight':
      if (currentIndex % 3 !== 2) targetIndex = currentIndex + 1;
      break;
    default:
      return;
  }

  if (targetIndex !== null) {
    e.preventDefault();
    DOM.cells[targetIndex].focus();
  }
}

/**
 * Handles a cell click or activation request.
 * @param {number} index - 0 to 8
 */
function handleCellClick(index) {
  // If game is over or AI is currently calculating, disallow
  if (gameState.isGameOver || gameState.isAiThinking) {
    audio.playErrorBuzz();
    return;
  }

  // If in VS CPU mode and it is not human's turn, disallow
  if (gameState.gameMode === 'vs-cpu' && gameState.currentPlayer !== gameState.humanSymbol) {
    audio.playErrorBuzz();
    return;
  }

  // If cell is already taken, disallow with buzz
  if (gameState.board[index] !== null) {
    audio.playErrorBuzz();
    return;
  }

  // Execute valid move
  makeMove(index, gameState.currentPlayer);
}

/**
 * Executes a move on the board array and updates DOM.
 * @param {number} index - 0 to 8
 * @param {string} player - 'X' or 'O'
 */
function makeMove(index, player) {
  gameState.board[index] = player;
  renderCell(index, player);

  // Play distinctive move sound
  if (player === 'X') {
    audio.playMoveX();
  } else {
    audio.playMoveO();
  }

  // Check for win
  const winningCombo = checkWinner();
  if (winningCombo) {
    handleWin(player, winningCombo);
    return;
  }

  // Check for draw
  if (checkDraw()) {
    handleDraw();
    return;
  }

  // Alternate turn
  gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
  updateGameStatus();
  updateTurnIndicators();

  // If VS CPU mode and now CPU turn, trigger computer move
  if (gameState.gameMode === 'vs-cpu' && gameState.currentPlayer === gameState.cpuSymbol && !gameState.isGameOver) {
    scheduleComputerMove();
  }
}

/**
 * Schedules the AI opponent move with a realistic arcade thinking delay.
 */
function scheduleComputerMove() {
  gameState.isAiThinking = true;
  DOM.statusDisplay.className = 'game-status-text thinking-state';
  DOM.statusDisplay.textContent = 'COMPUTER THINKING...';

  const thinkDelay = 420 + Math.floor(Math.random() * 200); // 420ms - 620ms

  setTimeout(() => {
    if (gameState.isGameOver) {
      gameState.isAiThinking = false;
      return;
    }

    const cpuMoveIndex = computerMove();
    if (cpuMoveIndex !== null && cpuMoveIndex !== undefined) {
      gameState.isAiThinking = false;
      makeMove(cpuMoveIndex, gameState.cpuSymbol);
    } else {
      gameState.isAiThinking = false;
    }
  }, thinkDelay);
}

/**
 * Lightweight, strategic Vanilla JS AI.
 * 1. Checks for winning move.
 * 2. Checks to block human's winning move.
 * 3. Takes center cell (4) if available.
 * 4. Takes strategic corner.
 * 5. Takes strategic side.
 * 6. Fallback: selects any available empty cell.
 * @returns {number|null} Best cell index
 */
function computerMove() {
  const board = gameState.board;
  const cpu = gameState.cpuSymbol;
  const human = gameState.humanSymbol;

  // 1. Can CPU win immediately?
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = cpu;
      if (checkWinOnVirtualBoard(board, cpu)) {
        board[i] = null;
        return i;
      }
      board[i] = null;
    }
  }

  // 2. Can Human win immediately on their next turn? Block them!
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = human;
      if (checkWinOnVirtualBoard(board, human)) {
        board[i] = null;
        return i;
      }
      board[i] = null;
    }
  }

  // 3. Take Center cell (index 4) if open
  if (board[4] === null) {
    return 4;
  }

  // 4. Strategic Corners [0, 2, 6, 8]
  const corners = [0, 2, 6, 8];
  // Check if human has a corner and opposite corner is open
  const oppositeCornerPairs = [
    [0, 8],
    [2, 6],
    [8, 0],
    [6, 2]
  ];
  for (const [corner, opp] of oppositeCornerPairs) {
    if (board[corner] === human && board[opp] === null) {
      return opp;
    }
  }

  const openCorners = corners.filter(idx => board[idx] === null);
  if (openCorners.length > 0) {
    return openCorners[Math.floor(Math.random() * openCorners.length)];
  }

  // 5. Strategic Sides [1, 3, 5, 7]
  const sides = [1, 3, 5, 7];
  const openSides = sides.filter(idx => board[idx] === null);
  if (openSides.length > 0) {
    return openSides[Math.floor(Math.random() * openSides.length)];
  }

  // 6. Fallback: any empty cell
  const openCells = [];
  board.forEach((val, idx) => {
    if (val === null) openCells.push(idx);
  });

  return openCells.length > 0 ? openCells[0] : null;
}

/**
 * Checks if a specific player has achieved a 3-in-a-row on a hypothetical board.
 */
function checkWinOnVirtualBoard(board, player) {
  return WINNING_COMBINATIONS.some(combo => {
    const [a, b, c] = combo;
    return board[a] === player && board[b] === player && board[c] === player;
  });
}

/**
 * Checks if current board state has a winner.
 * @returns {Array<number>|null} Winning combination or null
 */
function checkWinner() {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (
      gameState.board[a] !== null &&
      gameState.board[a] === gameState.board[b] &&
      gameState.board[a] === gameState.board[c]
    ) {
      return combo;
    }
  }
  return null;
}

/**
 * Checks if the board is full with no winner.
 * @returns {boolean}
 */
function checkDraw() {
  return gameState.board.every(cell => cell !== null);
}

/**
 * Handles round victory.
 * @param {string} winner - 'X' or 'O'
 * @param {Array<number>} combo - [a, b, c]
 */
function handleWin(winner, combo) {
  gameState.isGameOver = true;
  gameState.winningLine = combo;
  gameState.scores[winner]++;

  // Update Scoreboard UI
  updateScoreboard();

  // Highlight Winning Cells & Draw Strike Line
  highlightWinningCells(combo);
  drawWinningLine(combo);

  // Status Announcement
  DOM.statusDisplay.className = winner === 'X' ? 'game-status-text winner-x' : 'game-status-text winner-o';
  if (gameState.gameMode === 'vs-cpu') {
    if (winner === gameState.humanSymbol) {
      DOM.statusDisplay.textContent = 'YOU WIN THE ROUND!';
    } else {
      DOM.statusDisplay.textContent = 'COMPUTER CLAIMS THE WIN!';
    }
  } else {
    DOM.statusDisplay.textContent = `PLAYER ${winner} WINS!`;
  }

  // Audio Fanfare
  audio.playVictory();

  // CRT Screen Glitch Flash & Victory Fireworks
  triggerScreenGlitch();
  spawnCelebrationParticles();

  // Highlight Play Again button
  DOM.playAgainBtn.classList.add('highlight-pulse');
}

/**
 * Handles round draw.
 */
function handleDraw() {
  gameState.isGameOver = true;
  gameState.scores.draws++;

  // Update Scoreboard UI
  updateScoreboard();

  // Status Announcement
  DOM.statusDisplay.className = 'game-status-text draw-state';
  DOM.statusDisplay.textContent = "IT'S A DRAW!";

  // Audio Buzz
  audio.playDraw();

  // Trigger CRT Glitch
  triggerScreenGlitch();

  // Highlight Play Again button
  DOM.playAgainBtn.classList.add('highlight-pulse');
}

/**
 * Resets the 3x3 board and launches a fresh round while preserving running scores.
 */
function resetBoard() {
  gameState.board = Array(9).fill(null);
  gameState.isGameOver = false;
  gameState.isAiThinking = false;
  gameState.winningLine = null;

  // X always initiates the round in standard XOX
  gameState.currentPlayer = 'X';

  // Clear cells in DOM
  DOM.cells.forEach((cell, idx) => {
    cell.innerHTML = '';
    cell.className = 'grid-cell';
    cell.removeAttribute('aria-disabled');
    cell.setAttribute('aria-label', `${CELL_POSITION_NAMES[idx]}, Empty`);
  });

  // Hide winning strike line
  DOM.winningStrikeSvg.classList.remove('strike-active');
  DOM.winningStrikeLine.setAttribute('x1', '0');
  DOM.winningStrikeLine.setAttribute('y1', '0');
  DOM.winningStrikeLine.setAttribute('x2', '0');
  DOM.winningStrikeLine.setAttribute('y2', '0');

  // Clear any existing particles
  DOM.particlesOverlay.innerHTML = '';

  // Remove highlight from play again button
  DOM.playAgainBtn.classList.remove('highlight-pulse');

  // Update status and turn pills
  updateGameStatus();
  updateTurnIndicators();

  // In VS CPU mode: If human chose 'O', CPU is 'X' and must move first!
  if (gameState.gameMode === 'vs-cpu' && gameState.humanSymbol === 'O') {
    scheduleComputerMove();
  }
}

/**
 * Opens confirmation modal for resetting running score.
 */
function openResetModal() {
  DOM.resetConfirmModal.removeAttribute('hidden');
  DOM.modalCancelBtn.focus();
}

/**
 * Closes confirmation modal.
 */
function closeResetModal() {
  DOM.resetConfirmModal.setAttribute('hidden', '');
  DOM.resetScoreBtn.focus();
}

/**
 * Confirms resetting all player scores to 0 and clears board.
 */
function confirmResetScore() {
  gameState.scores.X = 0;
  gameState.scores.O = 0;
  gameState.scores.draws = 0;

  audio.playSystemReset();
  updateScoreboard();
  closeResetModal();
  resetBoard();
}

/**
 * Switches between 'two-player' and 'vs-cpu' modes.
 * @param {string} mode - 'two-player' or 'vs-cpu'
 */
function switchGameMode(mode) {
  gameState.gameMode = mode;

  if (mode === 'two-player') {
    DOM.twoPlayerBtn.classList.add('active-mode');
    DOM.vsCpuBtn.classList.remove('active-mode');
    DOM.currentModeLabel.textContent = '2 PLAYER MODE';
    DOM.labelPlayerX.textContent = 'PLAYER X';
    DOM.labelPlayerO.textContent = 'PLAYER O';
    DOM.switchSymbolBtn.style.opacity = '0.5';
    DOM.switchSymbolBtn.style.pointerEvents = 'none';
    DOM.footerMetaText.textContent = 'TWO-PLAYER LOCAL ARCADE DUEL';
  } else {
    DOM.twoPlayerBtn.classList.remove('active-mode');
    DOM.vsCpuBtn.classList.add('active-mode');
    DOM.currentModeLabel.textContent = 'VS COMPUTER';
    DOM.switchSymbolBtn.style.opacity = '1';
    DOM.switchSymbolBtn.style.pointerEvents = 'auto';
    updatePlayerLabelsForCpuMode();
    DOM.footerMetaText.textContent = `VS CPU — HUMAN IS ${gameState.humanSymbol}`;
  }

  audio.playSystemReset();
  resetBoard();
}

/**
 * Switches human player's symbol between X and O in VS Computer mode.
 */
function switchPlayerSymbol() {
  if (gameState.gameMode !== 'vs-cpu') {
    switchGameMode('vs-cpu');
  }

  gameState.humanSymbol = gameState.humanSymbol === 'X' ? 'O' : 'X';
  gameState.cpuSymbol = gameState.humanSymbol === 'X' ? 'O' : 'X';

  DOM.currentHumanSymbolText.textContent = gameState.humanSymbol;
  updatePlayerLabelsForCpuMode();
  DOM.footerMetaText.textContent = `VS CPU — HUMAN IS ${gameState.humanSymbol}`;

  audio.playSystemReset();
  resetBoard();
}

/**
 * Updates player name labels in scoreboard when in CPU mode.
 */
function updatePlayerLabelsForCpuMode() {
  if (gameState.humanSymbol === 'X') {
    DOM.labelPlayerX.textContent = 'HUMAN (X)';
    DOM.labelPlayerO.textContent = 'CPU (O)';
  } else {
    DOM.labelPlayerX.textContent = 'CPU (X)';
    DOM.labelPlayerO.textContent = 'HUMAN (O)';
  }
}

/**
 * Toggles sound effects on or off.
 */
function toggleSound() {
  gameState.soundEnabled = !gameState.soundEnabled;

  if (gameState.soundEnabled) {
    DOM.soundToggleBtn.classList.remove('muted');
    DOM.soundIcon.textContent = '🔊';
    DOM.soundText.textContent = 'SFX ON';
    audio.playButtonClick();
  } else {
    DOM.soundToggleBtn.classList.add('muted');
    DOM.soundIcon.textContent = '🔇';
    DOM.soundText.textContent = 'MUTED';
  }
}

// ----------------------------------------------------------------------------
// 5. DOM Rendering & UI Presentation
// ----------------------------------------------------------------------------

/**
 * Renders an X or O mark inside the designated grid cell button.
 */
function renderCell(index, player) {
  const cell = DOM.cells[index];
  cell.classList.add('cell-taken');
  cell.setAttribute('aria-disabled', 'true');
  cell.setAttribute('aria-label', `${CELL_POSITION_NAMES[index]}, marked ${player}`);

  if (player === 'X') {
    cell.innerHTML = `
      <div class="symbol-mark symbol-mark-x" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <line x1="18" y1="18" x2="62" y2="62" />
          <line x1="62" y1="18" x2="18" y2="62" />
        </svg>
      </div>
    `;
  } else {
    cell.innerHTML = `
      <div class="symbol-mark symbol-mark-o" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="23" />
        </svg>
      </div>
    `;
  }
}

/**
 * Updates status text and color theme based on active player and game state.
 */
function updateGameStatus() {
  if (gameState.isGameOver) return;

  if (gameState.currentPlayer === 'X') {
    DOM.statusDisplay.className = 'game-status-text turn-x';
    if (gameState.gameMode === 'vs-cpu') {
      DOM.statusDisplay.textContent = gameState.humanSymbol === 'X' ? "YOUR TURN (X)" : "COMPUTER'S TURN (X)";
    } else {
      DOM.statusDisplay.textContent = "PLAYER X'S TURN";
    }
  } else {
    DOM.statusDisplay.className = 'game-status-text turn-o';
    if (gameState.gameMode === 'vs-cpu') {
      DOM.statusDisplay.textContent = gameState.humanSymbol === 'O' ? "YOUR TURN (O)" : "COMPUTER'S TURN (O)";
    } else {
      DOM.statusDisplay.textContent = "PLAYER O'S TURN";
    }
  }
}

/**
 * Updates the active turn badges on the scoreboard pods.
 */
function updateTurnIndicators() {
  if (DOM.gameGrid) {
    DOM.gameGrid.setAttribute('data-turn', gameState.currentPlayer);
  }

  if (gameState.isGameOver) {
    DOM.turnPillX.className = 'card-turn-pill';
    DOM.turnPillO.className = 'card-turn-pill';
    DOM.turnPillX.textContent = 'DONE';
    DOM.turnPillO.textContent = 'DONE';
    DOM.cardPlayerX.classList.remove('active-card');
    DOM.cardPlayerO.classList.remove('active-card');
    return;
  }

  if (gameState.currentPlayer === 'X') {
    DOM.turnPillX.className = 'card-turn-pill active-turn';
    DOM.turnPillX.textContent = 'TURN';
    DOM.turnPillO.className = 'card-turn-pill';
    DOM.turnPillO.textContent = 'WAIT';
    DOM.cardPlayerX.classList.add('active-card');
    DOM.cardPlayerO.classList.remove('active-card');
  } else {
    DOM.turnPillO.className = 'card-turn-pill active-turn';
    DOM.turnPillO.textContent = 'TURN';
    DOM.turnPillX.className = 'card-turn-pill';
    DOM.turnPillX.textContent = 'WAIT';
    DOM.cardPlayerO.classList.add('active-card');
    DOM.cardPlayerX.classList.remove('active-card');
  }
}

/**
 * Updates numeric scores on the scoreboard.
 */
function updateScoreboard() {
  DOM.scoreX.textContent = gameState.scores.X;
  DOM.scoreO.textContent = gameState.scores.O;
  DOM.scoreDraws.textContent = gameState.scores.draws;

  DOM.scoreX.setAttribute('aria-label', `Player X Score: ${gameState.scores.X}`);
  DOM.scoreO.setAttribute('aria-label', `Player O Score: ${gameState.scores.O}`);
  DOM.scoreDraws.setAttribute('aria-label', `Draws Count: ${gameState.scores.draws}`);
}

/**
 * Highlights the three winning cells with pulsing neon victory animation.
 * @param {Array<number>} combo - [a, b, c]
 */
function highlightWinningCells(combo) {
  combo.forEach(idx => {
    DOM.cells[idx].classList.add('cell-winning');
  });
}

/**
 * Draws the glowing multi-color SVG strike line across the three winning cells.
 * @param {Array<number>} combo - [a, b, c]
 */
function drawWinningLine(combo) {
  const key = combo.join(',');
  const coords = STRIKE_COORDINATES[key];
  if (!coords) return;

  DOM.winningStrikeLine.setAttribute('x1', coords.x1.toString());
  DOM.winningStrikeLine.setAttribute('y1', coords.y1.toString());
  DOM.winningStrikeLine.setAttribute('x2', coords.x2.toString());
  DOM.winningStrikeLine.setAttribute('y2', coords.y2.toString());

  DOM.winningStrikeSvg.classList.add('strike-active');
}

/**
 * Triggers a brief CRT screen glitch flash when a round completes.
 */
function triggerScreenGlitch() {
  DOM.screenGlitch.classList.remove('active-glitch');
  // Trigger reflow to restart animation
  void DOM.screenGlitch.offsetWidth;
  DOM.screenGlitch.classList.add('active-glitch');
}

/**
 * Spawns radiant neon victory confetti particles bursting outward.
 */
function spawnCelebrationParticles() {
  // Check if reduced motion is requested
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  DOM.particlesOverlay.innerHTML = '';
  const colors = ['#00F5FF', '#FF35D3', '#8B35FF', '#FFE65C', '#E8FFFF'];
  const particleCount = 38;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'arcade-particle';

    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.floor(Math.random() * 6) + 4; // 4px - 10px
    const startX = 50 + (Math.random() * 20 - 10); // Start near center percentage
    const startY = 50 + (Math.random() * 20 - 10);

    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.floor(Math.random() * 110) + 40; // 40px - 150px
    const dx = `${Math.cos(angle) * distance}px`;
    const dy = `${Math.sin(angle) * distance}px`;
    const rot = `${Math.floor(Math.random() * 360)}deg`;

    particle.style.left = `${startX}%`;
    particle.style.top = `${startY}%`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.boxShadow = `0 0 8px ${color}`;
    particle.style.setProperty('--dx', dx);
    particle.style.setProperty('--dy', dy);
    particle.style.setProperty('--rot', rot);

    DOM.particlesOverlay.appendChild(particle);
  }

  // Remove particles after animation completes
  setTimeout(() => {
    DOM.particlesOverlay.innerHTML = '';
  }, 1000);
}

// ----------------------------------------------------------------------------
// 6. Execution Bootstrap
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initializeGame);
