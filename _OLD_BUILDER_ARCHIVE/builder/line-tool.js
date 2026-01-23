// ===== LINE TOOL FEATURE =====
// Manual line drawing tool for connections

let lineToolActive = false;
let lineStartPoint = null;
let lineTempElement = null;

function toggleLineTool() {
    lineToolActive = !lineToolActive;
    const btn = document.getElementById('line-tool-btn');

    if (lineToolActive) {
        btn.classList.add('active');
        document.getElementById('canvas').style.cursor = 'crosshair';
        lineStartPoint = null;
        alert('📏 Line Tool Active!\nKlik titik awal, lalu klik titik akhir untuk membuat garis.');
    } else {
        btn.classList.remove('active');
        document.getElementById('canvas').style.cursor = 'default';
        lineStartPoint = null;
        if (lineTempElement) {
            lineTempElement.remove();
            lineTempElement = null;
        }
    }
}

function handleCanvasClickForLine(event) {
    if (!lineToolActive) return;

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    // Get coordinates relative to canvas dengan zoom
    const x = Math.round(((event.clientX - rect.left) / currentZoom) / GRID) * GRID;
    const y = Math.round(((event.clientY - rect.top) / currentZoom) / GRID) * GRID;

    if (!lineStartPoint) {
        // First click - set start point
        lineStartPoint = { x, y };

        // Show visual indicator
        const indicator = document.createElement('div');
        indicator.id = 'line-start-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 10px;
            height: 10px;
            background: #fbbf24;
            border: 2px solid #fff;
            border-radius: 50%;
            transform: translate(-5px, -5px);
            z-index: 9999;
            pointer-events: none;
        `;
        canvas.appendChild(indicator);

    } else {
        // Second click - create line
        const lineId = 'line-' + Date.now();
        createManualLine(lineId, lineStartPoint.x, lineStartPoint.y, x, y);

        // Remove indicator
        const indicator = document.getElementById('line-start-indicator');
        if (indicator) indicator.remove();

        // Reset
        lineStartPoint = null;

        // Auto deactivate after drawing one line (optional)
        // toggleLineTool();
    }
}

function createManualLine(id, x1, y1, x2, y2) {
    const line = document.createElement('div');
    line.id = id;
    line.className = 'manual-line';

    // Calculate length and angle
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Store data
    line.dataset.x1 = x1;
    line.dataset.y1 = y1;
    line.dataset.x2 = x2;
    line.dataset.y2 = y2;
    line.dataset.length = length;
    line.dataset.angle = angle;

    // Style
    line.style.cssText = `
        position: absolute;
        left: ${x1}px;
        top: ${y1}px;
        width: ${length}px;
        height: 2px;
        background: #000;
        transform-origin: 0 0;
        transform: rotate(${angle}deg);
        z-index: 8;
        pointer-events: auto;
        cursor: pointer;
    `;

    // Delete button (appears on hover)
    line.innerHTML = `
        <div class="line-delete-btn" onclick="deleteLine('${id}')" style="
            position: absolute;
            right: -12px;
            top: -12px;
            width: 24px;
            height: 24px;
            background: #ef4444;
            color: white;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        ">×</div>
    `;

    // Show delete button on hover
    line.addEventListener('mouseenter', function () {
        this.querySelector('.line-delete-btn').style.display = 'flex';
    });
    line.addEventListener('mouseleave', function () {
        this.querySelector('.line-delete-btn').style.display = 'none';
    });

    document.getElementById('canvas').appendChild(line);
}

function deleteLine(lineId) {
    const line = document.getElementById(lineId);
    if (line && confirm('Hapus garis ini?')) {
        line.remove();
    }
}

// Add canvas click handler
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('canvas').addEventListener('click', handleCanvasClickForLine);
});

// ===== SAVE/LOAD UPDATE =====
// Update existing save/load functions to include manual lines

// Modify confirmSaveTemplate to save lines
const originalConfirmSaveTemplate = confirmSaveTemplate;
async function confirmSaveTemplateWithLines() {
    // ... existing save code ...

    // Save manual lines
    const lines = [];
    document.querySelectorAll('.manual-line').forEach(el => {
        lines.push({
            id: el.id,
            x1: el.dataset.x1,
            y1: el.dataset.y1,
            x2: el.dataset.x2,
            y2: el.dataset.y2
        });
    });

    // Add to save data (modify existing save function)
    // This will be integrated into main save function
}
