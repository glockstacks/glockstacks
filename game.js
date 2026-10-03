(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const W = 720;                       // portrait design width
  let H = Math.round(W * Math.min(2.4, Math.max(16 / 9, (window.innerHeight || 1280) / (window.innerWidth || 720))));
  const TILE = 48, COLS = 11, INITIAL_ROWS = 90;
  const MINE_W = TILE * COLS;
  const MINE_X = Math.round((W - MINE_W) / 2);
  let WORLD_TOP = Math.round(H * 0.34);
  let RING_Y = Math.round(H * 0.504);   // ring centre (matches the reference photo)
  let towerStart = 520;
  const bets = [10, 20, 30, 50, 100, 250, 500];
  const sprites = {};
  const gameSpriteNames = [
    "grass","cobblestone","stone","wall","copper","gold","diamond","emerald","redstone","obsidian","slime","no","heart","health_bar",
    "tnt","stretch","crafting_table","pickaxe_0","pickaxe_1","pickaxe_2","pickaxe_3",
    "frame","frame_back","frame_arrow","cloud_0","cloud_1","cloud_2",
    "ground_1","ground_2","ground_3","stone_fx_1","stone_fx_2","stone_fx_3",
    "cr1","cr2","cr3","cr4","cr5","cr6","cr7","cr8","cr9","cr10",
    "boom_1","boom_2","boom_3","boom_4"
  ];
  for (const name of gameSpriteNames) {
    const img = new Image();
    img.src = `./assets/sprites/game/${name}.png`;
    sprites[name] = img;
  }
  for (const name of ["lava_dirt","lava_stone","lava_hard","lava_wall","frame_lava","frame_back_lava",
    "lava_dirt_0","lava_dirt_1","lava_dirt_2","lava_stone_0","lava_stone_1","lava_stone_2","lava_hard_0","lava_hard_1","lava_hard_2"]) {
    const img=new Image();img.src=`./assets/sprites/lava/${name}.png`;sprites[name]=img;
  }
  const dirtImage = new Image();
  dirtImage.src = "./assets/sprites/loading/dirt.png";
  sprites.dirt = dirtImage;

  /* ===== BIOME / BACKGROUND THEMES — premium magical portals ===== */
  const THEMES = [
    { id: "hell",       name: "Inferno",     ring: "ring_hell",       bg: "hell",       mine: "#1a0808", particle: "#ff6020", ground: "hell",     accent: "#ff4010" },
    { id: "end",        name: "Void",        ring: "ring_end",        bg: "end",        mine: "#0c0814", particle: "#c080ff", ground: "end",      accent: "#a040ff" },
    { id: "deep_dark",  name: "Frost",       ring: "ring_deep_dark",  bg: "deep_dark",  mine: "#04080a", particle: "#80e0ff", ground: "deep_dark", accent: "#40c0ff" },
    { id: "classic",    name: "Forest",      ring: "ring_classic",    bg: "portal_run", mine: "#0a1a10", particle: "#c8ffc0", ground: "classic",  accent: "#40ff60" },
    { id: "portal_run", name: "Celestial",   ring: "ring_portal",     bg: "aether",     mine: "#182028", particle: "#ffe080", ground: "classic",  accent: "#ffd040" },
    { id: "cherry",     name: "Abyss",       ring: "ring_cherry",     bg: "cherry",     mine: "#180818", particle: "#ff60c0", ground: "classic",  accent: "#c040ff" },
    { id: "ocean",      name: "Ocean",       ring: "ring_original",   bg: "ocean",      mine: "#041820", particle: "#40c0ff", ground: "classic",  accent: "#2080ff" },
  ];
  let themeIndex = 0;
  let variantIndex = 0;
  let blockPackMode = 0; // 0 = themed (per world), 1 = classic (from pack)
  let shadersOn = true;
  let zannMode = false;
  try {
    const saved = localStorage.getItem("fp_theme");
    if (saved != null) {
      const i = THEMES.findIndex(t => t.id === saved);
      if (i >= 0) themeIndex = i;
    }
    const sv = localStorage.getItem("fp_variant");
    if (sv != null) variantIndex = parseInt(sv, 10) || 0;
    const bp = localStorage.getItem("fp_blockpack");
    if (bp != null) blockPackMode = parseInt(bp, 10) || 0;
    const sh = localStorage.getItem("fp_shaders");
    if (sh != null) shadersOn = sh !== "0";
    const zn = localStorage.getItem("fp_zann");
    if (zn != null) zannMode = zn === "1";
  } catch (_) {}

  const themeBackgrounds = {};
  const themeRings = {};
  const themeGrounds = {};
  const allBgIds = new Set();
  for (const t of THEMES) {
    allBgIds.add(t.bg);
    if (t.variants) t.variants.forEach(v => allBgIds.add(v.bg));
  }
  for (const id of allBgIds) {
    const img = new Image();
    img.src = `./assets/images/backgrounds/${id}.png`;
    themeBackgrounds[id] = img;
  }
  // Zann money background
  {
    const img = new Image();
    img.src = "./assets/images/backgrounds/zann.png";
    themeBackgrounds["zann"] = img;
  }
  for (const t of THEMES) {
    if (themeRings[t.id]) continue;
    const img = new Image();
    img.src = `./assets/sprites/frames/${t.ring}.png`;
    themeRings[t.id] = img;
  }
  const zannRingImg = new Image();
  zannRingImg.src = "./assets/sprites/frames/ring_zann.png";
  const zannPicks = [];
  for (let i = 0; i < 4; i++) {
    const img = new Image();
    img.src = `./assets/sprites/game/zann_pickaxe_${i}.png`;
    zannPicks[i] = img;
  }
  const frameBackDark = new Image();
  frameBackDark.src = "./assets/sprites/frames/frame_back_dark.png";

  for (const g of ["end", "hell", "deep_dark", "classic"]) {
    const img = new Image();
    img.src = `./assets/sprites/grounds/${g}.png`;
    themeGrounds[g] = img;
  }
  // Keep old theme block packs for dirt/stone if present
  const themeBlocks = {};
  for (const tid of ["inferno", "void", "frost", "forest", "celestial", "abyss", "aqua", "classic", "zann"]) {
    const pack = {};
    for (const kind of ["dirt", "stone", "hard"]) {
      for (let i = 0; i < 3; i++) {
        const img = new Image();
        img.src = `./assets/sprites/themes/${tid}/${kind}_${i}.png`;
        pack[`${kind}_${i}`] = img;
      }
    }
    const wall = new Image();
    wall.src = `./assets/sprites/themes/${tid}/wall.png`;
    pack.wall = wall;
    themeBlocks[tid] = pack;
  }
  // Map themes to block packs (existing theme sprites)
  const BLOCK_PACK_MAP = {
    hell: "inferno", end: "void", deep_dark: "frost", classic: "forest",
    portal_run: "celestial", cherry: "abyss", ocean: "aqua",
  };

  function currentTheme() { return THEMES[themeIndex]; }
  function currentBgId() {
    if (zannMode) return "zann";
    const t = currentTheme();
    if (t.variants && t.variants.length) {
      const v = t.variants[variantIndex % t.variants.length];
      if (v && v.bg) return v.bg;
    }
    return t.bg;
  }
  function applyThemeUI() {
    const t = currentTheme();
    const sel = document.querySelector("#themeSelect");
    if (sel) sel.value = t.id;
    const vwrap = document.querySelector("#variantWrap");
    const vsel = document.querySelector("#variantSelect");
    if (vwrap && vsel) {
      if (t.variants && t.variants.length) {
        vwrap.classList.remove("hidden");
        vsel.innerHTML = t.variants.map((v, i) =>
          `<option value="${i}">${v.name}</option>`).join("");
        vsel.value = String(variantIndex % t.variants.length);
      } else {
        vwrap.classList.add("hidden");
      }
    }
    // Pixel bet palette follows current world (or Zann)
    document.body.className = document.body.className
      .split(/\s+/)
      .filter(cl => cl && !cl.startsWith("theme-"))
      .join(" ");
    document.body.classList.add(zannMode ? "theme-zann" : ("theme-" + t.id));

    const btn = document.querySelector("#themeBtn");
    if (btn) btn.innerHTML = '<i class="chip-label">WORLD</i><span class="chip-value">' + t.name + "</span>";
    const bbtn = document.querySelector("#blockTexBtn");
    if (bbtn) bbtn.innerHTML = '<i class="chip-label">BLOCKS</i><span class="chip-value">' + (blockPackMode === 0 ? "THEMED" : "CLASSIC") + "</span>";
    const sbtn = document.querySelector("#shaderBtn");
    if (sbtn) sbtn.innerHTML = '<i class="chip-label">SHADER</i><span class="chip-value">' + (shadersOn ? "ON" : "OFF") + "</span>";
    const zbtn = document.querySelector("#zannBtn");
    if (zbtn) {
      zbtn.innerHTML = '<i class="chip-label">ZANN</i><span class="chip-value">' + (zannMode ? "ON" : "OFF") + "</span>";
      zbtn.classList.toggle("active-zann", zannMode);
    }
  }
  function setThemeById(id) {
    const i = THEMES.findIndex(t => t.id === id);
    if (i < 0) return;
    themeIndex = i;
    variantIndex = 0;
    try {
      localStorage.setItem("fp_theme", id);
      localStorage.setItem("fp_variant", "0");
    } catch (_) {}
  applyThemeUI();
    toast("Мир: " + currentTheme().name, true);
  }
  function setVariant(i) {
    variantIndex = i;
    try { localStorage.setItem("fp_variant", String(i)); } catch (_) {}
    applyThemeUI();
    const t = currentTheme();
    if (t.variants) toast("Фон: " + t.variants[i % t.variants.length].name, true);
  }
  function cycleTheme() {
    themeIndex = (themeIndex + 1) % THEMES.length;
    variantIndex = 0;
    try {
      localStorage.setItem("fp_theme", currentTheme().id);
      localStorage.setItem("fp_variant", "0");
    } catch (_) {}
    applyThemeUI();
    toast("Мир: " + currentTheme().name, true);
  }
  function themedSprite(kind, n) {
    const packId = zannMode
      ? "zann"
      : (blockPackMode === 1 ? "classic" : (BLOCK_PACK_MAP[currentTheme().id] || "classic"));
    const pack = themeBlocks[packId];
    if (!pack) {
      if (kind === "wall") return sprites.lava_wall;
      return sprites["lava_" + kind + "_" + (n % 3)] || sprites["lava_" + kind];
    }
    if (kind === "wall") return pack.wall;
    return pack[kind + "_" + (n % 3)];
  }

  function cycleBlockPack() {
    blockPackMode = blockPackMode === 0 ? 1 : 0;
    try { localStorage.setItem("fp_blockpack", String(blockPackMode)); } catch (_) {}
    applyThemeUI();
    toast(blockPackMode === 0 ? "Блоки: THEMED" : "Блоки: CLASSIC", true);
  }

  function cycleShaders() {
    shadersOn = !shadersOn;
    try { localStorage.setItem("fp_shaders", shadersOn ? "1" : "0"); } catch (_) {}
    applyThemeUI();
    toast(shadersOn ? "Shaders: ON" : "Shaders: OFF", true);
  }

  function cycleZann() {
    zannMode = !zannMode;
    try { localStorage.setItem("fp_zann", zannMode ? "1" : "0"); } catch (_) {}
    applyThemeUI();
    toast(zannMode ? "ZANN MODE ON" : "ZANN MODE OFF", true);
  }

  
  // iOS Safari: unlock AudioContext + samples on first gesture
  function iosAudioUnlock() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      // warm up HTMLAudioElements
      for (const a of Object.values(samples)) {
        try {
          a.muted = true;
          const p = a.play();
          if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
        } catch (_) {}
      }
    } catch (_) {}
  }
  ["pointerdown", "touchstart", "click"].forEach((ev) => {
    window.addEventListener(ev, function once() {
      iosAudioUnlock();
      window.removeEventListener(ev, once, true);
    }, true);
  });
  // Prevent iOS bounce / pinch-zoom on canvas
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());

  const $ = (s) => document.querySelector(s);
  const ui = {
    cash: $("#balanceValue"), win: $("#winValue"), bet: $("#betValue"),
    play: $("#playBtn"), plus: $("#plusBtn"), minus: $("#minusBtn"),
    pickCount: $("#pickCountBtn"),
    turbo: $("#turboBtn"), auto: $("#autoBtn"), bonus: $("#bonusBtn"),
    sound: $("#soundBtn"), settings: $("#settingsBtn"), theme: $("#themeBtn"), blockTex: $("#blockTexBtn"), shader: $("#shaderBtn"), zann: $("#zannBtn"), uiToggle: $("#uiToggleBtn"), toast: $("#toast"),
    dialog: $("#settingsDialog"), bonusDialog: $("#bonusDialog"), autoDialog: $("#autoDialog"),
    particles: $("#particlesToggle"), shake: $("#shakeToggle"),
  };

  const TYPE = {
    dirt:    { hp: 1, value: 0, top: "#9a6035", base: "#754329", dark: "#4f2e22" },
    stone:   { hp: 1, value: 0, top: "#6e7981", base: "#505a62", dark: "#354049" },
    hard:    { hp: 1, value: 0, top: "#59636f", base: "#3b4651", dark: "#25303b" },
    copper:  { hp: 5, value: .01, top: "#cb7950", base: "#9b5037", dark: "#5e342d" },
    redstone:{ hp: 10, value: .05, top: "#ef5845", base: "#92372f", dark: "#51272a" },
    gold:    { hp: 15, value: .2, top: "#ffd24f", base: "#c48a2f", dark: "#725023" },
    diamond: { hp: 20, value: 1, top: "#6cf3ec", base: "#25a9b4", dark: "#185c71" },
    emerald: { hp: 30, value: 5, top: "#78f07a", base: "#2aaa5d", dark: "#175e43" },
  };
  const TIER_HP=[100,150,200,400];
  const TIER_POWER=[2,3,4,6];
  const TIER_NAMES=["WOODEN","STONE","IRON","DIAMOND"];
  const pickColors = [
    { edge: "#e7e8db", face: "#b7b9aa", handle: "#8b4928", glow: "#fff" },
    { edge: "#f4f7ff", face: "#8b9ba7", handle: "#8b4928", glow: "#d8e6ef" },
    { edge: "#ffe38a", face: "#c89735", handle: "#77472a", glow: "#ffdd54" },
    { edge: "#b9ffff", face: "#38cbd1", handle: "#75452c", glow: "#61ffff" },
  ];

  let state = "menu";
  let stateTime = 0;
  let balance = 50000;
  let betIndex = 2;
  let win = 0;
  let turbo = false;
  let sound = true;
  let autoplay = false;
  let autoRemaining = 0;
  let crossStreak = 0;
  let wheelOutcome = -1;
  let bonusRound = false;
  let pickCount = 1;
  let wheelAngle = 0;
  let wheelStart = 0;
  let wheelTarget = 0;
  let towerOffset = 0;
  let cameraY = 0;
  let cameraShake = 0;
  let blocks = [];
  let generatedRows = 0;
  let particles = [];
  let labels = [];
  let last = performance.now();
  let seed = 12345;
  let audio = null;
  const samples = {};
  for (const name of ["spin","spin_stop","win","increase","tnt_01","dirt_01","dirt_02","dirt_03","stone_01","stone_02","stone_03","ore_hit_01","ore_hit_02","ore_break_01","crystal_hit_01","crystal_break_01"]) {
    samples[name] = new Audio(`./assets/sounds/${name}.ogg`);
    samples[name].preload = "auto";
  }
  let picks = [];
  let pick = newPick(0);

  function newPick(id=0) {
    return { id, alive:true, x: W / 2, y: WORLD_TOP - 58, vx: 0, vy: 0, angle: -.8, spin: 0, tier: 0, hp:100, maxHp:100, scale: 1, sizeLevel:0, sizeUntil:0, power: TIER_POWER[0], trail: [], hits: 0, progressY: WORLD_TOP - 58, progressTime: 0 };
  }
  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function refresh() {
    ui.cash.textContent = fmt(balance);
    ui.win.textContent = fmt(win);
    if (ui.win.parentElement) ui.win.parentElement.classList.toggle("is-zero", !win);
    ui.bet.textContent = fmt(bets[betIndex]);
  }
  function toast(text, visible = true) {
    ui.toast.textContent = text;
    ui.toast.classList.toggle("hidden", !visible);
  }
  function controls(enabled) {
    ui.play.disabled = !enabled;
    ui.plus.disabled = !enabled;
    ui.minus.disabled = !enabled;
    ui.pickCount.disabled = !enabled;
    ui.play.classList.toggle("busy", !enabled);
  }
  function tone(freq = 220, length = .05, volume = .025, type = "square") {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(volume, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + length);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + length);
    } catch (_) {}
  }
  function playSample(name, volume=.55, rate=1) {
    if(!sound||!samples[name])return;
    const a=samples[name].cloneNode();
    a.volume=volume;a.playbackRate=rate;
    a.play().catch(()=>{});
  }
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function chooseOutcome() {
    if(crossStreak>=7){crossStreak=0;return Math.floor(rnd()*4)}
    if(rnd()<.28){crossStreak++;return -1}
    crossStreak=0;
    // Random pickaxe: wooden / stone / iron / diamond
    const r=rnd();
    if (r < 0.40) return 0; // wooden
    if (r < 0.68) return 1; // stone
    if (r < 0.88) return 2; // iron
    return 3;               // diamond
  }

  function makeLevel() {
    seed = (Date.now() ^ bets[betIndex] * 31337) >>> 0;
    blocks = []; particles = []; labels = []; generatedRows=0;
    generateRows(INITIAL_ROWS);
  }

  function oreForDepth(row) {
    const pool=["copper"];
    if(row>=10)pool.push("redstone");
    if(row>=20)pool.push("gold");
    if(row>=30)pool.push("diamond");
    if(row>=40)pool.push("emerald");
    const weights=pool.map((_,i)=>Math.pow(.58,pool.length-1-i));
    let r=rnd()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<pool.length;i++){r-=weights[i];if(r<=0)return pool[i]}
    return pool[0];
  }

  function generateRows(targetRow) {
    const start=generatedRows,end=Math.max(start,targetRow);
    const added=[];
    for (let row = start; row < end; row++) {
      for (let col = 0; col < COLS; col++) {
        const edge = col === 0 || col === COLS - 1;

        // Solid field — no random holes / gaps
        let type = row < 10 ? "dirt" : row < 50 ? "stone" : "hard";
        if (edge) type = "wall";

        const baseHp = TYPE[type]?.hp || (type === "wall"||type==="slime" ? 999 : 1);
        // n=0 → grass (surface only); n=1/2 → plain earth for deeper dirt
        let variant = Math.floor(rnd() * 7);
        if (type === "dirt") {
          variant = (row === 0) ? 0 : (1 + Math.floor(rnd() * 2)); // grass only on first layer
        }
        const block={
          row, col, type, x: MINE_X + col * TILE, y: WORLD_TOP + row * TILE,
          hp: baseHp, maxHp: baseHp, n: variant, lastHit: {},
        };
        blocks.push(block);added.push(block);
      }
    }
    // Dense ore veins instead of isolated single resources.
    for(let row=start+2;row<end;row+=5+Math.floor(rnd()*4)){
      const ore=oreForDepth(row),cx=2+Math.floor(rnd()*(COLS-4)),cy=row+Math.floor(rnd()*3),radius=1+rnd()*1.45;
      for(const b of added){
        if(["wall"].includes(b.type))continue;
        const d=Math.hypot((b.col-cx)*.85,b.row-cy);
        if(d<=radius&&rnd()<.88){
          b.type=ore;b.hp=TYPE[ore].hp;b.maxHp=b.hp;
        }
      }
    }
    // Specials are layered on top of the generated veins.
    for(const b of added){
      if(b.type==="wall")continue;
      const r=rnd();
      if(b.row>6&&r<.01)b.type="tnt";
      else if(b.row>8&&r<.018)b.type="upgrade";
      else if(b.row>14&&r<.0195)b.type="workbench";
      else if(b.row>12&&r<.0285)b.type="slime";
      if(!TYPE[b.type]){b.hp=["slime"].includes(b.type)?999:1;b.maxHp=b.hp}
    }
    generatedRows=end;
  }

  function startRound(options={}) {
    if (state !== "menu" && state !== "result") return;
    const forcedTier=Number.isInteger(options.forcedTier)?options.forcedTier:null;
    bonusRound=forcedTier!==null;
    const wager = forcedTier!==null ? bets[betIndex]*10 : bets[betIndex];
    if (balance < wager) {
      autoplay=false;autoRemaining=0;ui.auto.style.filter="";controls(true);
      toast("NOT ENOUGH CASH");tone(90,.18,.05);return;
    }
    balance -= wager; win = 0; refresh();
    seed = (Date.now() ^ wager) >>> 0;
    state = "spin"; stateTime = 0;
    wheelStart = wheelAngle;
    wheelOutcome=forcedTier!==null?forcedTier:chooseOutcome();
    // Smooth multi-turn spin that lands with the awarded pickaxe centered
    const tierStep = (Math.PI * 2) / 4;
    const turns = turbo ? 4 : (6 + Math.floor(rnd() * 3));
    const landTier = wheelOutcome >= 0 ? wheelOutcome : Math.floor(rnd() * 4);
    // Align so landTier is at center when angle % 2PI == landTier * step
    const currentMod = ((wheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const targetMod = landTier * tierStep;
    let delta = targetMod - currentMod;
    if (delta < 0) delta += Math.PI * 2;
    wheelTarget = wheelAngle + turns * Math.PI * 2 + delta;
    picks=Array.from({length:pickCount},(_,i)=>newPick(i));
    if(wheelOutcome>=0){
      for(const p of picks){
        p.tier=wheelOutcome;p.power=TIER_POWER[p.tier];
        p.maxHp=TIER_HP[p.tier];p.hp=p.maxHp;
      }
    }
    pick=picks[0];
    controls(false); toast("",false);
    playSample("spin",.5,turbo?1.25:1);
  }

  function buildMine() {
    if(wheelOutcome<0){
      state="cross";stateTime=0;controls(false);playSample("spin_stop",.65);return;
    }
    makeLevel();
    towerStart = Math.max(520, H - WORLD_TOP + 30);
    towerOffset = towerStart;
    cameraY = 0;
    const side = Math.sin(wheelAngle) > 0 ? 1 : -1;
    for(let i=0;i<picks.length;i++){
      const p=picks[i],spread=(i-(picks.length-1)/2)*31,dir=i%2===0?side:-side;
      p.x=W/2+spread;p.y=WORLD_TOP-62-Math.abs(spread)*.12;
      p.vx=dir*(205+p.tier*18)+spread*1.3;p.vy=90+i*8;
      p.spin=dir*(7.8+p.tier*.45);p.progressY=p.y;p.progressTime=0;
    }
    pick=picks[0];
    state = "build"; stateTime = 0;
    toast("",false);
    playSample("spin_stop",.65);
  }
  function beginFall() {
    state = "fall"; stateTime = 0; towerOffset = 0;
    toast("", false);
  }
  function endRound() {
    if (state !== "fall") return;
    state = "result"; stateTime = 0;
    balance += win; refresh(); controls(!autoplay);
    toast("",false);
    if(win)playSample("win",.7);else tone(110,.15,.05);
  }

  function addWin(block, amount, text) {
    const before=win;
    win = Math.min(bets[betIndex]*160,win+amount);
    amount=win-before;
    refresh();
    if(amount<=0&&!text)return;
    if (!text && ["dirt", "stone", "hard"].includes(block.type)) return;
    if (labels.length >= 5) labels.shift();
    labels.push({ x: block.x + TILE / 2, y: block.y + TILE / 2, text: text || `+${fmt(amount)}`, life: 1.05, max: 1.05 });
  }
  function debris(x, y, color, count = 10, force = 1) {
    if (!ui.particles.checked) return;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, s = (40 + rnd() * 180) * force;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25, life: .35 + rnd() * .55, max: .9, size: 3 + Math.floor(rnd() * 6), color });
    }
  }
  function removeBlock(b, payout = true) {
    const i = blocks.indexOf(b);
    if (i < 0 || b.type === "wall" || b.type === "slime") return;
    blocks.splice(i, 1);
    const cx = b.x + TILE / 2, cy = b.y + TILE / 2;

    if (b.type === "tnt") {
      addWin(b, bets[betIndex] * .35, "BOOM!");
      debris(cx, cy, "#ff8b35", 38, 1.45); cameraShake = 18;
      pixelRing(cx, cy, "#ffb23d", 18, 1.7); pixelRing(cx, cy, "#ffffff", 10, 1); pixelRing(cx, cy, "#ff5a20", 12, .8);
      if (ui.particles.checked) particles.push({ kind: "flash", x: cx, y: cy, vx: 0, vy: 0, g: 0, life: .22, max: .22, size: TILE * 3, color: "#ffd9a0" });
      const victims = blocks.filter(v => !["wall","slime"].includes(v.type) && Math.hypot((v.x-b.x)/TILE,(v.y-b.y)/TILE) < 2.35);
      victims.slice(0, 22).forEach(v => {
        const j = blocks.indexOf(v);
        if (j >= 0) {
          blocks.splice(j, 1);
          if (TYPE[v.type]) win = Math.min(bets[betIndex]*160,win+bets[betIndex] * TYPE[v.type].value * .35);
          debris(v.x + TILE/2, v.y + TILE/2, TYPE[v.type]?.base || "#a77d52", 3); blockBreakFx(v, TYPE[v.type] || TYPE.dirt);
        }
      });
      refresh(); pick.vy += 260; playSample("tnt_01",.8);
      return;
    }
    if (b.type === "upgrade" || b.type === "workbench") {
      const before = pick.tier;
      if(b.type==="upgrade"){
        pick.sizeLevel=Math.min(3,pick.sizeLevel+1);
        pick.scale=[1,1.5,2,2.5][pick.sizeLevel];
        pick.sizeUntil=stateTime+3;
      }else{
        pick.tier=Math.min(3,pick.tier+1);
        pick.power=TIER_POWER[pick.tier];
        pick.maxHp=TIER_HP[pick.tier];
        pick.hp=pick.maxHp;
      }
      addWin(b, 0, b.type === "upgrade" ? `SIZE x${pick.scale}` : "FULL REPAIR!");
      debris(cx,cy,b.type === "upgrade" ? "#89ff4f" : "#ffbd55",22,1.2);pixelRing(cx,cy,b.type === "upgrade" ? "#b6ff7a" : "#ffd27a",14,1.3);pick.hitT=stateTime;
      cameraShake = 9; playSample("increase",.75);
      if (b.type==="workbench"&&before === pick.tier) labels.push({x:cx,y:cy-20,text:"FULL REPAIR",life:1,max:1});
      return;
    }

    const info = TYPE[b.type] || TYPE.dirt;
    const amount = payout ? bets[betIndex] * info.value : 0;
    if (amount) addWin(b, amount);
    debris(cx, cy, info.top, b.type === "dirt" ? 4 : 6);
    blockBreakFx(b, info);
    if(["copper","gold","redstone"].includes(b.type))playSample("ore_break_01",.38,.9+rnd()*.2);
    else if(["diamond","emerald"].includes(b.type))playSample("crystal_break_01",.42,.9+rnd()*.2);
    else if(b.type==="dirt")playSample(`dirt_0${1+Math.floor(rnd()*3)}`,.28,.9+rnd()*.18);
    else playSample(`stone_0${1+Math.floor(rnd()*3)}`,.3,.9+rnd()*.18);
  }

  function collidePick() {
    const half = (TILE * 0.48) * pick.scale;
    const probeRadius = 4.5 * pick.scale;
    const c = Math.cos(pick.angle), s = Math.sin(pick.angle);
    // The complete visible tool is collidable: both blade ends, center and handle.
    const localProbes = [
      [-.46,-.27],[-.32,-.35],[-.14,-.38],[.05,-.37],[.24,-.33],[.43,-.24],
      [-.02,-.12],[-.055,.04],[-.08,.2],[-.11,.36],[-.13,.47],[0,0]
    ];
    const probes = localProbes.map(([lx,ly]) => ({
      rx:(lx*c-ly*s)*half*2,
      ry:(lx*s+ly*c)*half*2,
    }));
    const nearby = blocks.filter(b => {
      if (b.y < pick.y - TILE - half || b.y > pick.y + TILE + half) return false;
      if (b.x < pick.x - TILE - half || b.x > pick.x + TILE + half) return false;
      return true;
    });
    let contacts = 0;
    for (const b of nearby) {
      let best = null;
      for (const p of probes) {
        const px=pick.x+p.rx, py=pick.y+p.ry;
        const left=b.x-probeRadius, right=b.x+TILE+probeRadius;
        const top=b.y-probeRadius, bottom=b.y+TILE+probeRadius;
        if(px<left||px>right||py<top||py>bottom)continue;
        const sides=[
          {d:px-left,nx:-1,ny:0},{d:right-px,nx:1,ny:0},
          {d:py-top,nx:0,ny:-1},{d:bottom-py,nx:0,ny:1},
        ];
        sides.sort((a,z)=>a.d-z.d);
        const hit={...sides[0],rx:p.rx,ry:p.ry};
        if(!best||hit.d<best.d)best=hit;
      }
      if(!best)continue;

      const vcx=pick.vx-pick.spin*best.ry;
      const vcy=pick.vy+pick.spin*best.rx;
      const vn=vcx*best.nx+vcy*best.ny;
      pick.x+=best.nx*(best.d+.7)*.75;
      pick.y+=best.ny*(best.d+.7)*.75;

      if(vn<0){
        const invI=1/(.22*Math.pow(half*2,2));
        const rn=best.rx*best.ny-best.ry*best.nx;
        const willBreak=!["wall","slime"].includes(b.type)&&(b.hp-pick.power<=0||["tnt","upgrade","workbench"].includes(b.type));
        const restitution=b.type==="slime"?1.06:(b.type==="wall"?.84:(willBreak?.46:.76));
        const impulse=-(1+restitution)*vn/(1+rn*rn*invI);
        pick.vx+=impulse*best.nx;
        pick.vy+=impulse*best.ny;
        pick.spin+=rn*impulse*invI;

        const tx=-best.ny,ty=best.nx;
        const vt=vcx*tx+vcy*ty;
        const rt=best.rx*ty-best.ry*tx;
        let friction=-vt/(1+rt*rt*invI);
        const maxF=Math.abs(impulse)*.12;
        friction=Math.max(-maxF,Math.min(maxF,friction));
        pick.vx+=friction*tx;
        pick.vy+=friction*ty;
        pick.spin+=rt*friction*invI;

        const impact=-vn;
        const lastHit=b.lastHit[pick.id]??-99;
        if(b.type!=="wall"&&impact>28&&stateTime-lastHit>.055){
          b.lastHit[pick.id]=stateTime;
          if(b.type==="slime"){
            pick.vx+=best.nx*(170+impact*.22);
            pick.vy+=best.ny*(170+impact*.22);
            pick.spin+=(rnd()>.5?1:-1)*2.4;
            debris(b.x+TILE/2,b.y+TILE/2,"#73f20e",10,.8);pixelRing(b.x+TILE/2,b.y+TILE/2,"#9dff3a",9,1.1);pick.hitT=stateTime;
            tone(360,.05,.025,"sine");
            contacts++;continue;
          }
          b.hp-=pick.power;pick.hits++;pick.hp=Math.max(0,pick.hp-pick.maxHp/250);pick.hitT=stateTime;b.hitT=stateTime;hitFx(pick,b,best);
          const cx=b.x+TILE/2,cy=b.y+TILE/2;
          if(b.hp<=0||["tnt","upgrade","workbench"].includes(b.type))removeBlock(b);
          else{
            debris(cx,cy,TYPE[b.type]?.top||"#b18a68",5,.7);
            cameraShake=Math.max(cameraShake,Math.min(8,impact*.018));
            if(["copper","gold","redstone"].includes(b.type))playSample("ore_hit_01",.25,.95+rnd()*.12);
            else if(["diamond","emerald"].includes(b.type))playSample("crystal_hit_01",.25,.95+rnd()*.12);
          }
        }
      }
      contacts++;
      if(contacts>=4)break;
    }
    pick.vx=Math.max(-620,Math.min(620,pick.vx));
    pick.vy=Math.max(-460,Math.min(820,pick.vy));
    pick.spin=Math.max(-14,Math.min(14,pick.spin));
    return contacts;
  }

  function simulatePick(p,sim){
    pick=p;
    if(!p.alive)return;
    if(p.sizeLevel>0&&stateTime>=p.sizeUntil){p.sizeLevel=0;p.scale=1}
    const steps=Math.max(1,Math.ceil(sim/.01)),step=sim/steps;
    let contactTotal=0;
    for(let i=0;i<steps;i++){
      p.vy+=465*step;p.x+=p.vx*step;p.y+=p.vy*step;p.angle+=p.spin*step;
      p.vx*=Math.pow(.998,step*60);p.spin*=Math.pow(.997,step*60);
      const left=MINE_X+TILE+12*p.scale,right=MINE_X+MINE_W-TILE-12*p.scale;
      if(p.x<left){p.x=left;p.vx=Math.abs(p.vx)*.86;p.spin-=1.4;cameraShake=3}
      if(p.x>right){p.x=right;p.vx=-Math.abs(p.vx)*.86;p.spin+=1.4;cameraShake=3}
      contactTotal+=collidePick();
      if(p.hp<=0)break;
    }
    if(p.y>p.progressY+TILE*.5){p.progressY=p.y;p.progressTime=0}else p.progressTime+=sim;
    if(p.progressTime>.75&&contactTotal>0){
      const blockers=blocks.filter(b=>!["wall","slime"].includes(b.type)&&b.y>=p.y-8&&b.y<p.y+TILE*1.35&&Math.abs(b.x+TILE/2-p.x)<TILE*1.15);
      if(blockers.length){blockers.sort((a,b)=>Math.abs(a.x+TILE/2-p.x)-Math.abs(b.x+TILE/2-p.x));removeBlock(blockers[0]);p.hp=Math.max(0,p.hp-p.maxHp/250)}
      p.vy=Math.max(310,p.vy+190);p.vx+=(rnd()>.5?1:-1)*(155+rnd()*110);p.spin+=(rnd()>.5?1:-1)*(4+rnd()*3);
      p.y+=5;p.progressY=p.y;p.progressTime=0;cameraShake=7;
    }
    speedFx(p);
    p.trail.unshift({x:p.x,y:p.y,angle:p.angle,scale:p.scale});p.trail.length=Math.min(6,p.trail.length);
    if(p.hp<=0){
      p.alive=false;p.hp=0;debris(p.x,p.y,pickColors[p.tier].glow,24,1.2);pixelRing(p.x,p.y,pickColors[p.tier].glow,16,1.4);pixelRing(p.x,p.y,"#ffffff",8,.8);cameraShake=11;tone(72,.2,.05);
    }
  }

  function update(dt) {
    stateTime += dt;
    const sim = dt * (turbo ? 1.45 : 1);
    if (state === "menu") wheelAngle += dt * .08;
    if (state === "spin") {
      const duration = turbo ? 0.9 : 2.4;
      const t = Math.min(1, stateTime / duration);
      // ultra-smooth ease-out (quintic) — fast start, very soft landing
      const ease = 1 - Math.pow(1 - t, 5);
      wheelAngle = wheelStart + (wheelTarget - wheelStart) * ease;
      if (t >= 1) buildMine();
    }
    if (state === "build") {
      const t = Math.min(1, stateTime / (turbo ? .35 : .72));
      towerOffset = towerStart * (1 - (1 - Math.pow(1 - t, 3)));
      if (t >= 1) beginFall();
    }
    if(state==="cross"&&stateTime>(turbo?.45:1)){
      state="result";stateTime=0;refresh();controls(!autoplay);tone(95,.16,.04);
    }
    if (state === "fall") {
      for(const p of picks)simulatePick(p,sim);
      const alive=picks.filter(p=>p.alive);
      if(!alive.length){pick=picks[0];endRound()}
      else{
        pick=alive.reduce((a,b)=>a.y>b.y?a:b);
        const depthRow=Math.floor((pick.y-WORLD_TOP)/TILE);
        if(depthRow>generatedRows-35)generateRows(generatedRows+70);
      }
      const target = Math.max(0, (pick?.y||0) - H * .39);
      cameraY += (target - cameraY) * Math.min(1, sim * 3.7);
    }
    if (state === "result" && stateTime > (autoplay ? 1.2 : 2.7)) {
      state = "menu"; stateTime = 0; cameraY = 0; towerOffset = 0; toast("",false);
      if(autoplay){
        if(autoRemaining>0)autoRemaining--;
        if(autoRemaining===0){autoplay=false;ui.auto.style.filter="";controls(true)}
        else setTimeout(()=>startRound(),250);
      }else controls(true);
    }

    for (const p of particles) {
      p.x += p.vx * sim; p.y += p.vy * sim; p.vy += (p.g ?? 300) * sim; p.vx *= .985; p.life -= sim;
    }
    particles = particles.filter(p => p.life > 0);
    if (particles.length > 480) particles.splice(0, particles.length - 480);
    for (const l of labels) { l.y -= 38 * sim; l.life -= sim; }
    labels = labels.filter(l => l.life > 0);
    cameraShake *= Math.pow(.06, dt);
  }


  /* =====================================================================
     PIXEL FX + DETAILED SHADING
     ===================================================================== */
  const snap4 = (v) => Math.round(v / 4) * 4;
  const hexRGB = (hex) => {
    const h = (hex || "#c080ff").replace("#", "");
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  };
  let lightPicks = [];
  let lightRGB = "255,205,130";
  let accentRGB = "192,128,255";
  const visGrid = new Map();
  const ORE_TYPES = ["copper", "gold", "redstone", "diamond", "emerald"];

  function pixelRing(x, y, color, n = 10, power = 1) {
    if (!ui.particles.checked) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .2;
      const sp = (300 + Math.random() * 60) * power;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: .34, max: .34, size: 8, color, shrink: true });
    }
  }
  function hitFx(p, b, best) {
    if (!ui.particles.checked) return;
    const px = p.x + best.rx, py = p.y + best.ry;
    for (let i = 0; i < 3; i++) {
      const t = (Math.random() - .5) * 2, sp = 120 + Math.random() * 170;
      particles.push({ x: px, y: py, vx: best.nx * sp - best.ny * t * 130, vy: best.ny * sp + best.nx * t * 130, g: 420,
        life: .2 + Math.random() * .16, max: .36, size: 4, color: Math.random() < .5 ? "#ffffff" : "#ffe9a8" });
    }
  }
  function blockBreakFx(b, info) {
    if (!ui.particles.checked) return;
    const cx = b.x + TILE / 2, cy = b.y + TILE / 2;
    const cols = [info.top, info.base, info.dark, info.base, info.top];
    // the block shatters into a 3x3 grid of pixel chunks
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
      const dx = gx - 1, dy = gy - 1, sp = 90 + Math.random() * 130;
      particles.push({
        x: b.x + gx * 16 + 4, y: b.y + gy * 16 + 4,
        vx: (dx + (Math.random() - .5) * .9) * sp, vy: (dy - .9 + (Math.random() - .5) * .9) * sp,
        g: 560, life: .5 + Math.random() * .35, max: .85,
        size: Math.random() < .4 ? 12 : 8, color: cols[(gx + gy * 2) % cols.length], shrink: true,
      });
    }
    particles.push({ kind: "flash", x: cx, y: cy, vx: 0, vy: 0, g: 0, life: .14, max: .14, size: TILE, color: "#ffffff" });
    pixelRing(cx, cy, info.top, 8, .55);
    if (ORE_TYPES.includes(b.type)) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({ kind: "star", x: cx, y: cy, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 60, g: 120,
          life: .45 + Math.random() * .25, max: .7, size: 8, color: i % 2 ? "#ffffff" : info.top });
      }
    }
  }
  function speedFx(p) {
    const spd = Math.hypot(p.vx, p.vy);
    p.speed = spd;
    if (state === "fall" && ui.particles.checked && spd > 230) {
      const n = spd > 560 ? 3 : spd > 380 ? 2 : 1, col = pickColors[p.tier];
      const nx = -p.vx / spd, ny = -p.vy / spd;
      for (let i = 0; i < n; i++) {
        particles.push({
          x: p.x + nx * (10 + i * 9) * p.scale + (Math.random() - .5) * 14,
          y: p.y + ny * (10 + i * 9) * p.scale + (Math.random() - .5) * 14,
          vx: nx * 40, vy: ny * 40, g: 0, life: .26 + Math.random() * .14, max: .4,
          size: Math.random() < .35 ? 8 : 4, color: Math.random() < .5 ? col.glow : col.edge, shrink: true,
        });
      }
    }
    if (spd > 600 && !p.boosted) {
      p.boosted = true;
      pixelRing(p.x, p.y, pickColors[p.tier].glow, 12, 1);
      cameraShake = Math.max(cameraShake, 5);
    } else if (spd < 430) p.boosted = false;
  }
  function drawParticles() {
    const oy = -cameraY + towerOffset;
    for (const p of particles) {
      const k = Math.max(0, p.life / p.max), a = Math.ceil(k * 4) / 4;
      ctx.globalAlpha = a;
      if (p.kind === "flash") {
        ctx.globalAlpha = a * .6; ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y + oy - p.size / 2), p.size, p.size);
        continue;
      }
      const px = snap4(p.x), py = snap4(p.y + oy);
      ctx.fillStyle = p.color;
      if (p.kind === "star") {
        const s = k > .5 ? 8 : 4;
        ctx.fillRect(px - s, py - 2, s * 2, 4); ctx.fillRect(px - 2, py - s, 4, s * 2);
        continue;
      }
      const sz = p.shrink ? Math.max(4, snap4(p.size * (.35 + .65 * k))) : Math.max(3, Math.round(p.size));
      ctx.fillRect(px, py, sz, sz);
      if (sz >= 8) { ctx.fillStyle = "rgba(255,255,255,.38)"; ctx.fillRect(px, py, 4, 4); }
    }
    ctx.globalAlpha = 1;
  }
  function drawSpeedFx(p) {
    const spd = p.speed || 0;
    if (spd < 330) return;
    const sy = p.y - cameraY + towerOffset, f = Math.min(1, (spd - 330) / 450), col = pickColors[p.tier];
    const vert = Math.abs(p.vy) >= Math.abs(p.vx), dir = vert ? Math.sign(p.vy) : Math.sign(p.vx);
    ctx.save();
    ctx.fillStyle = col.glow;
    for (let i = 0; i < 7; i++) {
      const seed = i * 37.1 + Math.floor(stateTime * 14) * 13.7;
      const fr = Math.sin(seed) * 43758.5453, frac = fr - Math.floor(fr);
      const lat = (frac - .5) * 56 * p.scale, len = snap4(16 + f * 48 * (.45 + ((i * 7) % 5) / 5)), gap = snap4(16 + frac * 14);
      ctx.globalAlpha = .22 + .5 * f;
      if (vert) ctx.fillRect(snap4(p.x + lat), snap4(dir > 0 ? sy - gap - len : sy + gap), 4, len);
      else ctx.fillRect(snap4(dir > 0 ? p.x - gap - len : p.x + gap), snap4(sy + lat), len, 4);
    }
    // orbiting pixel sparks: more of them the faster the pickaxe goes
    const n = Math.min(8, Math.floor(spd / 110)), r = (34 + f * 8) * p.scale;
    for (let j = 0; j < n; j++) {
      const a = stateTime * 7 + (j / n) * Math.PI * 2;
      ctx.globalAlpha = .85; ctx.fillStyle = j % 2 ? "#ffffff" : col.glow;
      ctx.fillRect(snap4(p.x + Math.cos(a) * r), snap4(sy + Math.sin(a) * r), 4, 4);
    }
    ctx.restore();
  }
  function pickGlint(x, sy, angle, size, seed) {
    const ph = (stateTime * .9 + seed * .37) % 1.7;
    if (ph > .27) return;
    const f = Math.floor(ph / .09), a = [4, 8, 4][f];
    const lx = f === 1 ? .43 : -.46, ly = f === 1 ? -.24 : -.27, c = Math.cos(angle), s = Math.sin(angle);
    const gx = snap4(x + (lx * c - ly * s) * size), gy = snap4(sy + (lx * s + ly * c) * size);
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
    ctx.fillRect(gx - a, gy - 2, a * 2, 4); ctx.fillRect(gx - 2, gy - a, 4, a * 2);
    ctx.restore();
  }
  function drawTurboStreaks() {
    ctx.save(); ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 16; i++) {
      const x = snap4(((i * 97.3) % W)), len = snap4(40 + (i % 4) * 28);
      const y = snap4(H - (((i * 131.7) + stateTime * (900 + (i % 5) * 220)) % (H + 160)) + 20);
      ctx.globalAlpha = .08 + (i % 3) * .03;
      ctx.fillRect(x, y, 4, len);
    }
    ctx.restore();
  }

  // ---- tile lighting: bevel, grain, pick light, rim-light on mined edges, ore twinkle ----
  function shadeTile(b, y) {
    const type = b.type;
    if (type === "tnt" || type === "slime" || type === "upgrade" || type === "workbench" || type === "wall") return;
    const x = b.x, cx = x + TILE / 2, cy = y + TILE / 2;
    let light = 0;
    for (const p of lightPicks) {
      const d = Math.hypot(cx - p.x, cy - (p.y - cameraY + towerOffset));
      light = Math.max(light, 1 - d / (250 * Math.sqrt(p.scale)));
    }
    light = Math.max(0, light);
    // stepped (pixel-style) darkness: ambient + depth - pick light
    const dark = Math.round(Math.max(0, .15 + Math.min(.3, b.row * .003) - light * .46) * 10) / 10;
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(x, y, TILE, TILE); }
    const lq = Math.round(light * light * 5) / 5 * .16;
    if (lq > 0) { ctx.fillStyle = `rgba(${lightRGB},${lq})`; ctx.fillRect(x, y, TILE, TILE); }
    // bevel
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(x, y, TILE, 2); ctx.fillRect(x, y, 2, TILE);
    ctx.fillStyle = "rgba(0,0,0,.26)"; ctx.fillRect(x, y + TILE - 3, TILE, 3); ctx.fillRect(x + TILE - 3, y, 3, TILE);
    // exposed edges next to mined-out space
    const r = b.row, c = b.col;
    if (!visGrid.has((r - 1) * 16 + c)) { ctx.fillStyle = "rgba(255,255,255,.24)"; ctx.fillRect(x, y, TILE, 3); }
    if (!visGrid.has((r + 1) * 16 + c)) { ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.fillRect(x, y + TILE - 6, TILE, 6); }
    if (!visGrid.has(r * 16 + c - 1)) { ctx.fillStyle = `rgba(${accentRGB},.34)`; ctx.fillRect(x, y, 3, TILE); }
    if (!visGrid.has(r * 16 + c + 1)) { ctx.fillStyle = `rgba(${accentRGB},.34)`; ctx.fillRect(x + TILE - 3, y, 3, TILE); }
    // grain
    const s = ((b.row * 73856093) ^ (b.col * 19349663)) >>> 0;
    for (let k = 0; k < 3; k++) {
      const v = (s >>> (k * 8)) & 255;
      ctx.fillStyle = (v & 1) ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.15)";
      ctx.fillRect(x + (v & 15) * 3, y + (v >> 4) * 3, 3, 3);
    }
    // ore twinkle
    if (ORE_TYPES.includes(type)) {
      const ph = (stateTime * .8 + (s & 255) / 255 * 4) % 4;
      if (ph < .3) {
        const a = [3, 6, 3][Math.floor(ph / .1)], sx = x + 10 + ((s >>> 5) & 31), sy = y + 10 + ((s >>> 10) & 23);
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.fillRect(sx - a, sy, a * 2 + 3, 3); ctx.fillRect(sx, sy - a, 3, a * 2 + 3);
      }
    }
  }
  function drawTile(b) {
    if (b.type === "wall") return;
    const y = b.y - cameraY + towerOffset;
    if (y < -TILE || y > H + TILE) return;
    const since = stateTime - (b.hitT ?? -9);
    if (since < .12) { ctx.save(); ctx.translate(Math.floor(since * 50) % 2 ? 2 : -2, 0); drawTileBase(b); ctx.restore(); }
    else drawTileBase(b);
    if (shadersOn) shadeTile(b, y);
  }
  // stepped glow around every pick + drifting dust + stepped depth fog
  function drawMineLight() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of lightPicks) {
      const sy = p.y - cameraY + towerOffset, base = 150 * Math.sqrt(p.scale), boost = 1 + Math.min(1, (p.speed || 0) / 520);
      [1, .72, .48, .28].forEach((k, i) => {
        ctx.fillStyle = `rgba(${lightRGB},${.032 * boost})`;
        ctx.beginPath(); ctx.arc(snap4(p.x), snap4(sy), base * k * (1 + .04 * Math.sin(stateTime * 6 + i)), 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.fillStyle = `rgba(${accentRGB},.55)`;
    for (let i = 0; i < 26; i++) {
      const tw = .5 + .5 * Math.sin(stateTime * 2.4 + i * 1.9);
      if (tw < .4) continue;
      const x = MINE_X + TILE + ((i * 97) % (MINE_W - 2 * TILE));
      const y = ((((i * 83.7) - cameraY * .5 + stateTime * (5 + (i % 4) * 3)) % H) + H) % H;
      ctx.globalAlpha = tw * .8;
      ctx.fillRect(snap4(x), snap4(y), i % 3 ? 4 : 8, i % 3 ? 4 : 8);
    }
    ctx.restore();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(0,0,0,${.045 * (6 - i)})`; ctx.fillRect(0, H - (i + 1) * 30, W, 30); }
  }

  // ---- full-screen pixel overlay: scanlines + ordered-dither vignette (cached) ----
  let pxOverlay = null, pxOverlayKey = "";
  function getPxOverlay() {
    const key = W + "x" + H;
    if (pxOverlay && pxOverlayKey === key) return pxOverlay;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,.07)";
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    g.fillStyle = "rgba(0,0,0,.42)";
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const d = Math.min(1.4, Math.sqrt(dx * dx * .9 + dy * dy * .8));
      const v = Math.max(0, (d - .62) * 1.45), t = (bayer[((y >> 2) & 3) * 4 + ((x >> 2) & 3)] + .5) / 16;
      if (v > t) g.fillRect(x, y, 4, 4);
    }
    pxOverlay = c; pxOverlayKey = key; return c;
  }
  // ---- stepped light shafts + pixel fireflies (theme-tinted) ----
  function drawPixelAtmos() {
    const st = stateTime, mineMode = state === "fall" || state === "build";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const reach = H * .62, k = mineMode ? .55 : 1;
    for (let b = 0; b < 3; b++) {
      const baseX = W * (.12 + .3 * b) + Math.sin(st * .3 + b * 2) * 34;
      for (let y = 0; y < reach; y += 8) {
        const fade = 1 - y / reach;
        ctx.fillStyle = `rgba(${accentRGB},${.045 * fade * k * (.7 + .3 * Math.sin(st * .8 + b))})`;
        ctx.fillRect(snap4(baseX + y * .38), y, snap4(40 + y * .14), 8);
      }
    }
    for (let i = 0; i < 18; i++) {
      const tw = .5 + .5 * Math.sin(st * 3 + i * 1.7);
      if (tw < .35) continue;
      const x = ((i * 131.7) + Math.sin(st * .5 + i) * 18 + W) % W;
      const y = ((((i * 89.3) - st * (10 + (i % 5) * 4)) % H) + H) % H;
      ctx.globalAlpha = tw * .85; ctx.fillStyle = i % 4 === 0 ? "#ffffff" : `rgb(${accentRGB})`;
      ctx.fillRect(snap4(x), snap4(y), 4, 4);
    }
    ctx.restore();
  }
  function pixelStars(x, y) {
    ctx.save(); ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 10; i++) {
      const ph = (stateTime * .7 + i * .37) % 1.6;
      if (ph > .3) continue;
      const a = [4, 8, 4][Math.floor(ph / .1)], ang = i / 10 * Math.PI * 2 + i, r = 205 + (i % 3) * 18;
      const px = snap4(x + Math.cos(ang) * r), py = snap4(y + Math.sin(ang) * r);
      ctx.fillRect(px - a, py - 2, a * 2, 4); ctx.fillRect(px - 2, py - a, 4, a * 2);
    }
    ctx.restore();
  }

  function rect(x,y,w,h,c) { ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  function sprite(name,x,y,w,h,angle=0,alpha=1,center=false) {
    const img=sprites[name];
    if(!img||!img.complete||!img.naturalWidth)return false;
    ctx.save();ctx.globalAlpha=alpha;
    if(center){ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.drawImage(img,-w/2,-h/2,w,h)}
    else if(angle){ctx.translate(Math.round(x+w/2),Math.round(y+h/2));ctx.rotate(angle);ctx.drawImage(img,-w/2,-h/2,w,h)}
    else ctx.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
    ctx.restore();return true;
  }
  function drawSky() {
    const t = currentTheme();
    const bg = themeBackgrounds[currentBgId()];

    // 1) Cover-fill background across the whole 16:9 canvas (no black bars)
    if (bg && bg.complete && bg.naturalWidth) {
      const srcW = bg.naturalWidth, srcH = bg.naturalHeight;
      const scale = Math.max(W / srcW, H / srcH); // cover
      const dw = Math.round(srcW * scale);
      const dh = Math.round(srcH * scale);
      const dx = Math.round((W - dw) / 2);
      const dy = Math.round((H - dh) / 2);
      ctx.drawImage(bg, dx, dy, dw, dh);

      // 2) Soft blurred side panels: darken + edge fade instead of hard black bars
      // Left side blur-vignette
      const sideW = Math.max(80, Math.round((W - Math.min(W, srcW * (H / srcH))) / 2) + 60);
      const gL = ctx.createLinearGradient(0, 0, sideW, 0);
      gL.addColorStop(0, "rgba(0,0,0,0.72)");
      gL.addColorStop(0.45, "rgba(0,0,0,0.35)");
      gL.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gL;
      ctx.fillRect(0, 0, sideW, H);
      // Right side
      const gR = ctx.createLinearGradient(W, 0, W - sideW, 0);
      gR.addColorStop(0, "rgba(0,0,0,0.72)");
      gR.addColorStop(0.45, "rgba(0,0,0,0.35)");
      gR.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gR;
      ctx.fillRect(W - sideW, 0, sideW, H);

      // Extra soft center-edge haze for depth
      const haze = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      haze.addColorStop(0, "rgba(0,0,0,0)");
      haze.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Fallback solid theme sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      if (t.id === "end" || t.id === "cherry") { sky.addColorStop(0, "#0a0614"); sky.addColorStop(1, "#1a1030"); }
      else if (t.id === "ocean") { sky.addColorStop(0, "#041820"); sky.addColorStop(1, "#0a3050"); }
      else if (t.id === "cyber") { sky.addColorStop(0, "#050510"); sky.addColorStop(1, "#0a1020"); }
      else if (t.id === "aether" || t.id === "portal_run") { sky.addColorStop(0, "#101828"); sky.addColorStop(1, "#1a2840"); }
      else if (t.id === "classic") { sky.addColorStop(0, "#1a2818"); sky.addColorStop(1, "#0a1810"); }
      else if (t.id === "deep_dark") { sky.addColorStop(0, "#04080a"); sky.addColorStop(1, "#0a1820"); }
      else if (t.id === "hell") { sky.addColorStop(0, "#1a0808"); sky.addColorStop(1, "#3a1010"); }
      else { sky.addColorStop(0, "#09070c"); sky.addColorStop(1, "#19090d"); }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
    }

    // 3) Themed ambient particles — unique motion & look per style
    drawThemeParticles(t);
  }

  function drawThemeParticles(t) {
    const id = t.id;
    ctx.save();
    const count = (id === "hell" || id === "end" || id === "aether" || id === "portal_run") ? 90 : 55;

    for (let i = 0; i < count; i++) {
      const seed = i * 97.13;
      let x, y, sz, col, alpha;

      if (id === "hell") {
        // Rising embers
        x = ((seed * 13 + stateTime * (18 + i % 5 * 6)) % (W + 40)) - 20;
        y = H - ((seed * 7 + stateTime * (40 + i % 4 * 25)) % (H + 60));
        sz = 1.5 + (i % 5 === 0 ? 3 : 1);
        col = i % 4 === 0 ? "#ffd06a" : (i % 3 === 0 ? "#ff6020" : "#ff3010");
        alpha = 0.35 + 0.45 * Math.abs(Math.sin(stateTime * 3 + i));
      } else if (id === "end" || id === "cherry") {
        // Floating void motes + crystal glints
        x = ((seed * 11 + stateTime * (8 + (i % 3) * 3)) % (W + 30)) - 15;
        y = ((seed * 17 - stateTime * (6 + i % 4 * 2) + 2000) % (H + 40)) - 20;
        sz = 1.2 + (i % 6 === 0 ? 3.5 : (i % 3 === 0 ? 2 : 1));
        col = i % 5 === 0 ? "#fff0ff" : (i % 3 === 0 ? "#e0a0ff" : "#9040ff");
        alpha = 0.3 + 0.5 * Math.abs(Math.sin(stateTime * 2.2 + i * 0.7));
      } else if (id === "deep_dark") {
        // Falling snow / frost
        x = ((seed * 19 + stateTime * (12 + i % 4 * 4) + Math.sin(stateTime + i) * 20) % (W + 30)) - 15;
        y = ((seed * 23 + stateTime * (25 + i % 5 * 8)) % (H + 50)) - 25;
        sz = 1.5 + (i % 4 === 0 ? 2.5 : 0.8);
        col = i % 3 === 0 ? "#ffffff" : "#a0e8ff";
        alpha = 0.4 + 0.35 * Math.abs(Math.sin(stateTime * 1.5 + i));
      } else if (id === "classic") {
        // Floating leaves / pollen
        const sway = Math.sin(stateTime * 1.4 + i * 0.6) * 30;
        x = ((seed * 15 + stateTime * (10 + i % 3 * 3) + sway) % (W + 40)) - 20;
        y = ((seed * 21 - stateTime * (8 + i % 4 * 3) + 1800) % (H + 40)) - 20;
        sz = 2 + (i % 5 === 0 ? 2 : 0);
        col = i % 4 === 0 ? "#c8ff80" : (i % 3 === 0 ? "#60ff60" : "#a0e040");
        alpha = 0.35 + 0.4 * Math.abs(Math.sin(stateTime * 1.8 + i));
      } else if (id === "portal_run" || id === "aether") {
        // Twinkling golden stars
        x = ((seed * 31) % W);
        y = ((seed * 47) % H);
        const tw = 0.5 + 0.5 * Math.sin(stateTime * (2 + i % 5) + i);
        sz = (1 + (i % 5 === 0 ? 2.5 : 0.5)) * tw;
        col = i % 4 === 0 ? "#ffffff" : (i % 3 === 0 ? "#ffe080" : "#ffd040");
        alpha = 0.25 + 0.55 * tw;
      } else if (id === "ocean") {
        // Rising bubbles
        x = ((seed * 13 + Math.sin(stateTime * 0.8 + i) * 15) % (W + 20)) - 10;
        y = H - ((seed * 9 + stateTime * (20 + i % 5 * 12)) % (H + 40));
        sz = 1.5 + (i % 4 === 0 ? 3 : 1);
        col = i % 3 === 0 ? "#e0f8ff" : "#40c0ff";
        alpha = 0.3 + 0.4 * Math.abs(Math.sin(stateTime * 2 + i));
      } else if (id === "cyber") {
        // Digital rain / neon dots
        x = ((i * 37) % W);
        y = ((seed * 11 + stateTime * (50 + i % 7 * 20)) % (H + 30)) - 15;
        sz = 1.2 + (i % 8 === 0 ? 2.5 : 0.5);
        col = i % 5 === 0 ? "#ffffff" : (i % 3 === 0 ? "#00ffe0" : "#00c0ff");
        alpha = 0.35 + 0.4 * Math.abs(Math.sin(stateTime * 4 + i));
      } else if (id === "original") {
        // Cosmic starfield drift
        x = ((seed * 41 + stateTime * (5 + i % 3)) % W);
        y = ((seed * 53 + stateTime * (3 + i % 4)) % H);
        const tw = 0.4 + 0.6 * Math.sin(stateTime * (1.5 + i % 6) + i * 1.3);
        sz = (1 + (i % 7 === 0 ? 2.8 : 0.4)) * tw;
        col = i % 5 === 0 ? "#ffffff" : (i % 3 === 0 ? "#c0a0ff" : "#8060ff");
        alpha = 0.2 + 0.55 * tw;
      } else {
        // Default soft motes
        x = ((seed * 17 + stateTime * 12) % (W + 20)) - 10;
        y = ((seed * 23 - stateTime * 8 + 1500) % (H + 20)) - 10;
        sz = 1.5 + (i % 4 === 0 ? 2 : 0);
        col = t.particle || "#c8ffc0";
        alpha = 0.35 + 0.35 * Math.abs(Math.sin(stateTime * 2 + i));
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGround() {
    // Intentionally empty: menu/result shows only pure background + ring + pickaxe + UI.
    // Ground tiles were creating noisy texture bands over the portrait backgrounds.
  }

  function drawWheel() {
    const x = W / 2, y = RING_Y;
    const t = currentTheme();
    const accent = t.accent || t.particle || "#c080ff";
    const pulse = 0.85 + 0.15 * Math.sin(stateTime * 2.2);
    ctx.save();
    ctx.translate(x, y); ctx.scale(1.06, 1.06); ctx.translate(-x, -y);

    // Large ambient magical glow (premium portal)
    try {
      const glowR = 220 + 30 * pulse;
      const glow = ctx.createRadialGradient(x, y, 30, x, y, glowR);
      const rgb = accent.startsWith("#") ? accent : "#c080ff";
      // simple hex to rgba helper inline
      let r=192,g=128,b=255;
      if (rgb.length >= 7) {
        r = parseInt(rgb.slice(1,3),16)||192;
        g = parseInt(rgb.slice(3,5),16)||128;
        b = parseInt(rgb.slice(5,7),16)||255;
      }
      glow.addColorStop(0, `rgba(${r},${g},${b},${0.55 * pulse})`);
      glow.addColorStop(0.45, `rgba(${r},${g},${b},0.18)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    } catch (_) {}

    // Dark center disc with slight rotation
    if (frameBackDark && frameBackDark.complete && frameBackDark.naturalWidth) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(wheelAngle * 0.35);
      ctx.drawImage(frameBackDark, -105, -105, 210, 210);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(6,4,12,0.94)";
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.fill();
      // inner energy ring
      ctx.strokeStyle = accent + "88";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Ring: Zann coin ring when mode on, else themed
    const ring = (zannMode && zannRingImg && zannRingImg.complete && zannRingImg.naturalWidth)
      ? zannRingImg
      : themeRings[t.id];
    if (ring && ring.complete && ring.naturalWidth) {
      ctx.save();
      ctx.translate(x, y);
      const rs = zannMode ? 360 : 400;
      ctx.globalAlpha = 0.35 * pulse;
      ctx.drawImage(ring, -rs / 2 - 8, -rs / 2 - 8, rs + 16, rs + 16);
      ctx.globalAlpha = 1;
      ctx.drawImage(ring, -rs / 2, -rs / 2, rs, rs);
      ctx.restore();
    } else if (sprites.frame_lava && sprites.frame_lava.complete) {
      sprite("frame_lava", x, y, 340, 343, 0, 1, true);
    } else {
      // rich procedural magical portal ring
      ctx.save();
      ctx.translate(x, y);
      const baseR = 145;
      // outer stone-like band
      ctx.strokeStyle = "#2a2438";
      ctx.lineWidth = 28;
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      ctx.stroke();
      // glowing core ring
      ctx.strokeStyle = accent;
      ctx.lineWidth = 10;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, baseR - 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // crystal points
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + wheelAngle * 0.1;
        const cx = Math.cos(a) * (baseR + 18);
        const cy = Math.sin(a) * (baseR + 18);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 10, cy);
        ctx.lineTo(cx, cy + 14);
        ctx.lineTo(cx - 10, cy);
        ctx.closePath();
        ctx.fill();
      }
      // inner bright rim
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, baseR - 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Smooth pickaxe spin reel (wood / stone / iron / diamond) — not a text scroll
    if (state === "result" && wheelOutcome < 0) {
      sprite("no", x, y, 74, 74, 0, 1, true);
    } else if (state === "spin") {
      drawPickaxeReel(x, y, wheelAngle, wheelOutcome);
    } else {
      // menu / result: show awarded pickaxe gently rotating
      const showTier = (wheelOutcome >= 0 ? wheelOutcome : ((pick && pick.tier) || 0));
      drawPick(x, y + Math.round(Math.sin(stateTime * 2.2) * 2) * 3, -0.72 + wheelAngle * 0.15, 1.45, showTier, false);
    }

    // Orbiting magical particles / energy wisps around the portal
    ctx.save();
    for (let i = 0; i < 18; i++) {
      const ang = stateTime * (0.4 + (i % 5) * 0.07) + (i / 18) * Math.PI * 2;
      const rad = 175 + 25 * Math.sin(stateTime * 1.5 + i);
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad * 0.92;
      const sz = 2 + (i % 3);
      ctx.globalAlpha = 0.35 + 0.45 * Math.sin(stateTime * 3 + i);
      ctx.fillStyle = (i % 4 === 0) ? "#ffffff" : accent;
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    pixelStars(x, y);

    // Side arrows (subtle)
    const arrowCol = accent;
    arrow(x - 158, y, Math.PI, arrowCol);
    arrow(x + 158, y, 0, arrowCol);

    ctx.restore();

    // Decorative ore panel to the right of the portal (matches reference style)
    drawOrePanel(W - 96 - 28, y - 225 - 132, t);
  }

  function drawOrePanel(px, py, t) {
    const ores = [
      { name: "copper",   label: "Cu" },
      { name: "redstone", label: "Rs" },
      { name: "gold",     label: "Au" },
      { name: "diamond",  label: "Di" },
      { name: "emerald",  label: "Em" },
      { name: "tnt",      label: "TNT" },
    ];
    const cell = 36;
    const cols = 2;
    const pad = 8;
    const panelW = cols * cell + pad * 2 + 8;
    const panelH = Math.ceil(ores.length / cols) * cell + pad * 2 + 8;
    // panel background
    ctx.save();
    ctx.globalAlpha = 0.92;
    // dark fantasy frame
    ctx.fillStyle = "rgba(8,6,14,0.88)";
    ctx.strokeStyle = (t.accent || t.particle || "#c080ff") + "cc";
    ctx.lineWidth = 3;
    roundRect(px, py, panelW, panelH, 10);
    ctx.fill();
    ctx.stroke();
    // inner glow line
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    roundRect(px + 3, py + 3, panelW - 6, panelH - 6, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // ore icons
    ores.forEach((o, i) => {
      const cx = px + pad + 4 + (i % cols) * cell + cell / 2;
      const cy = py + pad + 4 + Math.floor(i / cols) * cell + cell / 2;
      const ok = sprite(o.name, cx, cy, 30, 30, 0, 1, true);
      if (!ok) {
        ctx.fillStyle = t.particle || "#aaa";
        ctx.font = "11px Jersey, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(o.label, cx, cy + 4);
      }
    });
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function arrow(x,y,a,color){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-15,-19);ctx.lineTo(18,0);ctx.lineTo(-15,19);ctx.closePath();ctx.fill();ctx.restore();}


  function drawPickaxeReel(cx, cy, angle, outcome) {
    // Vertical slot-style reel: pickaxes scroll up/down smoothly
    const n = 4; // wood, stone, iron, diamond
    const step = (Math.PI * 2) / n;
    const spacing = 78; // vertical distance between pickaxes
    let a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const raw = a / step;
    const idx = Math.floor(raw) % n;
    const frac = raw - Math.floor(raw); // 0..1 progress toward next

    // Soft vertical window (clip)
    const winH = 150;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 70, cy - winH / 2, 140, winH);
    ctx.clip();

    // Draw a strip of pickaxes vertically (neighbors above/below)
    for (let off = -2; off <= 2; off++) {
      const ti = (idx + off + n * 20) % n;
      const slide = off - frac; // vertical offset in "slots"
      const py = cy + slide * spacing;
      const dist = Math.abs(slide);
      if (dist > 2.2) continue;
      // scale & alpha falloff away from center
      const sc = 1.65 * (1 - Math.min(1, dist) * 0.28);
      const al = Math.max(0, 1 - dist * 0.55);
      // gentle upright angle (almost vertical pose), no spinning of the icon itself
      const pose = -0.55;
      ctx.save();
      ctx.globalAlpha = al;
      drawPick(cx, py, pose, sc, ti, false);
      ctx.restore();
    }
    ctx.restore();

    // speed streaks while the reel is accelerating / spinning fast
    {
      const prog = Math.min(1, stateTime / (turbo ? 0.9 : 2.4)), v = Math.pow(1 - prog, 3);
      if (v > .12) {
        ctx.save(); ctx.beginPath(); ctx.rect(cx - 70, cy - winH / 2, 140, winH); ctx.clip(); ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 12; i++) {
          ctx.globalAlpha = .3 * v;
          ctx.fillRect(snap4(cx - 62 + ((i * 29) % 124)), snap4(cy - 80 + (((i * 53) + stateTime * 900 * v) % 160)), 4, snap4(20 + 44 * v));
        }
        ctx.restore();
      }
    }

    // Center selection frame (horizontal guides)
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 55, cy - 36);
    ctx.lineTo(cx + 55, cy - 36);
    ctx.moveTo(cx - 55, cy + 36);
    ctx.lineTo(cx + 55, cy + 36);
    ctx.stroke();
    // soft center glow
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 70, cy - 50, 140, 100);
    ctx.restore();

    // Label under reel — follows center, snaps to outcome near end
    const centerTier = (frac < 0.5 ? idx : (idx + 1) % n);
    const duration = turbo ? 0.9 : 2.4;
    const progress = Math.min(1, stateTime / duration);
    const labelTier = progress > 0.9 && outcome >= 0 ? outcome : centerTier;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.textAlign = "center";
    ctx.font = "900 18px Jersey";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#0a1018";
    ctx.fillStyle = pickColors[labelTier]?.glow || "#fff";
    ctx.strokeText(TIER_NAMES[labelTier] || "PICKAXE", cx, cy + 92);
    ctx.fillText(TIER_NAMES[labelTier] || "PICKAXE", cx, cy + 92);
    ctx.restore();
  }

  function drawPick(x,y,angle,scale,tier,world=true,alpha=1) {
    const sy=y-(world?cameraY:0)+towerOffset;
    // Base size = one block (TILE). Powerup scale multiplies, but per-block feel stays.
    let size = TILE * scale;
    if (!world) size = Math.min(size * 0.95, TILE * 1.5); // menu/reel: a bit larger, still limited

    if (zannMode && zannPicks[tier] && zannPicks[tier].complete && zannPicks[tier].naturalWidth) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, sy);
      ctx.rotate(angle);
      const s = size;
      ctx.drawImage(zannPicks[tier], -s/2, -s/2, s, s);
      ctx.restore();
      if (alpha >= 1) pickGlint(x, sy, angle, size, tier);
      return;
    }
    sprite(`pickaxe_${tier}`,x,sy,size,size,angle,alpha,true);
    if (alpha >= 1) pickGlint(x, sy, angle, size, tier);
  }

  function drawTileBase(b) {
    const y = b.y - cameraY + towerOffset, x = b.x;
    if (y < -TILE || y > H + TILE) return;
    // Keep diamond, TNT, slime unchanged
    if (b.type === "tnt") { sprite("tnt", x, y, TILE, TILE); return; }
    if (b.type === "slime") { sprite("slime", x, y, TILE, TILE); return; }
    if (b.type === "diamond") {
      sprite("diamond", x, y, TILE, TILE);
      if (b.hp < b.maxHp) {
        const n = Math.max(1, Math.min(10, Math.ceil((1 - b.hp / b.maxHp) * 10)));
        sprite("cr" + n, x, y, TILE, TILE);
      }
      return;
    }
    if (b.type === "upgrade") { sprite("stretch", x, y, TILE, TILE); return; }
    if (b.type === "workbench") { sprite("crafting_table", x, y, TILE, TILE); return; }

    const drawImg = (img) => { if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, TILE, TILE); };
    if (b.type === "wall") return; // side walls hidden so background is visible
    else if (b.type === "dirt") {
      // Grass texture only on the first layer (row 0); below = plain earth
      const dirtN = (b.row === 0) ? 0 : (b.n % 2) + 1;
      drawImg(themedSprite("dirt", dirtN));
    }
    else if (b.type === "stone") drawImg(themedSprite("stone", b.n));
    else if (b.type === "hard") drawImg(themedSprite("hard", b.n));
    else if (["copper", "gold", "redstone", "emerald"].includes(b.type)) {
      drawImg(themedSprite("stone", b.n));
      sprite(b.type, x, y, TILE, TILE);
    } else if (b.type === "obsidian") {
      drawImg(themedSprite("hard", b.n));
      sprite("obsidian", x, y, TILE, TILE);
    } else {
      sprite(b.type, x, y, TILE, TILE);
    }
    if (b.hp < b.maxHp) {
      const n = Math.max(1, Math.min(10, Math.ceil((1 - b.hp / b.maxHp) * 10)));
      sprite("cr" + n, x, y, TILE, TILE);
    }
  }

  function drawMine() {
    // No solid wall behind blocks — background shows through
    // Optional subtle vignette only at the dig column edges
    const top = WORLD_TOP - cameraY + towerOffset;
    const gradL = ctx.createLinearGradient(MINE_X - 20, 0, MINE_X + 30, 0);
    gradL.addColorStop(0, "rgba(0,0,0,0)");
    gradL.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = gradL;
    ctx.fillRect(MINE_X - 20, top, 50, H + cameraY + 200);
    const gradR = ctx.createLinearGradient(MINE_X + MINE_W - 30, 0, MINE_X + MINE_W + 20, 0);
    gradR.addColorStop(0, "rgba(0,0,0,0.25)");
    gradR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(MINE_X + MINE_W - 30, top, 50, H + cameraY + 200);
    // lighting inputs for this frame
    lightPicks = picks.filter(p => p.alive);
    { const ar = hexRGB(currentTheme().accent); accentRGB = ar.join(",");
      lightRGB = ar.map(v => Math.round(v * .45 + 255 * .55)).join(","); }
    visGrid.clear();
    { const r0 = Math.floor((cameraY - towerOffset - WORLD_TOP) / TILE) - 2, r1 = r0 + Math.ceil(H / TILE) + 5;
      for (const b of blocks) if (b.row >= r0 && b.row <= r1) visGrid.set(b.row * 16 + b.col, b); }
    blocks.forEach(drawTile);
    if (shadersOn) drawMineLight();
    if (turbo && state === "fall") drawTurboStreaks();
    for(const p of picks)if(p.alive)p.trail.slice().reverse().forEach((t,i)=>drawPick(t.x,t.y,t.angle,t.scale,p.tier,true,(i+1)/p.trail.length*((p.speed||0)>300?.3:.1)));
    drawParticles();
    for(const p of picks)if(p.alive)drawSpeedFx(p);
    for(const p of picks)if(p.alive){
      let hk = Math.max(0, 1 - (stateTime - (p.hitT ?? -9)) / .2); hk = hk > 0 ? Math.ceil(hk * 4) / 4 : 0;
      drawPick(p.x,p.y,p.angle,p.scale*(1+.12*hk),p.tier,true);
      if (hk > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; drawPick(p.x,p.y,p.angle,p.scale*(1+.12*hk),p.tier,true,hk*.55); ctx.restore(); }
      const py=p.y-cameraY-29*p.scale;
      ctx.textAlign="center";ctx.font="900 17px Jersey";ctx.lineWidth=4;ctx.strokeStyle="#101820";ctx.fillStyle="#fff";
      ctx.strokeText(`${Math.ceil(p.hp)}/${p.maxHp}`,p.x,py);ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`,p.x,py);
      if(p.sizeLevel>0){ctx.font="900 13px Jersey";ctx.fillStyle="#9cff62";ctx.fillText(`x${p.scale} ${(p.sizeUntil-stateTime).toFixed(1)}s`,p.x,py+15)}
    }
    labels.forEach(l=>{const a=Math.min(1,l.life/.22);ctx.globalAlpha=a;ctx.textAlign="center";ctx.font="900 21px Jersey";ctx.lineWidth=5;ctx.strokeStyle="#17212b";ctx.fillStyle="#f4ff67";ctx.strokeText(l.text,l.x,l.y-cameraY+towerOffset);ctx.fillText(l.text,l.x,l.y-cameraY+towerOffset)});ctx.globalAlpha=1;
    const depth=Math.max(0,Math.floor((pick.y-WORLD_TOP)/TILE));
    rect(W/2-78,18,156,36,"rgba(10,23,33,.78)");ctx.fillStyle="#dff8ff";ctx.font="900 15px Jersey";ctx.textAlign="center";ctx.fillText(`DEPTH  ${depth} m`,W/2,41);
    ctx.fillStyle="#dce7ec";ctx.font="900 14px Jersey";ctx.fillText(`PICKAXES  ${picks.filter(p=>p.alive).length}/${picks.length}`,W/2,59);
  }

  function drawResult() {
    if(state!=="result")return;
    const a=Math.min(1,stateTime*3);
    const ry=RING_Y-370;
    ctx.globalAlpha=a;rect(W/2-180,ry,360,136,"rgba(8,18,26,.88)");
    ctx.strokeStyle="#dfff45";ctx.lineWidth=3;ctx.strokeRect(W/2-180,ry,360,136);
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 24px Jersey";ctx.fillText(wheelOutcome<0?"CROSS":"TOTAL WIN",W/2,ry+42);
    ctx.fillStyle=wheelOutcome<0?"#ff5148":"#eaff51";ctx.font="900 52px Jersey";ctx.fillText(wheelOutcome<0?"NO PICKAXE":fmt(win),W/2,ry+102);ctx.globalAlpha=1;
  }
  function draw() {
    ctx.save();
    try {
      const sx = ui.shake && ui.shake.checked ? (rnd() - 0.5) * cameraShake : 0;
      const sy = ui.shake && ui.shake.checked ? (rnd() - 0.5) * cameraShake : 0;
      ctx.translate(sx, sy);
      drawSky();
      if (state === "fall" || state === "build") {
        drawMine();
      } else {
        drawGround();
        drawWheel();
      }
      drawResult();
      // Soft edge vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.7, "rgba(0,0,0,0.08)");
      v.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      // Per-theme post shaders
      if (shadersOn) {
        drawThemeShaders(currentTheme());
        { const ar = hexRGB(currentTheme().accent); accentRGB = ar.join(","); }
        drawPixelAtmos();
        ctx.drawImage(getPxOverlay(), 0, 0);
      }
    } catch (err) {
      console.error("draw error", err);
    }
    ctx.restore();
  }

  function drawThemeShaders(t) {
    const id = t.id;
    const accent = t.accent || "#c080ff";
    const pulse = 0.5 + 0.5 * Math.sin(stateTime * 1.35);
    const pulse2 = 0.5 + 0.5 * Math.sin(stateTime * 0.7 + 1.2);
    const st = stateTime;
    ctx.save();

    // ===== 1. Multi-stop cinematic color grade =====
    const grade = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.08, W * 0.5, H * 0.5, H * 0.95);
    if (id === "hell") {
      grade.addColorStop(0, `rgba(255,90,20,${0.10 + pulse * 0.06})`);
      grade.addColorStop(0.35, "rgba(200,40,0,0.07)");
      grade.addColorStop(0.7, "rgba(80,10,0,0.12)");
      grade.addColorStop(1, "rgba(15,0,0,0.32)");
    } else if (id === "end" || id === "cherry") {
      grade.addColorStop(0, `rgba(180,70,255,${0.09 + pulse * 0.05})`);
      grade.addColorStop(0.4, "rgba(90,20,160,0.08)");
      grade.addColorStop(0.75, "rgba(30,0,50,0.14)");
      grade.addColorStop(1, "rgba(5,0,12,0.34)");
    } else if (id === "deep_dark") {
      grade.addColorStop(0, `rgba(160,230,255,${0.07 + pulse * 0.04})`);
      grade.addColorStop(0.35, "rgba(60,140,200,0.06)");
      grade.addColorStop(0.7, "rgba(10,40,70,0.12)");
      grade.addColorStop(1, "rgba(0,8,20,0.30)");
    } else if (id === "classic") {
      grade.addColorStop(0, `rgba(140,255,160,${0.06 + pulse * 0.03})`);
      grade.addColorStop(0.4, "rgba(40,140,70,0.05)");
      grade.addColorStop(0.75, "rgba(15,50,25,0.10)");
      grade.addColorStop(1, "rgba(5,15,8,0.26)");
    } else if (id === "portal_run") {
      grade.addColorStop(0, `rgba(255,230,140,${0.10 + pulse * 0.05})`);
      grade.addColorStop(0.35, "rgba(255,190,60,0.06)");
      grade.addColorStop(0.7, "rgba(80,40,0,0.10)");
      grade.addColorStop(1, "rgba(12,6,0,0.28)");
    } else if (id === "ocean") {
      grade.addColorStop(0, `rgba(60,180,255,${0.08 + pulse * 0.04})`);
      grade.addColorStop(0.4, "rgba(20,100,180,0.07)");
      grade.addColorStop(0.75, "rgba(0,40,90,0.14)");
      grade.addColorStop(1, "rgba(0,10,30,0.32)");
    } else {
      grade.addColorStop(0, "rgba(255,255,255,0.04)");
      grade.addColorStop(1, "rgba(0,0,0,0.18)");
    }
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);

    // ===== 2. Soft secondary ambient (horizontal wash) =====
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    if (id === "hell") {
      wash.addColorStop(0, "rgba(40,0,0,0.12)");
      wash.addColorStop(0.55, "rgba(255,50,0,0.03)");
      wash.addColorStop(1, "rgba(255,100,0,0.10)");
    } else if (id === "deep_dark") {
      wash.addColorStop(0, "rgba(100,200,255,0.08)");
      wash.addColorStop(0.4, "rgba(0,0,0,0)");
      wash.addColorStop(1, "rgba(0,20,40,0.14)");
    } else if (id === "ocean") {
      wash.addColorStop(0, "rgba(0,40,80,0.10)");
      wash.addColorStop(0.5, "rgba(40,160,220,0.04)");
      wash.addColorStop(1, "rgba(0,20,50,0.16)");
    } else {
      wash.addColorStop(0, "rgba(0,0,0,0.06)");
      wash.addColorStop(1, "rgba(0,0,0,0.10)");
    }
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    // ===== 3. Additive bloom layers =====
    ctx.globalCompositeOperation = "lighter";

    if (id === "hell") {
      // volcanic glow from below
      const core = ctx.createRadialGradient(W / 2, H + 20, 20, W / 2, H * 0.55, H * 0.7);
      core.addColorStop(0, `rgba(255,140,30,${0.22 + pulse * 0.1})`);
      core.addColorStop(0.4, `rgba(255,60,0,${0.10 + pulse * 0.05})`);
      core.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, W, H);
      // rising heat bands (soft)
      for (let i = 0; i < 7; i++) {
        const y = ((st * 55 + i * 110) % (H + 100)) - 50;
        const h = 28 + (i % 3) * 10;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        const a = 0.035 + pulse * 0.025;
        g.addColorStop(0, "rgba(255,120,0,0)");
        g.addColorStop(0.5, `rgba(255,90,20,${a})`);
        g.addColorStop(1, "rgba(255,40,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, y, W, h);
      }
      // ember sparks
      for (let i = 0; i < 24; i++) {
        const x = ((i * 97 + st * (20 + i % 5)) % W);
        const y = H - ((i * 53 + st * (50 + i % 7 * 10)) % (H + 40));
        const r = 1.5 + (i % 4) * 0.8;
        ctx.fillStyle = i % 3 === 0 ? `rgba(255,220,100,${0.35 + pulse * 0.2})` : `rgba(255,80,20,${0.25 + pulse * 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === "end" || id === "cherry") {
      // deep void bloom center
      const voidG = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, H * 0.55);
      voidG.addColorStop(0, `rgba(220,160,255,${0.12 + pulse * 0.06})`);
      voidG.addColorStop(0.35, `rgba(140,40,255,${0.07 + pulse * 0.03})`);
      voidG.addColorStop(1, "rgba(40,0,80,0)");
      ctx.fillStyle = voidG;
      ctx.fillRect(0, 0, W, H);
      // drifting nebula orbs
      for (let i = 0; i < 8; i++) {
        const ang = st * (0.18 + i * 0.03) + i * 0.9;
        const rad = 120 + i * 35 + Math.sin(st * 0.5 + i) * 20;
        const px = W * 0.5 + Math.cos(ang) * rad;
        const py = H * 0.42 + Math.sin(ang * 0.75) * (rad * 0.55);
        const r = 40 + i * 10;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(200,120,255,${0.10 + pulse * 0.05})`);
        g.addColorStop(0.5, `rgba(120,40,200,${0.04})`);
        g.addColorStop(1, "rgba(60,0,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // star twinkles
      for (let i = 0; i < 30; i++) {
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(st * (2 + i % 5) + i));
        const x = ((i * 137.5) % W);
        const y = ((i * 89.3) % H);
        ctx.fillStyle = `rgba(255,230,255,${0.15 * tw})`;
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (id === "deep_dark") {
      // aurora sheets
      for (let i = 0; i < 5; i++) {
        const baseX = W * (0.1 + i * 0.18);
        const sway = Math.sin(st * 0.55 + i * 1.3) * 50;
        const x = baseX + sway;
        const g = ctx.createLinearGradient(x - 50, 0, x + 70, H * 0.7);
        const a = 0.07 + pulse * 0.04 + (i % 2) * 0.02;
        g.addColorStop(0, `rgba(140,240,255,${a})`);
        g.addColorStop(0.35, `rgba(60,180,255,${a * 0.5})`);
        g.addColorStop(0.7, `rgba(40,100,200,${a * 0.2})`);
        g.addColorStop(1, "rgba(0,40,80,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 20, 0);
        for (let y = 0; y <= H * 0.7; y += 20) {
          const dx = Math.sin(y * 0.02 + st * 1.1 + i) * 18;
          ctx.lineTo(x + dx + 30, y);
        }
        for (let y = H * 0.7; y >= 0; y -= 20) {
          const dx = Math.sin(y * 0.02 + st * 1.1 + i) * 18;
          ctx.lineTo(x + dx - 40, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      // frost sparkles
      for (let i = 0; i < 20; i++) {
        const tw = Math.abs(Math.sin(st * 3 + i * 1.7));
        const x = (i * 61 + st * 15) % W;
        const y = (i * 47 + st * 8) % (H * 0.6);
        ctx.fillStyle = `rgba(220,250,255,${0.2 * tw})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + tw, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === "classic") {
      // forest god-rays
      for (let i = 0; i < 5; i++) {
        const x = W * (0.15 + i * 0.18) + Math.sin(st * 0.35 + i) * 25;
        const g = ctx.createLinearGradient(x, 0, x + 30, H * 0.65);
        const a = 0.06 + pulse * 0.03;
        g.addColorStop(0, `rgba(200,255,140,${a})`);
        g.addColorStop(0.5, `rgba(100,200,80,${a * 0.4})`);
        g.addColorStop(1, "rgba(20,80,20,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 15, 0);
        ctx.lineTo(x + 25, 0);
        ctx.lineTo(x + 55, H * 0.65);
        ctx.lineTo(x - 45, H * 0.65);
        ctx.closePath();
        ctx.fill();
      }
      // pollen motes
      for (let i = 0; i < 18; i++) {
        const x = (i * 71 + st * 12 + Math.sin(st + i) * 20) % W;
        const y = (i * 53 + st * 6) % H;
        ctx.fillStyle = `rgba(200,255,120,${0.12 + pulse * 0.08})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === "portal_run") {
      // golden radial god-rays
      ctx.save();
      ctx.translate(W / 2, H * 0.32);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + st * 0.12;
        ctx.save();
        ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 0, -H * 0.55);
        const al = 0.07 + pulse * 0.04;
        g.addColorStop(0, `rgba(255,240,160,${al})`);
        g.addColorStop(0.4, `rgba(255,200,60,${al * 0.45})`);
        g.addColorStop(1, "rgba(255,160,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.lineTo(28, -H * 0.55);
        ctx.lineTo(-28, -H * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // center halo
      const halo = ctx.createRadialGradient(0, 0, 5, 0, 0, 120);
      halo.addColorStop(0, `rgba(255,255,220,${0.18 + pulse * 0.08})`);
      halo.addColorStop(0.4, `rgba(255,210,80,${0.08})`);
      halo.addColorStop(1, "rgba(255,180,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (id === "ocean") {
      // volumetric underwater light columns
      for (let i = 0; i < 4; i++) {
        const x = W * (0.2 + i * 0.2) + Math.sin(st * 0.4 + i) * 30;
        const g = ctx.createLinearGradient(x, 0, x, H);
        const a = 0.06 + pulse * 0.03;
        g.addColorStop(0, `rgba(120,220,255,${a})`);
        g.addColorStop(0.5, `rgba(40,160,255,${a * 0.4})`);
        g.addColorStop(1, "rgba(0,60,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 35, 0, 70, H);
      }
      // caustic wave network
      ctx.lineWidth = 1.5;
      for (let layer = 0; layer < 3; layer++) {
        const a = 0.05 + layer * 0.02 + pulse * 0.02;
        ctx.strokeStyle = `rgba(100,220,255,${a})`;
        for (let row = 0; row < 5; row++) {
          const baseY = H * 0.15 + row * 90 + layer * 20;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 12) {
            const yy = baseY
              + Math.sin(x * 0.018 + st * (1.4 + layer * 0.3) + row) * (10 + layer * 3)
              + Math.sin(x * 0.04 + st * 2.1 + row * 0.5) * 4;
            if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }
      // rising bubbles
      for (let i = 0; i < 16; i++) {
        const x = (i * 83 + Math.sin(st + i) * 12) % W;
        const y = H - ((i * 41 + st * (25 + i % 5 * 8)) % (H + 30));
        const r = 1.5 + (i % 3);
        ctx.strokeStyle = `rgba(180,240,255,${0.2 + pulse * 0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = "source-over";

    // ===== 4. Soft vignette (themed tint) =====
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.82);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    if (id === "hell") vig.addColorStop(1, "rgba(40,0,0,0.45)");
    else if (id === "end" || id === "cherry") vig.addColorStop(1, "rgba(15,0,30,0.48)");
    else if (id === "ocean") vig.addColorStop(1, "rgba(0,10,30,0.45)");
    else if (id === "deep_dark") vig.addColorStop(1, "rgba(0,15,30,0.42)");
    else vig.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ===== 5. Accent rim (soft, low alpha) =====
    const rim = ctx.createLinearGradient(0, 0, W, 0);
    rim.addColorStop(0, accent + "40");
    rim.addColorStop(0.12, "rgba(0,0,0,0)");
    rim.addColorStop(0.88, "rgba(0,0,0,0)");
    rim.addColorStop(1, accent + "40");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, W, H);

    const rimV = ctx.createLinearGradient(0, 0, 0, H);
    rimV.addColorStop(0, accent + "28");
    rimV.addColorStop(0.1, "rgba(0,0,0,0)");
    rimV.addColorStop(0.9, "rgba(0,0,0,0)");
    rimV.addColorStop(1, accent + "28");
    ctx.fillStyle = rimV;
    ctx.fillRect(0, 0, W, H);

    // ===== 6. Fine film grain (very subtle) =====
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 55; i++) {
      const gx = ((st * 130 + i * 97.1) * 1.3) % W;
      const gy = ((st * 90 + i * 61.7) * 1.1) % H;
      ctx.fillStyle = i % 3 === 0 ? "#ffffff" : accent;
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function loop(now) {
    const dt=Math.min(.034,(now-last)/1000||0);last=now;update(dt);draw();requestAnimationFrame(loop);
  }

  ui.play.addEventListener("click",startRound);
  canvas.addEventListener("pointerdown",()=>{if(state==="menu"||state==="result")startRound()});
  ui.minus.addEventListener("click",()=>{if(betIndex>0)betIndex--;refresh();tone(170)});
  ui.plus.addEventListener("click",()=>{if(betIndex<bets.length-1)betIndex++;refresh();tone(250)});
  ui.pickCount.addEventListener("click",()=>{
    if(state==="menu"||state==="result"){
      pickCount=pickCount%4+1;
      const pv=document.querySelector("#pickCountValue");
      if(pv) pv.textContent=`×${pickCount}`;
      else ui.pickCount.textContent=`PICKS ×${pickCount}`;
      tone(300+pickCount*35,.04);
    }
  });
  ui.turbo.addEventListener("click",()=>{turbo=!turbo;ui.turbo.classList.toggle("active",turbo)});
  ui.auto.addEventListener("click",()=>{
    if(autoplay){autoplay=false;autoRemaining=0;ui.auto.style.filter="";if(state==="menu"||state==="result")controls(true);return}
    if(state==="menu"||state==="result")ui.autoDialog.showModal();
  });
  ui.sound.addEventListener("click",()=>{sound=!sound;ui.sound.classList.toggle("muted",!sound)});
  ui.settings.addEventListener("click",()=>ui.dialog.showModal());
  ui.bonus.addEventListener("click",()=>{if(state==="menu"||state==="result")ui.bonusDialog.showModal()});
  if (ui.theme) {
    ui.theme.addEventListener("click", () => { if (state === "menu" || state === "result") cycleTheme(); });
    if (ui.blockTex) ui.blockTex.addEventListener("click", () => { if (state === "menu" || state === "result") cycleBlockPack(); });
    if (ui.shader) ui.shader.addEventListener("click", () => { cycleShaders(); });
    if (ui.zann) ui.zann.addEventListener("click", () => { if (state === "menu" || state === "result") cycleZann(); });
    if (ui.uiToggle) {
      let uiHidden = false;
      try { uiHidden = localStorage.getItem("fp_ui_hide") === "1"; } catch (_) {}
      const applyUiHide = () => {
        document.body.classList.toggle("ui-hidden", uiHidden);
        ui.uiToggle.innerHTML = '<i class="chip-label">UI</i><span class="chip-value">' + (uiHidden ? "SHOW" : "HIDE") + "</span>";
      };
      applyUiHide();
      ui.uiToggle.addEventListener("click", () => {
        uiHidden = !uiHidden;
        try { localStorage.setItem("fp_ui_hide", uiHidden ? "1" : "0"); } catch (_) {}
        applyUiHide();
      });
    }
  }
  const themeSelect = document.querySelector("#themeSelect");
  if (themeSelect) {
    themeSelect.innerHTML = THEMES.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    themeSelect.addEventListener("change", () => {
      if (state === "menu" || state === "result") setThemeById(themeSelect.value);
      else themeSelect.value = currentTheme().id;
    });
  }
  const variantSelect = document.querySelector("#variantSelect");
  if (variantSelect) {
    variantSelect.addEventListener("change", () => {
      if (state === "menu" || state === "result") setVariant(parseInt(variantSelect.value, 10) || 0);
    });
  }
  applyThemeUI();
  ui.bonusDialog.querySelectorAll("[data-tier]").forEach(btn=>btn.addEventListener("click",()=>{
    const tier=Number(btn.dataset.tier);ui.bonusDialog.close();startRound({forcedTier:tier});
  }));
  ui.autoDialog.querySelectorAll("[data-auto]").forEach(btn=>btn.addEventListener("click",()=>{
    autoRemaining=Number(btn.dataset.auto);autoplay=true;ui.auto.style.filter="drop-shadow(0 0 8px #dfff35)";
    ui.autoDialog.close();controls(false);setTimeout(()=>startRound(),200);
  }));
  window.addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="Enter"){e.preventDefault();startRound()}if(e.key.toLowerCase()==="m")ui.sound.click();if(e.key.toLowerCase()==="t")ui.turbo.click();if(e.key==="+")ui.plus.click();if(e.key==="-")ui.minus.click()});
  document.addEventListener("visibilitychange",()=>{last=performance.now()});

  /* ===== portrait layout: canvas height follows the screen, HUD scales from --u ===== */
  const gameEl = document.querySelector(".game");
  function applyLayout() {
    const r = Math.min(2.4, Math.max(16 / 9, (window.innerHeight || 1280) / (window.innerWidth || 720)));
    const nh = Math.round(W * r);
    document.documentElement.style.setProperty("--ar", String(nh / W));
    if (nh !== H || canvas.height !== nh) {
      H = nh; canvas.width = W; canvas.height = H; ctx.imageSmoothingEnabled = false;
      if (state === "menu" || state === "result") { WORLD_TOP = Math.round(H * 0.34); }
      RING_Y = Math.round(H * 0.504);
    }
    if (gameEl) gameEl.style.setProperty("--u", (gameEl.clientWidth / W) + "px");
  }
  applyLayout();
  window.addEventListener("resize", applyLayout);
  window.addEventListener("orientationchange", () => setTimeout(applyLayout, 120));
  if (window.ResizeObserver && gameEl) new ResizeObserver(() => gameEl.style.setProperty("--u", (gameEl.clientWidth / W) + "px")).observe(gameEl);
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock("portrait").catch(() => {}); } catch (_) {}

  const railBtn = $("#railOpenBtn");
  if (railBtn) railBtn.addEventListener("click", () => {
    const open = railBtn.closest(".theme-rail").classList.toggle("open");
    railBtn.setAttribute("aria-expanded", String(open));
    railBtn.querySelector(".chip-value").textContent = open ? "▴" : "▾";
  });

  /* ===== pixel press animation: stepped squish + burst of square "pixels" ===== */
  const FX_SEL = ".hud-round,.hud-bet-side,.hud-spin,.hud-bonus,.game-chip";
  const FX_COLORS = ["#ffffff", "#ffe566", "#8fb4ff", "#ffffff"];
  const fxLayer = document.createElement("div");
  fxLayer.className = "px-fx";
  if (gameEl) gameEl.appendChild(fxLayer);
  function pixelBurst(btn) {
    if (!gameEl) return;
    const g = gameEl.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const cx = b.left - g.left + b.width / 2, cy = b.top - g.top + b.height / 2;
    const reach = Math.max(b.width, b.height) * 0.75, u = Math.max(2, Math.round(g.width / 160));
    const n = btn.classList.contains("hud-spin") ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5, dist = reach * (0.7 + Math.random() * 0.6);
      const s = u * (1 + Math.floor(Math.random() * 2)), el = document.createElement("i");
      el.style.cssText = `left:${cx - s / 2}px;top:${cy - s / 2}px;width:${s}px;height:${s}px;background:${FX_COLORS[i % FX_COLORS.length]}`;
      fxLayer.appendChild(el);
      const a = el.animate(
        [{ transform: "translate(0,0)", opacity: 1 },
         { transform: `translate(${Math.round(Math.cos(ang) * dist / u) * u}px,${Math.round(Math.sin(ang) * dist / u) * u}px)`, opacity: 0 }],
        { duration: 380, easing: "steps(5,end)" });
      a.onfinish = () => el.remove();
    }
  }
  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest && e.target.closest(FX_SEL);
    if (!btn || btn.disabled) return;
    btn.classList.remove("px-hit"); void btn.offsetWidth; btn.classList.add("px-hit");
    pixelBurst(btn);
  }, { passive: true });
  document.addEventListener("animationend", (e) => { if (e.animationName === "pxPress") e.target.classList.remove("px-hit"); });

  refresh();
  requestAnimationFrame(loop);
})();