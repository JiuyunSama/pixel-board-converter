import { useState, useRef, useEffect } from "react";
import { Upload, Download, Plus, X, Undo2, Redo2, Pipette, RotateCcw } from "lucide-react";

/* ---------- color helpers ---------- */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb(hex) {
  let h = String(hex).replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

// even 4x4x4 RGB cube -> exactly 64 well-spread colors, a safe starting point
function defaultPalette() {
  const levels = [0, 85, 170, 255];
  const colors = [];
  for (const r of levels)
    for (const g of levels) for (const b of levels) colors.push(rgbToHex(r, g, b));
  return colors;
}

// a few well-known, fixed pixel-art palettes as quick-start options
const PICO8_PALETTE = ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"];
const DB32_PALETTE = ["#9badb7", "#524b24", "#663931", "#76428a", "#d77bba", "#323c39", "#37946e", "#45283c", "#eec39a", "#ac3232", "#847e87", "#8a6f30", "#99e550", "#8f974a", "#4b692f", "#8f563b", "#696a6a", "#cbdbfc", "#d9a066", "#222034", "#6abe30", "#639bff", "#595652", "#5fcde4", "#306082", "#ffffff", "#df7126", "#5b6ee1", "#fbf236", "#000000", "#3f3f74", "#d95763"];
const RESURRECT64_PALETTE = ["#2e222f", "#3e3546", "#625565", "#966c6c", "#ab947a", "#694f62", "#7f708a", "#9babb2", "#c7dcd0", "#ffffff", "#6e2727", "#b33831", "#ea4f36", "#f57d4a", "#ae2334", "#e83b3b", "#fb6b1d", "#f79617", "#f9c22b", "#7a3045", "#9e4539", "#cd683d", "#e6904e", "#fbb954", "#4c3e24", "#676633", "#a2a947", "#d5e04b", "#fbff86", "#165a4c", "#239063", "#1ebc73", "#91db69", "#cddf6c", "#313638", "#374e4a", "#547e64", "#92a984", "#b2ba90", "#0b5e65", "#0b8a8f", "#0eaf9b", "#30e1b9", "#8ff8e2", "#323353", "#484a77", "#4d65b4", "#4d9be6", "#8fd3ff", "#45293f", "#6b3e75", "#905ea9", "#a884f3", "#eaaded", "#753c54", "#a24b6f", "#cf657f", "#ed8099", "#831c5d", "#c32454", "#f04f78", "#f68181", "#fca790", "#fdcbb0"];
const ONMYOJI64_10YEARS_PALETTE = ["#ffffff", "#000000", "#aaaaaa", "#555555", "#f9ebde", "#dfdfdf", "#7c7c7c", "#363636", "#fed3c7", "#ffc4ce", "#faac8e", "#ff8b83", "#f44336", "#e91e63", "#e2669e", "#fec2a6", "#86394d", "#6a2a2e", "#4c2a1e", "#9c27b0", "#673ab7", "#3f51b5", "#b4a2d8", "#a692c5", "#a4789c", "#004670", "#057197", "#2196f3", "#00bcd4", "#3be5db", "#97fddc", "#bed8fa", "#b8bae1", "#167300", "#37a93c", "#89e642", "#d7ff07", "#95d4c3", "#aec099", "#25b88c", "#fff6d1", "#f8cb8c", "#ffeb3b", "#ffc107", "#ff9800", "#ff5722", "#b83f27", "#795548", "#ffeea1", "#ece2cd", "#dec16d", "#ca825c", "#c7ca98", "#c6c754", "#92934a", "#525231", "#ffd9a0", "#fff4eb", "#ffeadf", "#fde7c8", "#e4bd7d", "#d5a37b", "#aea298", "#726255"];

const PALETTE_PRESETS = [
  { id: "onmyoji64", label: "阴阳师十周年画板（64 色）", colors: ONMYOJI64_10YEARS_PALETTE },
  { id: "cube64", label: "均匀 64 色（默认）", colors: defaultPalette() },
  { id: "pico8", label: "PICO 8（16 色）", colors: PICO8_PALETTE },
  { id: "db32", label: "DawnBringer 32（32 色）", colors: DB32_PALETTE },
  { id: "res64", label: "Resurrect 64（64 色）", colors: RESURRECT64_PALETTE },
];

function parsePaletteText(text) {
  const tokens = text.split(/[\s,;，；]+/).map((t) => t.trim()).filter(Boolean);
  const out = [];
  for (let t of tokens) {
    if (!t.startsWith("#")) t = "#" + t;
    const rgb = hexToRgb(t);
    if (rgb) out.push(rgbToHex(...rgb));
  }
  return out;
}

/* ---------- .aco / .act palette file import ---------- */

// Adobe Color Table: 256 RGB triplets (768 bytes), optionally followed by a
// 4-byte trailer (actual color count + transparent color index) when the
// palette uses fewer than 256 colors.
function parseACT(buffer) {
  const bytes = new Uint8Array(buffer);
  let numColors = Math.min(256, Math.floor(bytes.length / 3));
  if (bytes.length === 772) {
    const trailerCount = (bytes[768] << 8) | bytes[769];
    if (trailerCount > 0 && trailerCount <= 256) numColors = trailerCount;
  }
  const colors = [];
  for (let i = 0; i < numColors; i++) {
    const r = bytes[i * 3];
    const g = bytes[i * 3 + 1];
    const b = bytes[i * 3 + 2];
    if (r === undefined || g === undefined || b === undefined) break;
    colors.push(rgbToHex(r, g, b));
  }
  return { colors, skipped: 0 };
}

function hsbToRgb(h, s, v) {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = v - c;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function labToRgb(L, a, b) {
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;
  const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = 0.95047 * f(x);
  const Y = f(y);
  const Z = 1.08883 * f(z);
  let r = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  let g = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  let bl = X * 0.0557 + Y * -0.204 + Z * 1.057;
  const gamma = (c) => (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c);
  return [gamma(r) * 255, gamma(g) * 255, gamma(bl) * 255];
}

// converts one Adobe color-swatch entry to 0-255 RGB; returns null for
// color spaces we don't support so the caller can skip and report it
function acoColorToRgb(space, w, x, y, z) {
  switch (space) {
    case 0: // RGB, each component 0-65535
      return [(w / 65535) * 255, (x / 65535) * 255, (y / 65535) * 255];
    case 1: // HSB
      return hsbToRgb((w / 65535) * 360, x / 65535, y / 65535);
    case 2: { // CMYK, each component 0-65535 representing 0-100%
      const c = w / 65535, m = x / 65535, ye = y / 65535, k = z / 65535;
      return [255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - ye) * (1 - k)];
    }
    case 7: // Lab (approximate)
      return labToRgb((w / 65535) * 100, (x / 65535) * 255 - 128, (y / 65535) * 255 - 128);
    case 8: { // grayscale, 0-10000
      const g = (w / 10000) * 255;
      return [g, g, g];
    }
    default:
      return null;
  }
}

// Adobe Color Swatch: a v1 block (10 bytes/color), often followed by a v2
// block that repeats the same colors with names attached - v2 is preferred
// when present since it's the more complete/reliable copy.
function parseACO(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return { colors: [], skipped: 0 };

  function parseBlock(offset) {
    const version = view.getUint16(offset, false);
    const count = view.getUint16(offset + 2, false);
    let pos = offset + 4;
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (pos + 10 > view.byteLength) break;
      const space = view.getUint16(pos, false);
      const w = view.getUint16(pos + 2, false);
      const x = view.getUint16(pos + 4, false);
      const y = view.getUint16(pos + 6, false);
      const z = view.getUint16(pos + 8, false);
      pos += 10;
      if (version === 2) {
        if (pos + 4 > view.byteLength) break;
        const nameLen = view.getUint32(pos, false); // UTF-16 units incl. null terminator
        pos += 4 + nameLen * 2;
      }
      entries.push({ space, w, x, y, z });
    }
    return { version, count, entries, end: pos };
  }

  const first = parseBlock(0);
  let use = first;
  if (first.version === 1 && first.end < view.byteLength) {
    const maybeV2 = parseBlock(first.end);
    if (maybeV2.version === 2 && maybeV2.count === first.count) use = maybeV2;
  }

  const colors = [];
  let skipped = 0;
  for (const entry of use.entries) {
    const rgb = acoColorToRgb(entry.space, entry.w, entry.x, entry.y, entry.z);
    if (!rgb) {
      skipped++;
      continue;
    }
    colors.push(rgbToHex(...rgb));
  }
  return { colors, skipped };
}

// "redmean" weighted distance - a cheap perceptual approximation
function colorDistance(c1, c2) {
  const rmean = (c1[0] + c2[0]) / 2;
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
}

