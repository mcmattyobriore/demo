const canvas = document.getElementById("funkin");
const ctx = canvas.getContext("2d");

canvas.width = 1280;
canvas.height = 720;

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
// SPRITE CLASS
// ==============================
class Sprite {
  constructor(image, frames, x, y, scale = 1) {
    this.image = image;
    this.frames = frames;
    this.x = x;
    this.y = y;
    this.scale = scale;

    this.anim = "idle";
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.fps = 12;
  }

  setAnim(name) {
    if (this.anim !== name && this.frames[name]) {
      this.anim = name;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  update(dt) {
    const animFrames = this.frames[this.anim];
    if (!animFrames) return;

    this.frameTimer += dt;
    if (this.frameTimer > 1 / this.fps) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % animFrames.length;
    }
  }

  draw() {
    const frame = this.frames[this.anim][this.frameIndex];
    if (!frame) return;

    ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h,
      this.x + frame.ox * this.scale,
      this.y + frame.oy * this.scale,
      frame.w * this.scale,
      frame.h * this.scale
    );
  }
}

// ==============================
// XML PARSER (Sparrow)
// ==============================
function parseSparrow(xml) {
  const frames = {};
  const subs = xml.getElementsByTagName("SubTexture");

  for (const sub of subs) {
    const name = sub.getAttribute("name");
    const anim = name.replace(/[0-9]/g, "").trim();

    if (!frames[anim]) frames[anim] = [];

    frames[anim].push({
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
let bgData;
let player;
let opponent;
let lastTime = 0;

// ==============================
// INPUT → ANIM
// ==============================
function updateControls() {
  // Opponent (WASD)
  if (keys["w"]) opponent.setAnim("singUP");
  else if (keys["a"]) opponent.setAnim("singLEFT");
  else if (keys["s"]) opponent.setAnim("singDOWN");
  else if (keys["d"]) opponent.setAnim("singRIGHT");
  else opponent.setAnim("idle");

  // Player (Arrow Keys)
  if (keys["ArrowUp"]) player.setAnim("singUP");
  else if (keys["ArrowLeft"]) player.setAnim("singLEFT");
  else if (keys["ArrowDown"]) player.setAnim("singDOWN");
  else if (keys["ArrowRight"]) player.setAnim("singRIGHT");
  else player.setAnim("idle");
}

// ==============================
// MAIN LOOP
// ==============================
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.drawImage(
    bg,
    bgData.x,
    bgData.y,
    canvas.width,
    canvas.height
  );

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
  // UNWRAP ARRAY HERE
  const demo = (await fetch("demo.json").then(r => r.json()))[0];

  bgData = demo.background;
  bg = await loadImage(bgData.image);

  const oppImg = await loadImage(demo.opponent.image);
  const oppXML = parseSparrow(await loadXML(demo.opponent.xml));

  opponent = new Sprite(
    oppImg,
    oppXML,
    demo.opponent.x,
    demo.opponent.y,
    demo.opponent.scale || 1
  );

  const plrImg = await loadImage(demo.player.image);
  const plrXML = parseSparrow(await loadXML(demo.player.xml));

  player = new Sprite(
    plrImg,
    plrXML,
    demo.player.x,
    demo.player.y,
    demo.player.scale || 1
  );

  requestAnimationFrame(loop);
}

init();
