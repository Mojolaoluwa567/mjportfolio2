// ================================================================
//  BOUNCE GAME ENGINE — Pure Vanilla JS + HTML Canvas API
//  No external libraries. requestAnimationFrame game loop.
// ================================================================

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// Responsive canvas
function resizeCanvas() {
  const wrap = document.getElementById("game-wrap");
  canvas.width = wrap.clientWidth;
  canvas.height = Math.min(Math.floor(window.innerHeight * 0.56), 460);
}
resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  if (gameState === "playing") {
    buildLevel();
  } else {
    drawStaticFrame();
  }
});

// ── Palette ───────────────────────────────────────────────────────
const COL = {
  sky1: "#5BBCF5",
  sky2: "#C8ECFF",
  grass: "#228B22",
  ground: "#8B4513",
  plat: "#4169E1",
  platTop: "#6699FF",
  dark: "#0A0A0A",
  red: "#FF2020",
  yellow: "#FFD700",
  white: "#FFFFFF",
  orange: "#FF6B00",
};

// ── State ─────────────────────────────────────────────────────────
let gameState = "idle"; // idle | playing | dead | win
let score = 0,
  ringsTotal = 0,
  ringsGot = 0,
  lives = 3;
let animId = null;

// ── Input ─────────────────────────────────────────────────────────
const keys = { left: false, right: false, space: false };
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") {
    keys.left = true;
    e.preventDefault();
  }
  if (e.code === "ArrowRight") {
    keys.right = true;
    e.preventDefault();
  }
  if (e.code === "Space") {
    keys.space = true;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") keys.left = false;
  if (e.code === "ArrowRight") keys.right = false;
  if (e.code === "Space") keys.space = false;
});

// ── Physics constants ─────────────────────────────────────────────
const BALL_R = 18;
const GRAVITY = 0.52;
const JUMP_V = -13.5;
const MOVE_SPD = 4.8;

// ── Entities ──────────────────────────────────────────────────────
let ball = {};
let platforms = [],
  rings = [],
  spiders = [],
  particles = [];

// ── Build level (layout based on current canvas size) ────────────
function buildLevel() {
  const W = canvas.width,
    H = canvas.height;

  platforms = [
    // Ground
    { x: 0, y: H - 52, w: W, h: 52, ground: true },
    // Floating platforms
    { x: W * 0.04, y: H - 52 - 95, w: W * 0.17, h: 14, ground: false },
    { x: W * 0.27, y: H - 52 - 145, w: W * 0.15, h: 14, ground: false },
    { x: W * 0.48, y: H - 52 - 105, w: W * 0.14, h: 14, ground: false },
    { x: W * 0.66, y: H - 52 - 170, w: W * 0.17, h: 14, ground: false },
    { x: W * 0.36, y: H - 52 - 225, w: W * 0.14, h: 14, ground: false },
    { x: W * 0.14, y: H - 52 - 200, w: W * 0.15, h: 14, ground: false },
  ];

  // Rings above each floating platform
  rings = [];
  for (let i = 1; i < platforms.length; i++) {
    const p = platforms[i];
    const count = i <= 3 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      rings.push({
        x: p.x + p.w * (0.18 + j * (0.64 / (count - 1))),
        baseY: p.y - 34,
        phase: Math.random() * Math.PI * 2,
        r: 10,
        collected: false,
      });
    }
  }
  ringsTotal = rings.length;
  ringsGot = 0;

  // Spiders patrol platforms
  spiders = [makSpider(3, 0.5, -2.0), makSpider(4, 0.3, 1.4)];

  // Ball starts on first floating platform
  const sp = platforms[1];
  ball = {
    x: sp.x + sp.w * 0.5,
    y: sp.y - BALL_R - 1,
    vx: 0,
    vy: 0,
    onGround: false,
    sqX: 1,
    sqY: 1,
  };
  score = 0;
  particles = [];
  updateHUD();
}

function makSpider(platIdx, relX, speed) {
  const p = platforms[platIdx];
  return {
    pi: platIdx,
    x: p.x + p.w * relX,
    dir: speed > 0 ? 1 : -1,
    speed: Math.abs(speed),
    w: 24,
    h: 18,
  };
}

