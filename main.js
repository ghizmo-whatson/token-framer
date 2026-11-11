/* Token Framer — all application JavaScript lives in this file.
 * Sections: tooltips, background engine/Worker, smart-removal panels, editor.
 * No imports, build step or separate worker script are required.
 */

/* ==================== TOOLTIPS ==================== */
// 1. Tooltips and setting explanations
/* One floating tooltip for settings: not clipped by a scrolling brush panel. */
(function (root) {
  "use strict";
  const popup = document.createElement("div");
  popup.id = "settingTooltip"; popup.className = "setting-tooltip";
  popup.setAttribute("role", "tooltip"); popup.hidden = true;
  document.body.append(popup);
  let active = null;
  function hide() {
    if (active) {
      const ids = (active.getAttribute("aria-describedby") || "").split(" ").filter(id => id && id !== popup.id);
      if (ids.length) active.setAttribute("aria-describedby", ids.join(" ")); else active.removeAttribute("aria-describedby");
    }
    active = null; popup.hidden = true;
  }
  function show(node) {
    if (!node || !node.dataset.help) { hide(); return; }
    hide(); active = node; popup.textContent = node.dataset.help; popup.hidden = false;
    node.setAttribute("aria-describedby", [node.getAttribute("aria-describedby"), popup.id].filter(Boolean).join(" "));
    const rect = node.getBoundingClientRect(), box = popup.getBoundingClientRect();
    popup.style.left = Math.max(10, Math.min(innerWidth - box.width - 10, rect.left + rect.width / 2 - box.width / 2)) + "px";
    popup.style.top = Math.max(10, rect.bottom + box.height + 12 < innerHeight ? rect.bottom + 8 : rect.top - box.height - 8) + "px";
  }
  document.addEventListener("pointerover", event => show(event.target.closest?.("[data-help]")));
  document.addEventListener("pointerout", event => {
    if (active && (!(event.relatedTarget instanceof Node) || !active.contains(event.relatedTarget))) hide();
  });
  document.addEventListener("focusin", event => show(event.target.closest?.("[data-help]")));
  document.addEventListener("focusout", hide);
  document.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !popup.hidden) { hide(); event.stopPropagation(); }
  }, true);
  root.EditorTooltips = {
    set(node, text, includeLabel = false) {
      if (!node) return;
      node.dataset.help = text; node.removeAttribute("title");
      const label = includeLabel && (node.closest("label") || node.closest(".brush-size-row") || node.closest(".brush-controls"));
      if (label) { label.dataset.help = text; label.removeAttribute("title"); }
      if (active === node || active === label) show(active);
    },
  };
})(globalThis);

/* ==================== BACKGROUND ==================== */
// 2. Background removal engine and local Blob Worker
/* Local, dependency-free image processing. This factory also runs in a Blob Worker. */
(function (root) {
  "use strict";
  function createEngine() {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let disposed = false;
    const pause = async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (disposed) throw new Error("Cancelled");
    };
    const linear = Float32Array.from({ length: 256 }, (_, v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    const srgb = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
    function rgbToLab(r, g, b) {
      r = linear[r]; g = linear[g]; b = linear[b];
      const f = v => v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116;
      const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
      const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
      const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    }
    let w, h, n, rgba, lab, gradient, percentile, mask, groups, stats, barrierKey, barrier;
    const opaque = i => rgba[i * 4 + 3] > 8;
    const delta = (i, j) => Math.hypot(lab[i * 3] - lab[j * 3], lab[i * 3 + 1] - lab[j * 3 + 1], lab[i * 3 + 2] - lab[j * 3 + 2]) / 128;
    const fromModel = (i, m) => Math.hypot(lab[i * 3] / 128 - m.lab[0], lab[i * 3 + 1] / 128 - m.lab[1], lab[i * 3 + 2] / 128 - m.lab[2]);
    const median = a => a.sort((a, b) => a - b)[a.length >> 1];

    async function prepare(image) {
      w = image.width; h = image.height; n = w * h;
      if (!w || !h || image.data.length !== n * 4) throw new Error("Invalid image");
      rgba = new Uint8ClampedArray(image.data);
      // Fixed-point LAB saves half the memory of three full-resolution float maps.
      lab = new Int16Array(n * 3);
      gradient = new Uint8Array(n);
      mask = null; barrier = null; barrierKey = null;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, p = i * 4;
          const c = rgbToLab(rgba[p], rgba[p + 1], rgba[p + 2]);
          for (let k = 0; k < 3; k++) lab[i * 3 + k] = Math.round(c[k] * 128);
        }
        if (y % 64 === 0) await pause();
      }
      // Three rolling Gaussian-blurred LAB rows: no second full-size float image.
      const rows = [new Float32Array(w * 3), new Float32Array(w * 3), new Float32Array(w * 3)];
      function blurRow(y, out) {
        y = clamp(y, 0, h - 1);
        for (let x = 0; x < w; x++) {
          const center = y * w + x;
          for (let c = 0; c < 3; c++) {
            let sum = 0, weight = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const i = clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1);
              const a = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
              // Invisible RGB must not create false contours.
              sum += lab[(opaque(i) ? i : center) * 3 + c] * a;
              weight += a;
            }
            out[x * 3 + c] = sum / (weight * 128);
          }
        }
      }
      blurRow(-1, rows[0]); blurRow(0, rows[1]); blurRow(1, rows[2]);
      const histogram = new Uint32Array(256);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!opaque(i)) continue;
          let power = 0;
          for (let c = 0; c < 3; c++) {
            const l = Math.max(0, x - 1) * 3 + c, m = x * 3 + c, r = Math.min(w - 1, x + 1) * 3 + c;
            const gx = rows[0][r] + 2 * rows[1][r] + rows[2][r] - rows[0][l] - 2 * rows[1][l] - rows[2][l];
            const gy = rows[2][l] + 2 * rows[2][m] + rows[2][r] - rows[0][l] - 2 * rows[0][m] - rows[0][r];
            power += (gx * gx + gy * gy) * (c === 0 ? 1 : 0.55);
          }
          gradient[i] = Math.min(255, Math.round(Math.sqrt(power) / 4 * 3));
          if (gradient[i] > 2) histogram[gradient[i]]++;
        }
        const first = rows.shift(); rows.push(first); blurRow(y + 2, first);
        if (y % 64 === 0) await pause();
      }
      const total = histogram.reduce((a, b) => a + b, 0);
      let acc = 0; percentile = 20;
      for (let i = 3; i < 256; i++) {
        acc += histogram[i];
        if (acc >= total * 0.85) { percentile = i; break; }
      }
      return { width: w, height: h };
    }

    function backgroundAt(i) {
      const channels = [[], [], []], x = i % w, y = Math.floor(i / w);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const j = clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1);
        if (!opaque(j)) continue;
        for (let c = 0; c < 3; c++) channels[c].push(rgba[j * 4 + c]);
      }
      const rgb = channels.map((a, c) => a.length ? median(a) : rgba[i * 4 + c]);
      const model = { rgb, lab: rgbToLab(...rgb), seeds: [i], transparent: !opaque(i) && !channels[0].length };
      const distances = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const j = clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1);
        if (opaque(j)) distances.push(fromModel(j, model));
      }
      model.noise = distances.length ? median(distances) : 0;
      return model;
    }

    async function morph(input, radius, dilate) {
      const tmp = new Uint8Array(n), out = new Uint8Array(n);
      for (let axis = 0; axis < 2; axis++) {
        const src = axis ? tmp : input, dst = axis ? out : tmp;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let v = dilate ? 0 : 1;
            for (let k = -radius; k <= radius; k++) {
              const j = axis ? clamp(y + k, 0, h - 1) * w + x : y * w + clamp(x + k, 0, w - 1);
              if (dilate ? src[j] : !src[j]) { v = dilate ? 1 : 0; break; }
            }
            dst[y * w + x] = v;
          }
          if (y % 128 === 0) await pause();
        }
      }
      return out;
    }

    async function buildBarrier(options) {
      const key = `${options.edge}:${options.closing}`;
      if (barrierKey === key) return;
      barrierKey = key;
      barrier = new Uint8Array(n);
      if (options.edge === 0) return;
      const threshold = Math.max(6, percentile * (1.7 - options.edge * 0.014));
      for (let i = 0; i < n; i++) barrier[i] = gradient[i] >= threshold ? 1 : 0;
      if (options.closing) {
        const closed = await morph(await morph(barrier, options.closing, true), options.closing, false);
        for (let i = 0; i < n; i++) barrier[i] |= closed[i];
      }
    }

    function borderSeeds() {
      const clusters = [];
      const step = Math.max(1, Math.floor(2 * (w + h) / 256));
      const points = [];
      for (let x = 0; x < w; x += step) points.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y += step) points.push(y * w, y * w + w - 1);
      for (const i of points) {
        if (!opaque(i) || barrier[i] || gradient[i] > 8) continue;
        const model = backgroundAt(i);
        if (fromModel(i, model) > 4) continue;
        let group = clusters.find(m => Math.hypot(...m.lab.map((v, c) => v - model.lab[c])) < 7);
        if (!group) { group = model; clusters.push(group); } else group.seeds.push(i);
      }
      clusters.sort((a, b) => b.seeds.length - a.seeds.length);
      const best = clusters[0];
      // Require repeated, smooth, similarly colored border samples; never seed every edge pixel.
      return best && best.seeds.length >= Math.max(3, points.length * 0.18) ? [best] : [];
    }

    function radialGuard(seed, model, tolerance) {
      const cx = seed % w, cy = Math.floor(seed / w), rays = 360;
      const radii = new Float32Array(rays); let found = 0;
      for (let a = 0; a < rays; a++) {
        const angle = a * Math.PI * 2 / rays, dx = Math.cos(angle), dy = Math.sin(angle);
        let run = 0;
        for (let r = 3; r < Math.hypot(w, h); r++) {
          const x = Math.round(cx + r * dx), y = Math.round(cy + r * dy);
          if (x < 0 || y < 0 || x >= w || y >= h) break;
          const i = y * w + x;
          if (opaque(i) && fromModel(i, model) > tolerance) run++; else run = 0;
          if (run >= 2) { radii[a] = r - 1; found++; break; }
        }
      }
      if (found < rays * 0.75) return null;
      for (let a = 0; a < rays; a++) if (!radii[a]) {
        for (let d = 1; d < rays; d++) {
          const left = radii[(a - d + rays) % rays], right = radii[(a + d) % rays];
          if (left && right) { radii[a] = (left + right) / 2; break; }
        }
      }
      const smooth = Float32Array.from(radii, (_, a) => median([-2, -1, 0, 1, 2].map(d => radii[(a + d + rays) % rays])));
      return i => {
        const dx = i % w - cx, dy = Math.floor(i / w) - cy;
        const a = (Math.atan2(dy, dx) / (2 * Math.PI) * rays + rays) % rays;
        const k = Math.floor(a), r = smooth[k] * (1 - (a - k)) + smooth[(k + 1) % rays] * (a - k);
        return dx * dx + dy * dy <= r * r;
      };
    }

    // Locate a coherent annular band using background-relative contrast, rather
    // than the strongest highlights in the image. Dark steel can be only a few
    // LAB units away from a black background. Polar support across many angles
    // distinguishes the band from isolated smudges, screws and dust.
    function detectFrameStructure(model) {
      const cx = (w - 1) / 2, cy = (h - 1) / 2, size = Math.min(w, h);
      const rays = 720, step = Math.max(1, size / 1024), bins = Math.ceil(Math.hypot(w, h) / (2 * step)) + 2;
      const signal = new Uint8Array(rays * bins), coverage = new Float32Array(bins);
      const limits = new Uint16Array(rays);
      const threshold = clamp(1.2 + (model.noise || 0) * 2.5, 1.5, 8);
      for (let a = 0; a < rays; a++) {
        const angle = a * 2 * Math.PI / rays, dx = Math.cos(angle), dy = Math.sin(angle);
        for (let r = 0; r < bins; r++) {
          const x = Math.round(cx + r * step * dx), y = Math.round(cy + r * step * dy);
          if (x < 0 || y < 0 || x >= w || y >= h) break;
          limits[a] = r;
          const i = y * w + x;
          if (opaque(i) && fromModel(i, model) > threshold) {
            signal[a * bins + r] = 1; coverage[r]++;
          }
        }
      }
      const half = Math.max(1, Math.round(size * 0.008 / step));
      let peak = 0, best = 0;
      for (let r = Math.ceil(size * 0.12 / step); r < Math.min(bins - half, size * 0.56 / step); r++) {
        let score = 0;
        for (let d = -half; d <= half; d++) score += coverage[Math.max(0, r + d)];
        score /= (half * 2 + 1) * rays;
        if (score > best) { best = score; peak = r; }
      }
      if (best < 0.62) return null;
      const inner = new Float32Array(rays), outer = new Float32Array(rays);
      const gap = Math.max(2, Math.round(size * 0.012 / step));
      let valid = 0;
      for (let a = 0; a < rays; a++) {
        const runs = [];
        let start = -1, last = -1, hits = 0;
        for (let r = Math.ceil(size * 0.08 / step); r <= limits[a]; r++) {
          if (signal[a * bins + r]) {
            if (start < 0) start = r;
            last = r; hits++;
          }
          if (start >= 0 && (r - last > gap || r === limits[a])) {
            if (hits >= 2) runs.push({ start, end: last });
            start = -1; hits = 0;
          }
        }
        let anchor = -1, distance = Infinity;
        runs.forEach((run, index) => {
          const d = Math.max(run.start - peak, peak - run.end, 0);
          if (d < distance) { distance = d; anchor = index; }
        });
        if (anchor < 0 || distance * step > size * 0.065) continue;
        let first = anchor, lastRun = anchor;
        // Small dark seams do not split the frame; larger empty gaps still do.
        while (first > 0 && (runs[first].start - runs[first - 1].end) * step < size * 0.035) first--;
        while (lastRun + 1 < runs.length && (runs[lastRun + 1].start - runs[lastRun].end) * step < size * 0.12) lastRun++;
        inner[a] = Math.max(1, runs[first].start * step - 1);
        outer[a] = runs[lastRun].end * step + 1;
        valid++;
      }
      if (valid < rays * 0.78) return null;
      for (let a = 0; a < rays; a++) if (!inner[a]) {
        let left = 1, right = 1;
        while (left < rays && !inner[(a - left + rays) % rays]) left++;
        while (right < rays && !inner[(a + right) % rays]) right++;
        if (left + right > 40) return null;
        for (const radii of [inner, outer]) radii[a] = (radii[(a - left + rays) % rays] * right + radii[(a + right) % rays] * left) / (left + right);
      }
      // Reject single-ray debris while retaining broad spikes and local recesses.
      const smooth = radii => Float32Array.from(radii, (_, a) => median([-1, 0, 1].map(d => radii[(a + d + rays) % rays])));
      const inside = smooth(inner), outside = smooth(outer);
      const typicalWidth = median(Array.from(inside, (r, a) => outside[a] - r));
      const coherent = inside.slice();
      for (let a = 0; a < rays; a++) {
        const neighbors = [];
        for (let d = -36; d <= 36; d++) neighbors.push(inside[(a + d + rays) % rays]);
        neighbors.sort((a, b) => a - b);
        const supported = neighbors[Math.floor(neighbors.length * 0.25)];
        // A black seam can make the first visible material appear much farther
        // out, producing a suddenly thin band. Continue the neighboring inner
        // contour across that ambiguity instead of treating steel as background.
        if (outside[a] - inside[a] < typicalWidth * 0.95 && inside[a] - supported > Math.max(3, typicalWidth * 0.25)) coherent[a] = supported + Math.max(1, typicalWidth * 0.08);
      }
      inside.set(coherent);
      const innerMedian = median(Array.from(inside)), outerMedian = median(Array.from(outside));
      if (innerMedian < size * 0.12 || outerMedian - innerMedian < size * 0.015 || outerMedian - innerMedian > size * 0.32) return null;
      return {
        allows(i, mode) {
          const dx = i % w - cx, dy = Math.floor(i / w) - cy;
          const angle = (Math.atan2(dy, dx) * rays / (2 * Math.PI) + rays) % rays;
          const a = Math.floor(angle), t = angle - a, radii = mode === "inside" ? inside : outside;
          const r = radii[a] * (1 - t) + radii[(a + 1) % rays] * t, squared = dx * dx + dy * dy;
          return mode === "inside" ? squared < r * r : squared > r * r;
        },
        confidence: best,
      };
    }

    async function select(options) {
      await buildBarrier(options);
      groups = [];
      for (const point of options.seeds) {
        const x = clamp(Math.floor(point.x), 0, w - 1), y = clamp(Math.floor(point.y), 0, h - 1);
        const model = backgroundAt(y * w + x);
        const group = groups.find(m => m.transparent === model.transparent && Math.hypot(...m.lab.map((v, c) => v - model.lab[c])) < 5);
        if (group) group.seeds.push(y * w + x); else groups.push(model);
      }
      if (options.auto && options.mode === "outside") groups.push(...borderSeeds());
      mask = new Uint8Array(n);
      const queue = new Uint32Array(n), allowed = new Uint8Array(n);
      const tolerance = 1.5 + options.color * 0.75, local = 1.5 + options.local * 0.35;
      const structureMode = options.structure || "auto", centerModel = backgroundAt(Math.floor(h / 2) * w + Math.floor(w / 2));
      const structureModel = options.mode === "outside" || centerModel.transparent ? groups.find(group => !group.transparent) || centerModel : centerModel;
      const darkBackground = structureModel.lab[0] < 22;
      const useStructure = options.protectEnclosure !== false && !structureModel.transparent && (structureMode === "ring" || (structureMode === "auto" && darkBackground));
      const structure = useStructure ? detectFrameStructure(structureModel) : null;
      let radialFailed = false;
      for (const group of groups) {
        allowed.fill(0);
        const guard = !structure && options.radial && options.mode === "inside" ? radialGuard(group.seeds[0], group, tolerance) : null;
        if (!structure && options.radial && options.mode === "inside" && !guard) radialFailed = true;
        const groupTolerance = !structure && structureMode !== "color" && group.lab[0] < 22 && !group.transparent
          ? Math.min(tolerance, Math.max(3, 1.5 + group.noise * 2 + options.color * 0.12)) : tolerance;
        let head = 0, tail = 0;
        for (const i of group.seeds) {
          if (!mask[i] && !barrier[i] && (!guard || guard(i)) && (!structure || structure.allows(i, options.mode))) {
            mask[i] = 1; queue[tail++] = i;
          }
        }
        function visit(j, i) {
          if (mask[j] || barrier[j] || (guard && !guard(j)) || (structure && !structure.allows(j, options.mode))) return;
          if (!allowed[j]) allowed[j] = !opaque(j) || (!group.transparent && fromModel(j, group) <= groupTolerance) ? 1 : 2;
          if (allowed[j] === 2 || (opaque(j) && opaque(i) && delta(i, j) > local)) return;
          mask[j] = 1; queue[tail++] = j;
        }
        while (head < tail) {
          const i = queue[head++], x = i % w;
          if (x > 0) visit(i - 1, i);
          if (x < w - 1) visit(i + 1, i);
          if (i >= w) visit(i - w, i);
          if (i < n - w) visit(i + w, i);
          if (head % 131072 === 0) await pause();
        }
      }
      let count = 0, visible = 0, touchesBorder = false;
      for (let i = 0; i < n; i++) {
        if (opaque(i)) { visible++; if (mask[i]) count++; }
        if (mask[i] && (i < w || i >= n - w || i % w === 0 || i % w === w - 1)) touchesBorder = true;
      }
      const center = Math.floor(h / 2) * w + Math.floor(w / 2);
      const warnings = [];
      // A portrait background may legitimately cover its center and image borders.
      // Enclosure warnings protect decorative frames, while the large-area guard
      // remains active for every image.
      if (options.protectEnclosure !== false) {
        if (count && options.mode === "inside" && touchesBorder) warnings.push("leak");
        if (count && options.mode === "outside" && mask[center]) warnings.push("center");
      }
      if (count > visible * 0.92) warnings.push("large");
      if (radialFailed) warnings.push("radial");
      if (useStructure && !structure) warnings.push("structure");
      if (!count && (groups.some(group => group.transparent) || (options.auto && !groups.length && [0, w - 1, n - w, n - 1].every(i => !opaque(i))))) warnings.push("transparent");
      stats = { count, fraction: count / Math.max(visible, 1), warnings, structureUsed: Boolean(structure) };
      return stats;
    }

    async function distanceTo(selected) {
      const d = new Uint8Array(n); d.fill(255);
      for (let i = 0; i < n; i++) if (Boolean(mask[i]) === selected) d[i] = 0;
      // Chamfer distance (3/4 weights), capped naturally by Uint8 storage.
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let v = d[i];
          if (x) v = Math.min(v, d[i - 1] + 3);
          if (y) {
            v = Math.min(v, d[i - w] + 3);
            if (x) v = Math.min(v, d[i - w - 1] + 4);
            if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
          }
          d[i] = v;
        }
        if (y % 128 === 0) await pause();
      }
      for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
          const i = y * w + x;
          let v = d[i];
          if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
          if (y < h - 1) {
            v = Math.min(v, d[i + w] + 3);
            if (x) v = Math.min(v, d[i + w - 1] + 4);
            if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
          }
          d[i] = v;
        }
        if (y % 128 === 0) await pause();
      }
      return d;
    }

    async function refine(options) {
      if (!mask) throw new Error("Select an area first");
      const out = new Uint8ClampedArray(rgba);
      const band = Math.max(options.feather + 1, options.halo ? 4 : 0);
      const distance = band ? await distanceTo(true) : null;
      const shadowDistance = options.shadows ? await distanceTo(false) : null;
      const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, p = i * 4;
          if (!rgba[p + 3]) continue;
          if (mask[i]) {
            out[p + 3] = 0;
            if (options.shadows && shadowDistance[i] <= 18 && groups.length) {
              const bg = groups.reduce((a, b) => fromModel(i, a) < fromModel(i, b) ? a : b).rgb;
              const rgb = [rgba[p], rgba[p + 1], rgba[p + 2]];
              const loss = bg.map((v, c) => (v - rgb[c]) / Math.max(32, v));
              const strength = Math.max(0, Math.min(...loss));
              if (strength > 0.015 && strength < 0.45 && Math.max(...loss) - strength < 0.08) {
                out[p] = out[p + 1] = out[p + 2] = 0;
                out[p + 3] = rgba[p + 3] * strength;
              }
            }
            continue;
          }
          if (!band || distance[i] > band * 3) continue;
          const d = distance[i] / 3;
          let alpha = options.feather ? 1 - 0.5 * Math.max(0, 1 - d / (options.feather + 1)) : 1;
          if (options.halo) {
            let bgIndex = -1, fgIndex = -1;
            for (let r = 1; r <= band + 3 && (bgIndex < 0 || fgIndex < 0); r++) {
              for (const [dx, dy] of directions) {
                const nx = x + dx * r, ny = y + dy * r;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const j = ny * w + nx;
                if (!opaque(j)) continue;
                if (bgIndex < 0 && mask[j]) bgIndex = j;
                if (fgIndex < 0 && !mask[j] && distance[j] >= (band + 1) * 3) fgIndex = j;
              }
            }
            if (bgIndex >= 0 && fgIndex >= 0) {
              // Near black, linear RGB compresses all useful contrast below the
              // old absolute stability cutoff. Use encoded RGB there and compare
              // the residual relative to the actual foreground/background span.
              const encoded = Math.max(...[0, 1, 2].map(c => rgba[fgIndex * 4 + c]), ...[0, 1, 2].map(c => rgba[bgIndex * 4 + c])) < 100;
              const component = v => encoded ? v / 255 : linear[v];
              const bg = [0, 1, 2].map(c => component(rgba[bgIndex * 4 + c]));
              const fg = [0, 1, 2].map(c => component(rgba[fgIndex * 4 + c]));
              const color = [0, 1, 2].map(c => component(rgba[p + c]));
              let norm = 0, dot = 0;
              for (let c = 0; c < 3; c++) { norm += (fg[c] - bg[c]) ** 2; dot += (color[c] - bg[c]) * (fg[c] - bg[c]); }
              const a = clamp(dot / Math.max(norm, 1e-9), 0, 1);
              const residual = color.reduce((sum, v, c) => sum + (v - (a * fg[c] + (1 - a) * bg[c])) ** 2, 0);
              // Near-identical colors or an unrelated ornament are mathematically ambiguous.
              if (norm > (encoded ? 0.0025 : 0.012) && residual < (encoded ? norm * 0.025 + 0.00003 : 0.018) && a < 0.98) {
                if (options.shadows && Math.max(...color) - Math.min(...color) < 0.025) alpha = Math.max(alpha, a);
                else {
                  alpha = Math.min(alpha, a);
                  for (let c = 0; c < 3; c++) {
                    const corrected = clamp((color[c] - (1 - a) * bg[c]) / Math.max(a, 0.04), 0, 1);
                    out[p + c] = encoded ? corrected * 255 : srgb(corrected);
                  }
                }
              }
            }
          }
          out[p + 3] = rgba[p + 3] * alpha;
        }
        if (y % 64 === 0) await pause();
      }
      return { data: out, selection: mask.slice(), ...stats };
    }
    return { prepare, select, refine, rgbToLab, dispose: () => { disposed = true; } };
  }

  function workerMain() {
    const engine = createEngine();
    self.onmessage = async ({ data: { id, method, value } }) => {
      try {
        const result = await engine[method](value);
        const transfer = result.data ? [result.data.buffer, result.selection.buffer] : [];
        self.postMessage({ id, result }, transfer);
      } catch (error) { self.postMessage({ id, error: error.message }); }
    };
  }

  function createProcessor() {
    let worker = null, nextId = 0;
    const pending = new Map(), fallback = createEngine();
    try {
      const url = URL.createObjectURL(new Blob([`${createEngine.toString()}\n(${workerMain.toString()})();`], { type: "text/javascript" }));
      try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
    } catch (_) { /* Restrictive browsers use the same chunked algorithm on the main thread. */ }
    if (worker) {
      worker.onmessage = ({ data }) => {
        const job = pending.get(data.id);
        if (!job) return;
        pending.delete(data.id);
        if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
      };
      worker.onerror = event => {
        event.preventDefault();
        for (const job of pending.values()) job.reject(new Error(event.message || "Worker failed"));
        pending.clear();
      };
    }
    return {
      call(method, value) {
        if (!worker) return fallback[method](value);
        return new Promise((resolve, reject) => {
          const id = ++nextId;
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, method, value }, method === "prepare" ? [value.data.buffer] : []);
        });
      },
      dispose() {
        if (worker) worker.terminate();
        fallback.dispose();
        for (const job of pending.values()) job.reject(new Error("Cancelled"));
        pending.clear();
      },
    };
  }
  function findEnclosedRegion(passable, width, height, seed) {
    const mask = new Uint8Array(width * height);
    if (!seed) return mask;
    const queue = new Uint32Array(mask.length);
    let head = 0, tail = 1;
    queue[0] = seed.y * width + seed.x; mask[queue[0]] = 1;
    function visit(i) { if (passable[i] && !mask[i]) { mask[i] = 1; queue[tail++] = i; } }
    while (head < tail) {
      const i = queue[head++], x = i % width;
      // An unbounded outside region must never become the portrait window.
      if (!x || x === width - 1 || i < width || i >= mask.length - width) { mask.fill(0); return mask; }
      visit(i - 1); visit(i + 1); visit(i - width); visit(i + width);
    }
    return mask;
  }
  root.SmartBackgroundRemoval = { createEngine, createProcessor, findEnclosedRegion };
})(typeof globalThis === "object" ? globalThis : this);

