
// --- Constants ---
const GRID_WIDTH = 10;
const GRID_HEIGHT = 7;
const TRAIN_SPEED = 0.005;
const STOCK_SIZE = 10;

const TRACK_CONNECTIONS = {
    'vertical': ['up', 'down'],
    'horizontal': ['left', 'right'],
    'top-right': ['up', 'right'],
    'right-bottom': ['right', 'down'],
    'bottom-left': ['down', 'left'],
    'left-top': ['left', 'up'],
};

// --- State ---
const state = {
    grid: [],
    stock: [], // Array of { id: string, type: TrackType } to handle removal correcty
    train: null,
    score: 0,
    gameState: 'idle', // 'idle', 'playing', 'gameover'
    trainStartTime: 0
};

// --- DOM Elements ---
const gridEl = document.getElementById('game-grid');
const stockPanelEl = document.getElementById('stock-panel');
const trainEl = document.getElementById('train');
const scoreDisplayEl = document.getElementById('score-display');
const gameOverDisplayEl = document.getElementById('game-over-display');
const startBtn = document.getElementById('start-btn');

// --- Helper Functions ---
function getOppositeDirection(dir) {
    switch (dir) {
        case 'up': return 'down';
        case 'down': return 'up';
        case 'left': return 'right';
        case 'right': return 'left';
    }
}

function getNextStep(currentDir, trackType) {
    const connections = TRACK_CONNECTIONS[trackType];
    const cameFrom = getOppositeDirection(currentDir);

    if (!connections.includes(cameFrom)) {
        return null;
    }

    const newDir = connections.find(d => d !== cameFrom);
    return newDir || null;
}

function getRandomTrack() {
    const types = ['vertical', 'horizontal', 'top-right', 'right-bottom', 'bottom-left', 'left-top'];
    return types[Math.floor(Math.random() * types.length)];
}

function generateStockItem() {
    return {
        id: Math.random().toString(36).substr(2, 9),
        type: getRandomTrack()
    };
}

// --- Initialization ---
function initGame() {
    // Generate Grid
    const newGrid = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            row.push({
                x,
                y,
                type: 'empty',
                trackType: null,
                item: Math.random() > 0.8 ? 'coin' : null
            });
        }
        newGrid.push(row);
    }

    // Set Start Position
    newGrid[0][0].type = 'track';
    newGrid[0][0].trackType = 'horizontal';

    state.grid = newGrid;

    // Initialize Train
    state.train = {
        x: 0,
        y: 0,
        direction: 'right',
        lastMoveTime: 0  // Track when last move happened
    };

    // Initialize Stock
    state.stock = Array(STOCK_SIZE).fill(null).map(generateStockItem);

    // Reset Score & State
    state.score = 0;
    state.gameState = 'playing';
    state.trainStartTime = Date.now() + 5000;

    updateUI();
    updateTrainVisuals(); // Fix Initial Position

    // Start Loop
    requestAnimationFrame(gameLoop);
}

// --- Rendering ---
function getTrackSVG(type) {
    let d = '';
    switch (type) {
        case 'horizontal': d = 'M0,32 L64,32'; break;
        case 'vertical': d = 'M32,0 L32,64'; break;
        case 'top-right': d = 'M32,0 A32,32 0 0,0 64,32'; break;
        case 'right-bottom': d = 'M64,32 A32,32 0 0,0 32,64'; break;
        case 'bottom-left': d = 'M32,64 A32,32 0 0,0 0,32'; break;
        case 'left-top': d = 'M0,32 A32,32 0 0,0 32,0'; break;
    }

    return `
        <svg viewBox="0 0 64 64" class="track-svg">
            <path d="${d}" class="track-path-rail" />
            <path d="${d}" class="track-path-inner" />
        </svg>
    `;
}

