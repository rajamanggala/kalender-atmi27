// ====== PENGATURAN: ubah di sini saja ======
const CONFIG = {
  driveUrl: "https://drive.google.com/drive/folders/1WQkh77W6pygyDRqmalkVmO3AE-DEo_0D?usp=sharing",
  docs: {
    dinding: { file: "pdf/kalender-dinding-preview.pdf", saveAs: "Kalender-Dinding-ATMI-2027.pdf" },
    duduk:   { file: "pdf/kalender-duduk-preview.pdf",   saveAs: "Kalender-Duduk-ATMI-2027.pdf" },
  },
};
// ===========================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), canvas = $("canvas"), ctx = canvas.getContext("2d"), status = $("status");
const MAXPX = 4096, ZMIN = 1, ZMAX = 5;                                      // batas ketajaman & zoom
const T = () => $("top").offsetHeight - 6;                                   // ruang header
const B = () => innerHeight - $("dock").getBoundingClientRect().top + 14;    // ruang dock
const off = () => (T() - B()) / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const two = (n) => String(n).padStart(2, "0");

const cache = {};
let pdf = null, key = null, page = 1, zoom = 1, px = 0, py = 0;
let base = null, fit = 1, task = null, token = 0, rt;

async function openDoc(k) {
  if (!CONFIG.docs[k]) k = "dinding";
  key = k; page = 1; zoom = 1; px = py = 0;
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.doc === k)));
  const d = CONFIG.docs[k];
  $("dlPdf").href = d.file; $("dlPdf").setAttribute("download", d.saveAs);
  $("dlDrive").href = CONFIG.driveUrl;
  history.replaceState(null, "", "#" + k);
  status.textContent = "Memuat kalender…"; canvas.style.visibility = "hidden";
  try {
    pdf = cache[k] || (cache[k] = await pdfjsLib.getDocument(d.file).promise);
    if (key !== k) return;
    $("pageAll").textContent = two(pdf.numPages);
    await render();
  } catch (e) {
    status.textContent = "PDF gagal dimuat. Pastikan file ada di folder pdf/ dan namanya sesuai app.js.";
    console.error(e);
  }
}

// atur ukuran & posisi (cepat, tanpa render ulang)
function place() {
  if (!base) return;
  const W = stage.clientWidth, H = stage.clientHeight;
  fit = Math.min((W - 32) / base.width, (H - T() - B()) / base.height);
  const s = fit * zoom, cw = base.width * s, ch = base.height * s;
  const mx = Math.max(0, (cw - W) / 2 + 80), my = Math.max(0, (ch - H) / 2 + 80);
  px = clamp(px, -mx, mx); py = clamp(py, -my, my);
  canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
  canvas.style.transform = `translate(-50%,-50%) translate(${px}px,${py + off()}px)`;
  stage.classList.toggle("zoomed", zoom > 1.001);
  $("zoomVal").textContent = Math.round(zoom * 100) + "%";
}

// gambar ulang dengan ketajaman sesuai zoom
async function render() {
  const my = ++token;
  if (task) task.cancel();
  const p = await pdf.getPage(page);
  if (my !== token) return;
  base = p.getViewport({ scale: 1 });
  place();
  const r = Math.min(fit * zoom * (window.devicePixelRatio || 1), MAXPX / Math.max(base.width, base.height));
  const vp = p.getViewport({ scale: r });
  const off = document.createElement("canvas");
  off.width = Math.floor(vp.width); off.height = Math.floor(vp.height);
  task = p.render({ canvasContext: off.getContext("2d"), viewport: vp });
  try { await task.promise; } catch (e) { return; }
  if (my !== token) return;
  canvas.width = off.width; canvas.height = off.height; ctx.drawImage(off, 0, 0);
  status.textContent = ""; canvas.style.visibility = "visible"; canvas.style.opacity = 1;
  $("pageNow").textContent = two(page);
  $("prev").disabled = $("dPrev").disabled = page <= 1;
  $("next").disabled = $("dNext").disabled = page >= pdf.numPages;
}

function go(n) {
  if (!pdf) return;
  n = clamp(n, 1, pdf.numPages);
  if (n === page) return;
  page = n; zoom = 1; px = py = 0; canvas.style.opacity = .3; render();
}