// ── Update functions ──────────────────────────────────────────────
function updateBall() {
  if (keys.left) ball.vx = -MOVE_SPD;
  else if (keys.right) ball.vx = MOVE_SPD;
  else ball.vx *= 0.72;

  if (keys.space && ball.onGround) {
    ball.vy = JUMP_V;
    ball.onGround = false;
    ball.sqY = 0.62;
    ball.sqX = 1.38;
    keys.space = false;
  }

  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Squish spring back
  ball.sqY += (1 - ball.sqY) * 0.18;
  ball.sqX += (1 - ball.sqX) * 0.18;

  // Platform collision (top only, falling down)
  ball.onGround = false;
  for (const p of platforms) {
    const inX = ball.x + BALL_R > p.x && ball.x - BALL_R < p.x + p.w;
    const wasAbove = ball.y - ball.vy + BALL_R <= p.y + 2;
    const nowBelow = ball.y + BALL_R >= p.y;
    if (inX && wasAbove && nowBelow && ball.vy >= 0) {
      ball.y = p.y - BALL_R;
      if (ball.vy > 3) {
        ball.sqY = 0.68;
        ball.sqX = 1.32;
      }
      ball.vy = 0;
      ball.onGround = true;
      score++;
      break;
    }
  }

  // Horizontal wrap
  if (ball.x - BALL_R > canvas.width) ball.x = -BALL_R;
  if (ball.x + BALL_R < 0) ball.x = canvas.width + BALL_R;

  // Fell off bottom
  if (ball.y - BALL_R > canvas.height + 30) onDeath();
}

function updateRings(t) {
  for (const ring of rings) {
    if (ring.collected) continue;
    ring.phase += 0.045;
    const ry = ring.baseY + Math.sin(ring.phase) * 5;
    if (Math.hypot(ball.x - ring.x, ball.y - ry) < BALL_R + ring.r + 3) {
      ring.collected = true;
      ringsGot++;
      score += 100;
      burst(ring.x, ry, COL.yellow, 10);
      updateHUD();
      if (ringsGot >= ringsTotal) onWin();
    }
  }
}

function updateSpiders() {
  for (const s of spiders) {
    s.x += s.dir * s.speed;
    const p = platforms[s.pi];
    if (s.x < p.x + 4) {
      s.x = p.x + 4;
      s.dir = 1;
    }
    if (s.x > p.x + p.w - s.w - 4) {
      s.x = p.x + p.w - s.w - 4;
      s.dir = -1;
    }
    const sy = p.y - s.h;
    // Hit detection
    if (
      ball.x + BALL_R * 0.65 > s.x &&
      ball.x - BALL_R * 0.65 < s.x + s.w &&
      ball.y + BALL_R * 0.65 > sy &&
      ball.y - BALL_R * 0.65 < sy + s.h
    ) {
      onDeath();
    }
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.life -= 0.04;
  }
  particles = particles.filter((p) => p.life > 0);
}

// ── Events ────────────────────────────────────────────────────────
function onDeath() {
  burst(ball.x, ball.y, COL.red, 14);
  lives--;
  updateHUD();
  if (lives <= 0) {
    gameState = "dead";
    document.getElementById("final-score").textContent = score;
    setTimeout(() => show("screen-gameover"), 700);
  } else {
    const sp = platforms[1];
    ball.x = sp.x + sp.w * 0.5;
    ball.y = sp.y - BALL_R - 1;
    ball.vx = 0;
    ball.vy = 0;
  }
}

function onWin() {
  gameState = "win";
  document.getElementById("win-score").textContent = score;
  setTimeout(() => show("screen-win"), 500);
}

// ── Particles ─────────────────────────────────────────────────────
function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = ((Math.PI * 2) / count) * i;
    const spd = 2.5 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 1.5,
      life: 1,
      color,
      r: 4 + Math.random() * 3,
    });
  }
}
// Load cloud image once — black background knocked out with 'screen' blend
const cloudImg = new Image();
cloudImg.src = "image/cloud_12132011.png ";
cloudImg.onload = () => drawStaticFrame();

// ── Draw ──────────────────────────────────────────────────────────
function drawScene(t) {
  const W = canvas.width,
    H = canvas.height;

  // Sky
  const sg = ctx.createLinearGradient(0, 0, 0, H);
  sg.addColorStop(0, COL.sky1);
  sg.addColorStop(1, COL.sky2);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  drawClouds(W, H);
  drawPlatforms();
  drawRings();
  drawSpidersShape();
  if (gameState !== "dead" || lives > 0) drawBallShape();
  drawParticleLayer();
}

