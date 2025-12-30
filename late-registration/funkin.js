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
window.addEventListener("keydown", e => (keys[e.key] = true));
window.addEventListener("keyup", e => (keys[e.key] = false));

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
// SPRITE (ANCHOR-BASED)
// ==============================
class Sprite {
  constructor(image, frames, x, y, scale = 1) {
    this.image = image;
    this.frames = frames;

    // 🔒 WORLD POSITION (NEVER CHANGES)
    this.anchorX = x;
    this.anchorY = y;

    this.scale = scale;
    this.opacity = 1;
    this.fps = 12;

    this.anim = frames.idle ? "idle" : Object.keys(frames)[0];
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  setAnim(name) {
    if (this.frames[name] && this.anim !== name) {
      this.anim = name;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  update(dt) {
    const animFrames = this.frames[this.anim];
    if (!animFrames) return;

    this.frameTimer += dt;
    if (this.frameTimer >= 1 / this.fps) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % animFrames.length;
    }
  }

  draw() {
    const f = this.frames[this.anim]?.[this.frameIndex];
    if (!f) return;

    // 🔥 APPLY OFFSETS ONLY AT DRAW TIME
    const drawX =
      this.anchorX * scaleX +
      f.ox * this.scale * scaleX;

    const drawY =
      this.anchorY * scaleY +
      f.oy * this.scale * scaleY;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    ctx.drawImage(
      this.image,
      f.x, f.y, f.w, f.h,
      drawX,
      drawY,
      f.w * this.scale * scaleX,
      f.h * this.scale * scaleY
    );

    ctx.restore();
  }
}

// ==============================
// STRICT SPARROW XML PARSER
// ==============================
function parseSparrow(xml) {
  const frames = {};
  const subs = xml.getElementsByTagName("SubTexture");

  for (const sub of subs) {
    const name = sub.getAttribute("name");
    const match = name.match(/^(.*?)(\d+)$/);
    if (!match) continue;

    const anim = match[1];
    const index = Number(match[2]);

    if (!frames[anim]) frames[anim] = [];

    frames[anim].push({
      index,
      x: +sub.getAttribute("x"),
      y: +sub.getAttribute("y"),
      w: +sub.getAttribute("width"),
      h: +sub.getAttribute("height"),
      ox: -(+sub.getAttribute("frameX") || 0),
      oy: -(+sub.getAttribute("frameY") || 0)
    });
  }

  // 🔥 SORT FRAMES NUMERICALLY
  for (const anim in frames) {
    frames[anim].sort((a, b) => a.index - b.index);
    frames[anim] = frames[anim].map(f => {
      delete f.index;
      return f;
    });
  }

  return frames;
}

// ==============================
// GAME OBJECTS
// ==============================
let gameObjects = [];
let lastTime = 0;

function updateControls() {
  const player = gameObjects.find(o => o.name === "player")?.sprite;
  const opponent = gameObjects.find(o => o.name === "opponent")?.sprite;

  if (opponent) {
    if (keys.w) opponent.setAnim("singUP");
    else if (keys.a) opponent.setAnim("singLEFT");
    else if (keys.s) opponent.setAnim("singDOWN");
    else if (keys.d) opponent.setAnim("singRIGHT");
    else opponent.setAnim("idle");
  }

  if (player) {
    if (keys.ArrowUp) player.setAnim("singUP");
    else if (keys.ArrowLeft) player.setAnim("singLEFT");
    else if (keys.ArrowDown) player.setAnim("singDOWN");
    else if (keys.ArrowRight) player.setAnim("singRIGHT");
    else player.setAnim("idle");
  }
}

// ==============================
// EFFECTS
// ==============================
const effects = {
  pulseLight(obj, dt) {
    obj._t = (obj._t || 0) + dt * 2;
    obj.sprite.opacity = 0.9 + Math.sin(obj._t) * 0.1;
  }
};

// ==============================
// MAIN LOOP
// ==============================
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateControls();

  const sorted = [...gameObjects].sort(
    (a, b) => (a.layer || 0) - (b.layer || 0)
  );

  for (const obj of sorted) {
    obj.effect?.(obj, dt);
    obj.sprite?.update(dt);
    obj.sprite?.draw();
  }

  requestAnimationFrame(loop);
}

// ==============================
// INIT
// ==============================
async function init() {
  for (const key in demo) {
    const obj = demo[key];
    if (Array.isArray(obj)) {
      for (const o of obj) await loadAndPushObject(o);
    } else {
      await loadAndPushObject(obj);
    }
  }
  requestAnimationFrame(loop);
}

async function loadAndPushObject(obj) {
  const image = await loadImage(obj.image);
  let frames = {
    idle: [{ x: 0, y: 0, w: image.width, h: image.height, ox: 0, oy: 0 }]
  };

  if (obj.xml) {
    frames = parseSparrow(await loadXML(obj.xml));
  }

  const sprite = new Sprite(
    image,
    frames,
    obj.x || 0,
    obj.y || 0,
    obj.scale || 1
  );

  const gameObj = {
    name: obj.name || "object",
    layer: obj.layer || 0,
    sprite,
    effect: null
  };

  if (obj.name === "lamp-light" || obj.name === "lamp-lightend") {
    gameObj.effect = effects.pulseLight;
  }

  gameObjects.push(gameObj);
}

init();