function nearestIndex(rgb, paletteRgb) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < paletteRgb.length; i++) {
    const d = colorDistance(rgb, paletteRgb[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

// flood fill: repaint the region of cells 4-directionally connected to
// (startRow, startCol) that share its original color, with newColor
function floodFillGrid(grid, startRow, startCol, newColor) {
  const h = grid.length;
  const w = grid[0].length;
  const targetColor = grid[startRow][startCol];
  const next = grid.map((r) => r.slice());
  const stack = [[startRow, startCol]];
  const visited = new Set([`${startRow},${startCol}`]);
  while (stack.length) {
    const [r, c] = stack.pop();
    next[r][c] = newColor;
    const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (grid[nr][nc] !== targetColor) continue;
      visited.add(key);
      stack.push([nr, nc]);
    }
  }
  return next;
}

/* ---------- photo-mode algorithm helpers: denoise blur + edge detection ---------- */

// separable box blur via a summed-area table, applied per RGB channel
// (alpha untouched) - O(w*h) regardless of radius
function boxBlurRGBA(data, w, h, radius) {
  const out = new Uint8ClampedArray(data.length);
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let c = 0; c < 3; c++) {
    integral.fill(0);
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += data[(y * w + x) * 4 + c];
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
      }
    }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(w - 1, x + radius);
        const area = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum =
          integral[(y1 + 1) * (w + 1) + (x1 + 1)] -
          integral[y0 * (w + 1) + (x1 + 1)] -
          integral[(y1 + 1) * (w + 1) + x0] +
          integral[y0 * (w + 1) + x0];
        out[(y * w + x) * 4 + c] = sum / area;
      }
    }
  }
  for (let i = 3; i < data.length; i += 4) out[i] = data[i];
  return out;
}

// finds the value such that roughly the top `topPercent`% of entries in
// `values` sit at or above it - a histogram-based percentile, so this
// self-calibrates to each image's own amount of local color variation
// instead of relying on one fixed absolute scale that suits some photos
// and floods others
function percentileThreshold(values, maxValue, topPercent) {
  if (maxValue <= 0) return Infinity;
  const buckets = 256;
  const hist = new Uint32Array(buckets);
  for (let i = 0; i < values.length; i++) {
    const b = Math.min(buckets - 1, Math.floor((values[i] / maxValue) * (buckets - 1)));
    hist[b]++;
  }
  const targetCount = values.length * (topPercent / 100);
  let cum = 0;
  for (let b = buckets - 1; b >= 0; b--) {
    cum += hist[b];
    if (cum >= targetCount) return (b / (buckets - 1)) * maxValue;
  }
  return 0;
}

// maps a 0-10 "edge strength" level to "flag the top X% of cells (by how
// different they are from their most different neighbor)" - higher level
// means more cells get outlined, matching what turning the slider up
// should feel like
function edgePercentForLevel(level) {
  return level;
}

// picks an "outline" version of rgb from the palette: darkens rgb by a
// fixed factor and finds the palette color closest to that darkened
// target. Matching against the darkened target (rather than rgb itself)
// is what keeps neutral/desaturated colors matching to a neutral darker
// tone instead of drifting toward an unrelated saturated color.
function findOutlineIndex(rgb, paletteRgb) {
  const darkened = [rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5];
  return nearestIndex(darkened, paletteRgb);
}

// compares each cell's pre-quantization averaged color against its 8
// neighbors (using the same perceptual distance used for palette
// matching); the cells that stand out the most from their neighbors
// (top `level`-controlled percentile) are outlined by darkening that
// cell's own chosen color and re-matching it to the palette, so the
// outline always stays in the same hue family and uses only colors
// already in the palette
function applyEdgeOverlay(hexGrid, avg, w, h, paletteRgb, level) {
  const neighborOffsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  const cellCount = w * h;
  const maxDist = new Float64Array(cellCount);
  let overallMax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ci = y * w + x;
      const c1 = [avg[ci * 3], avg[ci * 3 + 1], avg[ci * 3 + 2]];
      let best = 0;
      for (const [dx, dy] of neighborOffsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        const c2 = [avg[ni * 3], avg[ni * 3 + 1], avg[ni * 3 + 2]];
        const d = colorDistance(c1, c2);
        if (d > best) best = d;
      }
      maxDist[ci] = best;
      if (best > overallMax) overallMax = best;
    }
  }
  const threshold = percentileThreshold(maxDist, overallMax, edgePercentForLevel(level));
  const out = hexGrid.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ci = y * w + x;
      if (maxDist[ci] < threshold) continue;
      const rgb = hexToRgb(hexGrid[y][x]);
      const idx = findOutlineIndex(rgb, paletteRgb);
      out[y][x] = rgbToHex(...paletteRgb[idx]);
    }
  }
  return out;
}

/* ---------- main component ---------- */