/* ==================== SMART_UI ==================== */
// 3. Smart-removal panel controllers
/* Shared side-panel adapter. Each instance owns its settings and non-destructive preview. */
(function (root) {
  "use strict";
  const TEXT = {
    ru: {
      title: "Умное удаление фона", mode: "Область удаления", inside: "Внутри рамки", outside: "Снаружи рамки",
      hint: "Нажмите на фон рамки. Shift + клик добавляет область, ПКМ убирает ближайшую точку. Средняя кнопка — перемещение, колесо — масштаб.",
      color: "Допуск цвета", edge: "Защита контуров", feather: "Смягчение края, px", halo: "Убрать цвет фона с края", shadows: "Сохранить мягкие тени",
      advanced: "Дополнительно", local: "Локальный допуск", closing: "Закрытие разрывов, px",
      auto: "Найти внешний фон", clear: "Сбросить точки", view: "Предпросмотр", highlight: "Подсветка удаления", transparency: "Прозрачность",
      apply: "Применить", reset: "Сбросить всю категорию", download: "PNG рамки",
      findInside: "Найти внутренний фон", defaults: "Восстановить значения по умолчанию", selectionActions: "Выбор фоновой области",
      applied: "Изменения применены. Выберите следующую область; настройки сохранены.",
      structureLabel: "Анализ рамки", structureAuto: "Авто: цвет и форма", structureColor: "Только цвет и границы", structureRing: "Форма кольца",
      radialLabel: "Дополнительная радиальная защита",
      structure: "Надёжная форма кольца не найдена. Использовано осторожное выделение по цвету; проверьте результат.",
      transparent: "В точке уже есть прозрачность. Она не используется как образец чёрного цвета; выберите видимый фон.",
      structureUsed: "Тёмные детали защищены формой рамки.",
      ready: "Выберите фон на изображении рамки.", busy: "Обработка… Можно изменить настройки или отменить.",
      selected: "Выбрано: {percent}% видимых пикселей. Точек: {seeds}.", empty: "Подходящая область не найдена. Выберите другую точку или измените настройки.",
      leak: "Область достигла края изображения: возможно протекание через разрыв рамки.", center: "Внешнее выделение попало в центр: проверьте, что внутренняя область не захвачена.",
      large: "Выделено почти всё изображение. Проверьте результат перед применением.", radial: "Замкнутый радиальный контур не найден. Использовано обычное выделение.",
      acknowledge: "Я проверил выделение и хочу применить его", error: "Не удалось обработать рамку. Изображение сохранено; попробуйте снова.",
      open: "Открыть файл", points: "Точка фона",
    },
    en: {
      title: "Smart Background Removal", mode: "Removal mode", inside: "Remove Inside", outside: "Remove Outside",
      hint: "Click the frame background. Shift + click adds a region; right-click removes the nearest seed. Middle button pans; wheel zooms.",
      color: "Color Tolerance", edge: "Edge Protection", feather: "Edge Feathering, px", halo: "Remove Edge Background Color", shadows: "Preserve Soft Shadows",
      advanced: "Advanced", local: "Local Color Tolerance", closing: "Close contour gaps, px",
      auto: "Find Outside Background", clear: "Clear Seeds", view: "Preview", highlight: "Highlight Removal", transparency: "Transparency",
      apply: "Apply", reset: "Reset Entire Category", download: "Frame PNG",
      findInside: "Find Inside Background", defaults: "Restore Default Values", selectionActions: "Background Selection",
      applied: "Changes applied. Choose the next region; your settings are preserved.",
      structureLabel: "Frame Analysis", structureAuto: "Auto: Color and Shape", structureColor: "Color and Edges Only", structureRing: "Ring Shape",
      radialLabel: "Additional Radial Protection",
      structure: "No reliable ring shape found. Using conservative color selection; check the result.",
      transparent: "This seed is already transparent. Its hidden RGB is not treated as black background; select visible background.",
      structureUsed: "Dark details are protected by the frame shape.",
      ready: "Choose a background area in the frame image.", busy: "Processing… You can change settings or cancel.",
      selected: "Selected: {percent}% of visible pixels. Seeds: {seeds}.", empty: "No suitable region found. Choose another point or adjust settings.",
      leak: "The region reached the image border: it may have leaked through a contour gap.", center: "The outside selection reached the center. Check that the inner region is preserved.",
      large: "Almost the entire image is selected. Check the preview before applying.", radial: "No reliable closed radial contour found. Using region growing.",
      acknowledge: "I checked the selection and want to apply it", error: "Frame processing failed. Your image is unchanged; please try again.",
      open: "Open File", points: "Background seed",
    },
  };
  const TOKEN_TEXT = {
    ru: {
      inside: "Область по клику", outside: "Внешний фон", download: "PNG изображения",
      structureLabel: "Анализ изображения", structureAuto: "Авто: цвет и границы",
      hint: "Нажмите на фон изображения. Shift + клик добавляет область, ПКМ убирает ближайшую точку. Средняя кнопка — перемещение, колесо — масштаб.",
      ready: "Выберите фон на изображении.", error: "Не удалось обработать изображение. Изменения не применены; попробуйте снова.",
    },
    en: {
      inside: "Clicked Region", outside: "Outside Background", download: "Image PNG",
      structureLabel: "Image Analysis", structureAuto: "Auto: Color and Edges",
      hint: "Click the image background. Shift + click adds a region; right-click removes the nearest seed. Middle button pans; wheel zooms.",
      ready: "Choose a background area in the image.", error: "Image processing failed. Changes were not applied; please try again.",
    },
  };
  const TIPS = {
    ru: {
      open: "Раскрывает настройки умного удаления. Снятие чекбокса отменяет только текущий предпросмотр, уже применённые правки сохраняются.",
      mode: "Выбирает область удаления. Внутри рамки — отверстие в центре, снаружи — фон вокруг неё. На изображении можно выбрать любую связную область по клику.",
      structure: "Авто защищает форму тёмного кольца, если контур достаточно надёжен. Только цвет подходит для произвольных изображений. Форма кольца принудительно ищет внутренний и внешний контур; при неудаче появится предупреждение.",
      color: "Насколько цвет фона может отличаться от образца в точке клика. Больше — удаляется больше оттенков и градиентов, но легче захватить похожие детали. Для чёрного фона начните с Авто и небольшого допуска.",
      edge: "Чем выше значение, тем сложнее выделению пересечь цветовую границу. Слишком высокая защита может оставить кайму или разделить фон на участки. 0 отключает барьер Sobel.",
      feather: "Ширина мягкого перехода в пикселях исходного изображения. 0 — чёткий край; увеличение смягчает узкую полосу и может истончить мелкие детали.",
      halo: "Убирает примесь белого, чёрного или цветного фона с пограничных пикселей. Корректирует RGB вместе с прозрачностью. Не восстанавливает детали, цвет которых полностью совпал с фоном.",
      shadows: "Пытается сохранить сероватые мягкие тени возле рамки на светлом фоне. Может оставить немного фона. Чёрную тень на чёрном фоне достоверно восстановить невозможно.",
      local: "Допустимый скачок цвета между соседними пикселями при заливке. Меньше — осторожнее проходит границы; больше — легче проходит шум и плавные переходы. Общий допуск цвета всё равно ограничивает область.",
      closing: "Закрывает небольшие разрывы карты контуров перед выделением. 0 — выключено. Больший радиус лучше закрывает щели, но может объединить тонкие детали и оставить фон рядом с ними.",
      radial: "Запасная защита внутренней области по лучам из точки клика. Применяется, если основной контур формы не найден. Подходит для почти круглых и овальных отверстий; сложные вогнутости могут определяться неточно.",
      view: "Подсветка показывает, что будет удалено. Прозрачность показывает будущий результат на шахматном фоне. Переключение не применяет правки.",
      auto: "Заменяет текущее выделение похожими гладкими участками вдоль границ изображения как внешним фоном. Контрастные детали у края не считаются фоном автоматически. Всегда проверьте предпросмотр.",
      findInside: "Переключает область удаления на внутреннюю и ставит одну точку точно в центре исходного изображения, как обычный клик. Предыдущие точки и автоматическое внешнее выделение заменяются.",
      clear: "Удаляет только стартовые точки и автоматическое выделение текущего предпросмотра. Применённая очистка сохраняется.",
      apply: "Применяет текущий предпросмотр к этой стороне. Панель остаётся открытой, настройки сохраняются, а точки очищаются для следующей операции. Положение, масштаб, другая сторона и ручные маски сохраняются.",
      defaults: "Возвращает параметры обработки, область удаления и вид предпросмотра к начальным значениям. Применённые правки сохраняются. При смене области удаления точки сбрасываются; иначе выделение пересчитывается по прежним точкам.",
      reset: "Сбрасывает всю умную очистку этой стороны и её предпросмотр. Правки обычных кистей, другая сторона и композиция сохраняются.",
      download: "Сохраняет уже применённый результат этой стороны в PNG с прозрачностью и исходным разрешением. Текущий неприменённый предпросмотр в файл не входит.",
      risk: "Разрешает применить подозрительное выделение после вашей проверки. Без отметки потенциально разрушительная операция заблокирована.",
      advanced: "Дополнительные ограничения заливки и исправление небольших разрывов. Начинайте с основных настроек и меняйте эти параметры при необходимости.",
    },
    en: {
      open: "Opens smart removal settings. Unchecking cancels only the current preview; previously applied changes remain.",
      mode: "Chooses the region to remove: the frame opening or the surrounding background. On a portrait, a click can select any connected region.",
      structure: "Auto protects a dark ring when its shape is reliable. Color Only suits arbitrary images. Ring Shape explicitly searches for inner and outer contours and warns if detection fails.",
      color: "Maximum background color difference from the clicked sample. Higher values remove more shades and gradients but may include similar details. Start with Auto and low tolerance for black backgrounds.",
      edge: "Higher values make detected color boundaries harder to cross. Excessive protection may leave a fringe or split the background. 0 disables the Sobel barrier.",
      feather: "Soft transition width in original-image pixels. 0 gives a sharp edge; increasing it softens a narrow band and may thin fine details.",
      halo: "Removes white, black or colored background contamination from edge pixels by adjusting RGB and alpha together. Cannot recover detail identical to its background.",
      shadows: "Tries to retain soft gray shadows near a frame on light backgrounds. May leave some background. Black shadows on black backgrounds cannot be reliably recovered.",
      local: "Maximum color jump between adjacent pixels during region growing. Lower values protect boundaries; higher values cross noise and gradients more easily. Global color tolerance still limits growth.",
      closing: "Closes small gaps in detected contours. 0 disables it. A larger radius bridges gaps more strongly but may connect fine details and leave background nearby.",
      radial: "Fallback inner protection using rays from the clicked point when the primary frame contour is unavailable. Best for nearly round or oval openings; deep concavities can be inaccurate.",
      view: "Highlight shows what will be removed. Transparency previews the result on a checkerboard. Switching views never applies changes.",
      auto: "Replaces the current selection with similar smooth image-border regions as outside background. Contrasting decorations touching an edge are not automatically treated as background. Check the preview.",
      findInside: "Switches to the inner region and places one seed at the exact center of the original image, just like a normal click. Replaces previous seeds and automatic outside selection.",
      clear: "Clears only the current seeds and automatic selection. Previously applied cleanup is preserved.",
      apply: "Applies this preview to the selected side. The panel stays open, settings are preserved and seeds are cleared for the next operation. Placement, scale, the other side and manual masks remain unchanged.",
      defaults: "Restores initial processing values, removal mode and preview style. Applied image edits remain unchanged. Seeds are cleared if the removal mode changes; otherwise the same seeds are recalculated.",
      reset: "Resets all smart cleanup and its preview on this side. Manual brushes, the other side and composition remain unchanged.",
      download: "Saves the applied result as a full-resolution PNG with transparency. An unapplied preview is not included.",
      risk: "Allows a suspicious selection to be applied after you review it. Potentially destructive selection is blocked without this acknowledgement.",
      advanced: "Additional growth limits and small-gap repair. Start with the main controls and adjust these only when needed.",
    },
  };

  function create(api) {
    const isToken = api.side === "token", prefix = isToken ? "tokenSmart" : "smart";
    const container = document.querySelector(`[data-smart-side="${api.side}"]`);
    const content = document.getElementById("smartRemovalTemplate").content.cloneNode(true);
    // The same template supplies both panels, including correctly associated labels.
    const scopedId = id => id.replace(/^smart/, prefix);
    content.querySelectorAll("[id]").forEach(node => { node.id = scopedId(node.id); });
    for (const attribute of ["for", "aria-controls"]) content.querySelectorAll(`[${attribute}]`).forEach(node => {
      node.setAttribute(attribute, node.getAttribute(attribute).split(" ").map(scopedId).join(" "));
    });
    container.append(content);
    const $ = id => document.getElementById(scopedId(id));
    const panel = $("smartPanel"), open = $("smartOpen"), status = $("smartStatus");
    const ids = ["mode", "structure", "color", "edge", "feather", "halo", "shadows", "local", "closing", "radial", "view"];
    const inputs = Object.fromEntries(ids.map(k => [k, $("smart-" + k)]));
    if (isToken) {
      inputs.mode.value = "outside";
      container.querySelectorAll("[data-smart-frame-only]").forEach(node => {
        node.hidden = true;
        if (node.tagName === "OPTION") node.disabled = true;
      });
    }
    const readValue = input => input.type === "checkbox" ? input.checked : input.tagName === "SELECT" ? input.value : Number(input.value);
    const defaultValues = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, readValue(input)]));
    let language = "ru", session = null, timer;
    let statusKey = "ready", statusVars = {}, warningKeys = [];
    const tr = (key, vars = {}) => ((isToken && TOKEN_TEXT[language][key]) || TEXT[language][key] || key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
    const settings = () => Object.fromEntries(ids.filter(k => k !== "view").map(k => [k, readValue(inputs[k])]));
    const tips = () => ({ ...TIPS[language], ...(isToken ? { structure: language === "ru"
      ? "Авто использует цвет и границы и осторожнее обрабатывает тёмный фон. Только цвет и границы использует полный заданный допуск. Геометрия кольца применяется только к рамкам справа."
      : "Auto uses color and edges with more conservative handling of dark backgrounds. Color and Edges Only uses the full selected tolerance. Ring geometry is available only for the frame on the right." } : {}) });
    function message(key, vars = {}, warnings = []) {
      statusKey = key; statusVars = vars; warningKeys = warnings;
      status.textContent = [tr(key, vars), ...warnings.map(k => tr(k))].join(" ");
      if (session?.result?.structureUsed) status.textContent += " " + tr("structureUsed");
      status.classList.toggle("smart-warning", warnings.length > 0 || key === "error");
    }
    function updateButtons() {
      const source = Boolean(api.getBase());
      open.disabled = !source;
      $("smartDownload").disabled = !source;
      $("smartReset").disabled = !api.getSmartBase() && !session?.seeds.length && !session?.auto;
      const risky = session?.result?.warnings.some(k => !["radial", "transparent"].includes(k));
      $("smartRiskRow").hidden = !risky;
      $("smartApply").disabled = !session?.result?.count || session.running || session.done !== session.version || (risky && !$("smartRisk").checked);
    }
    function setLanguage(lang) {
      language = lang;
      for (const scope of [container]) {
        scope.querySelectorAll("[data-smart-text]").forEach(node => { node.textContent = tr(node.dataset.smartText); });
        scope.querySelectorAll("[data-smart-label]").forEach(node => {
          const label = tr(node.dataset.smartLabel);
          node.setAttribute("aria-label", label);
        });
      }
      $("smartDownload").setAttribute("aria-label", tr("download"));
      $("smartSeedTools").setAttribute("aria-label", tr("selectionActions"));
      for (const [key, input] of Object.entries(inputs)) EditorTooltips.set(input, tips()[key], true);
      for (const [id, key] of Object.entries({ smartOpen: "open", smartAuto: "auto", smartInside: "findInside", smartClear: "clear", smartApply: "apply", smartReset: "reset", smartDefaults: "defaults", smartDownload: "download", smartRisk: "risk" })) {
        const node = $(id), label = node.getAttribute("aria-label");
        EditorTooltips.set(node, label ? label + ". " + tips()[key] : tips()[key], true);
      }
      EditorTooltips.set(container.querySelector("summary"), tips().advanced);
      message(statusKey, statusVars, warningKeys);
    }
    function cancel() {
      clearTimeout(timer);
      if (session) session.processor.dispose();
      session = null; panel.hidden = true;
      open.checked = false;
      open.setAttribute("aria-expanded", "false");
      api.setActive(false); api.render(); updateButtons(); api.layout();
    }
    function reset() {
      api.setBase(null); cancel(); updateButtons();
    }
    function resetEdits() {
      const reopen = Boolean(session);
      cancel(); api.setBase(null); api.changed();
      if (reopen) begin();
      updateButtons();
    }
    function restoreDefaults() {
      const modeChanged = inputs.mode.value !== defaultValues.mode;
      for (const [key, value] of Object.entries(defaultValues)) {
        if (inputs[key].type === "checkbox") inputs[key].checked = value;
        else inputs[key].value = String(value);
        const output = $("smart-" + key + "-value");
        if (output) output.value = String(value);
      }
      if (modeChanged && session) { session.seeds = []; session.auto = false; }
      invalidate();
    }
    function createSession() {
      return { base: api.getBase(), effective: api.getEffective(), seeds: [], auto: false, processor: SmartBackgroundRemoval.createProcessor(),
        version: 0, done: -1, running: false, prepared: false, segmentKey: "", result: null, preview: null };
    }
    function begin() {
      if (!api.getBase()) { open.checked = false; return; }
      if (session) return;
      api.disableBrush();
      session = createSession();
      panel.hidden = false; open.checked = true; open.setAttribute("aria-expanded", "true");
      api.setActive(true); message("ready"); updateButtons(); api.render(); api.layout();
    }
    function invalidate(segment = true) {
      if (!session) return;
      session.version++;
      if (segment) session.segmentKey = "";
      session.result = null; session.preview = null;
      $("smartRisk").checked = false;
      clearTimeout(timer);
      message(session.seeds.length || session.auto ? "busy" : "ready");
      updateButtons(); api.render();
      timer = setTimeout(run, 80);
    }
    async function run() {
      const s = session;
      if (!s || s.running || (!s.seeds.length && !s.auto)) return;
      s.running = true; updateButtons();
      try {
        if (!s.prepared) {
          const image = s.effective.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, s.effective.width, s.effective.height);
          await s.processor.call("prepare", image);
          s.prepared = true;
        }
        while (session === s && s.done !== s.version && (s.seeds.length || s.auto)) {
          const version = s.version, options = { ...settings(), seeds: s.seeds.slice(), auto: s.auto, protectEnclosure: !isToken };
          const key = JSON.stringify({ ...options, feather: 0, halo: false, shadows: false });
          if (key !== s.segmentKey) { await s.processor.call("select", options); s.segmentKey = key; }
          if (session !== s || version !== s.version) continue;
          const result = await s.processor.call("refine", options);
          if (session !== s || version !== s.version) continue;
          s.result = result; s.done = version;
          makePreview(s);
          message(result.count ? "selected" : "empty", { percent: (result.fraction * 100).toFixed(1), seeds: s.seeds.length + (s.auto ? "+" : "") }, result.warnings);
          api.render();
        }
      } catch (_) { if (session === s) { s.result = null; s.preview = null; message("error"); } }
      finally { s.running = false; if (session === s) updateButtons(); }
    }
    function makePreview(s) {
      if (!s.result) return;
      const canvas = document.createElement("canvas"); canvas.width = s.effective.width; canvas.height = s.effective.height;
      const ctx = canvas.getContext("2d");
      if (inputs.view.value === "transparency") ctx.putImageData(new ImageData(s.result.data, canvas.width, canvas.height), 0, 0);
      else {
        ctx.drawImage(s.effective, 0, 0);
        const overlay = ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < s.result.selection.length; i++) if (s.result.selection[i]) {
          overlay.data[i * 4] = 230; overlay.data[i * 4 + 1] = 56; overlay.data[i * 4 + 2] = 112; overlay.data[i * 4 + 3] = 120;
        }
        const tint = document.createElement("canvas"); tint.width = canvas.width; tint.height = canvas.height;
        tint.getContext("2d").putImageData(overlay, 0, 0); ctx.drawImage(tint, 0, 0);
      }
      s.preview = canvas;
    }
    function select(point, remove, additive) {
      if (!session) return;
      const s = session;
      if (remove) {
        if (s.seeds.length) {
          let nearest = 0, best = Infinity;
          s.seeds.forEach((p, i) => { const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2; if (d < best) { best = d; nearest = i; } });
          s.seeds.splice(nearest, 1);
        }
      } else {
        if (!additive) { s.seeds = []; s.auto = false; }
        if (s.seeds.length < 32) s.seeds.push(point);
      }
      invalidate();
    }
    function apply() {
      const s = session;
      if (!s?.result || $("smartApply").disabled) return;
      try {
        // Apply relative alpha to the base, preserving the three existing brush masks.
        const canvas = document.createElement("canvas"); canvas.width = s.base.width; canvas.height = s.base.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(s.base, 0, 0);
        const base = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const before = s.effective.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
        for (let p = 0; p < base.data.length; p += 4) if (before[p + 3]) {
          // Canvas readback of a masked pixel may have rounding differences. Only
          // copy RGB where matting actually corrected it, leaving other base RGB intact.
          for (let c = 0; c < 3; c++) if (s.result.data[p + c] !== before[p + c]) base.data[p + c] = s.result.data[p + c];
          base.data[p + 3] *= Math.min(1, s.result.data[p + 3] / before[p + 3]);
        }
        ctx.putImageData(base, 0, 0);
        api.setBase(canvas);
        clearTimeout(timer); s.processor.dispose();
        session = createSession();
        $("smartRisk").checked = false;
        api.changed(); message("applied"); updateButtons(); api.layout();
      } catch (_) { message("error"); }
    }
    function drawSeeds(ctx, rect) {
      if (!session) return;
      session.seeds.forEach((p, i) => {
        const x = rect.x + (p.x + 0.5) * rect.w / session.base.width, y = rect.y + (p.y + 0.5) * rect.h / session.base.height;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = "#2878d9"; ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#142438"; ctx.font = "bold 12px sans-serif"; ctx.fillText(String(i + 1), x + 9, y - 8);
      });
    }
    open.addEventListener("change", () => { if (open.checked) begin(); else cancel(); });
    $("smartApply").addEventListener("click", apply);
    $("smartAuto").addEventListener("click", () => { if (session) { inputs.mode.value = "outside"; session.seeds = []; session.auto = true; invalidate(); } });
    $("smartInside").addEventListener("click", () => {
      if (session) {
        inputs.mode.value = "inside";
        select({ x: Math.floor(session.base.width / 2), y: Math.floor(session.base.height / 2) }, false, false);
      }
    });
    $("smartClear").addEventListener("click", () => { if (session) { session.seeds = []; session.auto = false; invalidate(); } });
    $("smartRisk").addEventListener("change", updateButtons);
    $("smartReset").addEventListener("click", resetEdits);
    $("smartDefaults").addEventListener("click", restoreDefaults);
    $("smartDownload").addEventListener("click", () => api.download(api.getEffective(), isToken ? "token.png" : "frame.png"));
    for (const [key, input] of Object.entries(inputs)) input.addEventListener("input", () => {
      const output = $("smart-" + key + "-value"); if (output) output.value = input.value;
      if (key === "view") { if (session?.result) { makePreview(session); api.render(); } return; }
      if (key === "mode" && session) { session.seeds = []; session.auto = false; }
      invalidate(!["feather", "halo", "shadows"].includes(key));
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && session) cancel(); });
    setLanguage("ru"); updateButtons();
    return { get active() { return Boolean(session); }, getPreview: () => session?.preview, select, drawSeeds, cancel, reset, setLanguage, tr };
  }
  root.SmartRemovalUI = { create };
})(globalThis);

