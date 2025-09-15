// ===== Canvas Drawing =====
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

let currentColor = "#ff0000";
let drawing = false;

canvas.addEventListener("mousedown", (e) => { drawing = true; drawPixel(e); });
canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mousemove", (e) => { if (drawing) drawPixel(e); });

function drawPixel(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / 10);
  const y = Math.floor((e.clientY - rect.top) / 10);
  ctx.fillStyle = currentColor;
  ctx.fillRect(x * 10, y * 10, 10, 10);
}

// ===== Palette Selection =====
const swatches = document.querySelectorAll(".color-swatch");
swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    swatches.forEach((s) => s.classList.remove("selected"));
    swatch.classList.add("selected");
    currentColor = swatch.dataset.color;
  });
});

// ===== Toolbar Buttons =====
const toolBtns = document.querySelectorAll(".tool-btn");
toolBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (btn.dataset.action === "toggle-activity") {
      toggleActivityPanel();
    }
  });
});

// ===== Activity Panel Toggle =====
const sidePanel = document.getElementById("side-panel");
function toggleActivityPanel() {
  sidePanel.classList.toggle("collapsed");
}