export default function PixelBoardConverter() {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgNatural, setImgNatural] = useState(null);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [appliedCropRect, setAppliedCropRect] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [sourceMode, setSourceMode] = useState("photo"); // "photo" | "pattern"
  const [gridW, setGridW] = useState(48);
  const [gridH, setGridH] = useState(48);
  const [widthInput, setWidthInput] = useState("48");
  const [heightInput, setHeightInput] = useState("48");
  const [lockRatio, setLockRatio] = useState(true);

  const [cornerChoice, setCornerChoice] = useState("tl"); // "tl" | "tr" | "bl" | "br"
  const [refX, setRefX] = useState(1);
  const [refY, setRefY] = useState(1);
  const [refXInput, setRefXInput] = useState("1");
  const [refYInput, setRefYInput] = useState("1");

  // the rest of the app works in terms of the top-left cell's coordinate,
  // so derive that from whichever corner the person actually entered
  const cornerColOffset = cornerChoice === "tr" || cornerChoice === "br" ? gridW - 1 : 0;
  const cornerRowOffset = cornerChoice === "bl" || cornerChoice === "br" ? gridH - 1 : 0;
  const originX = refX - cornerColOffset;
  const originY = refY - cornerRowOffset;

  const [paletteText, setPaletteText] = useState(() => defaultPalette().join(", "));
  const [palette, setPalette] = useState(() => defaultPalette());
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const [dither, setDither] = useState(false);
  const [denoiseStrength, setDenoiseStrength] = useState(0); // 0-20
  const [denoiseLive, setDenoiseLive] = useState(0);
  const [edgeLevel, setEdgeLevel] = useState(0); // 0-20
  const [edgeLive, setEdgeLive] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxis, setShowAxis] = useState(false);
  const [cellPx, setCellPx] = useState(12);
  const [labelCoord, setLabelCoord] = useState(false);
  const [labelIndex, setLabelIndex] = useState(false);
  const [labelHex, setLabelHex] = useState(false);

  const [resultGrid, setResultGrid] = useState(null);
  const [colorCounts, setColorCounts] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState("brush"); // "brush" | "bucket"
  const [activeColor, setActiveColor] = useState("#000000");
  const [replaceColorA, setReplaceColorA] = useState("#000000");
  const [replaceColorB, setReplaceColorB] = useState("#ffffff");
  const [pickTarget, setPickTarget] = useState(null); // null | "A" | "B" | "active"
  const [compareExpanded, setCompareExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const imgElRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const paletteFileInputRef = useRef(null);
  const cropStageRef = useRef(null);
  const cropDragRef = useRef(null);
  const sidebarResizeRef = useRef(null);
  const isPaintingRef = useRef(false);
  const mouseDownCellRef = useRef(null);
  const strokeGridRef = useRef(null);
  const strokeStartedRef = useRef(false);
  const stateRef = useRef({});

  useEffect(() => {
    stateRef.current = { resultGrid, history, future };
  });

  /* -- undo / redo -- */

  const confirmDiscardEdits = () => {
    if (history.length === 0) return true;
    return window.confirm("操作会导致网格重新生成，手动编辑的内容将丢失，是否继续？");
  };

  const resetDisplayOptions = () => {
    if (!confirmDiscardEdits()) return;
    setDither(false);
    setDenoiseStrength(0);
    setEdgeLevel(0);
    setShowGrid(true);
    setShowAxis(false);
    setLabelCoord(false);
    setLabelIndex(false);
    setLabelHex(false);
  };

  // sliders: dragging only moves the visual position (denoiseLive/edgeLive);
  // the committed value (which triggers regeneration, and can discard
  // manual edits) is only applied on release - otherwise confirmDiscardEdits
  // would pop a confirm dialog on every pixel of drag
  useEffect(() => { setDenoiseLive(denoiseStrength); }, [denoiseStrength]);
  useEffect(() => { setEdgeLive(edgeLevel); }, [edgeLevel]);

  const commitDenoise = () => {
    if (denoiseLive === denoiseStrength) return;
    if (!confirmDiscardEdits()) {
      setDenoiseLive(denoiseStrength);
      return;
    }
    setDenoiseStrength(denoiseLive);
  };

  const commitEdge = () => {
    if (edgeLive === edgeLevel) return;
    if (!confirmDiscardEdits()) {
      setEdgeLive(edgeLevel);
      return;
    }
    setEdgeLevel(edgeLive);
  };

  const pushHistory = (grid) => {
    setHistory((h) => [...h, grid]);
    setFuture([]);
  };

  const paintCellColor = (row, col, hex) => {
    setResultGrid((prev) => {
      if (!prev || prev[row][col] === hex) return prev;
      const next = prev.map((r) => r.slice());
      next[row][col] = hex;
      return next;
    });
  };

  const applyColorReplace = () => {
    if (!resultGrid || replaceColorA === replaceColorB) return;
    const found = resultGrid.some((row) => row.includes(replaceColorA));
    if (!found) return;
    pushHistory(resultGrid);
    setResultGrid(resultGrid.map((row) => row.map((c) => (c === replaceColorA ? replaceColorB : c))));
  };

  const handlePickColor = (hex) => {
    if (pickTarget === "A") setReplaceColorA(hex);
    else if (pickTarget === "B") setReplaceColorB(hex);
    else if (pickTarget === "active") setActiveColor(hex);
    setPickTarget(null);
  };

  const undo = () => {
    const { history: h, future: f, resultGrid: g } = stateRef.current;
    if (!h || h.length === 0) return;
    const prevGrid = h[h.length - 1];
    setHistory(h.slice(0, -1));
    setFuture([...f, g]);
    setResultGrid(prevGrid);
  };

  const redo = () => {
    const { history: h, future: f, resultGrid: g } = stateRef.current;
    if (!f || f.length === 0) return;
    const nextGrid = f[f.length - 1];
    setFuture(f.slice(0, -1));
    setHistory([...h, g]);
    setResultGrid(nextGrid);
  };

  const resetAllEdits = () => {
    if (history.length === 0) return;
    if (!window.confirm("这会清除所有编辑，且无法重做，确定继续吗？")) return;
    setResultGrid(history[0]);
    setHistory([]);
    setFuture([]);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      const isEditableField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable;
      if (isEditableField) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onUp = () => {
      isPaintingRef.current = false;
      mouseDownCellRef.current = null;
      strokeStartedRef.current = false;
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  /* -- upload -- */

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (!confirmDiscardEdits()) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      const img = new Image();
      img.onload = () => {
        imgElRef.current = img;
        setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
        setImgSrc(src);
        const fullRect = { x: 0, y: 0, width: 1, height: 1 };
        setCropRect(fullRect);
        setAppliedCropRect(fullRect);
        setGridW((w) => {
          if (lockRatio) {
            setGridH(clamp(Math.round((w * img.naturalHeight) / img.naturalWidth), 4, 256));
          }
          return w;
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  /* -- crop (photo mode only) -- */

  const startCropDrag = (e, mode) => {
    e.preventDefault();
    const stage = cropStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    cropDragRef.current = {
      mode,
      startFX: (e.clientX - rect.left) / rect.width,
      startFY: (e.clientY - rect.top) / rect.height,
      startRect: { ...cropRect },
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      const drag = cropDragRef.current;
      const stage = cropStageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      const fx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const fy = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      const dx = fx - drag.startFX;
      const dy = fy - drag.startFY;
      const s = drag.startRect;
      const minSize = 0.03;
      let next;
      if (drag.mode === "move") {
        next = {
          x: clamp(s.x + dx, 0, 1 - s.width),
          y: clamp(s.y + dy, 0, 1 - s.height),
          width: s.width,
          height: s.height,
        };
      } else {
        let left = s.x;
        let top = s.y;
        let right = s.x + s.width;
        let bottom = s.y + s.height;
        if (drag.mode.includes("w")) left = clamp(s.x + dx, 0, right - minSize);
        if (drag.mode.includes("e")) right = clamp(right + dx, left + minSize, 1);
        if (drag.mode.includes("n")) top = clamp(s.y + dy, 0, bottom - minSize);
        if (drag.mode.includes("s")) bottom = clamp(bottom + dy, top + minSize, 1);
        next = { x: left, y: top, width: right - left, height: bottom - top };
      }
      setCropRect(next);
    };
    const onUp = () => { cropDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* -- sidebar width resize -- */

  const startSidebarResize = (e) => {
    e.preventDefault();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
  };

  useEffect(() => {
    const onMove = (e) => {
      const drag = sidebarResizeRef.current;
      if (!drag) return;
      setSidebarWidth(clamp(drag.startWidth + (e.clientX - drag.startX), 220, 800));
    };
    const onUp = () => { sidebarResizeRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const applyCrop = () => {
    if (!confirmDiscardEdits()) return;
    setAppliedCropRect(cropRect);
    if (lockRatio && imgNatural) {
      const effW = imgNatural.w * cropRect.width;
      const effH = imgNatural.h * cropRect.height;
      const nh = clamp(Math.round((gridW * effH) / effW), 4, 256);
      setGridH(nh);
      setHeightInput(String(nh));
    }
  };

  const resetCrop = () => {
    if (!confirmDiscardEdits()) return;
    const fullRect = { x: 0, y: 0, width: 1, height: 1 };
    setCropRect(fullRect);
    setAppliedCropRect(fullRect);
    if (lockRatio && imgNatural) {
      const nh = clamp(Math.round((gridW * imgNatural.h) / imgNatural.w), 4, 256);
      setGridH(nh);
      setHeightInput(String(nh));
    }
  };

  /* -- grid size -- */

  useEffect(() => { setWidthInput(String(gridW)); }, [gridW]);
  useEffect(() => { setHeightInput(String(gridH)); }, [gridH]);

  const commitWidth = () => {
    const nv = clamp(parseInt(widthInput) || gridW, 4, 256);
    let nh = gridH;
    if (lockRatio && imgNatural) {
      const effW = imgNatural.w * appliedCropRect.width;
      const effH = imgNatural.h * appliedCropRect.height;
      nh = clamp(Math.round((nv * effH) / effW), 4, 256);
    }
    if (nv === gridW && nh === gridH) {
      setWidthInput(String(nv));
      return;
    }
    if (!confirmDiscardEdits()) {
      setWidthInput(String(gridW));
      return;
    }
    setGridW(nv);
    setWidthInput(String(nv));
    if (lockRatio && imgNatural) {
      setGridH(nh);
      setHeightInput(String(nh));
    }
  };

  const commitHeight = () => {
    const nv = clamp(parseInt(heightInput) || gridH, 4, 256);
    let nw = gridW;
    if (lockRatio && imgNatural) {
      const effW = imgNatural.w * appliedCropRect.width;
      const effH = imgNatural.h * appliedCropRect.height;
      nw = clamp(Math.round((nv * effW) / effH), 4, 256);
    }
    if (nv === gridH && nw === gridW) {
      setHeightInput(String(nv));
      return;
    }
    if (!confirmDiscardEdits()) {
      setHeightInput(String(gridH));
      return;
    }
    setGridH(nv);
    setHeightInput(String(nv));
    if (lockRatio && imgNatural) {
      setGridW(nw);
      setWidthInput(String(nw));
    }
  };

  /* -- board corner coordinate (any corner, converted to a top-left origin) -- */

  useEffect(() => { setRefXInput(String(refX)); }, [refX]);
  useEffect(() => { setRefYInput(String(refY)); }, [refY]);

  const commitRefX = () => {
    const nv = parseInt(refXInput);
    const final = Number.isFinite(nv) ? nv : 1;
    setRefX(final);
    setRefXInput(String(final));
  };

  const commitRefY = () => {
    const nv = parseInt(refYInput);
    const final = Number.isFinite(nv) ? nv : 1;
    setRefY(final);
    setRefYInput(String(final));
  };

  const handleCornerChange = (newCorner) => {
    // re-express the same physical origin in terms of the newly chosen
    // corner, so switching corners doesn't silently shift the coordinates
    const newColOffset = newCorner === "tr" || newCorner === "br" ? gridW - 1 : 0;
    const newRowOffset = newCorner === "bl" || newCorner === "br" ? gridH - 1 : 0;
    const newRefX = originX + newColOffset;
    const newRefY = originY + newRowOffset;
    setCornerChoice(newCorner);
    setRefX(newRefX);
    setRefY(newRefY);
    setRefXInput(String(newRefX));
    setRefYInput(String(newRefY));
  };

  /* -- palette editing -- */

  const applyPaletteText = () => {
    const parsed = parsePaletteText(paletteText);
    if (parsed.length === 0) return;
    const isSame = parsed.length === palette.length && parsed.every((c, i) => c === palette[i]);
    if (isSame) return;
    if (!confirmDiscardEdits()) return;
    setPalette(parsed);
    setSelectedPresetId("");
  };

  const handlePaletteFile = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isAct = name.endsWith(".act");
    const isAco = name.endsWith(".aco");
    if (!isAct && !isAco) {
      window.alert("只支持 .aco 或 .act 格式的色组文件。");
      return;
    }
    if (!confirmDiscardEdits()) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { colors, skipped } = isAct ? parseACT(e.target.result) : parseACO(e.target.result);
        if (colors.length === 0) {
          window.alert("没能从这个文件里读出任何颜色，文件可能已损坏或格式不受支持。");
          return;
        }
        setPalette(colors);
        setPaletteText(colors.join(", "));
        setSelectedPresetId("");
        if (skipped > 0) {
          window.alert(`已导入 ${colors.length} 种颜色，有 ${skipped} 种颜色使用了不支持的颜色空间（如 Lab），已跳过。`);
        }
      } catch (err) {
        window.alert("解析这个色组文件时出错，文件可能已损坏。");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const applyPreset = (id) => {
    const preset = PALETTE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (!confirmDiscardEdits()) return;
    setPalette(preset.colors);
    setPaletteText(preset.colors.join(", "));
    setSelectedPresetId(id);
  };

  const updateSwatch = (i, hex) => {
    if (palette[i] === hex) return;
    if (!confirmDiscardEdits()) return;
    setPalette((prev) => {
      const next = [...prev];
      next[i] = hex;
      setPaletteText(next.join(", "));
      return next;
    });
    setSelectedPresetId("");
  };

  const removeSwatch = (i) => {
    if (!confirmDiscardEdits()) return;
    setPalette((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      setPaletteText(next.join(", "));
      return next;
    });
    setSelectedPresetId("");
  };

  const addSwatch = () => {
    if (!confirmDiscardEdits()) return;
    setPalette((prev) => {
      const next = [...prev, "#888888"];
      setPaletteText(next.join(", "));
      return next;
    });
    setSelectedPresetId("");
  };

  /* -- core processing --
     photo mode: downsample by box-average, then quantize to palette
     pattern mode: slice the image into an uneven w*h grid (no square assumption),
     sample the dominant color from a shrunk window in the middle of each cell
     (to avoid borders/grid lines), then quantize to palette */

  useEffect(() => {
    if (!imgElRef.current || palette.length === 0) return;
    setIsProcessing(true);
    const t = setTimeout(() => {
      const hexGrid =
        sourceMode === "pattern"
          ? recognizePattern(imgElRef.current, gridW, gridH, palette)
          : computeAndQuantize(imgElRef.current, gridW, gridH, palette, dither, appliedCropRect, denoiseStrength, edgeLevel);
      setResultGrid(hexGrid);
      setSelectedCell((prev) => (prev && prev.row < hexGrid.length && prev.col < hexGrid[0].length ? prev : null));
      setHistory([]);
      setFuture([]);
      setIsProcessing(false);
    }, 10);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgSrc, gridW, gridH, palette, dither, sourceMode, appliedCropRect, denoiseStrength, edgeLevel]);

  // derive the materials list from resultGrid directly, so it stays correct
  // whether resultGrid came from generation or from manual edits
  useEffect(() => {
    if (!resultGrid) {
      setColorCounts([]);
      return;
    }
    const usage = {};
    for (const row of resultGrid) for (const hex of row) usage[hex] = (usage[hex] || 0) + 1;
    const counts = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .map(([hex, count]) => ({ hex, count }));
    setColorCounts(counts);
  }, [resultGrid]);

  function computeAndQuantize(img, w, h, paletteHex, useDither, crop, denoise, edgeLevel) {
    // guard against a degenerate (near-zero or out-of-bounds) source rect:
    // a sub-1px cw/ch truncates the canvas to 0 width/height (getImageData
    // then returns nothing, averaging to pure black), and a cx/cy that
    // drifts past the image edge makes drawImage paint nothing at all
    // (leaving only the white background fill, i.e. pure white)
    let cw = Math.min(img.naturalWidth, Math.max(1, crop.width * img.naturalWidth));
    let ch = Math.min(img.naturalHeight, Math.max(1, crop.height * img.naturalHeight));
    const cx = clamp(crop.x * img.naturalWidth, 0, img.naturalWidth - cw);
    const cy = clamp(crop.y * img.naturalHeight, 0, img.naturalHeight - ch);
    const srcCanvas = document.createElement("canvas");
    let sw = cw;
    let sh = ch;
    const maxDim = 1400;
    if (Math.max(sw, sh) > maxDim) {
      const scale = maxDim / Math.max(sw, sh);
      sw = Math.round(sw * scale);
      sh = Math.round(sh * scale);
    }
    sw = Math.max(1, Math.round(sw));
    sh = Math.max(1, Math.round(sh));
    srcCanvas.width = sw;
    srcCanvas.height = sh;
    const sctx = srcCanvas.getContext("2d");
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, sw, sh);
    sctx.drawImage(img, cx, cy, cw, ch, 0, 0, sw, sh);
    const rawData = sctx.getImageData(0, 0, sw, sh).data;

    // denoise blur only feeds the color-averaging step below; radius scales
    // with how many source pixels land in one output cell, so small grids
    // (few, large cells) get proportionally more smoothing than large ones
    const cellSrcW = sw / w;
    const cellSrcH = sh / h;
    const blurRadius = denoise > 0 ? Math.max(1, Math.round((denoise * (cellSrcW + cellSrcH)) / 20)) : 0;
    const data = blurRadius > 0 ? boxBlurRGBA(rawData, sw, sh, blurRadius) : rawData;

    const avg = new Float64Array(w * h * 3);
    for (let ty = 0; ty < h; ty++) {
      let sy0 = Math.ceil((ty * sh) / h);
      let sy1 = Math.ceil(((ty + 1) * sh) / h);
      sy0 = Math.min(sy0, sh - 1);
      if (sy1 <= sy0) sy1 = sy0 + 1;
      sy1 = Math.min(sy1, sh);
      for (let tx = 0; tx < w; tx++) {
        let sx0 = Math.ceil((tx * sw) / w);
        let sx1 = Math.ceil(((tx + 1) * sw) / w);
        sx0 = Math.min(sx0, sw - 1);
        if (sx1 <= sx0) sx1 = sx0 + 1;
        sx1 = Math.min(sx1, sw);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;
        for (let y = sy0; y < sy1; y++) {
          for (let x = sx0; x < sx1; x++) {
            const si = (y * sw + x) * 4;
            rSum += data[si];
            gSum += data[si + 1];
            bSum += data[si + 2];
            count++;
          }
        }
        const ci = ty * w + tx;
        avg[ci * 3] = rSum / count;
        avg[ci * 3 + 1] = gSum / count;
        avg[ci * 3 + 2] = bSum / count;
      }
    }

    const paletteRgb = paletteHex.map(hexToRgb).filter(Boolean);
    let hexGrid = new Array(h);

    if (useDither) {
      const buf = avg.slice();
      for (let y = 0; y < h; y++) {
        hexGrid[y] = new Array(w);
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 3;
          const r = clamp(buf[i], 0, 255);
          const g = clamp(buf[i + 1], 0, 255);
          const b = clamp(buf[i + 2], 0, 255);
          const idx = nearestIndex([r, g, b], paletteRgb);
          const chosen = paletteRgb[idx];
          hexGrid[y][x] = rgbToHex(...chosen);
          const er = r - chosen[0];
          const eg = g - chosen[1];
          const eb = b - chosen[2];
          const spread = (dx, dy, f) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
            const ni = (ny * w + nx) * 3;
            buf[ni] += er * f;
            buf[ni + 1] += eg * f;
            buf[ni + 2] += eb * f;
          };
          spread(1, 0, 7 / 16);
          spread(-1, 1, 3 / 16);
          spread(0, 1, 5 / 16);
          spread(1, 1, 1 / 16);
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        hexGrid[y] = new Array(w);
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 3;
          const idx = nearestIndex([avg[i], avg[i + 1], avg[i + 2]], paletteRgb);
          hexGrid[y][x] = rgbToHex(...paletteRgb[idx]);
        }
      }
    }

    if (edgeLevel > 0) {
      hexGrid = applyEdgeOverlay(hexGrid, avg, w, h, paletteRgb, edgeLevel);
    }

    return hexGrid;
  }

  function recognizePattern(img, w, h, paletteHex) {
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = sw;
    srcCanvas.height = sh;
    const sctx = srcCanvas.getContext("2d");
    sctx.drawImage(img, 0, 0, sw, sh);
    const data = sctx.getImageData(0, 0, sw, sh).data;

    // cells are NOT assumed square: divide width/height independently
    const cellW = sw / w;
    const cellH = sh / h;
    const shrink = 0.8; // only sample the central 80% of each cell, away from borders/grid lines
    const paletteRgb = paletteHex.map(hexToRgb).filter(Boolean);
    const hexGrid = new Array(h);

    for (let row = 0; row < h; row++) {
      hexGrid[row] = new Array(w);
      for (let col = 0; col < w; col++) {
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        const sampleW = Math.max(1, cellW * shrink);
        const sampleH = Math.max(1, cellH * shrink);
        let x0 = clamp(Math.floor(cx - sampleW / 2), 0, sw - 1);
        let x1 = clamp(Math.ceil(cx + sampleW / 2), x0 + 1, sw);
        let y0 = clamp(Math.floor(cy - sampleH / 2), 0, sh - 1);
        let y1 = clamp(Math.ceil(cy + sampleH / 2), y0 + 1, sh);

        const counts = new Map();
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * sw + x) * 4;
            const key = data[i] + "," + data[i + 1] + "," + data[i + 2];
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
        let bestKey = null;
        let bestCount = -1;
        for (const [key, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bestKey = key;
          }
        }
        const [r, g, b] = bestKey.split(",").map(Number);
        const idx = nearestIndex([r, g, b], paletteRgb);
        hexGrid[row][col] = rgbToHex(...paletteRgb[idx]);
      }
    }
    return hexGrid;
  }

  // one extra row/column of header space when the coordinate axis is shown
  const axisOffset = showAxis ? cellPx : 0;

  /* -- draw result to canvas -- */

  useEffect(() => {
    if (!resultGrid || !canvasRef.current) return;
    const h = resultGrid.length;
    const w = resultGrid[0].length;
    const canvas = canvasRef.current;
    canvas.width = w * cellPx + axisOffset;
    canvas.height = h * cellPx + axisOffset;
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = resultGrid[y][x];
        ctx.fillRect(axisOffset + x * cellPx, axisOffset + y * cellPx, cellPx, cellPx);
      }
    }
    if (showGrid && cellPx >= 4) {
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(axisOffset + x * cellPx + 0.5, axisOffset);
        ctx.lineTo(axisOffset + x * cellPx + 0.5, axisOffset + h * cellPx);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(axisOffset, axisOffset + y * cellPx + 0.5);
        ctx.lineTo(axisOffset + w * cellPx, axisOffset + y * cellPx + 0.5);
        ctx.stroke();
      }
    }
    const lineKinds = [];
    if (labelCoord) lineKinds.push("coord");
    if (labelIndex) lineKinds.push("index");
    if (labelHex) lineKinds.push("hex");
    if (lineKinds.length > 0 && cellPx >= 10) {
      const lineH = cellPx / lineKinds.length;
      const maxTextWidth = cellPx - 2;

      // size each label kind from its own worst-case (longest) text so a
      // short value (e.g. "3") never gets stretched to fill the same
      // width as a long one (e.g. "255,255") - that squishing is what
      // looked ugly. fillText is then called without a maxWidth.
      const worstCase = {};
      if (labelCoord) {
        const corners = [
          `(${originX},${originY})`,
          `(${originX + w - 1},${originY})`,
          `(${originX},${originY + h - 1})`,
          `(${originX + w - 1},${originY + h - 1})`,
        ];
        worstCase.coord = corners.reduce((a, b) => (b.length > a.length ? b : a));
      }
      if (labelIndex) worstCase.index = String(palette.length);
      if (labelHex) worstCase.hex = "#000000";

      const probeSize = 100;
      const fontSizeForKind = {};
      for (const kind of lineKinds) {
        ctx.font = `${probeSize}px 'JetBrains Mono', monospace`;
        const measured = ctx.measureText(worstCase[kind]).width;
        const byWidth = measured > 0 ? (probeSize * maxTextWidth) / measured : probeSize;
        const byHeight = lineH * 0.5;
        fontSizeForKind[kind] = Math.max(5, Math.floor(Math.min(byWidth, byHeight)));
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const hex = resultGrid[y][x];
          const rgb = hexToRgb(hex) || [0, 0, 0];
          const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
          ctx.fillStyle = luminance > 0.55 ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.88)";
          const cx = axisOffset + x * cellPx + cellPx / 2;
          let ty = axisOffset + y * cellPx + lineH / 2;
          for (const kind of lineKinds) {
            let text = "";
            if (kind === "coord") text = `(${originX + x},${originY + y})`;
            else if (kind === "index") {
              const idx = palette.indexOf(hex);
              text = idx >= 0 ? String(idx + 1) : "";
            } else if (kind === "hex") text = hex;
            if (text) {
              ctx.font = `${fontSizeForKind[kind]}px 'JetBrains Mono', monospace`;
              ctx.fillText(text, cx, ty);
            }
            ty += lineH;
          }
        }
      }
    }

    if (showAxis) {
      // header background for the top row and left column (this also
      // covers the top-left corner cell, which is left blank on purpose)
      ctx.fillStyle = "#E3E9E1";
      ctx.fillRect(0, 0, axisOffset + w * cellPx, axisOffset);
      ctx.fillRect(0, 0, axisOffset, axisOffset + h * cellPx);
      ctx.strokeStyle = "rgba(31,43,40,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisOffset + 0.5, 0);
      ctx.lineTo(axisOffset + 0.5, axisOffset + h * cellPx);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, axisOffset + 0.5);
      ctx.lineTo(axisOffset + w * cellPx, axisOffset + 0.5);
      ctx.stroke();

      if (cellPx >= 10) {
        const colWorst = [String(originX), String(originX + w - 1)].reduce((a, b) => (b.length > a.length ? b : a));
        const rowWorst = [String(originY), String(originY + h - 1)].reduce((a, b) => (b.length > a.length ? b : a));
        const probeSize = 100;
        ctx.font = `${probeSize}px 'JetBrains Mono', monospace`;
        const colMeasured = ctx.measureText(colWorst).width;
        const rowMeasured = ctx.measureText(rowWorst).width;
        const colFontSize = Math.max(5, Math.floor(Math.min(
          colMeasured > 0 ? (probeSize * (cellPx - 2)) / colMeasured : probeSize,
          axisOffset * 0.45
        )));
        const rowFontSize = Math.max(5, Math.floor(Math.min(
          rowMeasured > 0 ? (probeSize * (axisOffset - 2)) / rowMeasured : probeSize,
          cellPx * 0.45
        )));

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(31,43,40,0.85)";
        ctx.font = `${colFontSize}px 'JetBrains Mono', monospace`;
        for (let x = 0; x < w; x++) {
          ctx.fillText(String(originX + x), axisOffset + x * cellPx + cellPx / 2, axisOffset / 2);
        }
        ctx.font = `${rowFontSize}px 'JetBrains Mono', monospace`;
        for (let y = 0; y < h; y++) {
          ctx.fillText(String(originY + y), axisOffset / 2, axisOffset + y * cellPx + cellPx / 2);
        }
      }
    }
  }, [resultGrid, cellPx, showGrid, showAxis, labelCoord, labelIndex, labelHex, originX, originY, palette]);

  const cellFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const col = Math.floor(((e.clientX - rect.left) * scaleX - axisOffset) / cellPx);
    const row = Math.floor(((e.clientY - rect.top) * scaleY - axisOffset) / cellPx);
    return { row, col };
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    if (!resultGrid || !canvasRef.current) return;
    const { row, col } = cellFromEvent(e);
    if (row < 0 || row >= resultGrid.length || col < 0 || col >= resultGrid[0].length) return;
    if (pickTarget) {
      handlePickColor(resultGrid[row][col]);
      return;
    }
    const alreadySelected = selectedCell && selectedCell.row === row && selectedCell.col === col;
    setSelectedCell({ row, col });
    canvasRef.current.focus({ preventScroll: true });
    if (!editMode) return;
    if (tool === "bucket") {
      if (alreadySelected) {
        const targetColor = resultGrid[row][col];
        if (targetColor !== activeColor) {
          pushHistory(resultGrid);
          setResultGrid(floodFillGrid(resultGrid, row, col, activeColor));
        }
      }
      return;
    }
    mouseDownCellRef.current = { row, col };
    strokeGridRef.current = resultGrid;
    isPaintingRef.current = true;
    if (alreadySelected) {
      // clicking a cell that's already selected paints it right away -
      // a mouse-only equivalent of "select, then press space"
      pushHistory(resultGrid);
      paintCellColor(row, col, activeColor);
      strokeStartedRef.current = true;
    } else {
      strokeStartedRef.current = false;
    }
  };

  const handleCanvasMouseUp = () => {
    isPaintingRef.current = false;
    mouseDownCellRef.current = null;
    strokeStartedRef.current = false;
  };

  const handleCanvasContextMenu = (e) => {
    if (e.shiftKey) return; // hold Shift to get the browser's own right-click menu
    e.preventDefault();
    setSelectedCell(null);
  };

  const handleCanvasKeyDown = (e) => {
    if (!selectedCell || !resultGrid) return;
    if (editMode && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      if (tool === "bucket") {
        const targetColor = resultGrid[selectedCell.row][selectedCell.col];
        if (targetColor !== activeColor) {
          pushHistory(resultGrid);
          setResultGrid(floodFillGrid(resultGrid, selectedCell.row, selectedCell.col, activeColor));
        }
      } else {
        pushHistory(resultGrid);
        paintCellColor(selectedCell.row, selectedCell.col, activeColor);
      }
      return;
    }
    const h = resultGrid.length;
    const w = resultGrid[0].length;
    let { row, col } = selectedCell;
    if (e.key === "ArrowUp") row = Math.max(0, row - 1);
    else if (e.key === "ArrowDown") row = Math.min(h - 1, row + 1);
    else if (e.key === "ArrowLeft") col = Math.max(0, col - 1);
    else if (e.key === "ArrowRight") col = Math.min(w - 1, col + 1);
    else return;
    e.preventDefault();
    setSelectedCell({ row, col });
  };

  const handleCanvasMouseMove = (e) => {
    if (!resultGrid || !canvasRef.current) return;
    if (!editMode || !isPaintingRef.current) return;
    const { row, col } = cellFromEvent(e);
    const valid = row >= 0 && row < resultGrid.length && col >= 0 && col < resultGrid[0].length;
    if (!valid) return;
    const down = mouseDownCellRef.current;
    if (down && (down.row !== row || down.col !== col)) {
      // only once the cursor actually leaves the starting cell do we treat
      // this as a drag stroke - a plain click never paints anything
      if (!strokeStartedRef.current) {
        pushHistory(strokeGridRef.current);
        paintCellColor(down.row, down.col, activeColor);
        strokeStartedRef.current = true;
      }
      paintCellColor(row, col, activeColor);
      setSelectedCell({ row, col });
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "pixel-board.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleRootClick = (e) => {
    if (canvasRef.current && !canvasRef.current.contains(e.target)) {
      setSelectedCell(null);
    }
  };

  const totalCells = gridW * gridH;
  const sliderFillStyle = (value, min, max) => ({ "--fill": `${((value - min) / (max - min)) * 100}%` });

  const CROP_HANDLE_LABELS = { nw: "左上角", ne: "右上角", sw: "左下角", se: "右下角" };

  return (
    <div className="pbc" onClick={handleRootClick}>
      <style>{`
        .pbc {
          --paper: #EDF1EC;
          --ink: #1F2B28;
          --muted: #5B6B63;
          --line: #C7D1C7;
          --accent: #ED669B;
          --accent-rgb: 237, 102, 155;
          --accent-dark: #C2547F;
          --amber: #C9862B;
          --panel: #FFFFFF;
          --panel-alt: #F6F8F4;
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100%;
          padding: 28px 20px 48px;
          box-sizing: border-box;
        }
        .pbc * { box-sizing: border-box; }
        .pbc-header h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 1.4rem;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }
        .pbc-header p {
          margin: 0;
          color: var(--muted);
          font-size: 0.92rem;
          line-height: 1.5;
        }
        .pbc-layout {
          display: grid;
          grid-template-columns: var(--sidebar-width, 300px) minmax(320px, 1fr);
          gap: 20px;
          margin-top: 22px;
          align-items: start;
        }
        .pbc-sidebar-wrap {
          position: sticky;
          top: 20px;
          max-height: calc(100vh - 40px);
          display: flex;
          align-items: stretch;
        }
        .pbc-sidebar {
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 4px;
          flex: 1;
          min-width: 0;
        }
        .pbc-resize-handle {
          flex: 0 0 10px;
          position: relative;
          cursor: col-resize;
        }
        .pbc-resize-handle::after {
          content: "";
          position: absolute;
          top: 0;
          left: 4px;
          width: 2px;
          height: 100%;
          background: var(--line);
          transition: background 0.12s ease;
        }
        .pbc-resize-handle:hover::after,
        .pbc-resize-handle:active::after {
          background: var(--accent);
        }
        @media (max-width: 860px) {
          .pbc-layout { grid-template-columns: 1fr; }
          .pbc-sidebar-wrap {
            position: static;
            max-height: none;
          }
          .pbc-sidebar {
            overflow-y: visible;
            padding-right: 0;
          }
          .pbc-resize-handle { display: none; }
        }
        .panel {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 16px;
        }
        .panel + .panel { margin-top: 16px; }
        .panel h2 {
          font-size: 0.86rem;
          font-weight: 600;
          margin: 0 0 12px;
          color: var(--ink);
        }
        .field { margin-bottom: 12px; }
        .field:last-child { margin-bottom: 0; }
        .field label {
          display: block;
          font-size: 0.78rem;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .field input[type="number"],
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 6px 8px;
          font-family: inherit;
          font-size: 0.86rem;
          background: var(--panel-alt);
          color: var(--ink);
        }
        .field textarea {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          line-height: 1.5;
          resize: vertical;
          min-height: 64px;
        }
        .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .checkline {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          color: var(--ink);
          margin-top: 8px;
          cursor: pointer;
        }
        .checkline input[type="checkbox"] {
          accent-color: var(--accent);
        }
        .hint-text {
          font-size: 0.76rem;
          color: var(--muted);
          margin-top: 8px;
          line-height: 1.5;
        }
        .dropzone {
          border: 1.5px dashed var(--line);
          border-radius: 8px;
          padding: 18px 12px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          color: var(--muted);
          font-size: 0.82rem;
        }
        .dropzone.drag, .dropzone:hover {
          border-color: var(--accent);
          background: rgba(var(--accent-rgb), 0.06);
        }
        .dropzone svg { margin: 0 auto 6px; display: block; color: var(--accent); }
        .thumb {
          max-width: 100%;
          max-height: 90px;
          border-radius: 6px;
          border: 1px solid var(--line);
          display: block;
          margin: 10px auto 0;
        }
        .crop-wrap { margin-top: 10px; }
        .crop-stage {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-radius: 6px;
          border: 1px solid var(--line);
          user-select: none;
          touch-action: none;
        }
        .crop-stage img {
          display: block;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .crop-mask {
          position: absolute;
          background: rgba(0,0,0,0.5);
          pointer-events: none;
        }
        .crop-box {
          position: absolute;
          border: 1.5px solid #fff;
          box-shadow: 0 0 0 1px var(--accent);
          box-sizing: border-box;
          cursor: move;
        }
        .crop-handle {
          position: absolute;
          width: 10px;
          height: 10px;
          background: #fff;
          border: 1.5px solid var(--accent);
          border-radius: 50%;
        }
        .crop-handle-nw { top: -5px; left: -5px; cursor: nwse-resize; }
        .crop-handle-ne { top: -5px; right: -5px; cursor: nesw-resize; }
        .crop-handle-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
        .crop-handle-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
        .palette-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .palette-head h2 { margin: 0; }
        .count-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          color: var(--muted);
        }
        .btn {
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-primary { background: var(--accent); color: #fff; }
        .btn-primary:hover { background: var(--accent-dark); }
        .btn-ghost { background: transparent; border-color: var(--line); color: var(--ink); }
        .btn-ghost:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
        .btn-full { width: 100%; justify-content: center; }
        .color-input {
          width: 100%;
          flex: 1;
          min-width: 0;
          height: 34px;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 2px;
          background: var(--panel-alt);
          cursor: pointer;
        }
        .swatch-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
          margin-top: 10px;
        }
        .swatch {
          position: relative;
          aspect-ratio: 1;
          border-radius: 3px;
          border: 1px solid rgba(0,0,0,0.12);
          overflow: visible;
        }
        .swatch.active {
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--accent);
        }
        .swatch input[type="color"] {
          position: absolute;
          inset: -4px;
          width: calc(100% + 8px);
          height: calc(100% + 8px);
          border: none;
          padding: 0;
          cursor: pointer;
          opacity: 1;
        }
        .swatch-pick {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
          padding: 0;
          background: transparent;
          cursor: pointer;
        }
        .swatch .remove {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #1F2B28;
          color: #fff;
          border: none;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          padding: 0;
        }
        .swatch:hover .remove { display: flex; }
        .add-swatch {
          aspect-ratio: 1;
          border-radius: 3px;
          border: 1px dashed var(--line);
          background: var(--panel-alt);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
        }
        .add-swatch:hover { border-color: var(--accent); color: var(--accent); }
        .slider-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .slider-row input[type="range"] {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 14px;
          cursor: pointer;
        }
        .slider-row input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 3px;
          border: 1px solid var(--line);
          background: linear-gradient(to right, var(--accent) var(--fill), #fff var(--fill));
        }
        .slider-row input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          border: 1px solid var(--line);
          background: linear-gradient(to right, var(--accent) var(--fill), #fff var(--fill));
        }
        .slider-row input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          margin-top: -4px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          cursor: pointer;
          transition: background 0.12s ease, transform 0.12s ease;
        }
        .slider-row input[type="range"]::-webkit-slider-thumb:hover {
          background: var(--accent-dark);
          transform: scale(1.15);
        }
        .slider-row input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          cursor: pointer;
          transition: background 0.12s ease, transform 0.12s ease;
        }
        .slider-row input[type="range"]::-moz-range-thumb:hover {
          background: var(--accent-dark);
          transform: scale(1.15);
        }
        .slider-row span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.74rem;
          color: var(--muted);
          width: 40px;
          text-align: right;
        }
        .result-panel h2 { margin-bottom: 6px; }
        .canvas-wrap {
          overflow: auto;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--panel-alt);
          padding: 14px;
          display: flex;
          justify-content: center;
          min-height: 240px;
          align-items: center;
          gap: 14px;
        }
        .canvas-wrap canvas {
          image-rendering: pixelated;
          display: block;
          cursor: crosshair;
          outline: none;
        }
        .placeholder {
          color: var(--muted);
          font-size: 0.86rem;
          text-align: center;
          padding: 40px 20px;
        }
        .canvas-inner {
          position: relative;
          display: inline-block;
          flex-shrink: 0;
        }
        .compare-panel {
          align-self: flex-start;
          flex-shrink: 0;
          width: 140px;
        }
        .compare-frame {
          position: relative;
          width: 100%;
          height: 100%;
          border: 1px solid var(--line);
          border-radius: 6px;
          overflow: hidden;
          cursor: zoom-in;
          background: #000;
        }
        .compare-panel.expanded .compare-frame {
          cursor: zoom-out;
        }
        .compare-frame img {
          display: block;
          position: absolute;
          max-width: none;
          pointer-events: none;
        }
        .compare-hint {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0,0,0,0.55);
          color: #fff;
          font-size: 0.62rem;
          padding: 2px 4px;
          text-align: center;
          pointer-events: none;
        }
        .selection-tooltip {
          position: absolute;
          pointer-events: none;
          background: #fff;
          color: var(--ink);
          border: 1px solid var(--line);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          padding: 4px 7px;
          border-radius: 4px;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
          z-index: 5;
        }
        .selection-tooltip-sw {
          width: 9px;
          height: 9px;
          border-radius: 2px;
          border: 1px solid rgba(0,0,0,0.25);
          flex-shrink: 0;
        }
        .selection-box {
          position: absolute;
          pointer-events: none;
          border: 2px solid var(--accent);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.9);
          box-sizing: border-box;
        }
        .selection-readout {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.76rem;
          color: var(--muted);
          margin-top: 8px;
          min-height: 1.2em;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .selection-readout .sw {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          border: 1px solid rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .stats-line {
          font-size: 0.8rem;
          color: var(--muted);
          margin: 14px 0 10px;
        }
        .materials-list {
          max-height: 240px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 14px;
        }
        .materials-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.76rem;
          padding: 2px 0;
        }
        .materials-row .sw {
          width: 13px;
          height: 13px;
          border-radius: 2px;
          border: 1px solid rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .materials-row .count { margin-left: auto; color: var(--ink); }
        .processing-tag {
          font-size: 0.74rem;
          color: var(--amber);
          margin-left: 8px;
        }
        .pbc-footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid var(--line);
          font-size: 0.78rem;
          color: var(--muted);
          line-height: 1.7;
        }
        .pbc-footer .credits {
          display: flex;
          flex-wrap: wrap;
          column-gap: 16px;
          row-gap: 4px;
          margin-bottom: 12px;
          color: var(--ink);
        }
        .pbc-footer a {
          color: var(--accent);
          text-decoration: none;
        }
        .pbc-footer a:hover {
          text-decoration: underline;
        }
        .pbc-footer p {
          margin: 0 0 8px;
        }
        .pbc-footer p:last-child {
          margin-bottom: 0;
        }
      `}</style>

      <div className="pbc-header">
        <h1>像素画转换器</h1>
        <p>上传图片，设定网格尺寸和调色板，生成对应的像素网格，也可以手动编辑或识别已有图纸。</p>
      </div>

      <div className="pbc-layout" style={{ "--sidebar-width": `${sidebarWidth}px` }}>
        {/* left: setup */}
        <div className="pbc-sidebar-wrap">
        <div className="pbc-sidebar">
          <div className="panel">
            <h2>上传图片</h2>
            <label className="checkline" style={{ marginTop: 0 }}>
              <input
                type="checkbox"
                checked={sourceMode === "pattern"}
                onChange={(e) => {
                  if (!confirmDiscardEdits()) return;
                  setSourceMode(e.target.checked ? "pattern" : "photo");
                }}
              />
              这是像素图纸
            </label>
            <div
              className={`dropzone${isDragging ? " drag" : ""}`}
              style={{ marginTop: 10 }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <Upload size={18} />
              点击选择图片，或拖放到此处
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            {sourceMode === "pattern" && (
              <p className="hint-text">
                图纸模式：按照"网格尺寸"中设置的宽和高自动识别已有图纸。
              </p>
            )}
            {imgSrc && sourceMode === "pattern" && <img className="thumb" src={imgSrc} alt="原图预览" />}
            {imgSrc && sourceMode === "photo" && imgNatural && (
              <div className="crop-wrap">
                <div
                  className="crop-stage"
                  ref={cropStageRef}
                  style={{ aspectRatio: `${imgNatural.w} / ${imgNatural.h}` }}
                >
                  <img src={imgSrc} alt="裁剪预览" draggable={false} />
                  <div className="crop-mask" style={{ left: 0, top: 0, right: 0, height: `${cropRect.y * 100}%` }} />
                  <div className="crop-mask" style={{ left: 0, bottom: 0, right: 0, height: `${(1 - cropRect.y - cropRect.height) * 100}%` }} />
                  <div className="crop-mask" style={{ left: 0, top: `${cropRect.y * 100}%`, width: `${cropRect.x * 100}%`, height: `${cropRect.height * 100}%` }} />
                  <div className="crop-mask" style={{ right: 0, top: `${cropRect.y * 100}%`, width: `${(1 - cropRect.x - cropRect.width) * 100}%`, height: `${cropRect.height * 100}%` }} />
                  <div
                    className="crop-box"
                    style={{
                      left: `${cropRect.x * 100}%`,
                      top: `${cropRect.y * 100}%`,
                      width: `${cropRect.width * 100}%`,
                      height: `${cropRect.height * 100}%`,
                    }}
                    onMouseDown={(e) => startCropDrag(e, "move")}
                  >
                    {["nw", "ne", "sw", "se"].map((corner) => (
                      <div
                        key={corner}
                        className={`crop-handle crop-handle-${corner}`}
                        aria-label={`拖动调整裁剪框${CROP_HANDLE_LABELS[corner]}`}
                        onMouseDown={(e) => { e.stopPropagation(); startCropDrag(e, corner); }}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={applyCrop}>应用裁剪</button>
                  <button className="btn btn-ghost" onClick={resetCrop}>重置</button>
                </div>
                <p className="hint-text">调整裁剪框并应用裁剪。</p>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>网格尺寸</h2>
            <div className="row2">
              <div className="field">
                <label>宽（格）</label>
                <input type="number" min={4} max={256} value={widthInput} onChange={(e) => setWidthInput(e.target.value)} onBlur={commitWidth} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}/>
              </div>
              <div className="field">
                <label>高（格）</label>
                <input type="number" min={4} max={256} value={heightInput} onChange={(e) => setHeightInput(e.target.value)} onBlur={commitHeight} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}/>
              </div>
            </div>
            <label className="checkline">
              <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
              锁定原图比例
            </label>
            <div className="field" style={{ marginTop: 12 }}>
              <label>起始坐标位于</label>
              <select value={cornerChoice} onChange={(e) => handleCornerChange(e.target.value)}>
                <option value="tl">左上角</option>
                <option value="tr">右上角</option>
                <option value="bl">左下角</option>
                <option value="br">右下角</option>
              </select>
            </div>
            <div className="row2">
              <div className="field">
                <label>X 坐标</label>
                <input type="number" value={refXInput} onChange={(e) => setRefXInput(e.target.value)} onBlur={commitRefX} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
              </div>
              <div className="field">
                <label>Y 坐标</label>
                <input type="number" value={refYInput} onChange={(e) => setRefYInput(e.target.value)} onBlur={commitRefY} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="palette-head">
              <h2>调色板</h2>
              <span className="count-badge">{palette.length} 色</span>
            </div>
            <div className="field">
              <label>内置色组</label>
              <select value={selectedPresetId} onChange={(e) => {if (e.target.value) {applyPreset(e.target.value);}}}>
                <option value="">选择一个色组快速应用…</option>
                {PALETTE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>导入色组文件</label>
              <button className="btn btn-ghost btn-full" onClick={() => paletteFileInputRef.current?.click()}>
                <Upload size={14} />
                导入 .aco / .act 文件
              </button>
              <input
                ref={paletteFileInputRef}
                type="file"
                accept=".aco,.act"
                style={{ display: "none" }}
                onChange={(e) => {
                  handlePaletteFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="field">
              <label>粘贴颜色十六进制代码（使用空格 / 逗号 / 换行 / 分号分隔，如 #ffffff, #000000）</label>
              <textarea value={paletteText} onChange={(e) => setPaletteText(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-full" onClick={applyPaletteText}>应用颜色代码</button>
            <div className="swatch-grid">
              {palette.map((hex, i) => (
                <div className={`swatch${editMode && activeColor === hex ? " active" : ""}`} key={i} style={{ background: hex }} title={`${hex} · 第 ${i + 1} 色`}>
                  {pickTarget ? (
                    <button className="swatch-pick" onClick={() => handlePickColor(hex)} aria-label={`取色 ${hex}`} />
                  ) : editMode ? (
                    <button className="swatch-pick" onClick={() => setActiveColor(hex)} aria-label={`选择颜色 ${hex}`} />
                  ) : (
                    <>
                      <input type="color" value={hex} onChange={(e) => updateSwatch(i, e.target.value)} />
                      <button className="remove" onClick={(e) => { e.stopPropagation(); removeSwatch(i); }}>
                        <X size={9} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {!editMode && (
                <div className="add-swatch" onClick={addSwatch}>
                  <Plus size={14} />
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="palette-head">
              <h2>编辑</h2>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" onClick={undo} disabled={history.length === 0} title="撤销 (Ctrl+Z)">
                  <Undo2 size={14} />
                </button>
                <button className="btn btn-ghost" onClick={redo} disabled={future.length === 0} title="重做 (Ctrl+Y)">
                  <Redo2 size={14} />
                </button>
                <button className="btn btn-ghost" onClick={resetAllEdits} disabled={history.length === 0} title="重置所有手动编辑">
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
            <label className="checkline" style={{ marginTop: 0 }}>
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              开启编辑模式
            </label>
            {editMode && (
              <>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <input
                    type="color"
                    className="color-input"
                    style={{ flex: "0 0 34px" }}
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    title="自定义当前颜色"
                  />
                  <button
                    className={`btn ${pickTarget === "active" ? "btn-primary" : "btn-ghost"}`}
                    style={{ flex: "0 0 auto" }}
                    onClick={() => setPickTarget(pickTarget === "active" ? null : "active")}
                    title="从调色板或画布取色"
                  >
                    <Pipette size={14} />
                  </button>
                  <button className={`btn ${tool === "brush" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setTool("brush")}>画笔</button>
                  <button className={`btn ${tool === "bucket" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setTool("bucket")}>油漆桶</button>
                </div>
                <p className="hint-text">
                  可自由选择目标色，点击调色板选取指定色，或通过吸管使用取色模式。在画布上单击以选中网格，右键或点击画布外取消选中。再次单击 / 空格 / 回车，或直接按住并拖动鼠标上色，也可以通过方向键调整选中的网格。Ctrl+Z 撤销，Ctrl+Y 重做。
                </p>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>颜色替换</label>
                  <div className="row2">
                    <div className="field">
                      <label>原始色</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="color" className="color-input" value={replaceColorA} onChange={(e) => setReplaceColorA(e.target.value)} />
                        <button
                          className={`btn ${pickTarget === "A" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setPickTarget(pickTarget === "A" ? null : "A")}
                          title="从调色板或画布取色"
                        >
                          <Pipette size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      <label>目标色</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="color" className="color-input" value={replaceColorB} onChange={(e) => setReplaceColorB(e.target.value)} />
                        <button
                          className={`btn ${pickTarget === "B" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setPickTarget(pickTarget === "B" ? null : "B")}
                          title="从调色板或画布取色"
                        >
                          <Pipette size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {pickTarget && (
                    <p className="hint-text">
                      取色模式：点击调色板或网格选取颜色，再次点击图标以取消。
                    </p>
                  )}
                  <button className="btn btn-primary btn-full" onClick={applyColorReplace}>替换</button>
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <div className="palette-head">
              <h2>显示</h2>
              <button className="btn btn-ghost" onClick={resetDisplayOptions}>重置</button>
            </div>
            {sourceMode === "photo" && (
              <>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>降噪强度</label>
                  <div className="slider-row">
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={denoiseLive}
                      style={sliderFillStyle(denoiseLive, 0, 20)}
                      onChange={(e) => setDenoiseLive(parseInt(e.target.value))}
                      onMouseUp={commitDenoise}
                      onTouchEnd={commitDenoise}
                      onKeyUp={commitDenoise}
                    />
                    <span>{denoiseLive}</span>
                  </div>
                </div>
                <div className="field">
                  <label>边界强化</label>
                  <div className="slider-row">
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={edgeLive}
                      style={sliderFillStyle(edgeLive, 0, 20)}
                      onChange={(e) => setEdgeLive(parseInt(e.target.value))}
                      onMouseUp={commitEdge}
                      onTouchEnd={commitEdge}
                      onKeyUp={commitEdge}
                    />
                    <span>{edgeLive}</span>
                  </div>
                </div>
              </>
            )}
            <label className="checkline">
              <input
                type="checkbox"
                checked={dither}
                onChange={(e) => {
                  if (!confirmDiscardEdits()) return;
                  setDither(e.target.checked);
                }}
              />
              色彩抖动
            </label>
            <label className="checkline">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              网格线
            </label>
            <label className="checkline">
              <input type="checkbox" checked={showAxis} onChange={(e) => setShowAxis(e.target.checked)} />
              坐标轴
            </label>
            <label className="checkline">
              <input type="checkbox" checked={labelCoord} onChange={(e) => setLabelCoord(e.target.checked)} />
              坐标
            </label>
            <label className="checkline">
              <input type="checkbox" checked={labelIndex} onChange={(e) => setLabelIndex(e.target.checked)} />
              调色板序号
            </label>
            <label className="checkline">
              <input type="checkbox" checked={labelHex} onChange={(e) => setLabelHex(e.target.checked)} />
              颜色十六进制代码
            </label>
            {(labelCoord || labelIndex || labelHex || showAxis) && (
              <p className="hint-text">
                标注过多时显示不清晰，可通过下方"预览网格大小"滑块调整。标注会保存在下载图片中。
              </p>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <label>预览网格大小</label>
              <div className="slider-row">
                <input type="range" min={4} max={60} value={cellPx} style={sliderFillStyle(cellPx, 4, 60)} onChange={(e) => setCellPx(parseInt(e.target.value))} />
                <span>{cellPx}px</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pbc-resize-handle" onMouseDown={startSidebarResize} title="拖动调整侧栏宽度" />
        </div>

        {/* right: result */}
        <div className="panel result-panel">
          <h2>
            像素预览
            {isProcessing && <span className="processing-tag">生成中…</span>}
          </h2>
          <div className="canvas-wrap">
            {resultGrid ? (
              <>
                {imgSrc && imgNatural && (() => {
                  const effRect = sourceMode === "pattern" ? { x: 0, y: 0, width: 1, height: 1 } : appliedCropRect;
                  const cropAspect = (imgNatural.w * effRect.width) / (imgNatural.h * effRect.height);
                  const canvasPxH = resultGrid.length * cellPx + axisOffset;
                  const panelStyle = compareExpanded
                    ? { width: canvasPxH * cropAspect, height: canvasPxH }
                    : { aspectRatio: `${cropAspect}` };
                  return (
                    <div
                      className={`compare-panel${compareExpanded ? " expanded" : ""}`}
                      style={panelStyle}
                    >
                      <div
                        className="compare-frame"
                        onClick={(e) => { e.stopPropagation(); setCompareExpanded((v) => !v); }}
                        title={compareExpanded ? "点击缩小" : "点击放大对比原图"}
                      >
                        <img
                          src={imgSrc}
                          alt="原图对比"
                          draggable={false}
                          style={{
                            width: `${100 / effRect.width}%`,
                            height: `${100 / effRect.height}%`,
                            left: `${(-effRect.x / effRect.width) * 100}%`,
                            top: `${(-effRect.y / effRect.height) * 100}%`,
                          }}
                        />
                        <span className="compare-hint">{compareExpanded ? "点击缩小" : "原图"}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="canvas-inner">
                  <canvas
                    ref={canvasRef}
                    tabIndex={0}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseUp={handleCanvasMouseUp}
                    onContextMenu={handleCanvasContextMenu}
                    onKeyDown={handleCanvasKeyDown}
                    onMouseMove={handleCanvasMouseMove}
                  />
                  {selectedCell && (
                    <div
                      className="selection-box"
                      style={{
                        left: axisOffset + selectedCell.col * cellPx,
                        top: axisOffset + selectedCell.row * cellPx,
                        width: cellPx,
                        height: cellPx,
                      }}
                    />
                  )}
                  {selectedCell && (() => {
                    const gridWpx = axisOffset + resultGrid[0].length * cellPx;
                    const gridHpx = axisOffset + resultGrid.length * cellPx;
                    const cellLeft = axisOffset + selectedCell.col * cellPx;
                    const cellTop = axisOffset + selectedCell.row * cellPx;
                    const flipX = cellLeft > gridWpx / 2;
                    const flipY = cellTop > gridHpx / 2;
                    const hex = resultGrid[selectedCell.row][selectedCell.col];
                    return (
                      <div
                        className="selection-tooltip"
                        style={{
                          left: flipX ? cellLeft - 6 : cellLeft + cellPx + 6,
                          top: flipY ? cellTop + cellPx : cellTop,
                          transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
                        }}
                      >
                        <span className="selection-tooltip-sw" style={{ background: hex }} />
                        ({originX + selectedCell.col},{originY + selectedCell.row}) {hex}
                        {palette.indexOf(hex) >= 0 && <> · 第 {palette.indexOf(hex) + 1} 色</>}
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="placeholder">上传图片后，像素网格将在此处显示</div>
            )}
          </div>

          {resultGrid && (
            <div className="selection-readout">
              {selectedCell ? (
                <>
                  <span className="sw" style={{ background: resultGrid[selectedCell.row][selectedCell.col] }} />
                  已选中 ({originX + selectedCell.col},{originY + selectedCell.row}) {resultGrid[selectedCell.row][selectedCell.col]}
                  {palette.indexOf(resultGrid[selectedCell.row][selectedCell.col]) >= 0 && (
                    <> · 第 {palette.indexOf(resultGrid[selectedCell.row][selectedCell.col]) + 1} 色</>
                  )}
                </>
              ) : (
                "点击网格选中，方向键调整，右键取消选中（按住 Shift 右键可打开浏览器菜单）"
              )}
            </div>
          )}

          {resultGrid && (
            <>
              <div className="stats-line">
                共 {gridW} × {gridH} = {totalCells} 格，{colorCounts.length} 种颜色
              </div>
              <div className="materials-list">
                {colorCounts.map((c) => (
                  <div className="materials-row" key={c.hex}>
                    <span className="sw" style={{ background: c.hex }} />
                    <span>{c.hex}</span>
                    <span className="count">{c.count} 格</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-full" onClick={handleDownload}>
                <Download size={15} />
                下载 PNG
              </button>
            </>
          )}
        </div>
      </div>

      <div className="pbc-footer">
        <div className="credits">
          <span>作者：玖云</span>
          <a href="https://b23.tv/nlrfgrD" target="_blank" rel="noopener noreferrer">B站 @玖云-</a>
          <a href="https://xhslink.cn/o/3f8MMhvl8I9" target="_blank" rel="noopener noreferrer">小红书 @玖云</a>
          <a href="https://github.com/JiuyunSama" target="_blank" rel="noopener noreferrer">GitHub @JiuyunSama</a>
          <span>项目库：待发布</span>
        </div>
        <p>为了伟大的互联网共享精神，网页完全免费开源。</p>
        <p>如果在使用过程中有任何疑问和建议，请随时联系，我会尽快回复。如果对大家有帮助，也欢迎大家评论反馈。</p>
        <p>本项目的制作初衷是网易阴阳师手游十周年为崽而战，阴阳师的玩家们是这个世界上最好的人，祝阴阳师永不关服，我们二十周年见！请支持追月神！</p>
      </div>
    </div>
  );
}