function drawClouds(W, H) {
  const clouds = [
    { x: W * 0.08, y: H * 0.1, w: 110, h: 55 },
    { x: W * 0.5, y: H * 0.07, w: 140, h: 70 },
    { x: W * 0.82, y: H * 0.15, w: 100, h: 50 },
  ];
  if (cloudImg.complete && cloudImg.naturalWidth > 0) {
    clouds.forEach((c) => {
      ctx.globalCompositeOperation = "screen"; // knocks out black background
      ctx.drawImage(cloudImg, c.x, c.y, c.w, c.h);
      ctx.globalCompositeOperation = "source-over"; // reset after each cloud
    });
  }
}
function drawPlatforms() {
  for (const p of platforms) {
    ctx.lineWidth = 3;
    if (p.ground) {
      ctx.fillStyle = COL.grass;
      ctx.fillRect(p.x, p.y, p.w, 20);
      ctx.strokeStyle = COL.dark;
      ctx.strokeRect(p.x, p.y, p.w, 20);
      ctx.fillStyle = COL.ground;
      ctx.fillRect(p.x, p.y + 20, p.w, p.h - 20);
      ctx.strokeStyle = COL.dark;
      ctx.strokeRect(p.x, p.y + 20, p.w, p.h - 20);
    } else {
      ctx.fillStyle = COL.platTop;
      ctx.fillRect(p.x, p.y, p.w, 5);
      ctx.fillStyle = COL.plat;
      ctx.fillRect(p.x, p.y + 5, p.w, p.h - 5);
      ctx.strokeStyle = COL.dark;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(p.x + 4, p.y + p.h, p.w, 5);
    }
  }
}

function drawRings() {
  for (const ring of rings) {
    if (ring.collected) continue;
    const ry = ring.baseY + Math.sin(ring.phase) * 5;
    // Outer ring
    ctx.beginPath();
    ctx.arc(ring.x, ry, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = COL.yellow;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ring.x, ry, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = COL.dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Shine dot
    ctx.beginPath();
    ctx.arc(
      ring.x - ring.r * 0.35,
      ry - ring.r * 0.35,
      ring.r * 0.22,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fill();
  }
}

function drawSpidersShape() {
  for (const s of spiders) {
    const p = platforms[s.pi];
    const sy = p.y - s.h;
    ctx.save();
    ctx.translate(s.x + s.w / 2, sy + s.h / 2);
    if (s.dir < 0) ctx.scale(-1, 1);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, s.w / 2 - 1, s.h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();
    ctx.strokeStyle = COL.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = COL.red;
    ctx.beginPath();
    ctx.arc(-s.w * 0.18, -s.h * 0.12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.w * 0.18, -s.h * 0.12, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1.5;
    [-0.2, 0.05, 0.3].forEach((t, i) => {
      ctx.beginPath();
      ctx.moveTo(-s.w / 2 + 1, s.h * t);
      ctx.lineTo(-s.w / 2 - 9, s.h * (t - 0.12));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.w / 2 - 1, s.h * t);
      ctx.lineTo(s.w / 2 + 9, s.h * (t - 0.12));
      ctx.stroke();
    });

    ctx.restore();
  }
}

function drawBallShape() {
  const { x, y, sqX, sqY } = ball;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sqX, sqY);

  // Shadow
  ctx.beginPath();
  ctx.ellipse(0, BALL_R + 3, BALL_R * 0.75, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();

  // Ball
  const g = ctx.createRadialGradient(
    -BALL_R * 0.3,
    -BALL_R * 0.3,
    2,
    0,
    0,
    BALL_R,
  );
  g.addColorStop(0, "#ff8888");
  g.addColorStop(0.55, COL.red);
  g.addColorStop(1, "#880000");
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = COL.dark;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Shine
  ctx.beginPath();
  ctx.ellipse(
    -BALL_R * 0.3,
    -BALL_R * 0.3,
    BALL_R * 0.27,
    BALL_R * 0.17,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.fill();

  ctx.restore();
}

function drawParticleLayer() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = COL.dark;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── HUD ───────────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById("hud-score").textContent = score;
  document.getElementById("hud-rings").textContent =
    `${ringsGot}/${ringsTotal}`;
  document.getElementById("hud-lives").textContent = "♥".repeat(
    Math.max(0, lives),
  );
}

// ── Overlay helpers ───────────────────────────────────────────────
function show(id) {
  document.getElementById(id).style.display = "flex";
}
function hideAll() {
  ["screen-start", "screen-gameover", "screen-win"].forEach((id) => {
    document.getElementById(id).style.display = "none";
  });
}

// ── Game loop ─────────────────────────────────────────────────────
let lastT = 0;
function loop(ts) {
  if (gameState !== "playing") return;
  lastT = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScene(ts);
  updateBall();
  updateRings(ts);
  updateSpiders();
  updateParticles();

  animId = requestAnimationFrame(loop);
}

function drawStaticFrame() {
  buildLevel();
  drawScene(0);
}

// ── Start / Restart ───────────────────────────────────────────────
function startGame() {
  cancelAnimationFrame(animId);
  hideAll();
  lives = 3;
  buildLevel();
  gameState = "playing";
  animId = requestAnimationFrame(loop);
}

document.getElementById("btn-start").addEventListener("click", startGame);
document.getElementById("btn-restart").addEventListener("click", startGame);
document.getElementById("btn-next").addEventListener("click", startGame);

// Draw idle preview on load
drawStaticFrame();

// ── Cursor ────────────────────────────────────────────────────────
const cur = document.getElementById("cursor");
document.addEventListener("mousemove", (e) => {
  cur.style.left = e.clientX + "px";
  cur.style.top = e.clientY + "px";
});
document.addEventListener("mousedown", () => cur.classList.add("squish"));
document.addEventListener("mouseup", () => cur.classList.remove("squish"));

// ── Scroll reveals ────────────────────────────────────────────────
const obs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.style.opacity = "1";
        e.target.style.transform = "translateY(0)";
      }
    });
  },
  { threshold: 0.15 },
);
document.querySelectorAll(".project-card, .timeline-item").forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(28px)";
  el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
  obs.observe(el);
});