// zoom ke arah posisi kursor
function zoomAt(nz, mx, my) {
  nz = clamp(nz, ZMIN, ZMAX);
  if (!base || nz === zoom) return;
  const r = stage.getBoundingClientRect();
  const cx = mx - r.left - r.width / 2, cy = my - r.top - r.height / 2 - off();
  const k = nz / zoom;
  px = cx - (cx - px) * k; py = cy - (cy - py) * k; zoom = nz;
  if (zoom <= 1.001) { zoom = 1; px = py = 0; }
  place();
  clearTimeout(rt); rt = setTimeout(() => pdf && render(), 150);
}
function zoomMid(nz) {
  const r = stage.getBoundingClientRect();
  zoomAt(nz, r.left + r.width / 2, r.top + r.height / 2 + off());
}

stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoomAt(zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
}, { passive: false });

// sentuhan & mouse: geser (grab), cubit 2 jari (pinch), ketuk 2x, geser kiri/kanan = ganti halaman
const ptrs = new Map();
let drag = null, pinch = null, lastTap = null;
const two2 = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

stage.addEventListener("pointerdown", (e) => {
  document.body.classList.remove("menu-open");
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stage.setPointerCapture(e.pointerId);
  if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, px, py, moved: false }; stage.classList.add("grab"); }
  else if (ptrs.size === 2) { drag = null; pinch = two2(); }
});
stage.addEventListener("pointermove", (e) => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) {
    const n = two2();
    zoomAt(zoom * n.d / pinch.d, n.x, n.y);
    if (zoom > 1.001) { px += n.x - pinch.x; py += n.y - pinch.y; place(); }
    pinch = n; return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 8) drag.moved = true;
  if (zoom > 1.001) { px = drag.px + dx; py = drag.py + dy; place(); }
});
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  if (pinch) {
    if (ptrs.size < 2) {            // sisa satu jari: lanjut menggeser tanpa memicu ganti halaman
      pinch = null;
      const r = [...ptrs.values()][0];
      drag = r ? { x: r.x, y: r.y, px, py, moved: true } : null;
      if (!r) stage.classList.remove("grab");
    }
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, up = e.type === "pointerup";
  if (up && zoom <= 1.001 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    go(page + (dx < 0 ? 1 : -1));
  } else if (up && !drag.moved) {   // ketuk: dua kali = zoom / kembali
    const now = performance.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      zoom > 1.001 ? zoomMid(1) : zoomAt(2.5, e.clientX, e.clientY);
      lastTap = null;
    } else lastTap = { t: now, x: e.clientX, y: e.clientY };
  }
  drag = null; stage.classList.remove("grab");
};
stage.addEventListener("pointerup", endPtr);
stage.addEventListener("pointercancel", endPtr);

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => openDoc(b.dataset.doc)));
$("prev").onclick = () => go(page - 1);
$("next").onclick = () => go(page + 1);
$("zoomIn").onclick = () => zoomMid(zoom * 1.25);
$("zoomOut").onclick = () => zoomMid(zoom / 1.25);
$("full").onclick = toggleFull;
$("dPrev").onclick = () => go(page - 1);
$("dNext").onclick = () => go(page + 1);
$("more").onclick = (e) => { e.stopPropagation(); document.body.classList.toggle("menu-open"); };
document.querySelectorAll(".actions a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place());

document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); go(page + 1); }
  else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(page - 1); }
  else if (k === "Home") go(1);
  else if (k === "End") go(pdf ? pdf.numPages : 1);
  else if (k === "+" || k === "=") zoomMid(zoom * 1.25);
  else if (k === "-") zoomMid(zoom / 1.25);
  else if (k === "0") zoomMid(1);
  else if (k === "f" || k === "F") toggleFull();
  else if (k === "1") openDoc("dinding");
  else if (k === "2") openDoc("duduk");
});
document.addEventListener("fullscreenchange", () => pdf && render());
window.addEventListener("resize", () => { place(); clearTimeout(rt); rt = setTimeout(() => pdf && render(), 150); });

// tombol & header memudar saat mouse diam (muncul lagi saat bergerak)
let idleT;
function wake() {
  document.body.classList.remove("idle");
  clearTimeout(idleT);
  idleT = setTimeout(() => document.body.classList.add("idle"), 3000);
}
["mousemove", "keydown", "pointerdown", "touchstart"].forEach((ev) => document.addEventListener(ev, wake, { passive: true }));
wake();

openDoc(location.hash.slice(1) || "dinding");
