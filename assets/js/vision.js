/* vision.js — reading a puzzle off a screenshot. EXPERIMENTAL, and labelled as
   such everywhere it surfaces.

   The rest of this site is verified: every position shown is checked against a
   unique solution, and import.js refuses a grid rather than guess at it. This
   file cannot make that promise. It reads pixels, and pixels lie. So it is
   built to hand its answer to the *capture board* rather than to the solver —
   the digits land where you can see and correct them, with the shaky ones
   tinted, and nothing is imported until you press Check it. A wrong read costs
   you a glance; it never costs you a coach talking confident nonsense.

   The pipeline, and why each step is the shape it is:

     1. FIND THE BOARD as a lattice, not as a box. Apps disagree about whether
        cells have gridlines at all — one of the two this was built against
        draws thin rules, the other delimits cells by background tint alone and
        runs the board edge to edge with the screen. What both have is ten
        evenly spaced *discontinuities* per axis, because a tint change is an
        edge just as much as a rule is. So the search is over (start, spacing)
        against an edge-energy profile, and it does not care which app drew it.

     2. THRESHOLD PER CELL, never globally. Selection highlights, peer tints,
        error cells, note chips and dark mode all mean the background under one
        digit has nothing to do with the background under the next. Each cell
        estimates its own background from its border ring and calls ink
        whatever is far from that — which also, for free, throws away the
        coloured chip a highlighted pencil mark sits on, since the chip is much
        nearer the background than the digit on top of it is.

     3. CLUSTER BEFORE LABELLING. This is the step that makes the whole thing
        work without shipping a font. In a screenshot every instance of a digit
        is the *same bitmap*, so grouping the glyphs by similarity is nearly
        free and nearly perfect. That reduces the problem from "recognise sixty
        digits" to "label at most nine clusters", which is small enough that a
        crude template set plus an injective assignment gets it right — and
        small enough that one wrong label is visible as nine wrong cells rather
        than one, which is the failure you want, because you cannot miss it.

     4. LET SUDOKU CHECK THE CLUSTERING. Two glyphs of the same cluster in one
        row, column or box is impossible, so it is proof the clustering merged
        two digits, and the offender gets split. Note that this validates the
        *grouping* only: relabelling digits maps a valid grid to a valid grid,
        so the structure can never tell you which cluster is the 5.

   Nothing here is on the network and nothing is stored. The image is decoded,
   measured and dropped. */