// Touch controls — only show on touch devices
function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

if (isTouchDevice()) {
  document.getElementById("touch-controls").classList.add("visible");

  // Swap start screen instructions to button symbols
  document.querySelector("#screen-start p").innerHTML =
    "◀ ▶ MOVE &nbsp;|&nbsp; ▲ JUMP<br>COLLECT ALL RINGS · AVOID SPIDERS<br>FALL OFF = LOSE A LIFE";
}

// Wire each button to the same keys{} object the keyboard uses
function wireTouchBtn(id, key) {
  const btn = document.getElementById(id);
  btn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      keys[key] = true;
      btn.classList.add("pressed");
    },
    { passive: false },
  );
  btn.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      keys[key] = false;
      btn.classList.remove("pressed");
    },
    { passive: false },
  );
  btn.addEventListener("touchcancel", (e) => {
    keys[key] = false;
    btn.classList.remove("pressed");
  });
}

wireTouchBtn("tbtn-left", "left");
wireTouchBtn("tbtn-right", "right");
wireTouchBtn("tbtn-jump", "space");

// ── Sliding Tile Puzzle ──────────────────────────────────────────
const TILES = ["🔴", "⚡", "★", "🎮", "💻", "🎨", "🌍", "🏆", null]; // null = empty
let puzzleState = [],
  moveCount = 0;

function initPuzzle() {
  puzzleState = [...TILES];
  moveCount = 0;
  document.getElementById("move-count").textContent = 0;
  document.getElementById("puzzle-solved").style.display = "none";
  shufflePuzzle();
}

function shufflePuzzle() {
  // Do 80 random valid moves from solved state to guarantee solvability
  let blank = puzzleState.indexOf(null);
  for (let i = 0; i < 80; i++) {
    const neighbors = getNeighbors(blank);
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    puzzleState[blank] = puzzleState[pick];
    puzzleState[pick] = null;
    blank = pick;
  }
  moveCount = 0;
  document.getElementById("move-count").textContent = 0;
  document.getElementById("puzzle-solved").style.display = "none";
  renderPuzzle();
}

function getNeighbors(idx) {
  const row = Math.floor(idx / 3),
    col = idx % 3,
    n = [];
  if (row > 0) n.push(idx - 3); // up
  if (row < 2) n.push(idx + 3); // down
  if (col > 0) n.push(idx - 1); // left
  if (col < 2) n.push(idx + 1); // right
  return n;
}

function renderPuzzle() {
  const grid = document.getElementById("puzzle-grid");
  grid.innerHTML = "";
  const isSolved = puzzleState.every((v, i) => v === TILES[i]);

  puzzleState.forEach((val, i) => {
    const tile = document.createElement("div");
    tile.className =
      "tile" +
      (val === null ? " empty" : "") +
      (isSolved && val !== null ? " correct" : "");
    tile.textContent = val || "";
    if (val !== null) {
      tile.addEventListener("click", () => moveTile(i));
    }
    grid.appendChild(tile);
  });

  if (isSolved && moveCount > 0) {
    document.getElementById("puzzle-solved").style.display = "block";
  }
}

function moveTile(idx) {
  const blank = puzzleState.indexOf(null);
  if (getNeighbors(blank).includes(idx)) {
    puzzleState[blank] = puzzleState[idx];
    puzzleState[idx] = null;
    moveCount++;
    document.getElementById("move-count").textContent = moveCount;
    renderPuzzle();
  }
}

document.getElementById("btn-shuffle").addEventListener("click", shufflePuzzle);
initPuzzle();