function getStockSVG(type) {
    // Simplified paths for icon
    let d = '';
    switch (type) {
        case 'horizontal': d = 'M0,15 L30,15'; break;
        case 'vertical': d = 'M15,0 L15,30'; break;
        case 'top-right': d = 'M15,0 A15,15 0 0,0 30,15'; break;
        case 'right-bottom': d = 'M30,15 A15,15 0 0,0 15,30'; break;
        case 'bottom-left': d = 'M15,30 A15,15 0 0,0 0,15'; break;
        case 'left-top': d = 'M0,15 A15,15 0 0,0 15,0'; break;
    }
    // SVG with arrow indicator
    let arrow = '';
    // Draw arrow based on flow. Flow is bi-directional conceptually but stock icons should show connection.
    // Let's use simple dots at endpoints to show connection points.
    const dots = {
        'horizontal': '<circle cx="5" cy="15" r="2" fill="#3b82f6"/><circle cx="25" cy="15" r="2" fill="#3b82f6"/>',
        'vertical': '<circle cx="15" cy="5" r="2" fill="#3b82f6"/><circle cx="15" cy="25" r="2" fill="#3b82f6"/>',
        'top-right': '<circle cx="15" cy="5" r="2" fill="#3b82f6"/><circle cx="25" cy="15" r="2" fill="#3b82f6"/>',
        'right-bottom': '<circle cx="25" cy="15" r="2" fill="#3b82f6"/><circle cx="15" cy="25" r="2" fill="#3b82f6"/>',
        'bottom-left': '<circle cx="15" cy="25" r="2" fill="#3b82f6"/><circle cx="5" cy="15" r="2" fill="#3b82f6"/>',
        'left-top': '<circle cx="5" cy="15" r="2" fill="#3b82f6"/><circle cx="15" cy="5" r="2" fill="#3b82f6"/>'
    };

    return `
        <svg viewBox="0 0 30 30" style="width:24px; height:24px;">
            <path d="${d}" stroke="#3b82f6" stroke-width="4" fill="none" stroke-linecap="round" />
            ${dots[type]}
        </svg>
    `;
}

function renderGrid() {
    gridEl.innerHTML = '';
    state.grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            const cellEl = document.createElement('div');
            cellEl.className = `cell ${cell.type === 'track' ? 'track' : ''}`;
            cellEl.dataset.x = x;
            cellEl.dataset.y = y;

            // Allow Drop
            cellEl.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
                if (state.gameState === 'playing' && cell.type !== 'track') {
                    cellEl.classList.add('drag-over');
                }
            });

            cellEl.addEventListener('dragleave', () => {
                cellEl.classList.remove('drag-over');
            });

            cellEl.addEventListener('drop', (e) => handleDrop(e, x, y));

            if (cell.type === 'track') {
                cellEl.innerHTML = getTrackSVG(cell.trackType);
            } else if (cell.item === 'coin') {
                const coinEl = document.createElement('div');
                coinEl.className = 'item-coin';
                cellEl.appendChild(coinEl);
            }

            // Still allow click to place from head of stack (optional, but good UX fallback)
            // But user asked for DnD Specifically. Let's keep click as taking First item.
            cellEl.addEventListener('click', () => handleCellClick(x, y));

            gridEl.appendChild(cellEl);
        });
    });
}

function renderStock() {
    stockPanelEl.innerHTML = '';
    state.stock.forEach((item, i) => {
        const stockItem = document.createElement('div');
        stockItem.className = 'stock-item';
        stockItem.draggable = true;
        stockItem.dataset.id = item.id;
        stockItem.innerHTML = getStockSVG(item.type);

        stockItem.addEventListener('dragstart', (e) => {
            if (state.gameState !== 'playing') {
                e.preventDefault();
                return;
            }
            stockItem.classList.add('dragging');
            // Store ID to identify which item was dragged
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.setData('trackType', item.type); // Backup
        });

        stockItem.addEventListener('dragend', () => {
            stockItem.classList.remove('dragging');
        });

        stockPanelEl.appendChild(stockItem);
    });
}

function updateScore() {
    scoreDisplayEl.textContent = `Score: ${state.score}`;
}

function updateUI() {
    renderGrid();
    renderStock();
    updateScore();

    if (state.gameState === 'playing') {
        trainEl.style.display = 'flex';
        startBtn.style.display = 'none';
        gameOverDisplayEl.style.display = 'none';
        startBtn.textContent = 'RETRY';
    } else if (state.gameState === 'gameover') {
        gameOverDisplayEl.style.display = 'block';
        startBtn.style.display = 'block';
    } else {
        trainEl.style.display = 'none';
        startBtn.style.display = 'block';
        gameOverDisplayEl.style.display = 'none';
    }
}

// --- Interaction ---

