const canvas = document.getElementById("funkin");
const ctx = canvas.getContext("2d");

// ==============================
// DESIGN RESOLUTION
// ==============================
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

let scaleX = 1;
let scaleY = 1;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  scaleX = canvas.width / DESIGN_WIDTH;
  scaleY = canvas.height / DESIGN_HEIGHT;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ==============================
// INPUT
// ==============================
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// ==============================
// LOADERS
// ==============================
function loadImage(src) {
  return new Promise(res => {
    const img = new Image();
    img.src = src;
    img.onload = () => res(img);
  });
}

function loadXML(src) {
  return fetch(src)
    .then(r => r.text())
    .then(t => new DOMParser().parseFromString(t, "text/xml"));
}

// ==============================
// SPRITE CLASS (ANTI-JITTER)
// ==============================
class Sprite {
  constructor(image, frames, x, y, scale = 1) {
    this.image = image;
    this.frames = frames;

    // LOCKED base position (never changes)
    this.baseX = x;
    this.baseY = y;

    this.scale = scale;

    this.anim = frames.idle ? "idle" : Object.keys(frames)[0];
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.fps = 12;
  }

  setAnim(name) {
    if (this.frames[name] && this.anim !== name) {
      this.anim = name;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  update(dt) {
    const frames = this.frames[this.anim];
    if (!frames) return;

    this.frameTimer += dt;
    if (this.frameTimer >= 1 / this.fps) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
  }

  draw() {
    const f = this.frames[this.anim][this.frameIndex];
    if (!f) return;

    // Offsets applied RELATIVE to fixed base position
    const drawX = (this.baseX + f.ox) * scaleX;
    const drawY = (this.baseY + f.oy) * scaleY;

    ctx.drawImage(
      this.image,
      f.x, f.y, f.w, f.h,
      drawX,
      drawY,
      f.w * this.scale * scaleX,
      f.h * this.scale * scaleY
    );
  }
}

// ==============================
// SPARROW XML PARSER (FNF SAFE)
// ==============================
function parseSparrow(xml) {
  const frames = {};
  const subs = xml.getElementsByTagName("SubTexture");

  for (const sub of subs) {
    let name = sub.getAttribute("name");

    // Remove trailing numbers
    name = name.replace(/\d+$/, "");

    // Remove character prefix (e.g. "BF idle" → "idle")
    const parts = name.split(" ");
    if (parts.length > 1) parts.shift();
    name = parts.join(" ").trim();

    if (!frames[name]) frames[name] = [];

    frames[name].push({
      x: +sub.getAttribute("x"),
      y: +sub.getAttribute("y"),
      w: +sub.getAttribute("width"),
      h: +sub.getAttribute("height"),
      ox: -(+sub.getAttribute("frameX") || 0),
      oy: -(+sub.getAttribute("frameY") || 0)
    });
  }

  return frames;
}

// ==============================
// STATE
// ==============================
let bg;
let player, opponent;
let lastTime = 0;

// ==============================
// INPUT → ANIMATION
// ==============================
function updateControls() {
  // Opponent (WASD)
  if (keys.w) opponent.setAnim("singUP");
  else if (keys.a) opponent.setAnim("singLEFT");
  else if (keys.s) opponent.setAnim("singDOWN");
  else if (keys.d) opponent.setAnim("singRIGHT");
  else opponent.setAnim("idle");

  // Player (Arrow Keys)
  if (keys.ArrowUp) player.setAnim("singUP");
  else if (keys.ArrowLeft) player.setAnim("singLEFT");
  else if (keys.ArrowDown) player.setAnim("singDOWN");
  else if (keys.ArrowRight) player.setAnim("singRIGHT");
  else player.setAnim("idle");
}

// ==============================
// MAIN LOOP
// ==============================
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

if (bg) {
  const bgScale = demo.background.scale ?? 1;
  const bgX = demo.background.x ?? 0;
  const bgY = demo.background.y ?? 0;

  ctx.drawImage(
    bg,
    bgX * scaleX,
    bgY * scaleY,
    bg.width * bgScale * scaleX,
    bg.height * bgScale * scaleY
  );
}

  updateControls();

  opponent.update(dt);
  player.update(dt);

  opponent.draw();
  player.draw();

  requestAnimationFrame(loop);
}

// ==============================
// INIT
// ==============================
async function init() {
  bg = await loadImage(demo.background.image);

  const oppImg = await loadImage(demo.opponent.image);
  const oppFrames = parseSparrow(await loadXML(demo.opponent.xml));
  opponent = new Sprite(
    oppImg,
    oppFrames,
    demo.opponent.x,
    demo.opponent.y,
    demo.opponent.scale || 1
  );

  const plrImg = await loadImage(demo.player.image);
  const plrFrames = parseSparrow(await loadXML(demo.player.xml));
  player = new Sprite(
    plrImg,
    plrFrames,
    demo.player.x,
    demo.player.y,
    demo.player.scale || 1
  );

  requestAnimationFrame(loop);
}

init();