/* ==================== EDITOR ==================== */
// 4. Editor state, rendering, brushes, composition and export
(() => {
  const LANG = {
    RU: "ru",
    EN: "en",
  };

  const MODES = {
    OFFSET: "offset",
    MASK: "mask",
  };

  const BRUSH_MODES = {
    COLOR: "color",
    LOCAL: "local",
    ERASER: "eraser",
  };

  const SIDE = {
    TOKEN: "token",
    FRAME: "frame",
  };

  // Presets are discovered dynamically (no hardcoded file names): the app reads the
  // contents of PRESETS.dir either from a same-origin directory listing (works with
  // dev servers like `python -m http.server`) or from the GitHub Contents API (works
  // on GitHub Pages). Presets are grouped into categories — each first-level subfolder
  // of PRESETS.dir is a category. A category folder may contain a `meta.json` file
  // describing its localized name/description (see loadCategoryMeta). Images that still
  // live directly in PRESETS.dir (not yet sorted into a folder) are shown under a
  // transitional "uncategorized" group. To add a preset, drop the image into the right
  // category folder and commit/push it. The image itself is always loaded from a
  // same-origin URL so the result canvas stays untainted (CORS-safe) for download.
  const PRESETS = {
    dir: "ai_generated",
    metaFile: "meta.json",
    imageExtensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"],
    fallbackRepo: { owner: "atbakalov95", repo: "token-framer", branch: "main" },
    cache: null,
  };

  const I18N = {
    ru: {
      title: "Image + Frame Mixer",
      open: "Открыть файл",
      filesGroup: "Загрузка изображения",
      editsGroup: "Сброс и экспорт этой стороны",
      tipResetBrushes: "Сбрасывает удаление цвета, локальную очистку и ластик только этой стороны. Умная очистка и другая сторона сохраняются.",
      tipResetCenterMask: "Стирает только маску выступающих частей персонажа. Положение, масштаб и правки изображений сохраняются.",
      tipBrushSize: "Диаметр основной кисти в пикселях исходного изображения. В локальном режиме ограничивает область удаления, в режиме ластика — ширину стирания.",
      tipSampleSize: "Диаметр красной кисти, из которой берутся образцы цветов для локальной очистки. Удаление происходит только внутри основной фиолетовой кисти.",
      tipMaskSize: "Диаметр кисти маски в пикселях итогового холста. ЛКМ показывает части персонажа поверх рамки, ПКМ убирает эту маску.",
      tipOpenToken: "Открыть изображение токена с устройства.",
      tipOpenFrame: "Открыть изображение рамки с устройства.",
      paste: "Вставить из буфера",
      undo: "Сбросить всю категорию",
      download: "Скачать",
      removeToken: "Кисть удаления на токене",
      removeFrame: "Кисть удаления на рамке",
      modeColor: "Удаление цвета",
      modeLocal: "Локальная очистка цвета",
      modeEraser: "Ластик",
      placeholderToken: "Перетащите сюда изображение",
      placeholderFrame: "Перетащите сюда рамку",
      placeholderPreview:
        "Здесь появится результат\n\nПосле загрузки рамки можно двигать изображение мышью в центре.",
      centerModeLabel: "Режим",
      centerScaleLabel: "Масштаб",
      centerTokenScaleLabel: "Масштаб токена",
      modeOffset: "Смещение",
      modeMask: "Маска",
      tokenScalePrefix: "Токен",
      brushPurple: "Фиолетовая кисть: {size}",
      brushRed: "Красная кисть: {size}",
      brushMain: "Кисть: {size}",
      alertBadImage: "Файл не удалось открыть как изображение.",
      alertClipboardPermission: "Браузер не дал доступ к буферу через кнопку. Нажмите сейчас Cmd/Ctrl+V.",
      alertPastedUnreadable: "Вставленное содержимое не удалось прочитать как изображение.",
      alertClipboardNoImage: "В буфере нет изображения для вставки.",
      alertSaveFailed: "Не удалось сохранить изображение.",
      presetsButton: "Пресеты",
      presetsTitle: "Пресеты рамок",
      presetsDisclaimer: "Все пресеты сгенерированы нейросетью.",
      presetsLoading: "Загрузка пресетов…",
      presetsEmpty: "Категории не найдены. Добавьте папки с изображениями в ai_generated.",
      presetsCategoryEmpty: "В этой категории пока нет рамок.",
      presetsError: "Не удалось загрузить список пресетов. Проверьте подключение к сети.",
      presetsClose: "Закрыть",
      presetsBack: "← Назад",
      presetsCount: "Рамок: {count}",
      presetsUncategorized: "Без категории",
      presetsUncategorizedDesc: "Рамки, ещё не распределённые по категориям.",
      tipPresets: "Открывает галерею готовых пресетов рамок для вставки в правое окно.",
      tipLangSelect: "Переключает язык интерфейса приложения.",
      tipPasteToken: "Вставляет изображение из буфера обмена в левое окно токена.",
      tipUndoToken: "Сбрасывает все правки токена: умную очистку, удаление цвета и ластик.",
      tipRemoveTokenCheck: "Включает инструменты очистки для токена и показ кистей.",
      tipTokenModeColor:
        "Удаляет выбранные цвета по всему токену; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipTokenModeLocal:
        "Удаляет цвета только в области фиолетовой кисти по цветам из красной кисти; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipTokenModeEraser:
        "Стирает части токена кистью; правая кнопка мыши отменяет действие и возвращает стертые участки.",
      tipCenterMode:
        "Переключает центральный режим: 'Смещение' для выравнивания токена относительно рамки и 'Маска' для рисования дополнительного верхнего слоя токена поверх рамки (левая кнопка рисует, правая стирает маску).",
      tipCenterScale: "Меняет размер финального холста, добавляя или убирая поля вокруг рамки.",
      tipTokenScale: "Меняет масштаб токена в центральной композиции.",
      tipDownload: "Сохраняет текущий результат как PNG-файл.",
      tipPasteFrame: "Вставляет изображение из буфера обмена в правое окно рамки.",
      tipUndoFrame: "Сбрасывает все правки рамки: умную очистку, удаление цвета и ластик.",
      tipRemoveFrameCheck: "Включает инструменты очистки для рамки и показ кистей.",
      tipFrameModeColor:
        "Удаляет выбранные цвета по всей рамке; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipFrameModeLocal:
        "Удаляет цвета только в области фиолетовой кисти по цветам из красной кисти; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipFrameModeEraser:
        "Стирает части рамки кистью; правая кнопка мыши отменяет действие и возвращает стертые участки.",
      tipTokenCanvasPan:
        "В этой области можно перемещать изображение средней кнопкой мыши; при выключенной галочке инструментов также работает перетаскивание левой кнопкой.",
      tipFrameCanvasPan:
        "В этой области можно перемещать рамку средней кнопкой мыши; при выключенной галочке инструментов также работает перетаскивание левой кнопкой.",
      tipCenterCanvasPan:
        "В центральной области можно перемещать изображение средней кнопкой мыши в любом режиме. В режиме Маска: левая кнопка рисует маску, правая стирает.",
    },
    en: {
      title: "Image + Frame Mixer",
      open: "Open File",
      filesGroup: "Load Image",
      editsGroup: "Reset and Export This Side",
      tipResetBrushes: "Resets color removal, local cleanup and eraser masks only on this side. Smart cleanup and the other side are preserved.",
      tipResetCenterMask: "Clears only the character breakout mask. Placement, scale and image edits remain unchanged.",
      tipBrushSize: "Main brush diameter in original-image pixels. In local mode it limits removal area; in eraser mode it sets stroke width.",
      tipSampleSize: "Red brush diameter for sampling local cleanup colors. Removal is restricted to the main purple brush area.",
      tipMaskSize: "Mask brush diameter in output-canvas pixels. Left click reveals the character above the frame; right click removes that mask.",
      tipOpenToken: "Open a token image from your device.",
      tipOpenFrame: "Open a frame image from your device.",
      paste: "Paste from Clipboard",
      undo: "Reset Entire Category",
      download: "Download",
      removeToken: "Token Removal Brush",
      removeFrame: "Frame Removal Brush",
      modeColor: "Color Removal",
      modeLocal: "Local Color Cleanup",
      modeEraser: "Eraser",
      placeholderToken: "Drag image here",
      placeholderFrame: "Drag frame here",
      placeholderPreview: "The result will appear here\n\nAfter loading a frame, drag the image in the center.",
      centerModeLabel: "Mode",
      centerScaleLabel: "Scale",
      centerTokenScaleLabel: "Token Scale",
      modeOffset: "Offset",
      modeMask: "Mask",
      tokenScalePrefix: "Token",
      brushPurple: "Purple Brush: {size}",
      brushRed: "Red Brush: {size}",
      brushMain: "Brush: {size}",
      alertBadImage: "The file could not be opened as an image.",
      alertClipboardPermission: "Browser access to clipboard is blocked for button click. Press Cmd/Ctrl+V now.",
      alertPastedUnreadable: "Pasted content could not be read as an image.",
      alertClipboardNoImage: "There is no image in the clipboard.",
      alertSaveFailed: "Failed to save image.",
      presetsButton: "Presets",
      presetsTitle: "Frame Presets",
      presetsDisclaimer: "All presets are AI-generated.",
      presetsLoading: "Loading presets…",
      presetsEmpty: "No categories found. Add image folders to the ai_generated folder.",
      presetsCategoryEmpty: "This category has no frames yet.",
      presetsError: "Failed to load the preset list. Check your network connection.",
      presetsClose: "Close",
      presetsBack: "← Back",
      presetsCount: "Frames: {count}",
      presetsUncategorized: "Uncategorized",
      presetsUncategorizedDesc: "Frames not yet sorted into a category.",
      tipPresets: "Opens a gallery of ready-made frame presets to load into the right panel.",
      tipLangSelect: "Switches the application interface language.",
      tipPasteToken: "Pastes an image from clipboard into the left token panel.",
      tipUndoToken: "Resets all token edits: smart removal, color removal and eraser strokes.",
      tipRemoveTokenCheck: "Enables token cleanup tools and brush overlays.",
      tipTokenModeColor:
        "Removes selected colors globally across the token image; right mouse button inverts the action and restores removed colors.",
      tipTokenModeLocal:
        "Removes colors only inside the purple brush area using colors sampled by the red brush; right mouse button inverts the action and restores removed colors.",
      tipTokenModeEraser:
        "Erases token parts with the brush; right mouse button inverts the action and restores erased areas.",
      tipCenterMode:
        "Switches center mode between 'Offset' (align token relative to frame) and 'Mask' (paint an extra top token layer over the frame; left button paints, right button erases mask).",
      tipCenterScale: "Changes final canvas size by adding or reducing margins around the frame.",
      tipTokenScale: "Changes token scale in the center composition.",
      tipDownload: "Saves the current result as a PNG file.",
      tipPasteFrame: "Pastes an image from clipboard into the right frame panel.",
      tipUndoFrame: "Resets all frame edits: smart removal, color removal and eraser strokes.",
      tipRemoveFrameCheck: "Enables frame cleanup tools and brush overlays.",
      tipFrameModeColor:
        "Removes selected colors globally across the frame image; right mouse button inverts the action and restores removed colors.",
      tipFrameModeLocal:
        "Removes colors only inside the purple brush area using colors sampled by the red brush; right mouse button inverts the action and restores removed colors.",
      tipFrameModeEraser:
        "Erases frame parts with the brush; right mouse button inverts the action and restores erased areas.",
      tipTokenCanvasPan:
        "In this area you can pan the image with the middle mouse button; when tool checkbox is off, left mouse drag also pans.",
      tipFrameCanvasPan:
        "In this area you can pan the frame with the middle mouse button; when tool checkbox is off, left mouse drag also pans.",
      tipCenterCanvasPan:
        "In the center area you can pan with the middle mouse button in any mode. In Mask mode: left button paints the mask, right button erases it.",
    },
  };

  const state = {
    language: LANG.RU,
    appMode: MODES.OFFSET,
    scalePercent: 100,
    tokenScalePercent: 100,
    pendingPasteTarget: null,
    sides: {
      token: {
        source: null,
        smartSource: null,
        masks: {
          color: null,
          local: null,
          eraser: null,
        },
        enabled: false,
        brushMode: BRUSH_MODES.COLOR,
        brushSize: 30,
        localBrushSize: 15,
        viewport: {
          zoom: 1,
          panX: 0,
          panY: 0,
          displayRect: null,
          displayScale: 1,
        },
        paint: {
          active: false,
          draggingPan: false,
          lastX: 0,
          lastY: 0,
          lastMouseX: 0,
          lastMouseY: 0,
        },
      },
      frame: {
        source: null,
        // Smart cleanup edits the frame base; source remains available for Reset.
        smartSource: null,
        masks: {
          color: null,
          local: null,
          eraser: null,
        },
        enabled: false,
        brushMode: BRUSH_MODES.COLOR,
        brushSize: 30,
        localBrushSize: 15,
        viewport: {
          zoom: 1,
          panX: 0,
          panY: 0,
          displayRect: null,
          displayScale: 1,
        },
        paint: {
          active: false,
          draggingPan: false,
          lastX: 0,
          lastY: 0,
          lastMouseX: 0,
          lastMouseY: 0,
        },
        assets: {
          overlay: null,
          windowMask: null,
          hasWindow: false,
        },
      },
    },
    center: {
      userMask: null,
      composed: null,
      baseOffsetX: 0,
      baseOffsetY: 0,
      brushSize: 30,
      draggingOffset: false,
      draggingPan: false,
      paintingMask: false,
      erasingMask: false,
      lastMouseX: 0,
      lastMouseY: 0,
      lastPaintX: 0,
      lastPaintY: 0,
      displayRect: null,
      displayScale: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };

  const ui = bindUI();
  const smartRemovals = {};
  applyLanguage();
  const sideControllers = {
    token: createSideController(SIDE.TOKEN),
    frame: createSideController(SIDE.FRAME),
  };
  let layoutRenderScheduled = false;

  Object.values(SIDE).forEach(sideName => {
    const side = state.sides[sideName], sideUI = ui[sideName], controller = sideControllers[sideName];
    smartRemovals[sideName] = SmartRemovalUI.create({
      side: sideName,
      getBase: () => side.smartSource || side.source,
      getSmartBase: () => side.smartSource,
      getEffective: () => composeEffectiveCanvas(side.source, side.masks.color, side.masks.local, side.masks.eraser),
      setBase: canvas => { side.smartSource = canvas; },
      setActive: active => sideUI.drop.classList.toggle("smart-active", active),
      disableBrush: () => {
        sideUI.removeCheck.checked = false;
        sideUI.removeCheck.dispatchEvent(new Event("change"));
      },
      render: controller.renderPreview,
      layout: requestLayoutRender,
      changed: () => { controller.rebuildAssets(); controller.renderPreview(); renderCenterPreview(); },
      download: downloadCanvas,
    });
  });

  setupAppEvents();
  setupPresets();
  renderAll();

  function bindUI() {
    const tokenDrop = document.getElementById("tokenDrop");
    const frameDrop = document.getElementById("frameDrop");

    return {
      token: {
        drop: tokenDrop,
        canvas: document.getElementById("tokenCanvas"),
        placeholder: tokenDrop.querySelector(".placeholder"),
        cursorMain: document.getElementById("tokenCursorOverlay"),
        cursorSample: document.getElementById("tokenSampleCursorOverlay"),
        removeCheck: document.getElementById("removeTokenColorCheck"),
        brushControls: document.getElementById("tokenBrushControls"),
        brushLabel: document.getElementById("tokenBrushLabel"),
        brushSizeInput: document.getElementById("tokenBrushSize"),
        localBrushLabel: document.getElementById("tokenLocalBrushLabel"),
        localBrushSizeInput: document.getElementById("tokenLocalBrushSize"),
        localSizeRow: document.getElementById("tokenLocalSizeRow"),
        undoBtn: document.getElementById("undoTokenBtn"),
        modeInputs: document.querySelectorAll('input[name="tokenBrushMode"]'),
        pasteBtn: document.getElementById("pasteTokenBtn"),
        openBtn: document.getElementById("openTokenBtn"),
        fileInput: document.getElementById("openTokenFile"),
      },
      frame: {
        drop: frameDrop,
        canvas: document.getElementById("frameCanvas"),
        placeholder: frameDrop.querySelector(".placeholder"),
        cursorMain: document.getElementById("frameCursorOverlay"),
        cursorSample: document.getElementById("frameSampleCursorOverlay"),
        removeCheck: document.getElementById("removeFrameColorCheck"),
        brushControls: document.getElementById("frameBrushControls"),
        brushLabel: document.getElementById("frameBrushLabel"),
        brushSizeInput: document.getElementById("frameBrushSize"),
        localBrushLabel: document.getElementById("frameLocalBrushLabel"),
        localBrushSizeInput: document.getElementById("frameLocalBrushSize"),
        localSizeRow: document.getElementById("frameLocalSizeRow"),
        undoBtn: document.getElementById("undoFrameBtn"),
        modeInputs: document.querySelectorAll('input[name="frameBrushMode"]'),
        pasteBtn: document.getElementById("pasteFrameBtn"),
        openBtn: document.getElementById("openFrameBtn"),
        fileInput: document.getElementById("openFrameFile"),
      },
      center: {
        modeSelect: document.getElementById("modeSelect"),
        scaleSelect: document.getElementById("scaleSelect"),
        tokenScaleSelect: document.getElementById("tokenScaleSelect"),
        brushControls: document.getElementById("brushControls"),
        brushLabel: document.getElementById("brushLabel"),
        brushSizeInput: document.getElementById("brushSize"),
        wrap: document.getElementById("previewWrap"),
        canvas: document.getElementById("previewCanvas"),
        placeholder: document.getElementById("previewPlaceholder"),
        cursor: document.getElementById("cursorOverlay"),
        downloadBtn: document.getElementById("downloadBtn"),
      },
      app: {
        title: document.getElementById("appTitle"),
        langSelect: document.getElementById("langSelect"),
        pasteTokenBtn: document.getElementById("pasteTokenBtn"),
        undoTokenBtn: document.getElementById("undoTokenBtn"),
        removeTokenLabel: document.getElementById("removeTokenLabel"),
        tokenModeColorLabel: document.getElementById("tokenModeColorLabel"),
        tokenModeLocalLabel: document.getElementById("tokenModeLocalLabel"),
        tokenModeEraserLabel: document.getElementById("tokenModeEraserLabel"),
        tokenDropPlaceholder: document.getElementById("tokenDropPlaceholder"),
        pasteFrameBtn: document.getElementById("pasteFrameBtn"),
        undoFrameBtn: document.getElementById("undoFrameBtn"),
        removeFrameLabel: document.getElementById("removeFrameLabel"),
        frameModeColorLabel: document.getElementById("frameModeColorLabel"),
        frameModeLocalLabel: document.getElementById("frameModeLocalLabel"),
        frameModeEraserLabel: document.getElementById("frameModeEraserLabel"),
        frameDropPlaceholder: document.getElementById("frameDropPlaceholder"),
        previewPlaceholder: document.getElementById("previewPlaceholder"),
      },
      presets: {
        openBtn: document.getElementById("framePresetsBtn"),
        modal: document.getElementById("presetsModal"),
        closeBtn: document.getElementById("presetsCloseBtn"),
        backBtn: document.getElementById("presetsBackBtn"),
        title: document.getElementById("presetsModalTitle"),
        disclaimer: document.getElementById("presetsDisclaimer"),
        categoryDesc: document.getElementById("presetsCategoryDesc"),
        status: document.getElementById("presetsStatus"),
        grid: document.getElementById("presetsGrid"),
      },
    };
  }

  function createSideController(sideName) {
    const sideState = state.sides[sideName];
    const sideUI = ui[sideName];

    const handlers = {
      onDropFile: async (file) => {
        const image = await readImageFile(file);
        if (!image) {
          alert(t("alertBadImage"));
          return;
        }
        setSource(drawableToCanvas(image));
      },
      onRemoveToggle: () => {
        if (sideUI.removeCheck.checked) smartRemovals[sideName]?.cancel();
        sideState.enabled = sideUI.removeCheck.checked;
        sideUI.brushControls.classList.toggle("show", sideState.enabled);
        updateLocalSizeVisibility();
        if (!sideState.enabled) {
          sideState.paint.active = false;
          sideState.paint.draggingPan = false;
          hideCursors();
        }
        requestLayoutRender();
      },
      onBrushSizeChange: () => {
        sideState.brushSize = Number(sideUI.brushSizeInput.value);
        updateSideBrushLabels(sideName);
        updateCursorFromLast();
      },
      onLocalBrushSizeChange: () => {
        sideState.localBrushSize = Number(sideUI.localBrushSizeInput.value);
        updateSideBrushLabels(sideName);
        updateCursorFromLast();
      },
      onModeChange: (input) => {
        if (!input.checked) {
          return;
        }
        sideState.brushMode = input.value;
        updateLocalSizeVisibility();
        updateCursorFromLast();
        requestLayoutRender();
      },
      onWheel: (event) => {
        if (!sideState.source) {
          return;
        }
        event.preventDefault();

        const point = toPoint(sideUI.drop, event.clientX, event.clientY);
        const { width, height } = elementSize(sideUI.drop);
        const fit = fitRect(sideState.source.width, sideState.source.height, width - 28, height - 28);
        const oldZoom = sideState.viewport.zoom;
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = clamp(oldZoom * zoomFactor, 1, 8);

        if (Math.abs(newZoom - oldZoom) < 0.0001) {
          if (newZoom <= 1.0001 && (sideState.viewport.panX !== 0 || sideState.viewport.panY !== 0)) {
            sideState.viewport.zoom = 1;
            sideState.viewport.panX = 0;
            sideState.viewport.panY = 0;
            renderPreview();
          }
          return;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const oldDrawW = fit.w * oldZoom;
        const oldDrawH = fit.h * oldZoom;
        const oldX = centerX - oldDrawW / 2 + sideState.viewport.panX;
        const oldY = centerY - oldDrawH / 2 + sideState.viewport.panY;
        const u = (point.x - oldX) / oldDrawW;
        const v = (point.y - oldY) / oldDrawH;
        const newDrawW = fit.w * newZoom;
        const newDrawH = fit.h * newZoom;
        const centeredX = centerX - newDrawW / 2;
        const centeredY = centerY - newDrawH / 2;

        if (newZoom <= 1.0001) {
          sideState.viewport.zoom = 1;
          sideState.viewport.panX = 0;
          sideState.viewport.panY = 0;
        } else {
          sideState.viewport.panX = point.x - centeredX - u * newDrawW;
          sideState.viewport.panY = point.y - centeredY - v * newDrawH;
          sideState.viewport.zoom = newZoom;
        }

        renderPreview();
      },
      onMouseDown: (event) => {
        if (!sideState.source) {
          return;
        }
        if (event.button !== 0 && event.button !== 1 && event.button !== 2) {
          return;
        }

        const point = toPoint(sideUI.drop, event.clientX, event.clientY);
        if (!pointInRect(sideState.viewport.displayRect, point.x, point.y)) {
          return;
        }

        if (smartRemovals[sideName]?.active && event.button !== 1) {
          smartRemovals[sideName].select(widgetToImagePoint(sideState.viewport.displayRect, sideState.source, point.x, point.y), event.button === 2, event.shiftKey);
          event.preventDefault();
          return;
        }

        if (event.button === 1 || (!sideState.enabled && event.button === 0)) {
          sideState.paint.draggingPan = true;
          sideState.paint.lastMouseX = point.x;
          sideState.paint.lastMouseY = point.y;
          event.preventDefault();
          return;
        }

        if (!sideState.enabled) {
          return;
        }

        sideState.paint.active = true;
        const imagePoint = widgetToImagePoint(
          sideState.viewport.displayRect,
          effectiveCanvas(sideName)
            ? { width: effectiveCanvas(sideName).width, height: effectiveCanvas(sideName).height }
            : { width: sideState.source.width, height: sideState.source.height },
          point.x,
          point.y
        );

        sideState.paint.lastX = imagePoint.x;
        sideState.paint.lastY = imagePoint.y;
        applyStroke(imagePoint.x, imagePoint.y, imagePoint.x, imagePoint.y, event.button === 2);
        updateCursor(point.x, point.y);
        event.preventDefault();
      },
      onMouseMove: (event) => {
        if (!sideState.source) {
          return;
        }

        const point = toPoint(sideUI.drop, event.clientX, event.clientY);
        const prevMouseX = sideState.paint.lastMouseX;
        const prevMouseY = sideState.paint.lastMouseY;
        sideState.paint.lastMouseX = point.x;
        sideState.paint.lastMouseY = point.y;

        if (sideState.paint.draggingPan) {
          sideState.viewport.panX += point.x - prevMouseX;
          sideState.viewport.panY += point.y - prevMouseY;
          renderPreview();
          return;
        }

        if (sideState.enabled) {
          updateCursor(point.x, point.y);
        } else {
          hideCursors();
        }

        if (!sideState.paint.active || !sideState.enabled) {
          return;
        }
        if (!pointInRect(sideState.viewport.displayRect, point.x, point.y)) {
          return;
        }

        const imagePoint = widgetToImagePoint(
          sideState.viewport.displayRect,
          effectiveCanvas(sideName)
            ? { width: effectiveCanvas(sideName).width, height: effectiveCanvas(sideName).height }
            : { width: sideState.source.width, height: sideState.source.height },
          point.x,
          point.y
        );

        if (imagePoint.x === sideState.paint.lastX && imagePoint.y === sideState.paint.lastY) {
          return;
        }

        applyStroke(
          sideState.paint.lastX,
          sideState.paint.lastY,
          imagePoint.x,
          imagePoint.y,
          (event.buttons & 2) === 2
        );

        sideState.paint.lastX = imagePoint.x;
        sideState.paint.lastY = imagePoint.y;
      },
      onMouseUp: () => {
        sideState.paint.active = false;
        sideState.paint.draggingPan = false;
      },
      onMouseLeave: () => {
        if (!sideState.paint.active) {
          hideCursors();
        }
      },
      onUndo: () => {
        resetMasks();
      },
      onPaste: () => {
        pasteImageTo(sideName);
      },
    };

    bindEvents();

    return {
      setSource,
      renderPreview,
      resetMasks,
      rebuildAssets: rebuildDerivedAssets,
    };

    function bindEvents() {
      setupDropArea(sideUI.drop, handlers.onDropFile);
      sideUI.openBtn.addEventListener("click", () => sideUI.fileInput.click());
      sideUI.fileInput.addEventListener("change", event => {
        const file = event.target.files[0];
        if (file) handlers.onDropFile(file);
        event.target.value = "";
      });
      sideUI.removeCheck.addEventListener("change", handlers.onRemoveToggle);
      sideUI.brushSizeInput.addEventListener("input", handlers.onBrushSizeChange);
      sideUI.localBrushSizeInput.addEventListener("input", handlers.onLocalBrushSizeChange);
      sideUI.modeInputs.forEach((input) => input.addEventListener("change", () => handlers.onModeChange(input)));
      sideUI.canvas.addEventListener("wheel", handlers.onWheel, { passive: false });
      sideUI.canvas.addEventListener("mousedown", handlers.onMouseDown);
      sideUI.canvas.addEventListener("mousemove", handlers.onMouseMove);
      window.addEventListener("mousemove", handlers.onMouseMove);
      window.addEventListener("mouseup", handlers.onMouseUp);
      sideUI.canvas.addEventListener("mouseleave", handlers.onMouseLeave);
      sideUI.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      sideUI.undoBtn.addEventListener("click", handlers.onUndo);
      document.getElementById(sideName === SIDE.FRAME ? "resetFrameBrushBtn" : "resetTokenBrushBtn").addEventListener("click", resetBrushMasks);
      sideUI.pasteBtn.addEventListener("click", handlers.onPaste);
      window.addEventListener("resize", renderPreview);
    }

    function setSource(canvas) {
      sideState.source = canvas;
      sideState.viewport.zoom = 1;
      sideState.viewport.panX = 0;
      sideState.viewport.panY = 0;
      resetMasks(false);
      if (sideName === SIDE.FRAME) {
        rebuildDerivedAssets();
      }
      state.center.baseOffsetX = 0;
      state.center.baseOffsetY = 0;
      state.center.userMask = null;
      renderPreview();
      renderCenterPreview();
    }

    function resetMasks(shouldRender = true) {
      smartRemovals[sideName]?.reset();
      sideState.masks.color = null;
      sideState.masks.local = null;
      sideState.masks.eraser = null;
      if (sideName === SIDE.FRAME) {
        sideState.assets.hasWindow = false;
        rebuildDerivedAssets();
      }
      if (shouldRender) {
        renderPreview();
        renderCenterPreview();
      }
    }

    function resetBrushMasks() {
      smartRemovals[sideName]?.cancel();
      sideState.paint.active = false;
      sideState.masks.color = null;
      sideState.masks.local = null;
      sideState.masks.eraser = null;
      rebuildDerivedAssets(); renderPreview(); renderCenterPreview();
    }

    function rebuildDerivedAssets() {
      if (sideName !== SIDE.FRAME) {
        return;
      }
      const effective = effectiveCanvas(SIDE.FRAME);
      if (!effective) {
        state.sides.frame.assets.overlay = null;
        state.sides.frame.assets.windowMask = null;
        state.sides.frame.assets.hasWindow = false;
        return;
      }
      const previousWindow = sideState.assets.hasWindow ? sideState.assets.windowMask : null;
      const assets = buildFrameAssets(effective, previousWindow);
      state.sides.frame.assets.overlay = assets.overlay;
      state.sides.frame.assets.windowMask = assets.windowMask;
      state.sides.frame.assets.hasWindow = assets.hasWindow;
    }

    function renderPreview() {
      const ctx = sideUI.canvas.getContext("2d");
      const { width, height } = elementSize(sideUI.drop);

      if (sideUI.canvas.width !== width || sideUI.canvas.height !== height) {
        sideUI.canvas.width = width;
        sideUI.canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);

      const image = smartRemovals[sideName]?.getPreview() || effectiveCanvas(sideName);
      if (!image) {
        sideUI.placeholder.style.display = "grid";
        sideState.viewport.displayRect = null;
        return;
      }

      sideUI.placeholder.style.display = "none";
      const fit = fitRect(image.width, image.height, width - 28, height - 28);
      const drawW = Math.max(1, Math.floor(fit.w * sideState.viewport.zoom));
      const drawH = Math.max(1, Math.floor(fit.h * sideState.viewport.zoom));
      const drawX = Math.floor((width - drawW) / 2 + sideState.viewport.panX);
      const drawY = Math.floor((height - drawH) / 2 + sideState.viewport.panY);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      smartRemovals[sideName]?.drawSeeds(ctx, { x: drawX, y: drawY, w: drawW, h: drawH });

      sideState.viewport.displayRect = { x: drawX, y: drawY, w: drawW, h: drawH };
      sideState.viewport.displayScale = drawW / image.width;
    }

    function applyStroke(x1, y1, x2, y2, restore) {
      if (!sideState.source) {
        return;
      }

      ensureMasks(sideName);

      if (sideState.brushMode === BRUSH_MODES.COLOR) {
        applyGlobalColorMask(
          sideState.smartSource || sideState.source,
          sideState.masks.color,
          sideState.masks.local,
          sideState.masks.eraser,
          x1,
          y1,
          x2,
          y2,
          sideState.brushSize,
          restore
        );
      } else if (sideState.brushMode === BRUSH_MODES.LOCAL) {
        applyLocalColorMask(
          sideState.smartSource || sideState.source,
          sideState.masks.color,
          sideState.masks.local,
          sideState.masks.eraser,
          x1,
          y1,
          x2,
          y2,
          sideState.brushSize,
          sideState.localBrushSize,
          restore
        );
      } else {
        applyEraserMask(sideState.masks.eraser, x1, y1, x2, y2, sideState.brushSize, restore);
      }

      if (sideName === SIDE.FRAME) {
        rebuildDerivedAssets();
      }

      renderPreview();
      renderCenterPreview();
    }

    function updateLocalSizeVisibility() {
      sideUI.localSizeRow.style.display =
        sideState.enabled && sideState.brushMode === BRUSH_MODES.LOCAL ? "flex" : "none";
    }

    function updateCursorFromLast() {
      const { width, height } = elementSize(sideUI.drop);
      const x = sideState.paint.lastMouseX || width / 2;
      const y = sideState.paint.lastMouseY || height / 2;
      updateCursor(x, y);
    }

    function updateCursor(x, y) {
      if (!sideState.enabled || !sideState.viewport.displayRect) {
        hideCursors();
        return;
      }
      if (!pointInRect(sideState.viewport.displayRect, x, y)) {
        hideCursors();
        return;
      }

      const mainDiameter = Math.max(6, Math.round(sideState.brushSize * sideState.viewport.displayScale));
      placeCursor(sideUI.cursorMain, x, y, mainDiameter, "rgba(160, 80, 255, 0.9)", "rgba(160, 80, 255, 0.35)");

      if (sideState.brushMode === BRUSH_MODES.LOCAL) {
        const sampleDiameter = Math.max(4, Math.round(sideState.localBrushSize * sideState.viewport.displayScale));
        placeCursor(sideUI.cursorSample, x, y, sampleDiameter, "rgba(255, 64, 64, 0.9)", "rgba(255, 64, 64, 0.25)");
      } else {
        hideCursor(sideUI.cursorSample);
      }
    }

    function hideCursors() {
      hideCursor(sideUI.cursorMain);
      hideCursor(sideUI.cursorSample);
    }

    function effectiveCanvas(targetSide) {
      const target = state.sides[targetSide];
      if (!target.source) {
        return null;
      }
      return composeEffectiveCanvas(target.source, target.masks.color, target.masks.local, target.masks.eraser);
    }
  }

  function setupAppEvents() {
    const center = ui.center;
    const app = ui.app;

    app.langSelect.addEventListener("change", () => {
      state.language = app.langSelect.value === LANG.EN ? LANG.EN : LANG.RU;
      applyLanguage();
    });

    document.getElementById("resetCenterMaskBtn").addEventListener("click", () => {
      state.center.userMask = null;
      renderCenterPreview();
    });

    center.modeSelect.addEventListener("change", () => {
      state.appMode = center.modeSelect.value;
      if (state.appMode === MODES.MASK) {
        center.brushControls.classList.add("show");
        ensureCenterMaskCanvas();
      } else {
        center.brushControls.classList.remove("show");
        state.center.userMask = null;
        hideCursor(center.cursor);
        state.center.zoom = 1;
        state.center.panX = 0;
        state.center.panY = 0;
      }
      requestLayoutRender();
    });

    center.scaleSelect.addEventListener("change", () => {
      const oldSize = composeCanvasSize();
      state.scalePercent = Number(center.scaleSelect.value);
      const newSize = composeCanvasSize();
      resizeCenterMaskCanvas(oldSize, newSize);
      renderCenterPreview();
    });

    center.tokenScaleSelect.addEventListener("change", () => {
      state.tokenScalePercent = Number(center.tokenScaleSelect.value);
      renderCenterPreview();
    });

    center.brushSizeInput.addEventListener("input", () => {
      state.center.brushSize = Number(center.brushSizeInput.value);
      updateCenterBrushLabel();
      updateCenterCursorFromLast();
    });

    center.wrap.addEventListener("mousedown", onCenterMouseDown);
    window.addEventListener("mousemove", onCenterMouseMove);
    window.addEventListener("mouseup", onCenterMouseUp);
    center.wrap.addEventListener("wheel", onCenterWheel, { passive: false });
    center.wrap.addEventListener("mouseleave", () => {
      if (!state.center.paintingMask) {
        hideCursor(center.cursor);
      }
    });
    center.wrap.addEventListener("contextmenu", (event) => {
      if (state.appMode === MODES.MASK) {
        event.preventDefault();
      }
    });

    window.addEventListener("paste", onWindowPaste);
    center.downloadBtn.addEventListener("click", downloadComposedImage);
    window.addEventListener("resize", renderCenterPreview);
  }

  function setupDropArea(element, onFile) {
    element.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    element.addEventListener("drop", (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) {
        onFile(file);
      }
    });
  }

  async function pasteImageTo(target) {
    const image = await readClipboardImage();
    if (!image) {
      state.pendingPasteTarget = target;
      alert(t("alertClipboardPermission"));
      return;
    }

    const canvas = drawableToCanvas(image);
    if (target === SIDE.TOKEN) {
      sideControllers.token.setSource(canvas);
    } else {
      sideControllers.frame.setSource(canvas);
    }
  }

  function onWindowPaste(event) {
    if (!state.pendingPasteTarget) {
      return;
    }

    const data = event.clipboardData;
    if (!data || !data.items) {
      return;
    }

    for (const item of data.items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }

      const blob = item.getAsFile();
      if (!blob) {
        continue;
      }

      fileToImage(blob).then((img) => {
        if (!img) {
          alert(t("alertPastedUnreadable"));
          return;
        }

        const canvas = drawableToCanvas(img);
        if (state.pendingPasteTarget === SIDE.TOKEN) {
          sideControllers.token.setSource(canvas);
        } else {
          sideControllers.frame.setSource(canvas);
        }
        state.pendingPasteTarget = null;
      });

      event.preventDefault();
      return;
    }

    alert(t("alertClipboardNoImage"));
  }

  function onCenterMouseDown(event) {
    if (!state.center.composed) {
      return;
    }

    const point = toPoint(ui.center.wrap, event.clientX, event.clientY);
    state.center.lastMouseX = point.x;
    state.center.lastMouseY = point.y;

    if (!pointInRect(state.center.displayRect, point.x, point.y)) {
      return;
    }

    if (event.button === 1) {
      state.center.draggingPan = true;
      event.preventDefault();
      return;
    }

    if (state.appMode === MODES.MASK) {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }
      state.center.paintingMask = true;
      state.center.erasingMask = event.button === 2;
      const imagePoint = widgetToImagePoint(
        state.center.displayRect,
        { width: state.center.composed.width, height: state.center.composed.height },
        point.x,
        point.y
      );
      state.center.lastPaintX = imagePoint.x;
      state.center.lastPaintY = imagePoint.y;
      applyCenterMaskStroke(imagePoint.x, imagePoint.y, imagePoint.x, imagePoint.y, state.center.erasingMask);
      updateCenterCursor(point.x, point.y);
      event.preventDefault();
      return;
    }

    state.center.draggingOffset = true;
  }

  function onCenterMouseMove(event) {
    const point = toPoint(ui.center.wrap, event.clientX, event.clientY);

    if (state.center.draggingPan) {
      const dx = point.x - state.center.lastMouseX;
      const dy = point.y - state.center.lastMouseY;
      state.center.lastMouseX = point.x;
      state.center.lastMouseY = point.y;
      state.center.panX += dx;
      state.center.panY += dy;
      renderCenterPreview();
      return;
    }

    if (state.appMode === MODES.MASK) {
      state.center.lastMouseX = point.x;
      state.center.lastMouseY = point.y;
      updateCenterCursor(point.x, point.y);

      if (!state.center.paintingMask) {
        return;
      }

      const imagePoint = widgetToImagePoint(
        state.center.displayRect,
        { width: state.center.composed.width, height: state.center.composed.height },
        point.x,
        point.y
      );

      if (imagePoint.x === state.center.lastPaintX && imagePoint.y === state.center.lastPaintY) {
        return;
      }

      applyCenterMaskStroke(
        state.center.lastPaintX,
        state.center.lastPaintY,
        imagePoint.x,
        imagePoint.y,
        state.center.erasingMask
      );

      state.center.lastPaintX = imagePoint.x;
      state.center.lastPaintY = imagePoint.y;
      return;
    }

    if (!state.center.draggingOffset || state.center.displayScale <= 0 || !state.sides.frame.source) {
      return;
    }

    const dx = point.x - state.center.lastMouseX;
    const dy = point.y - state.center.lastMouseY;
    state.center.lastMouseX = point.x;
    state.center.lastMouseY = point.y;

    state.center.baseOffsetX += Math.round(dx / state.center.displayScale);
    state.center.baseOffsetY += Math.round(dy / state.center.displayScale);
    renderCenterPreview();
  }

  function onCenterMouseUp() {
    state.center.draggingOffset = false;
    state.center.draggingPan = false;
    state.center.paintingMask = false;
    state.center.erasingMask = false;
  }

  function onCenterWheel(event) {
    if (state.appMode !== MODES.MASK || !state.center.composed) {
      return;
    }

    event.preventDefault();
    const point = toPoint(ui.center.wrap, event.clientX, event.clientY);
    const { width, height } = elementSize(ui.center.wrap);
    const fit = fitRect(state.center.composed.width, state.center.composed.height, width - 28, height - 28);

    const oldZoom = state.center.zoom;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = clamp(oldZoom * zoomFactor, 1, 8);

    if (Math.abs(newZoom - oldZoom) < 0.0001) {
      if (newZoom <= 1.0001 && (state.center.panX !== 0 || state.center.panY !== 0)) {
        state.center.zoom = 1;
        state.center.panX = 0;
        state.center.panY = 0;
        renderCenterPreview();
      }
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const oldDrawW = fit.w * oldZoom;
    const oldDrawH = fit.h * oldZoom;
    const oldX = centerX - oldDrawW / 2 + state.center.panX;
    const oldY = centerY - oldDrawH / 2 + state.center.panY;
    const u = (point.x - oldX) / oldDrawW;
    const v = (point.y - oldY) / oldDrawH;
    const newDrawW = fit.w * newZoom;
    const newDrawH = fit.h * newZoom;
    const centeredX = centerX - newDrawW / 2;
    const centeredY = centerY - newDrawH / 2;

    if (newZoom <= 1.0001) {
      state.center.zoom = 1;
      state.center.panX = 0;
      state.center.panY = 0;
    } else {
      state.center.panX = point.x - centeredX - u * newDrawW;
      state.center.panY = point.y - centeredY - v * newDrawH;
      state.center.zoom = newZoom;
    }

    renderCenterPreview();
  }

  function applyCenterMaskStroke(x1, y1, x2, y2, erase) {
    if (state.appMode !== MODES.MASK || !state.sides.token.source) {
      return;
    }

    ensureCenterMaskCanvas();
    if (!state.center.userMask) {
      return;
    }

    const ctx = state.center.userMask.getContext("2d");
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = state.center.brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    renderCenterPreview();
  }

  function renderCenterPreview() {
    const ctx = ui.center.canvas.getContext("2d");
    const { width, height } = elementSize(ui.center.wrap);

    if (ui.center.canvas.width !== width || ui.center.canvas.height !== height) {
      ui.center.canvas.width = width;
      ui.center.canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const composed = composeFinalImage();
    state.center.composed = composed;

    if (!composed) {
      state.center.displayRect = null;
      state.center.displayScale = 1;
      ui.center.placeholder.style.display = "grid";
      ui.center.downloadBtn.disabled = true;
      hideCursor(ui.center.cursor);
      return;
    }

    const fit = fitRect(composed.width, composed.height, width - 28, height - 28);
    const drawW = Math.max(1, Math.floor(fit.w * state.center.zoom));
    const drawH = Math.max(1, Math.floor(fit.h * state.center.zoom));
    const drawX = Math.floor((width - drawW) / 2 + state.center.panX);
    const drawY = Math.floor((height - drawH) / 2 + state.center.panY);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(composed, drawX, drawY, drawW, drawH);

    state.center.displayRect = { x: drawX, y: drawY, w: drawW, h: drawH };
    state.center.displayScale = drawW / composed.width;

    ui.center.placeholder.style.display = "none";
    ui.center.downloadBtn.disabled = false;
  }

  function composeFinalImage() {
    const tokenEffective = composeEffectiveCanvas(
      state.sides.token.source,
      state.sides.token.masks.color,
      state.sides.token.masks.local,
      state.sides.token.masks.eraser
    );

    if (!tokenEffective) {
      return null;
    }

    const frameEffective = composeEffectiveCanvas(
      state.sides.frame.source,
      state.sides.frame.masks.color,
      state.sides.frame.masks.local,
      state.sides.frame.masks.eraser
    );

    const canvasSize = composeCanvasSize();
    const out = createCanvas(canvasSize.width, canvasSize.height);
    const outCtx = out.getContext("2d");

    const frameSize = frameEffective
      ? { width: frameEffective.width, height: frameEffective.height }
      : canvasSize;

    const frameOffset = {
      x: Math.floor((canvasSize.width - frameSize.width) / 2),
      y: Math.floor((canvasSize.height - frameSize.height) / 2),
    };

    const tokenPlacement = computeTokenPlacement(tokenEffective, canvasSize, frameSize, frameOffset);

    if (!frameEffective) {
      outCtx.drawImage(
        tokenPlacement.image,
        tokenPlacement.x,
        tokenPlacement.y,
        tokenPlacement.w,
        tokenPlacement.h
      );
      return out;
    }

    const maskedBase = createCanvas(canvasSize.width, canvasSize.height);
    const mbCtx = maskedBase.getContext("2d");
    mbCtx.drawImage(
      tokenPlacement.image,
      tokenPlacement.x,
      tokenPlacement.y,
      tokenPlacement.w,
      tokenPlacement.h
    );

    mbCtx.globalCompositeOperation = "destination-in";
    if (state.sides.frame.assets.windowMask) {
      mbCtx.drawImage(state.sides.frame.assets.windowMask, frameOffset.x, frameOffset.y);
    } else {
      mbCtx.drawImage(frameEffective, frameOffset.x, frameOffset.y);
    }

    const frameBoundsMask = createCanvas(canvasSize.width, canvasSize.height);
    const boundsCtx = frameBoundsMask.getContext("2d");
    boundsCtx.fillStyle = "rgba(255,255,255,1)";
    boundsCtx.fillRect(frameOffset.x, frameOffset.y, frameSize.width, frameSize.height);
    mbCtx.drawImage(frameBoundsMask, 0, 0);
    mbCtx.globalCompositeOperation = "source-over";

    outCtx.drawImage(maskedBase, 0, 0);

    if (state.sides.frame.assets.overlay) {
      outCtx.drawImage(state.sides.frame.assets.overlay, frameOffset.x, frameOffset.y);
    } else {
      outCtx.drawImage(frameEffective, frameOffset.x, frameOffset.y);
    }

    if (state.appMode === MODES.MASK && state.center.userMask) {
      const topLayer = createCanvas(canvasSize.width, canvasSize.height);
      const topCtx = topLayer.getContext("2d");
      topCtx.drawImage(
        tokenPlacement.image,
        tokenPlacement.x,
        tokenPlacement.y,
        tokenPlacement.w,
        tokenPlacement.h
      );
      topCtx.globalCompositeOperation = "destination-in";
      topCtx.drawImage(state.center.userMask, 0, 0);
      topCtx.globalCompositeOperation = "source-over";
      outCtx.drawImage(topLayer, 0, 0);
    }

    return out;
  }

  function computeTokenPlacement(tokenCanvas, canvasSize, frameSize, frameOffset) {
    const baseScale = Math.max(frameSize.width / tokenCanvas.width, frameSize.height / tokenCanvas.height);
    const scale = baseScale * (state.tokenScalePercent / 100);
    const drawW = Math.round(tokenCanvas.width * scale);
    const drawH = Math.round(tokenCanvas.height * scale);
    const x = frameOffset.x + Math.floor((frameSize.width - drawW) / 2) + state.center.baseOffsetX;
    const y = frameOffset.y + Math.floor((frameSize.height - drawH) / 2) + state.center.baseOffsetY;

    return {
      image: tokenCanvas,
      x,
      y,
      w: drawW,
      h: drawH,
    };
  }

  function composeCanvasSize() {
    let reference = null;

    if (state.sides.frame.source) {
      reference = {
        width: state.sides.frame.source.width,
        height: state.sides.frame.source.height,
      };
    } else if (state.sides.token.source) {
      reference = {
        width: state.sides.token.source.width,
        height: state.sides.token.source.height,
      };
    } else {
      return { width: 0, height: 0 };
    }

    const scale = state.scalePercent / 100;
    return {
      width: Math.max(1, Math.floor(reference.width * scale)),
      height: Math.max(1, Math.floor(reference.height * scale)),
    };
  }

  function ensureMasks(sideName) {
    const side = state.sides[sideName];
    if (!side.source) {
      return;
    }

    side.masks.color = ensureMaskCanvas(side.masks.color, side.source.width, side.source.height);
    side.masks.local = ensureMaskCanvas(side.masks.local, side.source.width, side.source.height);
    side.masks.eraser = ensureMaskCanvas(side.masks.eraser, side.source.width, side.source.height);
  }

  function ensureMaskCanvas(maskCanvas, width, height) {
    if (!maskCanvas || maskCanvas.width !== width || maskCanvas.height !== height) {
      return createCanvas(width, height);
    }
    return maskCanvas;
  }

  function ensureCenterMaskCanvas() {
    if (!state.sides.token.source) {
      return;
    }

    const size = composeCanvasSize();
    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    if (
      !state.center.userMask ||
      state.center.userMask.width !== size.width ||
      state.center.userMask.height !== size.height
    ) {
      state.center.userMask = createCanvas(size.width, size.height);
    }
  }

  function resizeCenterMaskCanvas(oldSize, newSize) {
    if (!state.center.userMask) {
      return;
    }

    if (oldSize.width === newSize.width && oldSize.height === newSize.height) {
      return;
    }

    if (newSize.width <= 0 || newSize.height <= 0) {
      state.center.userMask = null;
      return;
    }

    const next = createCanvas(newSize.width, newSize.height);
    const ctx = next.getContext("2d");
    const dx = Math.floor((newSize.width - oldSize.width) / 2);
    const dy = Math.floor((newSize.height - oldSize.height) / 2);
    ctx.drawImage(state.center.userMask, dx, dy);
    state.center.userMask = next;
  }

  function composeEffectiveCanvas(sourceCanvas, colorMaskCanvas, localMaskCanvas, eraserMaskCanvas) {
    if (!sourceCanvas) {
      return null;
    }
    for (const side of Object.values(state.sides)) {
      if (sourceCanvas === side.source) { sourceCanvas = side.smartSource || sourceCanvas; break; }
    }

    const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
    const ctx = out.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = "destination-out";

    if (colorMaskCanvas) {
      ctx.drawImage(colorMaskCanvas, 0, 0);
    }
    if (localMaskCanvas) {
      ctx.drawImage(localMaskCanvas, 0, 0);
    }
    if (eraserMaskCanvas) {
      ctx.drawImage(eraserMaskCanvas, 0, 0);
    }

    ctx.globalCompositeOperation = "source-over";
    return out;
  }

  function applyEraserMask(maskCanvas, x1, y1, x2, y2, brushSize, restore) {
    if (!maskCanvas) {
      return;
    }

    const ctx = maskCanvas.getContext("2d");
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.globalCompositeOperation = restore ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function applyGlobalColorMask(
    sourceCanvas,
    colorMaskCanvas,
    localMaskCanvas,
    eraserMaskCanvas,
    x1,
    y1,
    x2,
    y2,
    brushSize,
    restore
  ) {
    if (!sourceCanvas || !colorMaskCanvas) {
      return;
    }

    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const sourceData = sourceImageData.data;

    const effective = composeEffectiveCanvas(sourceCanvas, colorMaskCanvas, localMaskCanvas, eraserMaskCanvas);
    const effectiveCtx = effective.getContext("2d", { willReadFrequently: true });
    const effectiveImageData = effectiveCtx.getImageData(0, 0, effective.width, effective.height);
    const effectiveData = effectiveImageData.data;

    const sampleData = restore ? sourceData : effectiveData;
    const sampledColors = new Set();
    collectColorsFromPath(
      sampleData,
      effective.width,
      effective.height,
      x1,
      y1,
      x2,
      y2,
      brushSize / 2,
      sampledColors
    );

    if (sampledColors.size === 0) {
      return;
    }

    const maskCtx = colorMaskCanvas.getContext("2d", { willReadFrequently: true });
    const maskImageData = maskCtx.getImageData(0, 0, effective.width, effective.height);
    const maskData = maskImageData.data;

    for (let i = 0; i < sourceData.length; i += 4) {
      const key = (sourceData[i] << 16) | (sourceData[i + 1] << 8) | sourceData[i + 2];
      if (!sampledColors.has(key)) {
        continue;
      }

      if (restore) {
        maskData[i + 3] = 0;
      } else if (effectiveData[i + 3] !== 0) {
        maskData[i] = 255;
        maskData[i + 1] = 255;
        maskData[i + 2] = 255;
        maskData[i + 3] = 255;
      }
    }

    maskCtx.putImageData(maskImageData, 0, 0);
  }

  function applyLocalColorMask(
    sourceCanvas,
    colorMaskCanvas,
    localMaskCanvas,
    eraserMaskCanvas,
    x1,
    y1,
    x2,
    y2,
    mainBrushSize,
    sampleBrushSize,
    restore
  ) {
    if (!sourceCanvas || !localMaskCanvas) {
      return;
    }

    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const sourceData = sourceImageData.data;

    const effective = composeEffectiveCanvas(sourceCanvas, colorMaskCanvas, localMaskCanvas, eraserMaskCanvas);
    const effectiveCtx = effective.getContext("2d", { willReadFrequently: true });
    const effectiveImageData = effectiveCtx.getImageData(0, 0, effective.width, effective.height);
    const effectiveData = effectiveImageData.data;

    const sampleData = restore ? sourceData : effectiveData;
    const areaData = restore ? sourceData : effectiveData;

    const maskCtx = localMaskCanvas.getContext("2d", { willReadFrequently: true });
    const maskImageData = maskCtx.getImageData(0, 0, effective.width, effective.height);
    const maskData = maskImageData.data;

    const mainRadius = mainBrushSize / 2;
    const sampleRadius = sampleBrushSize / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    const step = Math.max(1, mainRadius * 0.4);
    const steps = Math.max(1, Math.ceil(distance / step));

    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;

      const sampledColors = new Set();
      collectColorsInCircle(sampleData, effective.width, effective.height, cx, cy, sampleRadius, sampledColors);
      if (sampledColors.size === 0) {
        continue;
      }

      const radius = Math.max(1, Math.floor(mainRadius));
      const left = clamp(Math.floor(cx - radius), 0, effective.width - 1);
      const right = clamp(Math.ceil(cx + radius), 0, effective.width - 1);
      const top = clamp(Math.floor(cy - radius), 0, effective.height - 1);
      const bottom = clamp(Math.ceil(cy + radius), 0, effective.height - 1);
      const rr = mainRadius * mainRadius;

      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const ddx = x - cx;
          const ddy = y - cy;
          if (ddx * ddx + ddy * ddy > rr) {
            continue;
          }

          const i = (y * effective.width + x) * 4;
          if (areaData[i + 3] === 0) {
            continue;
          }

          const key = (areaData[i] << 16) | (areaData[i + 1] << 8) | areaData[i + 2];
          if (!sampledColors.has(key)) {
            continue;
          }

          if (restore) {
            maskData[i + 3] = 0;
          } else {
            maskData[i] = 255;
            maskData[i + 1] = 255;
            maskData[i + 2] = 255;
            maskData[i + 3] = 255;
          }
        }
      }
    }

    maskCtx.putImageData(maskImageData, 0, 0);
  }

  function collectColorsFromPath(data, width, height, x1, y1, x2, y2, radius, outSet) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    const step = Math.max(1, radius * 0.4);
    const steps = Math.max(1, Math.ceil(distance / step));

    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      collectColorsInCircle(data, width, height, cx, cy, radius, outSet);
    }
  }

  function collectColorsInCircle(data, width, height, cx, cy, radius, outSet) {
    const r = Math.max(1, Math.floor(radius));
    const left = clamp(Math.floor(cx - r), 0, width - 1);
    const right = clamp(Math.ceil(cx + r), 0, width - 1);
    const top = clamp(Math.floor(cy - r), 0, height - 1);
    const bottom = clamp(Math.ceil(cy + r), 0, height - 1);
    const rr = radius * radius;

    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const ddx = x - cx;
        const ddy = y - cy;
        if (ddx * ddx + ddy * ddy > rr) {
          continue;
        }
        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) {
          continue;
        }
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        outSet.add(key);
      }
    }
  }

  function buildFrameAssets(frameCanvas, previousWindow = null) {
    const src = createCanvas(frameCanvas.width, frameCanvas.height);
    const srcCtx = src.getContext("2d", { willReadFrequently: true });
    srcCtx.drawImage(frameCanvas, 0, 0);

    const { width, height } = src;
    const srcData = srcCtx.getImageData(0, 0, width, height).data;
    const passable = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const r = srcData[i];
        const g = srcData[i + 1];
        const b = srcData[i + 2];
        const a = srcData[i + 3];

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const lowSaturation = maxC - minC <= 24;
        const bright = maxC >= 210;
        const almostWhite = maxC >= 245 && maxC - minC <= 12;
        passable[y * width + x] = a < 32 || almostWhite || (a < 220 && bright && lowSaturation) ? 1 : 0;
      }
    }

    const seed = findWindowSeed(passable, width, height);
    const inner = SmartBackgroundRemoval.findEnclosedRegion(passable, width, height, seed);
    const hasWindow = inner.some(Boolean);

    // Erasing a piece of an already-open frame can connect its opening to the
    // outside. Keep the last valid window rather than revealing the portrait
    // outside the ring or making it disappear. A new source/reset clears this cache.
    if (!hasWindow && previousWindow && previousWindow.width === width && previousWindow.height === height && passable[Math.floor(height / 2) * width + Math.floor(width / 2)]) {
      const overlay = createCanvas(width, height), ctx = overlay.getContext("2d");
      ctx.drawImage(src, 0, 0); ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(previousWindow, 0, 0); ctx.globalCompositeOperation = "source-over";
      return { overlay, windowMask: previousWindow, hasWindow: true };
    }

    const overlay = createCanvas(width, height);
    const overlayCtx = overlay.getContext("2d");
    overlayCtx.drawImage(src, 0, 0);
    const overlayImage = overlayCtx.getImageData(0, 0, width, height);

    const windowMask = createCanvas(width, height);
    const windowMaskCtx = windowMask.getContext("2d");
    const windowMaskImage = windowMaskCtx.createImageData(width, height);

    for (let i = 0; i < inner.length; i += 1) {
      if (!inner[i]) {
        continue;
      }
      overlayImage.data[i * 4 + 3] = 0;
      windowMaskImage.data[i * 4] = 255;
      windowMaskImage.data[i * 4 + 1] = 255;
      windowMaskImage.data[i * 4 + 2] = 255;
      windowMaskImage.data[i * 4 + 3] = 255;
    }

    overlayCtx.putImageData(overlayImage, 0, 0);
    windowMaskCtx.putImageData(windowMaskImage, 0, 0);

    return { overlay, windowMask, hasWindow };
  }

  function findWindowSeed(passable, width, height) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    if (passable[cy * width + cx]) {
      return { x: cx, y: cy };
    }

    const maxRadius = Math.max(width, height);
    for (let r = 1; r < maxRadius; r += 1) {
      const left = Math.max(cx - r, 0);
      const right = Math.min(cx + r, width - 1);
      const top = Math.max(cy - r, 0);
      const bottom = Math.min(cy + r, height - 1);

      for (let x = left; x <= right; x += 1) {
        if (passable[top * width + x]) {
          return { x, y: top };
        }
        if (passable[bottom * width + x]) {
          return { x, y: bottom };
        }
      }

      for (let y = top; y <= bottom; y += 1) {
        if (passable[y * width + left]) {
          return { x: left, y };
        }
        if (passable[y * width + right]) {
          return { x: right, y };
        }
      }
    }

    return null;
  }

  async function readImageFile(file) {
    if (!file.type.startsWith("image/")) {
      return null;
    }
    return fileToImage(file);
  }

  async function readClipboardImage() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((entry) => entry.startsWith("image/"));
          if (!type) {
            continue;
          }
          const blob = await item.getType(type);
          return fileToImage(blob);
        }
      }
    } catch (_) {
      // noop
    }

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text.startsWith("data:image/")) {
          return srcToImage(text);
        }
      }
    } catch (_) {
      // noop
    }

    return null;
  }

  function fileToImage(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  }

  function srcToImage(src, crossOrigin) {
    return new Promise((resolve) => {
      const image = new Image();
      if (crossOrigin) {
        image.crossOrigin = "anonymous";
      }
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function downloadComposedImage() {
    downloadCanvas(state.center.composed, "mixed_image.png");
  }

  function downloadCanvas(canvas, filename) {
    if (!canvas) {
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        alert(t("alertSaveFailed"));
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  // Which category is currently open in the modal (null = the category list view).
  let presetsCurrentCategory = null;

  function setupPresets() {
    const p = ui.presets;

    p.openBtn.addEventListener("click", openPresetsModal);
    p.closeBtn.addEventListener("click", closePresetsModal);
    p.backBtn.addEventListener("click", showCategoryList);
    p.modal.addEventListener("mousedown", (event) => {
      if (event.target === p.modal) {
        closePresetsModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || p.modal.hidden) {
        return;
      }
      // Esc first steps back from a category to the category list, then closes.
      if (presetsCurrentCategory) {
        showCategoryList();
      } else {
        closePresetsModal();
      }
    });
  }

  async function openPresetsModal() {
    const p = ui.presets;
    p.modal.hidden = false;

    if (PRESETS.cache) {
      showCategoryList();
      return;
    }

    presetsCurrentCategory = null;
    setPresetsHeader(null);
    p.grid.innerHTML = "";
    p.status.textContent = t("presetsLoading");

    let categories = [];
    try {
      categories = await loadCategories();
    } catch (_) {
      p.status.textContent = t("presetsError");
      return;
    }

    if (!categories.length) {
      p.status.textContent = t("presetsEmpty");
      return;
    }

    PRESETS.cache = categories;
    showCategoryList();
  }

  function closePresetsModal() {
    ui.presets.modal.hidden = true;
  }

  // Switches the modal header between the category list view (category === null) and a
  // single-category view (showing its localized name + description and a Back button).
  function setPresetsHeader(category) {
    const p = ui.presets;
    if (!category) {
      p.backBtn.hidden = true;
      p.title.textContent = t("presetsTitle");
      p.disclaimer.hidden = false;
      p.categoryDesc.hidden = true;
      p.categoryDesc.textContent = "";
      return;
    }
    p.backBtn.hidden = false;
    p.backBtn.textContent = t("presetsBack");
    p.title.textContent = categoryName(category);
    p.disclaimer.hidden = true;
    const desc = categoryDescription(category);
    p.categoryDesc.textContent = desc;
    p.categoryDesc.hidden = !desc;
  }

  function showCategoryList() {
    presetsCurrentCategory = null;
    setPresetsHeader(null);
    renderCategoryCards(PRESETS.cache || []);
  }

  function showCategory(category) {
    presetsCurrentCategory = category;
    setPresetsHeader(category);
    renderPresetCards(category.presets);
  }

  function renderCategoryCards(categories) {
    const p = ui.presets;
    p.status.textContent = "";
    p.grid.innerHTML = "";

    for (const category of categories) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "preset-card category-card";
      card.title = categoryName(category);

      card.appendChild(buildCategoryThumb(category));

      const name = document.createElement("span");
      name.className = "preset-name";
      name.textContent = categoryName(category);

      const count = document.createElement("span");
      count.className = "category-count";
      count.textContent = t("presetsCount", { count: category.presets.length });

      card.appendChild(name);
      card.appendChild(count);
      card.addEventListener("click", () => showCategory(category));
      p.grid.appendChild(card);
    }
  }

  // Builds a small cover for a category: a collage of up to four of its frame thumbnails
  // (or a folder glyph when the category is still empty).
  function buildCategoryThumb(category) {
    const thumb = document.createElement("div");
    thumb.className = "category-thumb";

    const covers = category.presets.slice(0, 4);
    if (!covers.length) {
      thumb.classList.add("category-thumb--empty");
      thumb.textContent = "📁";
      return thumb;
    }
    if (covers.length === 1) {
      thumb.classList.add("category-thumb--single");
    }
    for (const preset of covers) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      setPresetThumbSrc(img, preset);
      thumb.appendChild(img);
    }
    return thumb;
  }

  function renderPresetCards(list) {
    const p = ui.presets;
    p.grid.innerHTML = "";

    if (!list.length) {
      p.status.textContent = t("presetsCategoryEmpty");
      return;
    }
    p.status.textContent = "";

    for (const preset of list) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "preset-card";
      card.title = prettyPresetName(preset.name);

      const thumb = document.createElement("img");
      thumb.className = "preset-thumb";
      thumb.loading = "lazy";
      thumb.alt = prettyPresetName(preset.name);
      setPresetThumbSrc(thumb, preset);

      const name = document.createElement("span");
      name.className = "preset-name";
      name.textContent = prettyPresetName(preset.name);

      card.appendChild(thumb);
      card.appendChild(name);
      card.addEventListener("click", () => applyPreset(preset));
      p.grid.appendChild(card);
    }
  }

  // Loads an <img> from the local copy ("next to" the HTML) first; if that 404s, falls
  // back to the GitHub-hosted copy.
  function setPresetThumbSrc(img, preset) {
    img.src = preset.localUrl;
    if (preset.rawUrl) {
      img.addEventListener("error", function onThumbError() {
        img.removeEventListener("error", onThumbError);
        img.src = preset.rawUrl;
      });
    }
  }

  async function applyPreset(preset) {
    // Prefer the local file sitting next to the page (works on a deployed site and on
    // a local web server). If it is absent or unusable (e.g. a file:// page where the
    // canvas would be tainted), fall back to the GitHub-hosted copy via CORS.
    let canvas = await loadUsableCanvas(preset.localUrl, false);
    if (!canvas && preset.rawUrl) {
      canvas = await loadUsableCanvas(preset.rawUrl, true);
    }
    if (!canvas) {
      alert(t("alertBadImage"));
      return;
    }
    sideControllers.frame.setSource(canvas);
    closePresetsModal();
  }

  async function loadUsableCanvas(url, crossOrigin) {
    if (!url) {
      return null;
    }
    const image = await srcToImage(url, crossOrigin);
    if (!image) {
      return null;
    }
    const canvas = drawableToCanvas(image);
    try {
      // Verify the canvas is readable (not tainted). A tainted canvas would later make
      // "Download" and the color tools throw a SecurityError, so we reject it here and
      // let the caller try the next source.
      canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, 1, 1);
      return canvas;
    } catch (_) {
      return null;
    }
  }

  // Builds the list of categories: one per first-level subfolder of PRESETS.dir, plus a
  // transitional "uncategorized" group for images that still sit directly in PRESETS.dir.
  async function loadCategories() {
    const root = await listDir(PRESETS.dir);
    const categories = [];

    for (const folder of root.dirs) {
      const sub = await listDir(`${PRESETS.dir}/${folder}`);
      const images = sub.files.filter(isImageName);
      const meta = await loadCategoryMeta(folder);
      categories.push(makeCategory(folder, images, meta));
    }

    const looseImages = root.files.filter(isImageName);
    if (looseImages.length) {
      categories.push(makeUncategorizedCategory(looseImages));
    }

    categories.sort(compareCategories);
    return categories;
  }

  // Categories are ordered by their `order` field (from meta.json), then alphabetically;
  // the uncategorized group always sinks to the bottom.
  function compareCategories(a, b) {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
  }

  function makeCategory(folder, imageNames, meta) {
    const order = meta && Number.isFinite(meta.order) ? meta.order : 1000;
    return {
      id: folder,
      meta: meta || null,
      order,
      uncategorized: false,
      presets: sortedPresets(imageNames, folder),
    };
  }

  function makeUncategorizedCategory(imageNames) {
    return {
      id: "",
      meta: null,
      order: Number.MAX_SAFE_INTEGER,
      uncategorized: true,
      presets: sortedPresets(imageNames, ""),
    };
  }

  function sortedPresets(imageNames, folder) {
    return imageNames
      .slice()
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((name) => makePreset(name, folder));
  }

  function categoryName(category) {
    if (category.uncategorized) {
      return t("presetsUncategorized");
    }
    return localizedMeta(category.meta, "name") || prettyPresetName(category.id);
  }

  function categoryDescription(category) {
    if (category.uncategorized) {
      return t("presetsUncategorizedDesc");
    }
    return localizedMeta(category.meta, "description");
  }

  // Reads a localized string from a meta field that may be either a plain string or a
  // map of language code -> string (e.g. { ru: "...", en: "..." }).
  function localizedMeta(meta, field) {
    if (!meta || !meta[field]) {
      return "";
    }
    const value = meta[field];
    if (typeof value === "string") {
      return value;
    }
    return value[state.language] || value[LANG.RU] || value[LANG.EN] || "";
  }

  async function loadCategoryMeta(folder) {
    const rel = `${folder}/${PRESETS.metaFile}`;
    let meta = await fetchJson(`${PRESETS.dir}/${encodePresetPath(rel)}`);
    if (!meta) {
      const raw = buildRawUrl(rel);
      if (raw) {
        meta = await fetchJson(raw);
      }
    }
    return meta;
  }

  async function fetchJson(url) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  // Lists a directory's child folders and files. Tries a same-origin directory index
  // first (dev servers), then the GitHub Contents API (GitHub Pages). Returns
  // { dirs, files } — empty arrays when nothing could be listed.
  async function listDir(relPath) {
    const fromIndex = await listDirFromIndex(relPath);
    if (fromIndex) {
      return fromIndex;
    }
    const fromGitHub = await listDirFromGitHub(relPath);
    if (fromGitHub) {
      return fromGitHub;
    }
    return { dirs: [], files: [] };
  }

  async function listDirFromIndex(relPath) {
    try {
      const response = await fetch(`${encodePresetPath(relPath)}/`, { headers: { Accept: "text/html" } });
      if (!response.ok) {
        return null;
      }
      return parseDirIndex(await response.text());
    } catch (_) {
      return null;
    }
  }

  function parseDirIndex(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a[href]"));
    const dirs = [];
    const files = [];
    const seen = new Set();

    for (const anchor of anchors) {
      const raw = (anchor.getAttribute("href") || "").split("?")[0].split("#")[0];
      const isDir = raw.endsWith("/");
      const name = decodeURIComponent(raw.replace(/\/+$/, ""));
      // Keep only direct children: a bare "name" or "name/". Skip parent ("..") and any
      // nested/absolute hrefs (those contain a slash after trimming the trailing one).
      if (!name || name === ".." || name.includes("/") || seen.has(name)) {
        continue;
      }
      seen.add(name);
      (isDir ? dirs : files).push(name);
    }

    return { dirs, files };
  }

  async function listDirFromGitHub(relPath) {
    const repo = resolveGitHubRepo();
    if (!repo) {
      return null;
    }
    try {
      const endpoint = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${encodePresetPath(relPath)}?ref=${repo.branch}`;
      const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) {
        return null;
      }
      const items = await response.json();
      if (!Array.isArray(items)) {
        return null;
      }
      const dirs = [];
      const files = [];
      for (const item of items) {
        if (item.type === "dir") {
          dirs.push(item.name);
        } else if (item.type === "file") {
          files.push(item.name);
        }
      }
      return { dirs, files };
    } catch (_) {
      return null;
    }
  }

  function resolveGitHubRepo() {
    const host = location.hostname;
    if (host.endsWith(".github.io")) {
      const owner = host.slice(0, host.length - ".github.io".length);
      const repo = location.pathname.split("/").filter(Boolean)[0];
      if (owner && repo) {
        return { owner, repo, branch: PRESETS.fallbackRepo.branch };
      }
    }
    return PRESETS.fallbackRepo;
  }

  // `relPath` is relative to PRESETS.dir (e.g. "simple/foo.png" or just "foo.png").
  function makePreset(name, folder) {
    const rel = folder ? `${folder}/${name}` : name;
    return {
      name,
      // Same-origin path ("next to" the page) — used first.
      localUrl: `${PRESETS.dir}/${encodePresetPath(rel)}`,
      // GitHub-hosted copy — used as a fallback (and for thumbnails over file://).
      rawUrl: buildRawUrl(rel),
    };
  }

  function buildRawUrl(relPath) {
    const repo = resolveGitHubRepo();
    if (!repo) {
      return null;
    }
    return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/${PRESETS.dir}/${encodePresetPath(relPath)}`;
  }

  // Encodes each path segment so spaces/special characters are URL-safe while keeping the
  // slash separators intact.
  function encodePresetPath(relPath) {
    return String(relPath)
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
  }

  function isImageName(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return PRESETS.imageExtensions.includes(ext);
  }

  function prettyPresetName(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  }

  function updateCenterCursorFromLast() {
    const { width, height } = elementSize(ui.center.wrap);
    const x = state.center.lastMouseX || width / 2;
    const y = state.center.lastMouseY || height / 2;
    updateCenterCursor(x, y);
  }

  function updateCenterCursor(x, y) {
    if (state.appMode !== MODES.MASK || !state.center.displayRect) {
      hideCursor(ui.center.cursor);
      return;
    }

    if (!pointInRect(state.center.displayRect, x, y)) {
      hideCursor(ui.center.cursor);
      return;
    }

    const diameter = Math.max(6, Math.round(state.center.brushSize * state.center.displayScale));
    placeCursor(ui.center.cursor, x, y, diameter, "rgba(160, 80, 255, 0.9)", "rgba(160, 80, 255, 0.35)");
  }

  function placeCursor(node, x, y, diameter, borderColor, fillColor) {
    node.style.width = `${diameter}px`;
    node.style.height = `${diameter}px`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.borderColor = borderColor;
    node.style.background = fillColor;
    node.style.display = "block";
  }

  function hideCursor(node) {
    node.style.display = "none";
  }

  function toPoint(container, clientX, clientY) {
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function elementSize(node) {
    const rect = node.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    };
  }

  function pointInRect(rect, x, y) {
    if (!rect) {
      return false;
    }
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
  }

  function widgetToImagePoint(displayRect, imageSize, x, y) {
    if (!displayRect || !imageSize) {
      return { x: 0, y: 0 };
    }

    const localX = clamp(x - displayRect.x, 0, displayRect.w - 1);
    const localY = clamp(y - displayRect.y, 0, displayRect.h - 1);
    const imgX = Math.floor((localX * imageSize.width) / displayRect.w);
    const imgY = Math.floor((localY * imageSize.height) / displayRect.h);

    return {
      x: clamp(imgX, 0, imageSize.width - 1),
      y: clamp(imgY, 0, imageSize.height - 1),
    };
  }

  function fitRect(srcW, srcH, maxW, maxH) {
    if (srcW <= 0 || srcH <= 0 || maxW <= 0 || maxH <= 0) {
      return { w: 1, h: 1 };
    }
    const scale = Math.min(maxW / srcW, maxH / srcH);
    return {
      w: Math.max(1, Math.floor(srcW * scale)),
      h: Math.max(1, Math.floor(srcH * scale)),
    };
  }

  function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function drawableToCanvas(drawable) {
    const width = drawable.naturalWidth ?? drawable.width;
    const height = drawable.naturalHeight ?? drawable.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(drawable, 0, 0);
    return canvas;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function renderAll() {
    sideControllers.token.renderPreview();
    sideControllers.frame.renderPreview();
    sideControllers.frame.rebuildAssets();
    renderCenterPreview();
  }

  function requestLayoutRender() {
    if (layoutRenderScheduled) {
      return;
    }
    layoutRenderScheduled = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutRenderScheduled = false;
        renderAll();
      });
    });
  }

  function t(key, vars) {
    const dictionary = I18N[state.language] || I18N[LANG.RU];
    const template = dictionary[key] ?? I18N[LANG.RU][key] ?? key;
    if (!vars) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
  }

  function applyLanguage() {
    document.documentElement.lang = state.language;
    document.title = t("title");

    const app = ui.app;
    app.title.textContent = t("title");
    app.langSelect.value = state.language;
    labelIconButton(ui.token.openBtn, t("open"), t("tipOpenToken"));
    labelIconButton(app.pasteTokenBtn, t("paste"), t("tipPasteToken"));
    labelIconButton(app.undoTokenBtn, t("undo"), t("tipUndoToken"));
    app.removeTokenLabel.textContent = t("removeToken");
    app.tokenModeColorLabel.textContent = t("modeColor");
    app.tokenModeLocalLabel.textContent = t("modeLocal");
    app.tokenModeEraserLabel.textContent = t("modeEraser");
    app.tokenDropPlaceholder.textContent = t("placeholderToken");
    labelIconButton(ui.frame.openBtn, t("open"), t("tipOpenFrame"));
    labelIconButton(app.pasteFrameBtn, t("paste"), t("tipPasteFrame"));
    labelIconButton(app.undoFrameBtn, t("undo"), t("tipUndoFrame"));
    app.removeFrameLabel.textContent = t("removeFrame");
    app.frameModeColorLabel.textContent = t("modeColor");
    app.frameModeLocalLabel.textContent = t("modeLocal");
    app.frameModeEraserLabel.textContent = t("modeEraser");
    app.frameDropPlaceholder.textContent = t("placeholderFrame");
    app.previewPlaceholder.textContent = t("placeholderPreview");
    document.querySelectorAll(".panel-reset").forEach(button => { button.textContent = t("undo"); });

    ui.center.downloadBtn.textContent = t("download");

    labelIconButton(ui.presets.openBtn, t("presetsButton"), t("tipPresets"));
    document.querySelectorAll("[data-toolbar-label]").forEach(group => {
      group.setAttribute("aria-label", t(group.dataset.toolbarLabel === "files" ? "filesGroup" : "editsGroup"));
    });
    ui.presets.title.textContent = t("presetsTitle");
    ui.presets.disclaimer.textContent = t("presetsDisclaimer");
    ui.presets.closeBtn.setAttribute("aria-label", t("presetsClose"));
    ui.presets.closeBtn.title = t("presetsClose");

    ui.center.modeSelect.setAttribute("aria-label", t("centerModeLabel"));
    ui.center.scaleSelect.setAttribute("aria-label", t("centerScaleLabel"));
    ui.center.tokenScaleSelect.setAttribute("aria-label", t("centerTokenScaleLabel"));

    const offsetOption = ui.center.modeSelect.querySelector('option[value="offset"]');
    const maskOption = ui.center.modeSelect.querySelector('option[value="mask"]');
    if (offsetOption) {
      offsetOption.textContent = t("modeOffset");
    }
    if (maskOption) {
      maskOption.textContent = t("modeMask");
    }

    updateTokenScaleOptionLabels();
    applyTooltips();
    updateSideBrushLabels(SIDE.TOKEN);
    updateSideBrushLabels(SIDE.FRAME);
    updateCenterBrushLabel();
    Object.values(smartRemovals).forEach(controller => controller.setLanguage(state.language));

    // If the presets modal is open, re-render it so localized category names and
    // descriptions update immediately on a language switch.
    if (!ui.presets.modal.hidden && PRESETS.cache) {
      if (presetsCurrentCategory) {
        showCategory(presetsCurrentCategory);
      } else {
        showCategoryList();
      }
    }
  }

  function labelIconButton(button, label, tooltip) {
    button.setAttribute("aria-label", label);
    button.title = tooltip;
    button.dataset.tooltip = tooltip;
  }

  function updateTokenScaleOptionLabels() {
    const options = ui.center.tokenScaleSelect.options;
    for (const option of options) {
      option.textContent = `${t("tokenScalePrefix")} ${option.value}%`;
    }
  }

  function updateSideBrushLabels(sideName) {
    const sideState = state.sides[sideName];
    const sideUI = ui[sideName];
    sideUI.brushLabel.textContent = t("brushPurple", { size: sideState.brushSize });
    sideUI.localBrushLabel.textContent = t("brushRed", { size: sideState.localBrushSize });
  }

  function updateCenterBrushLabel() {
    ui.center.brushLabel.textContent = t("brushMain", { size: state.center.brushSize });
  }

  function applyTooltips() {
    const app = ui.app;
    const center = ui.center;

    app.langSelect.title = t("tipLangSelect");
    app.pasteTokenBtn.title = t("tipPasteToken");
    app.undoTokenBtn.title = t("tipUndoToken");
    ui.token.removeCheck.title = t("tipRemoveTokenCheck");
    if (ui.token.removeCheck.closest("label")) {
      ui.token.removeCheck.closest("label").title = t("tipRemoveTokenCheck");
    }
    app.pasteFrameBtn.title = t("tipPasteFrame");
    app.undoFrameBtn.title = t("tipUndoFrame");
    ui.frame.removeCheck.title = t("tipRemoveFrameCheck");
    if (ui.frame.removeCheck.closest("label")) {
      ui.frame.removeCheck.closest("label").title = t("tipRemoveFrameCheck");
    }

    center.modeSelect.title = t("tipCenterMode");
    center.scaleSelect.title = t("tipCenterScale");
    center.tokenScaleSelect.title = t("tipTokenScale");
    center.downloadBtn.title = t("tipDownload");

    ui.token.drop.title = t("tipTokenCanvasPan");
    ui.token.canvas.title = t("tipTokenCanvasPan");
    ui.frame.drop.title = t("tipFrameCanvasPan");
    ui.frame.canvas.title = t("tipFrameCanvasPan");
    center.wrap.title = t("tipCenterCanvasPan");
    center.canvas.title = t("tipCenterCanvasPan");

    ui.token.modeInputs.forEach((input) => {
      if (input.value === BRUSH_MODES.COLOR) {
        input.title = t("tipTokenModeColor");
      } else if (input.value === BRUSH_MODES.LOCAL) {
        input.title = t("tipTokenModeLocal");
      } else if (input.value === BRUSH_MODES.ERASER) {
        input.title = t("tipTokenModeEraser");
      }
      if (input.closest("label")) {
        input.closest("label").title = input.title;
      }
    });

    ui.frame.modeInputs.forEach((input) => {
      if (input.value === BRUSH_MODES.COLOR) {
        input.title = t("tipFrameModeColor");
      } else if (input.value === BRUSH_MODES.LOCAL) {
        input.title = t("tipFrameModeLocal");
      } else if (input.value === BRUSH_MODES.ERASER) {
        input.title = t("tipFrameModeEraser");
      }
      if (input.closest("label")) {
        input.closest("label").title = input.title;
      }
    });
    for (const sideName of Object.values(SIDE)) {
      const side = ui[sideName];
      EditorTooltips.set(side.removeCheck, side.removeCheck.title, true);
      EditorTooltips.set(side.brushSizeInput, t("tipBrushSize"), true);
      EditorTooltips.set(side.localBrushSizeInput, t("tipSampleSize"), true);
      side.modeInputs.forEach(input => EditorTooltips.set(input, input.title, true));
      EditorTooltips.set(document.getElementById(sideName === SIDE.FRAME ? "resetFrameBrushBtn" : "resetTokenBrushBtn"), t("tipResetBrushes"));
    }
    for (const control of [app.langSelect, center.modeSelect, center.scaleSelect, center.tokenScaleSelect]) EditorTooltips.set(control, control.title);
    EditorTooltips.set(center.brushSizeInput, t("tipMaskSize"), true);
    EditorTooltips.set(document.getElementById("resetCenterMaskBtn"), t("tipResetCenterMask"));
  }
})();