function placeTrack(x, y, stockItemId) {
    const cell = state.grid[y][x];
    if (cell.type === 'track') return;

    let stockIndex = -1;
    if (stockItemId) {
        stockIndex = state.stock.findIndex(s => s.id === stockItemId);
    } else {
        stockIndex = 0; // Default to first
    }

    if (stockIndex === -1) return;

    const trackItem = state.stock[stockIndex];

    // Remove used item
    state.stock.splice(stockIndex, 1);
    // Add new random item
    state.stock.push(generateStockItem());

    // Update Grid
    cell.type = 'track';
    cell.trackType = trackItem.type;

    // Update DOM (Optimized)
    const cellIndex = y * GRID_WIDTH + x;
    const cellEl = gridEl.children[cellIndex];
    cellEl.className = 'cell track'; // Remove drag-over etc

    // Clear coin if any
    const coinEl = cellEl.querySelector('.item-coin');
    if (coinEl) coinEl.remove();

    cellEl.innerHTML = getTrackSVG(trackItem.type);

    renderStock();
}

function handleCellClick(x, y) {
    if (state.gameState !== 'playing') return;
    // Place first item
    if (state.stock.length > 0) {
        placeTrack(x, y, state.stock[0].id);
    }
}

function handleDrop(e, x, y) {
    e.preventDefault();
    if (state.gameState !== 'playing') return;

    const stockItemId = e.dataTransfer.getData('text/plain');
    if (stockItemId) {
        placeTrack(x, y, stockItemId);
    }

    // Clean up drag visual state
    const cellIndex = y * GRID_WIDTH + x;
    if (gridEl.children[cellIndex]) {
        gridEl.children[cellIndex].classList.remove('drag-over');
    }
}

// --- Game Loop ---
function gameLoop() {
    if (state.gameState !== 'playing') return;

    const currentTime = Date.now();

    if (currentTime < state.trainStartTime) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const t = state.train;

    // Check if 2 seconds have passed since last move
    if (currentTime - t.lastMoveTime >= 2000) {
        // Time to move to next cell
        let nextX = t.x;
        let nextY = t.y;

        if (t.direction === 'right') nextX++;
        if (t.direction === 'left') nextX--;
        if (t.direction === 'down') nextY++;
        if (t.direction === 'up') nextY--;

        // Bounds Check
        if (nextX < 0 || nextX >= GRID_WIDTH || nextY < 0 || nextY >= GRID_HEIGHT) {
            handleGameOver();
            return;
        }

        const nextCell = state.grid[nextY][nextX];

        // Track Check
        if (nextCell.type !== 'track' || !nextCell.trackType) {
            handleGameOver();
            return;
        }

        const nextDir = getNextStep(t.direction, nextCell.trackType);
        if (!nextDir) {
            handleGameOver();
            return;
        }

        // ** Track Clearing Logic **
        // Train has moved FROM (t.x, t.y) TO (nextX, nextY).
        // The track at (t.x, t.y) should be cleared.
        const prevCell = state.grid[t.y][t.x];
        prevCell.type = 'empty';
        prevCell.trackType = null;

        // Update DOM for previous cell
        const prevCellIndex = t.y * GRID_WIDTH + t.x;
        const prevCellEl = gridEl.children[prevCellIndex];
        prevCellEl.className = 'cell';
        prevCellEl.innerHTML = ''; // Clear SVG

        // Move to next cell
        t.x = nextX;
        t.y = nextY;
        t.direction = nextDir;
        t.lastMoveTime = currentTime;

        // Item Check (Coin)
        if (nextCell.item === 'coin') {
            state.score += 100;
            nextCell.item = null;
            updateScore();
            const cellIndex = nextY * GRID_WIDTH + nextX;
            const cellEl = gridEl.children[cellIndex];
            const coinEl = cellEl.querySelector('.item-coin');
            if (coinEl) coinEl.remove();
        }

        // Update train position immediately
        updateTrainVisuals();
    }

    requestAnimationFrame(gameLoop);
}

function updateTrainVisuals() {
    const t = state.train;
    const cellSize = 64;
    const gap = 2;
    const stride = cellSize + gap;

    // Grid has 4px border offset
    const borderOffset = 4;

    // Always position train at center of current cell
    const centerX = t.x * stride + (cellSize / 2) + borderOffset;
    const centerY = t.y * stride + (cellSize / 2) + borderOffset;

    // Train element is 40x40. Centered implies -20.
    const trainSize = 40;
    const offset = trainSize / 2;

    trainEl.style.left = `${centerX - offset}px`;
    trainEl.style.top = `${centerY - offset}px`;
}

function handleGameOver() {
    state.gameState = 'gameover';
    updateUI();
}

startBtn.addEventListener('click', initGame);

// Initial Render (Empty)
renderGrid();
