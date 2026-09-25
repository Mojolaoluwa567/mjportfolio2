/* ==================================================================
   BONUS STAGE — "Bounce" (1-bit platformer) + sliding puzzle
   - Draws to a 480x240 canvas that CSS scales up with crisp pixels.
   - Fixed 60 Hz timestep, so it plays the same on 60/120/144 Hz screens.
   - Keys are only captured while a game is running and on screen,
     so Space and the arrows scroll the page normally everywhere else.
   ================================================================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("game-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width; // 480
  const H = canvas.height; // 240
  const GROUND_Y = H - 26;

  const INK = "#000";
  const PAPER = "#fff";

  // Physics (tuned for a 480x240 world)
  const R = 9;
  const GRAVITY = 0.26;
  const JUMP_V = -6.75;
  const MOVE = 2.4;
  const STEP = 1000 / 60;

  const keys = { left: false, right: false };
  let jumpBuffer = 0;
  let coyote = 0;

  let state = "idle"; // idle | playing | over | win
  let visible = false;
  let score = 0;
  let lives = 3;
  let ringsGot = 0;
  let tick = 0;

  let ball;
  let platforms = [];
  let rings = [];
  let spiders = [];
  let particles = [];
  let staticLayer = null;

  const r = Math.round;

  // ----------------------------------------------------------------
  // Crisp 1-bit drawing helpers (no anti-aliasing)
  // ----------------------------------------------------------------
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r(x), r(y), r(w), r(h));
  }

  function ellipse(cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    cx = r(cx);
    cy = r(cy);
    const ryi = Math.max(1, r(ry));
    for (let dy = -ryi; dy <= ryi; dy++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ryi * ryi))));
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
  }

  function line(x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    x0 = r(x0);
    y0 = r(y0);
    x1 = r(x1);
    y1 = r(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // ----------------------------------------------------------------
  // Level
  // ----------------------------------------------------------------
  function makeSpider(platformIndex, relX, speed) {
    const p = platforms[platformIndex];
    return {
      pi: platformIndex,
      x: p.x + p.w * relX,
      dir: speed > 0 ? 1 : -1,
      speed: Math.abs(speed),
      w: 12,
      h: 9,
    };
  }

  function drawPlatforms(c) {
    c.fillStyle = INK;
    for (const p of platforms) {
      if (p.ground) {
        // Hatched ground with a solid top edge
        c.fillStyle = PAPER;
        c.fillRect(p.x, p.y, p.w, p.h);
        c.fillStyle = INK;
        c.fillRect(p.x, p.y, p.w, 2);
        for (let x = -p.h; x < p.w; x += 5) {
          for (let k = 0; k < p.h - 2; k++) {
            c.fillRect(x + k, p.y + 2 + k, 1, 1);
          }
        }
      } else {
        c.fillStyle = INK;
        c.fillRect(p.x + 3, p.y + 3, p.w, p.h); // hard shadow
        c.fillStyle = PAPER;
        c.fillRect(p.x, p.y, p.w, p.h);
        c.fillStyle = INK;
        c.fillRect(p.x, p.y, p.w, 1);
        c.fillRect(p.x, p.y + p.h - 1, p.w, 1);
        c.fillRect(p.x, p.y, 1, p.h);
        c.fillRect(p.x + p.w - 1, p.y, 1, p.h);
      }
    }
  }

  function buildLevel() {
    const g = GROUND_Y;
    platforms = [
      { x: 0, y: g, w: W, h: H - g, ground: true },
      { x: r(W * 0.04), y: g - 48, w: r(W * 0.17), h: 7 },
      { x: r(W * 0.27), y: g - 73, w: r(W * 0.15), h: 7 },
      { x: r(W * 0.48), y: g - 53, w: r(W * 0.14), h: 7 },
      { x: r(W * 0.66), y: g - 85, w: r(W * 0.17), h: 7 },
      { x: r(W * 0.36), y: g - 113, w: r(W * 0.14), h: 7 },
      { x: r(W * 0.14), y: g - 100, w: r(W * 0.15), h: 7 },
    ];

    rings = [];
    for (let i = 1; i < platforms.length; i++) {
      const p = platforms[i];
      const count = i <= 3 ? 3 : 2;
      for (let j = 0; j < count; j++) {
        rings.push({
          x: p.x + p.w * (0.18 + j * (0.64 / (count - 1))),
          baseY: p.y - 17,
          phase: Math.random() * Math.PI * 2,
          r: 5,
          collected: false,
        });
      }
    }
    ringsGot = 0;

    spiders = [makeSpider(3, 0.5, -1.0), makeSpider(4, 0.3, 0.7)];
    respawn();
    particles = [];
    score = 0;

    // Pre-render the static platforms once.
    staticLayer = document.createElement("canvas");
    staticLayer.width = W;
    staticLayer.height = H;
    const c = staticLayer.getContext("2d");
    c.imageSmoothingEnabled = false;
    drawPlatforms(c);

    updateHud();
  }

  function respawn() {
    const sp = platforms[1];
    ball = {
      x: sp.x + sp.w * 0.5,
      y: sp.y - R - 1,
      vx: 0,
      vy: 0,
      onGround: false,
      sqX: 1,
      sqY: 1,
    };
    jumpBuffer = 0;
    coyote = 0;
  }

  // ----------------------------------------------------------------
  // Update
  // ----------------------------------------------------------------
  function update() {
    tick++;

    if (keys.left) ball.vx = -MOVE;
    else if (keys.right) ball.vx = MOVE;
    else ball.vx *= 0.72;

    coyote = ball.onGround ? 6 : Math.max(0, coyote - 1);
    if (jumpBuffer > 0) jumpBuffer--;
    if (jumpBuffer > 0 && coyote > 0) {
      ball.vy = JUMP_V;
      ball.onGround = false;
      coyote = 0;
      jumpBuffer = 0;
      ball.sqY = 0.62;
      ball.sqX = 1.38;
    }

    ball.vy += GRAVITY;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.sqY += (1 - ball.sqY) * 0.18;
    ball.sqX += (1 - ball.sqX) * 0.18;

    ball.onGround = false;
    for (const p of platforms) {
      const inX = ball.x + R > p.x && ball.x - R < p.x + p.w;
      const wasAbove = ball.y - ball.vy + R <= p.y + 1;
      const nowBelow = ball.y + R >= p.y;
      if (inX && wasAbove && nowBelow && ball.vy >= 0) {
        ball.y = p.y - R;
        if (ball.vy > 1.5) {
          ball.sqY = 0.68;
          ball.sqX = 1.32;
        }
        ball.vy = 0;
        ball.onGround = true;
        break;
      }
    }
    if (ball.x - R > W) ball.x = -R;
    if (ball.x + R < 0) ball.x = W + R;
    if (ball.y - R > H + 15) die();

    // Rings
    for (const ring of rings) {
      if (ring.collected) continue;
      ring.phase += 0.045;
      const ry = ring.baseY + Math.sin(ring.phase) * 2.5;
      if (Math.hypot(ball.x - ring.x, ball.y - ry) < R + ring.r + 1.5) {
        ring.collected = true;
        ringsGot++;
        score += 100;
        burst(ring.x, ry, 8);
        updateHud();
        if (ringsGot >= rings.length) return win();
      }
    }

    // Spiders
    for (const s of spiders) {
      s.x += s.dir * s.speed;
      const p = platforms[s.pi];
      if (s.x < p.x + 2) {
        s.x = p.x + 2;
        s.dir = 1;
      }
      if (s.x > p.x + p.w - s.w - 2) {
        s.x = p.x + p.w - s.w - 2;
        s.dir = -1;
      }
      const sy = p.y - s.h;
      if (
        ball.x + R * 0.65 > s.x &&
        ball.x - R * 0.65 < s.x + s.w &&
        ball.y + R * 0.65 > sy &&
        ball.y - R * 0.65 < sy + s.h
      ) {
        die();
        return;
      }
    }

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.09;
      p.life -= 0.04;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function burst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = ((Math.PI * 2) / count) * i;
      const spd = 1.2 + Math.random() * 1.6;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 0.8,
        life: 1,
      });
    }
  }

  function die() {
    burst(ball.x, ball.y, 12);
    lives--;
    updateHud();
    if (lives <= 0) {
      state = "over";
      $("final-score").textContent = score;
      draw();
      setTimeout(() => state === "over" && show("screen-over"), 600);
    } else {
      respawn();
    }
  }

  function win() {
    state = "win";
    $("win-score").textContent = score;
    draw();
    setTimeout(() => state === "win" && show("screen-win"), 450);
  }

  // ----------------------------------------------------------------
  // Draw
  // ----------------------------------------------------------------
  function drawCloud(x, y) {
    const parts = [
      [0, 6, 40, 8],
      [8, 2, 22, 8],
      [18, -2, 12, 8],
    ];
    for (const [dx, dy, w, h] of parts) rect(x + dx - 1, y + dy - 1, w + 2, h + 2, INK);
    for (const [dx, dy, w, h] of parts) rect(x + dx, y + dy, w, h, PAPER);
  }

  function draw() {
    rect(0, 0, W, H, PAPER);

    const drift = tick * 0.04;
    drawCloud(((60 + drift) % (W + 80)) - 40, 26);
    drawCloud(((250 + drift * 0.7) % (W + 80)) - 40, 14);
    drawCloud(((390 + drift * 1.2) % (W + 80)) - 40, 40);

    ctx.drawImage(staticLayer, 0, 0);

    // Rings
    for (const ring of rings) {
      if (ring.collected) continue;
      const ry = ring.baseY + Math.sin(ring.phase) * 2.5;
      ellipse(ring.x, ry, ring.r, ring.r, INK);
      ellipse(ring.x, ry, ring.r - 2, ring.r - 2, PAPER);
    }

    // Spiders
    for (const s of spiders) {
      const p = platforms[s.pi];
      const cx = s.x + s.w / 2;
      const cy = p.y - s.h / 2 - 1;
      const step = (tick >> 3) & 1;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const oy = -2 + k * 3;
          line(cx + side * 5, cy + oy, cx + side * 9, cy + oy + 2 + (step ^ (k & 1)), INK);
        }
      }
      ellipse(cx, cy, 7, 5, PAPER);
      ellipse(cx, cy, 6, 4, INK);
      rect(cx - 3, cy - 2, 2, 2, PAPER);
      rect(cx + 1, cy - 2, 2, 2, PAPER);
    }

    // Player (white halo keeps it readable over hatching)
    if (state !== "over" || lives > 0) {
      const rx = R * ball.sqX;
      const ry = R * ball.sqY;
      ellipse(ball.x, ball.y + (R - ry), rx + 1.5, ry + 1.5, PAPER);
      ellipse(ball.x, ball.y + (R - ry), rx, ry, INK);
      rect(ball.x - 4, ball.y + (R - ry) - 5, 3, 2, PAPER);
      rect(ball.x - 5, ball.y + (R - ry) - 3, 2, 2, PAPER);
    }

    // Particles
    ctx.fillStyle = INK;
    for (const p of particles) {
      const size = Math.max(1, r(3 * p.life));
      ctx.fillRect(r(p.x), r(p.y), size, size);
    }
  }

  // ----------------------------------------------------------------
  // HUD, overlays
  // ----------------------------------------------------------------
  function updateHud() {
    $("g-score").textContent = score;
    $("g-rings").textContent = `${ringsGot}/${rings.length}`;
    $("g-lives").textContent = "♥".repeat(Math.max(0, lives));
  }

  function show(id) {
    $(id).hidden = false;
    const btn = $(id).querySelector("button");
    if (btn) btn.focus({ preventScroll: true });
  }
  function hideOverlays() {
    ["screen-start", "screen-over", "screen-win"].forEach((id) => ($(id).hidden = true));
  }

  // ----------------------------------------------------------------
  // Loop (fixed timestep, pauses when off screen)
  // ----------------------------------------------------------------
  let raf = 0;
  let last = 0;
  let acc = 0;

  function frame(now) {
    raf = 0;
    if (state !== "playing" || !visible) return;
    const dt = Math.min(50, now - last);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      update();
      acc -= STEP;
      if (state !== "playing") break;
    }
    draw();
    if (state === "playing") raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && state === "playing" && visible) {
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    lives = 3;
    buildLevel();
    hideOverlays();
    state = "playing";
    kick();
  }

  $("btn-start").addEventListener("click", start);
  $("btn-retry").addEventListener("click", start);
  $("btn-again").addEventListener("click", start);

  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    },
    { threshold: 0.25 },
  ).observe($("game-frame"));

  // ----------------------------------------------------------------
  // Input (captured only while playing and visible)
  // ----------------------------------------------------------------
  window.addEventListener("keydown", (e) => {
    if (state !== "playing" || !visible) return;
    if (e.code === "ArrowLeft") {
      keys.left = true;
      e.preventDefault();
    } else if (e.code === "ArrowRight") {
      keys.right = true;
      e.preventDefault();
    } else if (e.code === "Space" || e.code === "ArrowUp") {
      if (!e.repeat) jumpBuffer = 6;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "ArrowRight") keys.right = false;
  });
  window.addEventListener("blur", () => {
    keys.left = keys.right = false;
  });

  function hold(id, down, up) {
    const el = $(id);
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      down();
      el.classList.add("pressed");
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) =>
      el.addEventListener(t, () => {
        up();
        el.classList.remove("pressed");
      }),
    );
  }
  hold("tbtn-left", () => (keys.left = true), () => (keys.left = false));
  hold("tbtn-right", () => (keys.right = true), () => (keys.right = false));
  hold("tbtn-jump", () => (jumpBuffer = 6), () => {});

  if (matchMedia("(pointer: coarse)").matches) {
    $("keys-hint").innerHTML =
      "◀ ▶ move · ▲ jump<br />Collect every ring. Avoid the spiders.";
  }

  // First paint behind the start screen
  lives = 3;
  buildLevel();
  draw();

  // ================================================================
  // Sliding puzzle
  // ================================================================
  const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, null];
  let tiles = [];
  let moves = 0;

  const grid = $("puzzle-grid");

  function neighbors(i) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const n = [];
    if (row > 0) n.push(i - 3);
    if (row < 2) n.push(i + 3);
    if (col > 0) n.push(i - 1);
    if (col < 2) n.push(i + 1);
    return n;
  }

  const isSolved = () => tiles.every((v, i) => v === SOLVED[i]);

  function shuffle() {
    tiles = [...SOLVED];
    let blank = 8;
    let prev = -1;
    for (let k = 0; k < 100; k++) {
      const options = neighbors(blank).filter((n) => n !== prev);
      const pick = options[Math.floor(Math.random() * options.length)];
      tiles[blank] = tiles[pick];
      tiles[pick] = null;
      prev = blank;
      blank = pick;
    }
    if (isSolved()) return shuffle();
    moves = 0;
    render();
  }

  function render(focusValue) {
    grid.innerHTML = "";
    const solved = isSolved();
    tiles.forEach((val, i) => {
      if (val === null) {
        const gap = document.createElement("div");
        gap.className = "tile empty";
        gap.setAttribute("aria-hidden", "true");
        grid.appendChild(gap);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile" + (solved ? " correct" : "");
      btn.textContent = val;
      btn.setAttribute("aria-label", `Tile ${val}`);
      btn.addEventListener("click", () => move(i));
      grid.appendChild(btn);
      if (val === focusValue) btn.focus({ preventScroll: true });
    });
    $("move-count").textContent = moves;
    $("puzzle-solved").hidden = !(solved && moves > 0);
  }

  function move(i) {
    const blank = tiles.indexOf(null);
    if (!neighbors(blank).includes(i)) return;
    const value = tiles[i];
    tiles[blank] = value;
    tiles[i] = null;
    moves++;
    render(value);
  }

  $("btn-shuffle").addEventListener("click", shuffle);
  shuffle();
})();
