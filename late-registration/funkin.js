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
    const f = this.frames[this.anim]?.[this.frameIndex];
    if (!f) return;

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
// SPARROW XML PARSER
// ==============================
function parseSparrow(xml) {
  const frames = {};
  const subs = xml.getElementsByTagName("SubTexture");

  for (const sub of subs) {
    let name = sub.getAttribute("name");
    name = name.replace(/\d+$/, "");
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
// GAME OBJECTS
// ==============================
let gameObjects = [];
let lastTime = 0;

function updateControls() {
  const playerObj = gameObjects.find(o => o.name === "player")?.sprite;
  const opponentObj = gameObjects.find(o => o.name === "opponent")?.sprite;

  if (opponentObj) {
    if (keys.w) opponentObj.setAnim("singUP");
    else if (keys.a) opponentObj.setAnim("singLEFT");
    else if (keys.s) opponentObj.setAnim("singDOWN");
    else if (keys.d) opponentObj.setAnim("singRIGHT");
    else opponentObj.setAnim("idle");
  }

  if (playerObj) {
    if (keys.ArrowUp) playerObj.setAnim("singUP");
    else if (keys.ArrowLeft) playerObj.setAnim("singLEFT");
    else if (keys.ArrowDown) playerObj.setAnim("singDOWN");
    else if (keys.ArrowRight) playerObj.setAnim("singRIGHT");
    else playerObj.setAnim("idle");
  }
}

// ==============================
// MAIN LOOP
// ==============================
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateControls();

  // Sort by layer
  const sortedObjects = [...gameObjects].sort((a, b) => (a.layer || 0) - (b.layer || 0));

  for (const obj of sortedObjects) {
    obj.sprite?.update(dt);
    obj.sprite?.draw();
  }

  requestAnimationFrame(loop);
}

// ==============================
// INIT
// ==============================
async function init() {
  // Loop through demo keys
  for (const key in demo) {
    const obj = demo[key];

    // Handle arrays of objects
    if (Array.isArray(obj)) {
      for (const o of obj) {
        await loadAndPushObject(o);
      }
    } else {
      await loadAndPushObject(obj);
    }
  }

  requestAnimationFrame(loop);
}

// Helper: load image, XML, create sprite and push
async function loadAndPushObject(obj) {
  const image = await loadImage(obj.image);
  let frames = { idle: [{ x: 0, y: 0, w: image.width, h: image.height, ox: 0, oy: 0 }] };

  if (obj.xml) {
    frames = parseSparrow(await loadXML(obj.xml));
  }

  gameObjects.push({
    name: obj.name || "object",
    layer: obj.layer || 0,
    sprite: new Sprite(image, frames, obj.x || 0, obj.y || 0, obj.scale || 1)
  });
}

init();