(function (root) {
  'use strict';

  /* ---------------- tunables ----------------
     Named rather than inlined because every one of them is a guess that a
     screenshot from an app I have not seen may want moved. */
  const N = 24;          // a normalised glyph is N x N
  const SPAN = 20;       // ...with its longer side scaled to this, centred
  const INSET = 0.08;    // fraction of each cell's edge ignored (gridlines live there)
  const SAME = 0.72;     // Jaccard above which two glyphs may be the same digit
  const BIG = 0.40;      // component height, as a fraction of the inset box, that means "placed"
  const NOTE = 0.10;     // ...and below which it is too small to be anything
  const WORK = 1500;     // longest side we work at; phones hand over much bigger images
  const SURE = 0.55;     // confidence below which a cell is marked for re-reading
  const SPLIT = 1.0;     // stroke separation above which two type styles are worth trying
  const TRUST = 0.45;    // mean confidence below which this was not a board at all
  let STYLE_SEP = 0;     // what the last read measured, for the diagnostics

  /* ---------------- image plumbing ---------------- */

  function grey(img) {
    const d = img.data, n = img.width * img.height, g = new Uint8Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      g[p] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    }
    return g;
  }

  /* A canvas is the only decoder available, so everything arrives through one.
     `imageOrientation` matters on phones: a photo carries EXIF rotation that
     createImageBitmap will otherwise honour or ignore depending on the engine,
     and a board rotated 90 degrees fails the lattice search in a way that looks
     like a bug rather than like a sideways picture. */
  /* Duck-typed rather than `instanceof Blob`, which is a per-realm constructor:
     a File handed across a frame boundary is a perfectly good blob that fails
     the instanceof, and the fall-through treats it as an image element and dies
     inside drawImage with a message about nothing. */
  function blobish(v) {
    return !!v && typeof v === 'object' && typeof v.type === 'string' &&
           typeof v.size === 'number' && typeof v.slice === 'function';
  }

  function decode(src) {
    return new Promise((resolve, reject) => {
      const finish = bmp => {
        const long = Math.max(bmp.width, bmp.height);
        const k = Math.min(1, WORK / long);
        const w = Math.max(1, Math.round(bmp.width * k));
        const h = Math.max(1, Math.round(bmp.height * k));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        resolve(ctx.getImageData(0, 0, w, h));
      };
      const viaImg = () => {
        const url = URL.createObjectURL(src);
        const im = new Image();
        im.onload = () => { URL.revokeObjectURL(url); finish(im); };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
        im.src = url;
      };
      if (!blobish(src)) { finish(src); return; }
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(src, { imageOrientation: 'from-image' })
          .then(finish)
          .catch(() => createImageBitmap(src).then(finish).catch(viaImg));
      } else {
        viaImg();
      }
    });
  }

  /* ---------------- finding the board ----------------

     Edge energy summed along each axis. The image's own borders are written in
     as maxima on purpose: a board that runs edge to edge with the screen — the
     second of the two apps does exactly this — has no measurable line at its
     outermost columns, and without this the lattice that is actually correct
     scores as the one with two missing sides. The frame IS a boundary; we just
     cannot see it from the inside. */
  function profiles(g, w, h) {
    const col = new Float32Array(w), row = new Float32Array(h);
    for (let y = 1; y < h; y++) {
      const o = y * w, p = o - w;
      for (let x = 1; x < w; x++) {
        const v = g[o + x];
        col[x] += Math.abs(v - g[o + x - 1]);
        row[y] += Math.abs(v - g[p + x]);
      }
    }
    for (let x = 0; x < w; x++) col[x] /= h;
    for (let y = 0; y < h; y++) row[y] /= w;
    let mc = 0, mr = 0;
    for (let x = 0; x < w; x++) if (col[x] > mc) mc = col[x];
    for (let y = 0; y < h; y++) if (row[y] > mr) mr = row[y];
    col[0] = col[w - 1] = mc;
    row[0] = row[h - 1] = mr;
    return { col, row };
  }

  function peak(prof, at, tol) {
    let best = 0;
    const a = Math.max(0, Math.round(at) - tol);
    const b = Math.min(prof.length - 1, Math.round(at) + tol);
    for (let i = a; i <= b; i++) if (prof[i] > best) best = prof[i];
    return best;
  }

  /* Best (start, spacing) for `n` cells against one profile.

     The score is a sum with a weakest-link term, because a lattice is only
     right if EVERY line is there — a sum alone happily takes a spacing of half
     the true one, landing five lines on real edges and five on nothing, and
     covering half the board while scoring well. The weakest link is measured
     after dropping the single worst line, which buys tolerance for one side
     genuinely being invisible without buying tolerance for five. */
  function axisScore(prof, s, cell, n, vals) {
    let sum = 0;
    for (let k = 0; k <= n; k++) { const v = peak(prof, s + k * cell, 1); vals[k] = v; sum += v; }
    let worst = Infinity, second = Infinity;
    for (let k = 0; k <= n; k++) {
      const v = vals[k];
      if (v < worst) { second = worst; worst = v; } else if (v < second) second = v;
    }
    const mean = sum / (n + 1);
    return sum * (0.35 + 0.65 * (mean > 0 ? Math.min(1, second / mean) : 0));
  }

  /* The best few starts, not just the best one, and kept far enough apart to be
     genuinely different guesses rather than the same guess jittered.

     This is what rescues a board whose cell edges have gone soft. Digits sit
     centred in their cells, so their tops and bottoms form a lattice of their
     own at the same spacing, offset by about seven tenths of a cell — blur the
     real edges and that impostor can outscore them. It never survives a look
     inside, because its cells straddle two rows of digits and yield nothing, so
     all it has to do is stay on the shortlist long enough to lose. */
  function scanTop(prof, len, cell, n, want) {
    const span = cell * n;
    if (span > len) return [];
    const vals = new Float64Array(n + 1), all = [];
    for (let s = 0; s <= len - Math.ceil(span); s++) {
      all.push({ start: s, score: axisScore(prof, s, cell, n, vals) });
    }
    all.sort((a, b) => b.score - a.score);
    const out = [];
    for (let i = 0; i < all.length && out.length < want; i++) {
      /* Far enough apart to be a different guess, and no further. A third of a
         cell sounds like a sensible gap and is not: the digit-baseline lattice
         sits about that far from the real one, so the coarse rule throws the
         right answer away as a duplicate of the thing it needs to beat. */
      if (out.every(o => Math.abs(o.start - all[i].start) > Math.max(4, cell * 0.12))) out.push(all[i]);
    }
    return out;
  }

  function scanAxis(prof, len, cell, n, lo, hi) {
    const span = cell * n;
    if (span > len) return null;
    const from = Math.max(0, lo === undefined ? 0 : lo);
    const to = Math.min(len - Math.ceil(span), hi === undefined ? len : hi);
    let best = null;
    const vals = new Float64Array(n + 1);
    for (let s = from; s <= to; s++) {
      let sum = 0;
      for (let k = 0; k <= n; k++) { const v = peak(prof, s + k * cell, 1); vals[k] = v; sum += v; }
      let worst = Infinity, second = Infinity;
      for (let k = 0; k <= n; k++) {
        const v = vals[k];
        if (v < worst) { second = worst; worst = v; } else if (v < second) second = v;
      }
      const mean = sum / (n + 1);
      const link = mean > 0 ? Math.min(1, second / mean) : 0;
      const score = sum * (0.35 + 0.65 * link);
      if (!best || score > best.score) best = { start: s, cell: cell, score: score, weak: second };
    }
    return best;
  }

  /* Cells are square in every sudoku ever printed, so the two axes share a
     spacing and the search is one-dimensional in it. Among spacings that score
     nearly as well as the best, the largest wins: a board and its own half are
     both lattices, and the board is the one you meant. */
  function findBoards(g, w, h) {
    const p = profiles(g, w, h);
    const lim = Math.min(w, h);
    const cellMin = Math.max(9, Math.floor(lim * 0.035));
    const cellMax = Math.floor(lim / 9);
    if (cellMax < cellMin) return null;
    const runs = [];
    for (let cell = cellMin; cell <= cellMax; cell += 0.5) {
      const c = scanAxis(p.col, w, cell, 9);
      const r = scanAxis(p.row, h, cell, 9);
      if (!c || !r) continue;
      runs.push({ cell: cell, x: c.start, y: r.start, score: c.score + r.score });
    }
    if (!runs.length) return [];
    let top = runs[0];
    runs.forEach(v => { if (v.score > top.score) top = v; });
    /* The nominal answer first — best score, then the largest spacing among
       those that score nearly as well, because a board and its own half are
       both lattices and the board is the one you meant.

       Then the runners-up, kept rather than discarded. Edge energy alone
       cannot always tell the board from the furniture around it: soften a
       tint-delimited board with a little blur and the strongest ten evenly
       spaced lines on the screen may not be the board's. What settles it is
       not a better score but a look inside — the candidate that yields
       eighty-one cells with digits in them is the board — and that check is
       only available once there is more than one candidate to run it on. */
    let pick = top;
    runs.forEach(v => { if (v.score >= top.score * 0.90 && v.cell > pick.cell) pick = v; });
    const sizes = [];
    [pick].concat(runs.slice().sort((a, b) => b.score - a.score)).forEach(v => {
      if (sizes.length < 3 && !sizes.some(c => Math.abs(c - v.cell) < 3)) sizes.push(v.cell);
    });
    const combos = [];
    sizes.forEach(cell => {
      const xs = scanTop(p.col, w, cell, 9, 4), ys = scanTop(p.row, h, cell, 9, 4);
      xs.forEach(cx => ys.forEach(cy => {
        combos.push({ cell: cell, x: cx.start, y: cy.start, score: cx.score + cy.score });
      }));
    });
    combos.sort((a, b) => b.score - a.score);
    const out = [];
    combos.forEach(v => {
      if (out.length >= 10) return;
      const dup = out.some(o => Math.abs(o.cell - v.cell) < 3 &&
                                Math.abs(o.x - v.x) < 8 && Math.abs(o.y - v.y) < 8);
      if (!dup) out.push(v);
    });
    const fine = [];
    out.forEach(v => {
      const r = refine(g, w, h, v);
      const dup = fine.some(o => Math.abs(o.cell - r.cell) < 2 &&
                                 Math.abs(o.x - r.x) < 4 && Math.abs(o.y - r.y) < 4);
      if (!dup) fine.push(r);
    });
    return fine;
  }

  /* Second pass. The first one measured every column against the whole image
     height, which dilutes the board's own lines with whatever else the screen
     is doing above and below it. Now that we know roughly where the board is,
     measure each axis over the other axis's span only, and re-search a narrow
     window. This is what moves the lattice from "within a few pixels" to "on
     the line", and a few pixels is the difference between an inset that clears
     the gridline and one that eats it. */
  function refine(g, w, h, box) {
    const y0 = Math.max(0, Math.round(box.y)), y1 = Math.min(h - 1, Math.round(box.y + box.cell * 9));
    const x0 = Math.max(0, Math.round(box.x)), x1 = Math.min(w - 1, Math.round(box.x + box.cell * 9));
    const col = new Float32Array(w), row = new Float32Array(h);
    for (let y = Math.max(1, y0); y <= y1; y++) {
      const o = y * w;
      for (let x = Math.max(1, x0); x <= x1; x++) {
        col[x] += Math.abs(g[o + x] - g[o + x - 1]);
        row[y] += Math.abs(g[o + x] - g[o - w + x]);
      }
    }
    const hs = Math.max(1, y1 - y0), ws = Math.max(1, x1 - x0);
    for (let x = 0; x < w; x++) col[x] /= hs;
    for (let y = 0; y < h; y++) row[y] /= ws;
    let mc = 0, mr = 0;
    for (let x = 0; x < w; x++) if (col[x] > mc) mc = col[x];
    for (let y = 0; y < h; y++) if (row[y] > mr) mr = row[y];
    col[0] = col[w - 1] = mc; row[0] = row[h - 1] = mr;

    let best = null;
    for (let cell = box.cell - 2; cell <= box.cell + 2; cell += 0.25) {
      if (cell < 8) continue;
      const c = scanAxis(col, w, cell, 9, box.x - 6, box.x + 6);
      const r = scanAxis(row, h, cell, 9, box.y - 6, box.y + 6);
      if (!c || !r) continue;
      const score = c.score + r.score;
      if (!best || score > best.score) best = { cell: cell, x: c.start, y: r.start, score: score };
    }
    return best || box;
  }

  /* ---------------- ink ----------------

     One cell's worth of pixels, with its own idea of what the background is.

     The threshold walks outward until the ink covers less than 45% of the box.
     That single line is what handles coloured highlights without knowing
     anything about them: a tinted cell moves the background, which the ring
     already measured; a note chip is a block of colour perhaps 60 levels from
     white while the digit on it is 200 from white, so the first threshold that
     gets the coverage under half has already dropped the chip and kept the
     digit. No palette, no app-specific list of colours to keep up with. */
  /* A 3x3 median, and only when the cell asks for it. A screenshot is flat —
     neighbouring pixels inside a stroke are identical, so the median adjacent
     difference is zero and this does nothing. A photograph of a screen is not,
     and there the same measurement comes back high; the filter then costs a
     little stroke fidelity and buys back the thing that actually matters, which
     is that two instances of the same digit still normalise to the same bitmap.
     Grain does not change what a 5 looks like to a person, but it moves every
     edge pixel, and clustering is the step that cares. */
  function median3(src, w, h) {
    const out = new Uint8Array(src.length), v = new Uint8Array(9);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            v[n++] = src[yy * w + xx];
          }
        }
        for (let i = 1; i < n; i++) {
          const t = v[i];
          let j = i - 1;
          while (j >= 0 && v[j] > t) { v[j + 1] = v[j]; j--; }
          v[j + 1] = t;
        }
        out[y * w + x] = v[n >> 1];
      }
    }
    return out;
  }

  function grain(d, w, h) {
    const diff = [];
    for (let y = 0; y < h; y += 2) {
      for (let x = 1; x < w; x += 2) diff.push(Math.abs(d[y * w + x] - d[y * w + x - 1]));
    }
    diff.sort((a, b) => a - b);
    return diff.length ? diff[diff.length >> 1] : 0;
  }

  function cellInk(g, w, box, r, c) {
    const ins = box.cell * INSET;
    const ax = Math.round(box.x + c * box.cell + ins);
    const ay = Math.round(box.y + r * box.cell + ins);
    const bw = Math.max(4, Math.round(box.cell - 2 * ins));
    const bh = bw;
    const d = new Uint8Array(bw * bh);
    const ring = [];
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const v = g[(ay + y) * w + (ax + x)];
        d[y * bw + x] = v;
        if (y === 0 || y === bh - 1 || x === 0 || x === bw - 1) ring.push(v);
      }
    }
    const gr = grain(d, bw, bh);
    let clean = d;
    if (gr >= 6) {
      clean = median3(d, bw, bh);
      if (gr >= 10) clean = median3(clean, bw, bh);
    }
    ring.sort((a, b) => a - b);
    const bg = ring[ring.length >> 1];
    let maxd = 0;
    const dev = new Uint8Array(bw * bh);
    for (let i = 0; i < dev.length; i++) {
      const v = Math.abs(clean[i] - bg);
      dev[i] = v > 255 ? 255 : v;
      if (v > maxd) maxd = v;
    }
    const mask = new Uint8Array(bw * bh);
    let n = 0, dark = 0;
    if (maxd >= 30) {
      let t = Math.max(18, maxd * 0.45);
      for (let guard = 0; guard < 24; guard++) {
        n = 0;
        for (let i = 0; i < dev.length; i++) { const on = dev[i] > t ? 1 : 0; mask[i] = on; n += on; }
        if (n / mask.length <= 0.45) break;
        t *= 1.2;
        if (t >= maxd) break;
      }
      for (let i = 0; i < mask.length; i++) if (mask[i] && clean[i] < bg) dark++;
    }
    return { mask: mask, w: bw, h: bh, bg: bg, n: n, polarity: dark * 2 >= n ? -1 : 1 };
  }

  /* ---------------- components ---------------- */

  function components(mask, w, h) {
    const seen = new Uint8Array(w * h), out = [];
    const stack = new Int32Array(w * h);
    for (let s = 0; s < mask.length; s++) {
      if (!mask[s] || seen[s]) continue;
      let sp = 0;
      stack[sp++] = s; seen[s] = 1;
      let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0, sx = 0, sy = 0;
      while (sp) {
        const i = stack[--sp];
        const x = i % w, y = (i - x) / w;
        area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (mask[j] && !seen[j]) { seen[j] = 1; stack[sp++] = j; }
          }
        }
      }
      out.push({ x0: x0, y0: y0, x1: x1, y1: y1, area: area, cx: sx / area, cy: sy / area });
    }
    return out;
  }

  /* A digit is one shape, but not always one component — a face can leave the
     bar of a 5 or the dot of an i detached, and antialiasing can pinch a thin
     join in two. Merge what overlaps horizontally and nearly touches
     vertically. Pencil marks survive this because they sit a third of a cell
     apart, which is far wider than any gap inside a glyph. */
  function coalesce(list, h) {
    const near = (a, b) => {
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const minw = Math.min(a.x1 - a.x0, b.x1 - b.x0) + 1;
      const gap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
      return ox > 0.45 * minw && gap < 0.16 * h;
    };
    const out = list.slice();
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < out.length && !merged; i++) {
        for (let j = i + 1; j < out.length && !merged; j++) {
          if (!near(out[i], out[j])) continue;
          const a = out[i], b = out[j], area = a.area + b.area;
          out[i] = {
            x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
            x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), area: area,
            cx: (a.cx * a.area + b.cx * b.area) / area,
            cy: (a.cy * a.area + b.cy * b.area) / area
          };
          out.splice(j, 1);
          merged = true;
        }
      }
    }
    return out;
  }

  /* ---------------- normalising a glyph ----------------
     Scale the longer side to SPAN and centre it in an N-box. Centring on the
     bounding box rather than on the centre of mass on purpose: templates and
     glyphs must be normalised the same way, and a bounding box is the one
     description that does not shift when a stroke thickens. */
  function normalise(mask, w, b) {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const k = SPAN / Math.max(bw, bh);
    const dw = Math.max(1, Math.min(N, Math.round(bw * k)));
    const dh = Math.max(1, Math.min(N, Math.round(bh * k)));
    const ox = (N - dw) >> 1, oy = (N - dh) >> 1;
    const out = new Uint8Array(N * N);
    for (let dy = 0; dy < dh; dy++) {
      const sy0 = b.y0 + Math.floor(dy * bh / dh);
      const sy1 = Math.max(sy0 + 1, b.y0 + Math.floor((dy + 1) * bh / dh));
      for (let dx = 0; dx < dw; dx++) {
        const sx0 = b.x0 + Math.floor(dx * bw / dw);
        const sx1 = Math.max(sx0 + 1, b.x0 + Math.floor((dx + 1) * bw / dw));
        let on = 0, tot = 0;
        for (let y = sy0; y < sy1; y++) {
          for (let x = sx0; x < sx1; x++) { tot++; if (mask[y * w + x]) on++; }
        }
        out[(oy + dy) * N + ox + dx] = tot && on * 2 >= tot ? 1 : 0;
      }
    }
    return out;
  }

  /* Jaccard rather than plain agreement. Two thirds of an N-box is background
     in every glyph, so raw pixel agreement puts a 1 and a 7 at 0.9 and leaves
     nothing to threshold on; overlap over union spends its whole range on the
     ink, which is the part that differs. */
  function jaccard(a, b) {
    let both = 0, either = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (x | y) { either++; if (x & y) both++; }
    }
    return either ? both / either : 0;
  }

  /* ---------------- what a stroke looks like ----------------
     Two numbers that describe how a glyph is DRAWN rather than which digit it
     is, because that is how the second app separates the printed digits from
     the ones you typed: one weight for the puzzle, another for your answers.

     Weight is the median horizontal run of ink over the glyph's height — a
     stroke width, near enough, and near enough independent of which digit it
     is. Slant is how far the top third leans off the bottom third. A face that
     distinguishes givens by italic moves the second; one that uses bold moves
     the first; News+ moves neither, which is itself the finding. */
  function strokes(mask, w, b) {
    const bh = b.y1 - b.y0 + 1, runs = [];
    for (let y = b.y0; y <= b.y1; y++) {
      let run = 0;
      for (let x = b.x0; x <= b.x1; x++) {
        if (mask[y * w + x]) run++;
        else { if (run) runs.push(run); run = 0; }
      }
      if (run) runs.push(run);
    }
    runs.sort((p, q) => p - q);
    const weight = runs.length ? runs[runs.length >> 1] / bh : 0;

    const third = bh / 3;
    let tx = 0, tn = 0, lx = 0, ln = 0;
    for (let y = b.y0; y <= b.y1; y++) {
      const up = y < b.y0 + third, down = y > b.y1 - third;
      if (!up && !down) continue;
      for (let x = b.x0; x <= b.x1; x++) {
        if (!mask[y * w + x]) continue;
        if (up) { tx += x; tn++; } else { lx += x; ln++; }
      }
    }
    const slant = (tn && ln) ? ((tx / tn) - (lx / ln)) / bh : 0;
    return { weight: weight, slant: slant };
  }

  /* ---------------- templates ----------------
     Built at run time by asking the browser to draw 1-9, which costs nothing to
     ship and adapts to the platform: on the phone where you took the screenshot
     the system face is very often the face in the screenshot.

     These only ever have to be good enough to LABEL nine clusters, not to read
     sixty digits, so a rough likeness across a handful of families and weights
     is enough. When the keypad harvest below succeeds they are not consulted at
     all. */
  let TEMPLATES = null;
  function templates() {
    if (TEMPLATES) return TEMPLATES;
    const px = 96, pad = 24, size = px + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const faces = [
      '400 96px system-ui, sans-serif',
      '700 96px system-ui, sans-serif',
      '300 96px Helvetica, Arial, sans-serif',
      '700 96px Helvetica, Arial, sans-serif',
      'italic 700 96px Helvetica, Arial, sans-serif',
      '400 96px Georgia, "Times New Roman", serif',
      '700 96px "DejaVu Sans", Verdana, sans-serif'
    ];
    const out = [];
    for (let d = 1; d <= 9; d++) {
      const vars = [];
      faces.forEach(f => {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        ctx.font = f;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(d), size / 2, size / 2);
        const im = ctx.getImageData(0, 0, size, size).data;
        const mask = new Uint8Array(size * size);
        let x0 = size, y0 = size, x1 = -1, y1 = -1;
        for (let p = 0, i = 3; p < mask.length; p++, i += 4) {
          if (im[i] > 128) {
            mask[p] = 1;
            const x = p % size, y = (p - x) / size;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        if (x1 < 0) return;
        vars.push(normalise(mask, size, { x0: x0, y0: y0, x1: x1, y1: y1 }));
      });
      out.push(vars);
    }
    TEMPLATES = out;
    return out;
  }

  function templateScores(bits) {
    const t = templates(), s = new Float64Array(9);
    for (let d = 0; d < 9; d++) {
      let best = 0;
      t[d].forEach(v => { const j = jaccard(bits, v); if (j > best) best = j; });
      s[d] = best;
    }
    return s;
  }

  /* ---------------- clustering ----------------
     A screenshot draws the same digit the same way every time, so this is
     mostly bookkeeping: near-identical bitmaps fall together and what is left
     is at most nine groups per style. The centroid is a per-pixel majority,
     which keeps a single antialiased outlier from dragging the group. */
  function centroid(members) {
    const acc = new Uint16Array(N * N);
    members.forEach(m => { for (let i = 0; i < acc.length; i++) acc[i] += m.bits[i]; });
    const out = new Uint8Array(N * N);
    const half = members.length / 2;
    for (let i = 0; i < acc.length; i++) out[i] = acc[i] >= half ? 1 : 0;
    return out;
  }

  /* Which units a set of glyphs occupies, as one bitmask: nine rows, nine
     columns, nine boxes. Two clusters may only join if their masks are
     disjoint, because a digit appearing twice in a unit is impossible. */
  const ROW = i => (i / 9) | 0, COL = i => i % 9;
  const BOX = i => (((i / 27) | 0) * 3) + (((i % 9) / 3) | 0);
  function unitMask(cell) {
    return (1 << ROW(cell)) | (1 << (9 + COL(cell))) | (1 << (18 + BOX(cell)));
  }

  /* Two glyphs drawn by the same hand. Instances of one digit in one style
     have all but identical stroke weight — background and subpixel offset move
     it a little, nothing moves it much — while a bold 5 and a light 5 differ by
     far more than that and are two different things on this board.

     The unit constraint alone will not keep them apart, and this is subtle
     enough to be worth stating: a printed 5 and a 5 you typed CAN legally merge,
     because they never share a row. The constraint is about what is possible,
     and that merge is possible. It is just wrong — and it destroys the only
     evidence there is for which digits the puzzle printed. Near-identical
     bitmaps are exempted, since at that similarity the weights agree anyway and
     the rule would only be second-guessing a match that is already certain. */
  function sameHand(a, b, sim) {
    if (sim >= 0.88) return true;
    const hi = Math.max(a.weight, b.weight), lo = Math.min(a.weight, b.weight);
    return hi <= 1e-6 ? true : lo / hi >= 0.80;
  }

  /* Agglomerative, and constrained by the puzzle itself.

     The first version of this thresholded on similarity alone and then repaired
     the damage afterwards, which was backwards, and a real screenshot showed
     why. On a drawn test board every instance of a digit is the same bitmap. On
     a phone it is not: the same 5 sits on a white cell, a grey one and a green
     highlight, at whatever subpixel offset its column happens to fall on, and
     the three are similar rather than identical. So one digit becomes three
     clusters, the count sails past nine, and everything downstream that assumed
     nine starts merging or relabelling across digits that cannot coexist.

     Encoding the constraint into the merge instead of auditing for it after
     makes the threshold almost incidental. Genuine twins join first at .95 and
     up; by the time the merge is scraping the floor the surviving clusters
     already span most of the board, their masks collide, and the merge is
     refused. A cluster built this way cannot contradict the puzzle, because it
     was never allowed to. */
  function cluster(glyphs) {
    const cl = glyphs.map(g => ({ bits: g.bits, members: [g], mask: unitMask(g.cell),
                                  weight: g.weight }));
    const sim = cl.map(() => []);
    for (let i = 0; i < cl.length; i++) {
      for (let j = i + 1; j < cl.length; j++) sim[i][j] = jaccard(cl[i].bits, cl[j].bits);
    }
    for (;;) {
      let bi = -1, bj = -1, best = SAME;
      for (let i = 0; i < cl.length; i++) {
        for (let j = i + 1; j < cl.length; j++) {
          if (sim[i][j] <= best) continue;
          if (cl[i].mask & cl[j].mask) continue;
          if (!sameHand(cl[i], cl[j], sim[i][j])) continue;
          best = sim[i][j]; bi = i; bj = j;
        }
      }
      if (bi < 0) break;
      const members = cl[bi].members.concat(cl[bj].members);
      cl[bi] = { bits: centroid(members), members: members, mask: cl[bi].mask | cl[bj].mask,
                 weight: median(members.map(m => m.weight)) };
      cl.splice(bj, 1);
      for (let i = 0; i < sim.length; i++) sim[i].splice(bj, 1);
      sim.splice(bj, 1);
      for (let i = 0; i < cl.length; i++) {
        if (i === bi) continue;
        const a = Math.min(i, bi), b = Math.max(i, bi);
        sim[a][b] = jaccard(cl[a].bits, cl[b].bits);
      }
    }
    return cl;
  }

  /* ---------------- one style, or two ----------------

     Sudoku decides this, not a threshold. A style can hold at most nine
     distinct glyphs, so a read that came back with more than nine clusters is
     PROOF that two styles are on the board, and a read with nine or fewer is
     proof that one style could account for all of them. That is worth leaning
     on because both mistakes are expensive in opposite directions: splitting a
     board that has one style invents a distinction between printed digits and
     typed ones that is not there, and failing to split a board that has two
     forces eighteen glyphs through nine labels and mangles half the grid.

     It also nearly determines where the cut goes. Seventeen clusters with a
     ceiling of nine a side leaves two legal cut points, so the axis — stroke
     weight, or slant — only has to pick between them rather than find the
     boundary unaided. */
  function cutAt(vals, order, k) {
    return vals[order[k]] - vals[order[k - 1]];
  }

  /* How convincingly a cut separates, measured against how tightly each side
     holds together rather than against the overall range. Two type weights on
     one board give two tight knots of values with clear air between them, and
     score high. One weight scattered by backgrounds and subpixel offsets gives
     a smear, where the widest gap is still comparable to the spread either
     side of it, and scores low. Magnitude alone cannot tell those apart, which
     is what the first attempt at this got wrong. */
  function spreadOf(vals, idx) {
    if (idx.length < 2) return 0;
    let m = 0;
    idx.forEach(i => { m += vals[i]; });
    m /= idx.length;
    let v = 0;
    idx.forEach(i => { const d = vals[i] - m; v += d * d; });
    return Math.sqrt(v / idx.length);
  }

  function separation(vals, low, high, gap) {
    const s = 0.5 * (spreadOf(vals, low) + spreadOf(vals, high));
    return gap / (s + 1e-6);
  }

  function styleSplit(cl) {
    const n = cl.length;
    if (n <= 9) return null;
    let best = null;
    [['weight', cl.map(c => c.weight)], ['slant', cl.map(c => c.slant)]].forEach(pair => {
      const vals = pair[1];
      const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
      const spread = vals[order[n - 1]] - vals[order[0]];
      if (spread <= 1e-9) return;
      for (let k = Math.max(2, n - 9); k <= Math.min(n - 2, 9); k++) {
        const low = order.slice(0, k), high = order.slice(k);
        const sep = separation(vals, low, high, cutAt(vals, order, k));
        if (!best || sep > best.sep) {
          best = { sep: sep, gap: cutAt(vals, order, k) / spread, axis: pair[0], low: low, high: high };
        }
      }
    });
    /* More than nine clusters is now only the PRECONDITION for two styles, not
       the proof of it. A real screenshot overshoots nine on its own — one digit
       drawn on three different backgrounds is three clusters — and a split
       taken on that alone invents a distinction between printed digits and
       typed ones that does not exist, which is far worse than declining to
       find one that does. So the cut has to be visible in the drawing: a gap
       in stroke weight or slant that dominates the spread around it.

       The bar is deliberately low, because the two things a split decides are
       not equally dangerous. Splitting only changes how the labelling is
       organised, and the labelling is constrained either way, so a split taken
       in error costs very little — the digits still come out. Claiming to know
       which of them the puzzle PRINTED is the expensive part, and that claim is
       not made here: it has to survive being solved, below. Measurements of the
       same two-weight board across two rendering environments came out at 1.3
       and 4.1, which is enough spread to say that no threshold here should be
       the thing the feature rests on. */
    if (!best) return null;
    STYLE_SEP = best.sep;
    if (best.sep < SPLIT) return null;
    const size = g => g.reduce((t, i) => t + cl[i].members.length, 0);
    if (size(best.low) < 8 || size(best.high) < 8) return null;
    return [best.low, best.high];
  }

  /* ---------------- labelling ----------------
     Injective inside a style group: nine clusters, nine digits, each used once.
     That constraint is doing real work — it is what lets a crude template set
     survive a face it has never seen, because a digit only has to beat the
     other eight rather than be recognised outright. */
  /* Labelling under the same constraint the clustering works under: a digit
     may not be given to a cluster that shares a unit with another cluster
     already holding it. Both would be on the board at once, in one row, which
     is the contradiction the read gets refused for.

     Worth noting this is true whether or not the style split was right. If two
     styles are really there, a printed 5 and a 5 you typed are different
     clusters and never share a unit anyway, so the rule costs nothing. If the
     split was spurious, the rule is what stops the two halves independently
     spending the same nine digits on cells that sit side by side. */
  function legal(taken, cl, ci, d) {
    const m = cl[ci].mask;
    return taken[d].every(x => !(x & m));
  }

  function claim(taken, cl, ci, d) {
    cl[ci].digit = d + 1;
    taken[d].push(cl[ci].mask);
  }

  function confOf(row, d) {
    const copy = Array.from(row);
    const best = copy[d];
    copy[d] = -1;
    const margin = best - Math.max.apply(null, copy);
    return Math.max(0, Math.min(Math.min(1, 0.45 + 2.5 * margin), 0.35 + best));
  }

  function label(cl, group, score, taken) {
    /* Too many clusters for one digit each — a real screen splits a digit
       across the backgrounds it is drawn on, so this is the ordinary case, not
       the broken one. Each cluster takes the best digit still open to it,
       surest first, and two clusters of the same digit may share a label as
       long as they never share a unit. */
    if (group.length > 9) {
      const order = group.slice().sort((a, b) => {
        const ra = Array.from(score[a]).sort((x, y) => y - x);
        const rb = Array.from(score[b]).sort((x, y) => y - x);
        return (rb[0] - rb[1]) - (ra[0] - ra[1]);
      });
      order.forEach(ci => {
        const row = score[ci];
        const rank = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort((a, b) => row[b] - row[a]);
        const d = rank.find(k => legal(taken, cl, ci, k));
        if (d === undefined) { cl[ci].digit = 0; cl[ci].conf = 0; return; }
        claim(taken, cl, ci, d);
        cl[ci].conf = confOf(row, d) * (d === rank[0] ? 1 : 0.7);
      });
      return;
    }

    const pairs = [];
    group.forEach(ci => { for (let d = 0; d < 9; d++) pairs.push([ci, d, score[ci][d]]); });
    pairs.sort((a, b) => b[2] - a[2]);
    const takenC = {}, takenD = {}, out = {};
    pairs.forEach(p => {
      if (takenC[p[0]] || takenD[p[1]] || !legal(taken, cl, p[0], p[1])) return;
      takenC[p[0]] = 1; takenD[p[1]] = 1;
      out[p[0]] = p[1];
    });
    /* One improvement sweep: swapping two assignments is the only move a greedy
       pass gets wrong often enough to be worth undoing. */
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let a = 0; a < group.length; a++) {
        for (let b = a + 1; b < group.length; b++) {
          const ca = group[a], cb = group[b], da = out[ca], db = out[cb];
          if (da === undefined || db === undefined) continue;
          if (!legal(taken, cl, ca, db) || !legal(taken, cl, cb, da)) continue;
          const now = score[ca][da] + score[cb][db];
          const swap = score[ca][db] + score[cb][da];
          if (swap > now + 1e-9) { out[ca] = db; out[cb] = da; moved = true; }
        }
      }
      if (!moved) break;
    }
    group.forEach(ci => {
      const d = out[ci];
      if (d === undefined) { cl[ci].digit = 0; cl[ci].conf = 0; return; }
      claim(taken, cl, ci, d);
      cl[ci].conf = confOf(score[ci], d);
    });
  }

  /* ---------------- the keypad ----------------
     Both apps put their own 1-9 on the screen under the board, in the face the
     board is drawn in. That is nine perfectly labelled samples sitting in the
     same image as the question, so when it is found there is no guessing at the
     font at all. Strictly best-effort: anything unexpected below the board and
     this bails to the built-in templates rather than risk a confident mislabel.

     A three-by-three block of big digits is also, unhelpfully, shaped like a
     sudoku box — which is why the board is found first, by a lattice of ten
     lines rather than four, and only the region below it is searched here. */
  /* Is the thing found below the board actually the keypad? Nine glyph-shaped
     blobs in a three-by-three arrangement is a weak claim — a row of controls
     and a couple of words can satisfy it. The check is that the harvest should
     agree with the built-in templates about roughly what it is holding: the
     glyph in the fourth position ought to look more like a 4 than like anything
     else. Perfect agreement is not the bar, since the whole point of harvesting
     is that the templates are mediocre on an unfamiliar face — but a harvest
     that agrees with them about almost nothing is not a keypad, and trusting it
     mislabels every digit on the board at once. */
  function seedsSane(seeds) {
    let agree = 0;
    for (let d = 0; d < 9; d++) {
      const sc = templateScores(seeds[d]);
      let bi = 0;
      for (let k = 1; k < 9; k++) if (sc[k] > sc[bi]) bi = k;
      if (bi === d) agree++;
    }
    return agree >= 5;
  }

  function harvest(g, w, h, box, polarity, gh) {
    const top = Math.min(h - 1, Math.round(box.y + box.cell * 9) + 4);
    if (h - top < gh * 3) return null;
    const rh = h - top, area = w * rh;
    const samp = [];
    for (let i = 0; i < area; i += 7) samp.push(g[top * w + i]);
    samp.sort((a, b) => a - b);
    const bg = samp[samp.length >> 1];
    const mask = new Uint8Array(area);
    for (let i = 0; i < area; i++) {
      const v = g[top * w + i];
      mask[i] = (polarity < 0 ? v < bg - 45 : v > bg + 45) ? 1 : 0;
    }
    const cands = coalesce(components(mask, w, rh), gh).filter(c => {
      const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
      return ch > gh * 0.6 && ch < gh * 1.7 && cw < ch * 1.25 && cw > ch * 0.18 && c.area > 24;
    });
    if (cands.length !== 9) return null;
    const byY = cands.slice().sort((a, b) => a.cy - b.cy);
    const rows = [byY.slice(0, 3), byY.slice(3, 6), byY.slice(6, 9)];
    const spread = r => Math.max.apply(null, r.map(c => c.cy)) - Math.min.apply(null, r.map(c => c.cy));
    for (let r = 0; r < 3; r++) if (spread(rows[r]) > gh * 0.5) return null;
    if (rows[1][0].cy - rows[0][2].cy < gh * 0.5) return null;
    if (rows[2][0].cy - rows[1][2].cy < gh * 0.5) return null;
    const out = [];
    rows.forEach(r => {
      r.sort((a, b) => a.cx - b.cx).forEach(c => out.push(normalise(mask, w, c)));
    });
    return out;
  }

  /* Nine clusters is the most a style can honestly have. More than that means
     one digit got split — different antialiasing at two sizes, usually — so the
     closest pair is folded back together until the count is legal. */
  /* Nine is the most a style can honestly have, so a group over that is folded
     back together closest-pair first — but only across pairs that could be the
     same digit. Without that test this is the step that undid the clustering's
     one guarantee: told to reach nine at any cost, it will merge two digits
     that sit in the same row, and every cell of both goes out wrong.

     Reaching nine is therefore an aim, not a promise. Where the legal merges
     run out the group stays large and the labelling below stops insisting each
     digit is used once, which is the weaker but honest answer. */
  function capNine(cl, group) {
    for (;;) {
      if (group.length <= 9) break;
      let a = -1, b = -1, best = -1;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (cl[group[i]].mask & cl[group[j]].mask) continue;
          const s = jaccard(cl[group[i]].bits, cl[group[j]].bits);
          if (s > best) { best = s; a = i; b = j; }
        }
      }
      if (a < 0) break;
      const ci = group[a], cj = group[b];
      cl[ci].members = cl[ci].members.concat(cl[cj].members);
      cl[ci].mask |= cl[cj].mask;
      cl[ci].bits = centroid(cl[ci].members);
      cl[cj].members = [];
      group.splice(b, 1);
    }
    return group;
  }

  const filledOf = g => g.filter(v => v).length;

  const median = a => {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y);
    return s[s.length >> 1];
  };

  /* ---------------- the read ---------------- */

  /* Failures carry their own numbers, in the message itself. This runs on a
     phone, looking at a screenshot that will never leave it, and the difference
     between "it did not work" and one readable line is the difference between
     guessing at the cause and fixing it. */
  function diag(d) {
    if (!d || !d.board) return '';
    const bits = [d.glyphs + ' digits', (d.clusters || 0) + ' groups'];
    if (d.styles) bits.push(d.styles + (d.styles === 1 ? ' style' : ' styles'));
    if (d.sep) bits.push('sep ' + d.sep);
    if (d.conf !== undefined) bits.push(d.conf + '% match');
    bits.push(d.keypad ? 'keypad found' : 'no keypad');
    bits.push('cell ' + Math.round(d.cell) + 'px');
    return ' <span class="dim">(' + bits.join(', ') + ')</span>';
  }

  function fail(code, message, debug) {
    return { ok: false, code: code, message: message + diag(debug), grid: null, notes: null,
             given: null, conf: null, low: [], debug: debug || {} };
  }

  function scanCells(g, w, box) {
    const glyphs = [], pending = [], heights = [], widths = [];
    let pol = 0;
    for (let i = 0; i < 81; i++) {
      const ink = cellInk(g, w, box, (i / 9) | 0, i % 9);
      pending.push([]);
      if (!ink.n) continue;
      pol += ink.polarity;
      const floor = Math.max(4, ink.w * ink.h * 0.004);
      const comps = coalesce(components(ink.mask, ink.w, ink.h), ink.h)
        .filter(c => c.area >= floor);
      let big = null;
      comps.forEach(c => {
        const ch = c.y1 - c.y0 + 1;
        if (ch < BIG * ink.h) return;
        if (Math.abs(c.cx - ink.w / 2) > 0.32 * ink.w) return;
        if (!big || c.area > big.area) big = c;
      });
      if (big) {
        const bits = normalise(ink.mask, ink.w, big);
        const st = strokes(ink.mask, ink.w, big);
        glyphs.push({ cell: i, bits: bits, weight: st.weight, slant: st.slant });
        heights.push(big.y1 - big.y0 + 1);
        continue;
      }
      /* Pencil marks. Both apps place a mark in the sub-square that names it —
         1 top left through 9 bottom right — so the value is read from WHERE it
         is, and its shape is only ever used to throw it away. */
      comps.forEach(c => {
        const ch = c.y1 - c.y0 + 1;
        if (ch < NOTE * ink.h || ch >= BIG * ink.h) return;
        const zx = Math.max(0, Math.min(2, Math.floor(3 * c.cx / ink.w)));
        const zy = Math.max(0, Math.min(2, Math.floor(3 * c.cy / ink.h)));
        const cw = c.x1 - c.x0 + 1;
        widths.push(cw);
        pending[i].push({ digit: zy * 3 + zx + 1, w: cw });
      });
    }
    return { glyphs: glyphs, pending: pending, heights: heights, widths: widths, pol: pol };
  }

  function read(img) {
    const w = img.width, h = img.height;
    const g = grey(img);
    const cands = findBoards(g, w, h).filter(b => b.cell >= 12);
    if (!cands.length) {
      return fail('noboard', 'No sudoku grid found in that picture. It wants the board filling ' +
        'most of the frame, square on — a screenshot rather than a photograph taken at an angle.');
    }
    /* Every candidate gets opened up and counted, and the one holding the most
       content wins. No early exit on the first plausible one: the impostor this
       is here to beat is a lattice shifted a whole cell down the board, which
       reads eighty-one perfectly ordinary cells and simply has the wrong ones.
       It loses on the count — a row of real digits traded for a row of the gap
       underneath — but only if something bothers to compare. Marks count too,
       and more of them than digits, because the shift costs a row of those as
       well and there are five times as many to lose. */
    let box = null, scan = null, most = -1;
    for (let k = 0; k < cands.length; k++) {
      const got = scanCells(g, w, cands[k]);
      const held = got.glyphs.length * 3 + got.pending.reduce((n, p) => n + p.length, 0);
      if (held > most) { most = held; scan = got; box = cands[k]; }
    }
    const glyphs = scan.glyphs, pending = scan.pending, widths = scan.widths, pol = scan.pol;

    if (glyphs.length < 17) {
      return fail('nodigits', 'A grid was found but only ' + glyphs.length + ' digits read out of ' +
        'it, and no sudoku has fewer than 17. Most likely the picture is cropped, or too small ' +
        'for the digits to survive — a full-resolution screenshot reads best.',
        { board: box, glyphs: glyphs.length, cell: box.cell, keypad: false, clusters: 0 });
    }

    const gh = median(scan.heights);
    let seeds = harvest(g, w, h, box, pol < 0 ? -1 : 1, gh);
    if (seeds && !seedsSane(seeds)) seeds = null;

    STYLE_SEP = 0;
    const cl = cluster(glyphs);
    cl.forEach(c => { c.slant = median(c.members.map(m => m.slant)); });

    const score = cl.map(c => {
      if (!seeds) return templateScores(c.bits);
      const s = new Float64Array(9);
      for (let d = 0; d < 9; d++) s[d] = jaccard(c.bits, seeds[d]);
      return s;
    });

    const live = cl.map((c, i) => i).filter(i => cl[i].members.length);
    const split = styleSplit(live.map(i => cl[i]));
    let groups;
    if (split) groups = split.map(grp => grp.map(k => live[k]));
    else groups = [live.slice()];
    groups = groups.map(grp => capNine(cl, grp));
    const taken = [[], [], [], [], [], [], [], [], []];
    groups.forEach(grp => label(cl, grp, score, taken));

    const grid = new Array(81).fill(0);
    const conf = new Array(81).fill(0);
    const styleOf = new Array(81).fill(-1);
    groups.forEach((grp, gi) => grp.forEach(ci => {
      const c = cl[ci];
      c.members.forEach(m => {
        const fit = jaccard(m.bits, c.bits);
        const scale = 0.6 + 0.4 * Math.max(0, Math.min(1, (fit - 0.7) / 0.2));
        grid[m.cell] = c.digit;
        conf[m.cell] = c.digit ? c.conf * scale : 0;
        styleOf[m.cell] = gi;
      });
    }));

    /* Struck-through candidates — one app draws a line through a mark it has
       ruled out — come back as a component noticeably wider than a bare digit.
       They are dropped rather than read: a pencil mark is advice, and the coach
       recomputes its own, so losing one costs nothing while keeping a wrong one
       is a lie about the position. */
    const capW = median(widths) * 1.7;
    const notes = [];
    for (let i = 0; i < 81; i++) {
      const s = new Set();
      if (!grid[i]) pending[i].forEach(n => { if (!capW || n.w <= capW) s.add(n.digit); });
      notes.push(s);
    }

    /* Which style is the printed puzzle. Solve from one group alone and see
       whether it lands on the other group's digits: a real puzzle has one
       solution and your entries, where they are right, are on it. When neither
       group passes — or when there was only ever one style — this stays null,
       and the caller has to say so rather than guess, because guessing wrong
       means the coach treats a digit you typed as one the puzzle printed. */
    let given = null, why = 'one style';
    const Core = root.SudokuCore;
    if (groups.length === 2 && Core) {
      const tries = groups.map((grp, gi) => {
        const sub = new Array(81).fill(0);
        let n = 0;
        for (let i = 0; i < 81; i++) if (styleOf[i] === gi && grid[i]) { sub[i] = grid[i]; n++; }
        if (n < 17) return null;
        const sols = Core.solve(sub, 2);
        if (sols.length !== 1) return null;
        for (let i = 0; i < 81; i++) if (grid[i] && sols[0][i] !== grid[i]) return null;
        return gi;
      }).filter(x => x !== null);
      if (tries.length === 1) {
        given = new Array(81).fill(false);
        for (let i = 0; i < 81; i++) given[i] = styleOf[i] === tries[0] && !!grid[i];
        why = 'two styles, one solves';
      } else why = tries.length ? 'two styles, both solve' : 'two styles, neither solves';
    }

    /* Whether this was a sudoku board at all.

       It used to be answered by arithmetic: count the digits repeating inside a
       row, column or box, and refuse when there were too many. That test is
       gone because it can no longer fire — clustering and labelling both work
       under the constraint now, so a repeat is not something the read is
       capable of producing, and a check that cannot fail is not a check.

       What is left is the thing the read already knows and had not been asked:
       how well the shapes it found actually matched digits. Nine columns of
       prose will yield a lattice and eighty glyphs and label them without
       complaint, but it labels them badly, and it knows. A board reads in the
       high eighties; a page of text reads at a tenth of that. The gap is wide
       enough that no threshold inside it is delicate. The cluster count says
       the same thing more bluntly — one style can hold nine shapes and two can
       hold eighteen, so a picture yielding twenty-five distinct shapes is not a
       sudoku whatever else it is. */
    let sure = 0;
    const filled = filledOf(grid);
    for (let i = 0; i < 81; i++) if (grid[i]) sure += conf[i];
    const mean = filled ? sure / filled : 0;
    if (mean < TRUST || live.length > 20) {
      return fail('notsudoku', 'That does not read as a sudoku board. A lattice was found and ' +
        filled + ' shapes came out of it, but they match digits at ' + Math.round(mean * 100) +
        '% where a real board reads above 75% — so either this is not a sudoku, or too little of ' +
        'it survived the picture to be worth trusting. Type it in instead.',
        { board: box, glyphs: glyphs.length, cell: box.cell, clusters: live.length,
          styles: groups.length, keypad: !!seeds, conf: Math.round(mean * 100),
          sep: Math.round(STYLE_SEP * 100) / 100 });
    }

    const low = [];
    for (let i = 0; i < 81; i++) if (grid[i] && conf[i] < SURE) low.push(i);

    return {
      ok: true, code: 'ok',
      grid: grid, notes: notes, given: given, conf: conf, low: low,
      filled: filled,
      noteCount: notes.reduce((n, s) => n + s.size, 0),
      message: '',
      debug: {
        board: box, glyphs: glyphs.length, clusters: live.length,
        styles: groups.length, keypad: !!seeds, split: why, cell: box.cell,
        sep: Math.round(STYLE_SEP * 100) / 100
      }
    };
  }

  function readFile(src) { return decode(src).then(read); }

  root.SudokuVision = {
    read: read, readFile: readFile, SURE: SURE,
    /* exported for dev/tests only — the trainer uses read and readFile */
    _parts: { grey: grey, findBoards: findBoards, scanCells: scanCells, cellInk: cellInk, components: components,
              coalesce: coalesce, normalise: normalise, jaccard: jaccard, cluster: cluster,
              templates: templates, harvest: harvest, strokes: strokes }
  };
})(typeof window !== 'undefined' ? window : globalThis);
