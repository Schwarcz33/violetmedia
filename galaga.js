// ═══════════════════════════════════════════════════════════════════
//  VIOLET MEDIA GAMES — COSMIC GALAGA
//  A fully playable enhanced Galaga arcade game
//  Built for violetmedia.org • No dependencies • Pure Canvas
// ═══════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ── PALETTE ──
  const C = {
    violet: "#8A2BE2",
    purple: "#6B21A8",
    blue: "#2D6BFF",
    gold: "#D7B15A",
    white: "#FFFFFF",
    bg: "#050214",
    dim: "rgba(255,255,255,0.5)",
    glass: "rgba(17,8,38,0.75)",
  };

  // ── CONSTANTS ──
  const GW = 800;
  const GH = 600;
  const PLAYER_W = 32;
  const PLAYER_H = 28;
  const PLAYER_SPEED = 5;
  const BULLET_SPEED = 8;
  const ENEMY_BULLET_SPEED = 4;
  const FIRE_COOLDOWN = 180; // ms
  const POWERUP_DURATION = 8000;
  const COLS = 8;
  const ROWS = 5;
  const ENEMY_W = 28;
  const ENEMY_H = 24;
  const ENEMY_PAD = 14;
  const FORMATION_TOP = 60;
  const BOSS_HP = 30;

  // ── STATE ──
  let canvas, ctx;
  let gameState = "menu"; // menu | playing | paused | gameover | waveIntro
  let score = 0;
  let highScore = parseInt(localStorage.getItem("vm_galaga_hi") || "0", 10);
  let lives = 3;
  let wave = 1;
  let waveTimer = 0;
  let shakeX = 0, shakeY = 0, shakeMag = 0;
  let lastTime = 0;
  let soundEnabled = true;
  let isMobile = false;
  let isFullscreen = false;
  let renderScale = 1;
  let canvasContainer = null;

  // Player
  let player = { x: 0, y: 0, w: PLAYER_W, h: PLAYER_H, lastFire: 0, invincible: 0, shield: false, rapidFire: false, spreadShot: false, rapidEnd: 0, spreadEnd: 0 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let powerups = [];
  let stars = [];
  let boss = null;

  // Formation
  let formationX = 0;
  let formationDir = 1;
  let formationSpeed = 0.4;
  let diveTimer = 0;
  let diveInterval = 2500;

  // Touch controls
  let touchLeft = false, touchRight = false, touchFire = false;

  // Keys
  const keys = {};

  // ── AUDIO (Web Audio API synth + background music) ──
  let audioCtx = null;
  let bgMusicBuffer = null, bgMusicSource = null, bgMusicGain = null;
  let bgMusicPlaying = false, bgMusicWaiting = false, bgMusicLoading = false;

  function initAudio() {
    if (audioCtx) {
      // AudioContext exists but music not loaded yet — try loading
      if (!bgMusicBuffer && !bgMusicLoading) loadBgMusic();
      return;
    }
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    if (audioCtx) loadBgMusic();
  }

  function loadBgMusic() {
    if (bgMusicBuffer || bgMusicLoading || !audioCtx) return;
    bgMusicLoading = true;
    const audio = new Audio("galaga-music.mp3");
    audio.crossOrigin = "anonymous";
    audio.loop = true;
    audio.volume = 0;
    audio.load();
    // Store as HTML5 Audio element — more reliable than Web Audio decoding
    audio.addEventListener("canplaythrough", function() {
      bgMusicBuffer = audio;
      bgMusicLoading = false;
      if (bgMusicWaiting) startBgMusic();
    }, { once: true });
    audio.addEventListener("error", function() {
      bgMusicLoading = false;
    }, { once: true });
  }

  function startBgMusic() {
    if (bgMusicPlaying) return;
    if (!bgMusicBuffer) {
      bgMusicWaiting = true;
      return;
    }
    bgMusicBuffer.loop = true;
    bgMusicBuffer.volume = soundEnabled ? 0.2 : 0;
    bgMusicBuffer.currentTime = 0;
    bgMusicBuffer.play().catch(() => {});
    bgMusicPlaying = true;
    bgMusicWaiting = false;
  }

  function stopBgMusic() {
    if (bgMusicBuffer && bgMusicPlaying) {
      bgMusicBuffer.pause();
      bgMusicBuffer.currentTime = 0;
    }
    bgMusicPlaying = false;
  }

  function updateBgMusicVolume() {
    if (bgMusicBuffer) bgMusicBuffer.volume = soundEnabled ? 0.2 : 0;
  }
  function playTone(freq, dur, type, vol) {
    if (!audioCtx || !soundEnabled) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }
  function sfxShoot() { playTone(880, 0.06, "square", 0.05); }
  function sfxHit() { playTone(220, 0.15, "sawtooth", 0.07); playTone(110, 0.2, "square", 0.05); }
  function sfxExplosion() { playTone(80, 0.3, "sawtooth", 0.1); playTone(60, 0.4, "triangle", 0.06); }
  function sfxPowerup() { playTone(660, 0.08, "sine", 0.06); setTimeout(() => playTone(880, 0.08, "sine", 0.06), 80); setTimeout(() => playTone(1100, 0.12, "sine", 0.06), 160); }
  function sfxGameOver() { playTone(440, 0.2, "square", 0.08); setTimeout(() => playTone(330, 0.2, "square", 0.08), 200); setTimeout(() => playTone(220, 0.4, "square", 0.08), 400); }
  function sfxBomb() { playTone(60, 0.5, "sawtooth", 0.12); playTone(40, 0.6, "square", 0.08); }

  // ── STARS BACKGROUND (3-layer parallax + nebula) ──
  let nebulaPhase = 0;
  function initStars() {
    stars = [];
    // Layer 1: distant dim stars (slow)
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * GW, y: Math.random() * GH,
        speed: Math.random() * 0.4 + 0.1, size: Math.random() * 1 + 0.3,
        color: "rgba(200,200,255,0.3)", layer: 0,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    // Layer 2: mid stars (medium)
    for (let i = 0; i < 100; i++) {
      const cols = [C.white, C.violet, C.blue, "rgba(200,180,255,0.9)"];
      stars.push({
        x: Math.random() * GW, y: Math.random() * GH,
        speed: Math.random() * 1 + 0.5, size: Math.random() * 1.5 + 0.5,
        color: cols[Math.floor(Math.random() * cols.length)], layer: 1,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    // Layer 3: close bright stars (fast)
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * GW, y: Math.random() * GH,
        speed: Math.random() * 2 + 1.5, size: Math.random() * 2.5 + 1,
        color: [C.white, C.violet, C.gold][Math.floor(Math.random() * 3)], layer: 2,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }
  function updateStars() {
    for (const s of stars) {
      s.y += s.speed;
      s.twinkle += 0.03 + s.layer * 0.01;
      if (s.y > GH) { s.y = -2; s.x = Math.random() * GW; }
    }
    nebulaPhase += 0.002;
  }
  function drawStars() {
    // Nebula clouds — colours shift by wave tier for visual variety
    const tier = typeof getWaveTier === "function" ? getWaveTier() : 1;
    const nebulaColors = [
      ["rgba(138,43,226,0.06)", "rgba(45,107,255,0.04)"],   // Tier 1: violet + blue (calm)
      ["rgba(100,43,226,0.08)", "rgba(45,80,255,0.06)"],    // Tier 2: deeper violet
      ["rgba(200,43,180,0.07)", "rgba(138,43,226,0.06)"],   // Tier 3: magenta shift
      ["rgba(226,43,80,0.06)", "rgba(200,100,43,0.05)"],    // Tier 4: red/amber threat
      ["rgba(255,43,43,0.08)", "rgba(226,160,43,0.06)"],    // Tier 5: full red/gold danger
    ];
    const nc = nebulaColors[Math.min(tier - 1, 4)];

    const grd1 = ctx.createRadialGradient(GW * 0.3, GH * 0.4 + Math.sin(nebulaPhase) * 30, 0, GW * 0.3, GH * 0.4, 250);
    grd1.addColorStop(0, nc[0]);
    grd1.addColorStop(1, "transparent");
    ctx.fillStyle = grd1;
    ctx.fillRect(0, 0, GW, GH);

    const grd2 = ctx.createRadialGradient(GW * 0.75, GH * 0.7 + Math.cos(nebulaPhase * 0.7) * 40, 0, GW * 0.75, GH * 0.7, 200);
    grd2.addColorStop(0, nc[1]);
    grd2.addColorStop(1, "transparent");
    ctx.fillStyle = grd2;
    ctx.fillRect(0, 0, GW, GH);

    // Stars with twinkling
    for (const s of stars) {
      const twinkleAlpha = 0.4 + Math.sin(s.twinkle) * 0.3;
      ctx.globalAlpha = twinkleAlpha;
      ctx.fillStyle = s.color;
      if (s.layer === 2 && s.size > 2) {
        // Bright close stars get a glow
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── PARTICLES ──
  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = Math.random() * (speed || 3) + 1;
      particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 1,
        decay: Math.random() * 0.025 + 0.015,
        size: Math.random() * 3 + 1,
        color: color || C.violet,
      });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ── PLAYER DRAWING ──
  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible / 80) % 2 === 0) return;
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;

    // Glow
    ctx.save();
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 18;

    // Ship body — triangle
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.moveTo(cx, player.y);
    ctx.lineTo(player.x, player.y + player.h);
    ctx.lineTo(player.x + player.w, player.y + player.h);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = C.blue;
    ctx.beginPath();
    ctx.moveTo(cx, player.y + 6);
    ctx.lineTo(cx - 6, player.y + player.h - 4);
    ctx.lineTo(cx + 6, player.y + player.h - 4);
    ctx.closePath();
    ctx.fill();

    // Engine glow
    ctx.fillStyle = C.gold;
    ctx.shadowColor = C.gold;
    ctx.shadowBlur = 12;
    ctx.fillRect(cx - 4, player.y + player.h - 2, 8, 4 + Math.random() * 3);

    ctx.restore();

    // Shield bubble
    if (player.shield) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── ENEMY TYPES & DRAWING ──
  function createEnemy(col, row, type) {
    const spacing = ENEMY_W + ENEMY_PAD;
    const gridW = COLS * spacing - ENEMY_PAD;
    const startX = (GW - gridW) / 2;
    return {
      x: 0, y: 0,
      gridCol: col, gridRow: row,
      baseX: startX + col * spacing,
      baseY: FORMATION_TOP + row * (ENEMY_H + ENEMY_PAD),
      w: ENEMY_W, h: ENEMY_H,
      type: type, // 'grunt' | 'striker' | 'commander'
      hp: type === "commander" ? 2 : 1,
      alive: true,
      diving: false,
      diveT: 0,
      diveStart: { x: 0, y: 0 },
      diveCtrl1: { x: 0, y: 0 },
      diveCtrl2: { x: 0, y: 0 },
      diveEnd: { x: 0, y: 0 },
      fireTimer: Math.random() * 3000 + 1000,
    };
  }

  function drawEnemy(e) {
    if (!e.alive) return;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    ctx.save();

    let color, glowColor;
    if (e.type === "grunt") { color = C.purple; glowColor = C.purple; }
    else if (e.type === "striker") { color = C.blue; glowColor = C.blue; }
    else { color = C.gold; glowColor = C.gold; }

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;

    // Body — diamond/hexagon shape
    ctx.fillStyle = color;
    ctx.beginPath();
    if (e.type === "commander") {
      // Hexagonal commander
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.35);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.65);
      ctx.lineTo(cx, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h * 0.65);
      ctx.lineTo(e.x, e.y + e.h * 0.35);
    } else if (e.type === "striker") {
      // Arrow-like striker
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.6);
      ctx.lineTo(cx + 4, e.y + e.h);
      ctx.lineTo(cx - 4, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h * 0.6);
    } else {
      // Diamond grunt
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, cy);
      ctx.lineTo(cx, e.y + e.h);
      ctx.lineTo(e.x, cy);
    }
    ctx.closePath();
    ctx.fill();

    // Inner detail — energy core
    ctx.fillStyle = C.white;
    ctx.shadowColor = C.white;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.008 + e.gridCol) * 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Wing/accent lines for detail
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    if (e.type === "striker") {
      ctx.beginPath();
      ctx.moveTo(e.x + 2, e.y + e.h * 0.5); ctx.lineTo(cx - 3, cy);
      ctx.moveTo(e.x + e.w - 2, e.y + e.h * 0.5); ctx.lineTo(cx + 3, cy);
      ctx.stroke();
    } else if (e.type === "grunt") {
      ctx.beginPath();
      ctx.moveTo(cx, e.y + 3); ctx.lineTo(cx, e.y + e.h - 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Commander damage ring
    if (e.type === "commander" && e.hp === 1) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, e.w / 2 + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ── BOSS ──
  function createBoss() {
    return {
      x: GW / 2 - 50, y: -80,
      w: 100, h: 60,
      hp: BOSS_HP + wave * 3,
      maxHp: BOSS_HP + wave * 3,
      alive: true,
      phase: 0, // 0=entering, 1=moving, 2=attacking
      moveDir: 1,
      fireTimer: 0,
      patternTimer: 0,
      pattern: 0, // 0=spread, 1=aimed, 2=barrage
    };
  }

  function drawBoss(b) {
    if (!b || !b.alive) return;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    ctx.save();

    // Body
    ctx.shadowColor = C.gold;
    ctx.shadowBlur = 20;
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.moveTo(cx, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h * 0.4);
    ctx.lineTo(b.x + b.w - 10, b.y + b.h);
    ctx.lineTo(b.x + 10, b.y + b.h);
    ctx.lineTo(b.x, b.y + b.h * 0.4);
    ctx.closePath();
    ctx.fill();

    // Inner detail
    ctx.fillStyle = C.purple;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(cx, b.y + 10);
    ctx.lineTo(cx + 25, cy);
    ctx.lineTo(cx, b.y + b.h - 8);
    ctx.lineTo(cx - 25, cy);
    ctx.closePath();
    ctx.fill();

    // Core
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HP bar
    const barW = b.w + 20;
    const barH = 6;
    const barX = b.x - 10;
    const barY = b.y - 14;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(barX, barY, barW, barH);
    const pct = b.hp / b.maxHp;
    ctx.fillStyle = pct > 0.5 ? C.gold : pct > 0.25 ? C.blue : C.violet;
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  function updateBoss(dt) {
    if (!boss || !boss.alive) return;
    if (boss.phase === 0) {
      boss.y += 1.5;
      if (boss.y >= 40) boss.phase = 1;
      return;
    }
    // Movement
    boss.x += boss.moveDir * 2;
    if (boss.x <= 20 || boss.x + boss.w >= GW - 20) boss.moveDir *= -1;

    // Attack patterns
    boss.fireTimer += dt;
    boss.patternTimer += dt;
    if (boss.patternTimer > 4000) {
      boss.pattern = (boss.pattern + 1) % 3;
      boss.patternTimer = 0;
    }

    const fireRate = boss.pattern === 2 ? 200 : 600;
    if (boss.fireTimer > fireRate) {
      boss.fireTimer = 0;
      const cx = boss.x + boss.w / 2;
      const by = boss.y + boss.h;
      if (boss.pattern === 0) {
        // Spread shot
        for (let a = -0.4; a <= 0.4; a += 0.2) {
          enemyBullets.push({ x: cx - 2, y: by, vx: Math.sin(a) * 3, vy: ENEMY_BULLET_SPEED, w: 4, h: 8, color: C.gold });
        }
      } else if (boss.pattern === 1) {
        // Aimed at player
        const dx = (player.x + player.w / 2) - cx;
        const dy = (player.y + player.h / 2) - by;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        enemyBullets.push({ x: cx - 2, y: by, vx: (dx / len) * ENEMY_BULLET_SPEED, vy: (dy / len) * ENEMY_BULLET_SPEED, w: 5, h: 5, color: C.violet });
      } else {
        // Barrage — random scatter
        const spread = (Math.random() - 0.5) * 4;
        enemyBullets.push({ x: cx - 2 + (Math.random() - 0.5) * 40, y: by, vx: spread, vy: ENEMY_BULLET_SPEED * 1.2, w: 3, h: 6, color: C.blue });
      }
    }
  }

  // ── FORMATION ──
  // Wave tiers change the feel of the game
  // Tier 1 (1-4): Easy intro, mostly grunts
  // Tier 2 (5-8): More strikers, faster dives, boss at 5
  // Tier 3 (9-12): Commanders in force, rapid dives, boss at 10
  // Tier 4 (13-16): Chaos, triple dives, thick formations, boss at 15
  // Tier 5 (17-20): Endgame, everything maxed, boss at 20
  function getWaveTier() {
    if (wave <= 4) return 1;
    if (wave <= 8) return 2;
    if (wave <= 12) return 3;
    if (wave <= 16) return 4;
    return 5;
  }

  function spawnWave() {
    enemies = [];
    boss = null;
    formationX = 0;
    formationDir = 1;
    const tier = getWaveTier();

    // Difficulty scaling per tier
    formationSpeed = 0.4 + wave * 0.08 + tier * 0.15;
    diveInterval = Math.max(400, 2500 - wave * 120 - tier * 200);
    diveTimer = 0;

    if (wave % 5 === 0) {
      // Boss wave — more escorts at higher tiers
      const escortRows = Math.min(2 + Math.floor(tier / 2), 4);
      for (let r = 0; r < escortRows; r++) {
        for (let c = 0; c < COLS; c++) {
          const type = r === 0 ? "commander" : (r <= 1 ? "striker" : "grunt");
          enemies.push(createEnemy(c, r, type));
        }
      }
      boss = createBoss();
    } else {
      // Normal wave — composition changes by tier
      const rows = Math.min(ROWS, 4 + Math.floor(tier / 2));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS; c++) {
          let type = "grunt";
          if (tier >= 3 && r <= 1) type = "commander";
          else if (tier >= 2 && r === 0) type = "commander";
          else if (r <= Math.min(tier, rows - 2)) type = "striker";
          // Tier 4+: random commanders mixed into striker rows
          if (tier >= 4 && type === "striker" && Math.random() < 0.2) type = "commander";
          enemies.push(createEnemy(c, r, type));
        }
      }
    }
  }

  function updateFormation(dt) {
    // Sway
    formationX += formationDir * formationSpeed;
    const gridW = COLS * (ENEMY_W + ENEMY_PAD) - ENEMY_PAD;
    const maxShift = (GW - gridW) / 2 - 10;
    if (Math.abs(formationX) > maxShift) formationDir *= -1;

    // Position enemies in formation
    for (const e of enemies) {
      if (!e.alive || e.diving) continue;
      e.x = e.baseX + formationX;
      e.y = e.baseY + Math.sin(Date.now() * 0.001 + e.gridCol * 0.5) * 4;
    }

    // Dive logic
    diveTimer += dt;
    if (diveTimer > diveInterval) {
      diveTimer = 0;
      const available = enemies.filter(e => e.alive && !e.diving);
      if (available.length > 0) {
        // Strikers dive more often
        const strikers = available.filter(e => e.type === "striker");
        const pool = strikers.length > 0 && Math.random() < 0.6 ? strikers : available;
        const diver = pool[Math.floor(Math.random() * pool.length)];
        startDive(diver);
        const tier = getWaveTier();
        // Pair dives from tier 2+
        if (tier >= 2 && Math.random() < 0.5 && available.length > 1) {
          const second = available.filter(e => e !== diver);
          if (second.length > 0) startDive(second[Math.floor(Math.random() * second.length)]);
        }
        // Triple dives from tier 4+
        if (tier >= 4 && Math.random() < 0.4 && available.length > 2) {
          const remaining = available.filter(e => e !== diver && !e.diving);
          if (remaining.length > 0) startDive(remaining[Math.floor(Math.random() * remaining.length)]);
        }
      }
    }

    // Update divers
    for (const e of enemies) {
      if (!e.alive || !e.diving) continue;
      e.diveT += dt * 0.0006 * (1 + wave * 0.05);
      if (e.diveT >= 1) {
        // Return to formation or wrap
        e.diving = false;
        e.diveT = 0;
        if (e.y > GH) { e.y = -30; }
        continue;
      }
      const t = e.diveT;
      const t1 = 1 - t;
      // Cubic bezier
      e.x = t1 * t1 * t1 * e.diveStart.x + 3 * t1 * t1 * t * e.diveCtrl1.x + 3 * t1 * t * t * e.diveCtrl2.x + t * t * t * e.diveEnd.x;
      e.y = t1 * t1 * t1 * e.diveStart.y + 3 * t1 * t1 * t * e.diveCtrl1.y + 3 * t1 * t * t * e.diveCtrl2.y + t * t * t * e.diveEnd.y;

      // Enemy fires while diving — more aggressive at higher tiers
      e.fireTimer -= dt;
      const tier = getWaveTier();
      const fireDelay = Math.max(300, 800 - tier * 100) + Math.random() * (600 - tier * 80);
      if (e.fireTimer <= 0) {
        e.fireTimer = fireDelay;
        const bulletSpeed = ENEMY_BULLET_SPEED + tier * 0.4;
        enemyBullets.push({
          x: e.x + e.w / 2 - 2, y: e.y + e.h,
          vx: (Math.random() - 0.5) * (1.5 + tier * 0.3), vy: bulletSpeed,
          w: 4, h: 8, color: e.type === "striker" ? C.blue : C.purple,
        });
        // Tier 4+: commanders fire double shots
        if (tier >= 4 && e.type === "commander") {
          enemyBullets.push({
            x: e.x + e.w / 2 - 2, y: e.y + e.h,
            vx: (Math.random() - 0.5) * 2, vy: bulletSpeed * 0.9,
            w: 4, h: 8, color: C.gold,
          });
        }
      }
    }
  }

  function startDive(e) {
    e.diving = true;
    e.diveT = 0;
    e.diveStart = { x: e.x, y: e.y };
    // Bezier toward player, then swoop off screen
    const px = player.x + player.w / 2;
    const side = e.x < GW / 2 ? 1 : -1;
    e.diveCtrl1 = { x: e.x + side * (80 + Math.random() * 60), y: e.y + 120 + Math.random() * 80 };
    e.diveCtrl2 = { x: px + side * (40 + Math.random() * 40), y: GH * 0.6 + Math.random() * 80 };
    e.diveEnd = { x: e.baseX + formationX, y: e.baseY };
  }

  // ── POWERUPS ──
  function spawnPowerup(x, y) {
    if (Math.random() > 0.15) return;
    const types = ["rapid", "spread", "shield", "bomb"];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = { rapid: C.purple, spread: C.blue, shield: C.gold, bomb: C.violet };
    powerups.push({ x, y, w: 16, h: 16, vy: 2, type, color: colors[type], alpha: 1 });
  }

  function drawPowerup(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha * (0.7 + Math.sin(Date.now() * 0.006) * 0.3);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = p.color;
    // Diamond shape
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, p.y);
    ctx.lineTo(p.x + p.w, cy);
    ctx.lineTo(cx, p.y + p.h);
    ctx.lineTo(p.x, cy);
    ctx.closePath();
    ctx.fill();
    // Icon letter
    ctx.fillStyle = C.white;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icons = { rapid: "R", spread: "S", shield: "G", bomb: "B" };
    ctx.fillText(icons[p.type], cx, cy + 1);
    ctx.restore();
  }

  function applyPowerup(type) {
    sfxPowerup();
    if (type === "rapid") { player.rapidFire = true; player.rapidEnd = Date.now() + POWERUP_DURATION; }
    else if (type === "spread") { player.spreadShot = true; player.spreadEnd = Date.now() + POWERUP_DURATION; }
    else if (type === "shield") { player.shield = true; }
    else if (type === "bomb") {
      sfxBomb();
      shakeMag = 12;
      // Damage all enemies but ALWAYS leave survivors
      // Count alive enemies first, then decide who lives
      const aliveEnemies = enemies.filter(e => e.alive);
      const aliveCount = aliveEnemies.length;
      const minSurvivors = Math.max(3, Math.ceil(aliveCount * 0.3));
      // Shuffle alive enemies and protect the last minSurvivors
      const shuffled = [...aliveEnemies].sort(() => Math.random() - 0.5);
      const toKill = shuffled.slice(0, Math.max(0, aliveCount - minSurvivors));
      const toSpare = shuffled.slice(Math.max(0, aliveCount - minSurvivors));
      for (const e of toKill) {
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.violet, 8, 4);
        score += e.type === "commander" ? 200 : e.type === "striker" ? 150 : 100;
        e.alive = false;
      }
      for (const e of toSpare) {
        // Survivors take damage but live
        e.hp = 1;
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.violet, 4, 2);
      }
      if (boss && boss.alive) {
        boss.hp -= 10;
        spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, C.gold, 20, 5);
        if (boss.hp <= 0) {
          boss.alive = false;
          score += 2000 + wave * 500;
          spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, C.gold, 40, 6);
        }
      }
      enemyBullets = [];
      // Flash effect
      particles.push({ x: GW / 2, y: GH / 2, vx: 0, vy: 0, life: 1, decay: 0.04, size: GW, color: "rgba(138,43,226,0.15)" });
    }
  }

  // ── COLLISION ──
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ── SCREEN SHAKE ──
  function applyShake() {
    if (shakeMag > 0) {
      shakeX = (Math.random() - 0.5) * shakeMag;
      shakeY = (Math.random() - 0.5) * shakeMag;
      shakeMag *= 0.9;
      if (shakeMag < 0.3) shakeMag = 0;
    } else {
      shakeX = 0; shakeY = 0;
    }
  }

  // ── HUD ──
  function drawHUD() {
    // Background bar
    ctx.fillStyle = C.glass;
    ctx.fillRect(0, 0, GW, 40);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(GW, 40); ctx.stroke();

    ctx.font = "bold 14px 'Space Grotesk', monospace";
    ctx.textBaseline = "middle";

    // Score
    ctx.fillStyle = C.white;
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + score.toLocaleString(), 16, 21);

    // Wave
    ctx.textAlign = "center";
    ctx.fillStyle = C.violet;
    ctx.fillText("WAVE " + wave, GW / 2, 21);

    // High score
    ctx.fillStyle = C.gold;
    ctx.textAlign = "right";
    ctx.fillText("HI " + Math.max(score, highScore).toLocaleString(), GW - 100, 21);

    // Lives
    ctx.fillStyle = C.dim;
    ctx.textAlign = "right";
    for (let i = 0; i < lives; i++) {
      const lx = GW - 16 - i * 22;
      ctx.fillStyle = C.violet;
      ctx.beginPath();
      ctx.moveTo(lx, 14);
      ctx.lineTo(lx - 8, 28);
      ctx.lineTo(lx + 8, 28);
      ctx.closePath();
      ctx.fill();
    }

    // Active powerup indicators
    let piX = 16;
    const piY = GH - 22;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    if (player.rapidFire) {
      const remaining = Math.max(0, player.rapidEnd - Date.now());
      ctx.fillStyle = C.purple;
      ctx.fillText("RAPID " + Math.ceil(remaining / 1000) + "s", piX, piY);
      piX += 80;
    }
    if (player.spreadShot) {
      const remaining = Math.max(0, player.spreadEnd - Date.now());
      ctx.fillStyle = C.blue;
      ctx.fillText("SPREAD " + Math.ceil(remaining / 1000) + "s", piX, piY);
      piX += 90;
    }
    if (player.shield) {
      ctx.fillStyle = C.gold;
      ctx.fillText("SHIELD", piX, piY);
    }
  }

  // ── MENU SCREEN ──
  function drawMenu() {
    // Dim background
    ctx.fillStyle = "rgba(5,2,20,0.85)";
    ctx.fillRect(0, 0, GW, GH);

    drawStars();

    // Title
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // "VIOLET MEDIA GAMES" brand
    ctx.font = "900 16px 'Space Grotesk', sans-serif";
    ctx.fillStyle = C.dim;
    ctx.letterSpacing = "4px";
    ctx.fillText("VIOLET MEDIA GAMES", GW / 2, GH * 0.22);

    // Main title
    const grad = ctx.createLinearGradient(GW * 0.25, 0, GW * 0.75, 0);
    grad.addColorStop(0, C.white);
    grad.addColorStop(0.4, C.violet);
    grad.addColorStop(1, C.purple);
    ctx.fillStyle = grad;
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 30;
    ctx.font = "900 52px 'Space Grotesk', sans-serif";
    ctx.fillText("COSMIC GALAGA", GW / 2, GH * 0.34);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = "400 14px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("A Violet Media Games Production", GW / 2, GH * 0.42);

    // Controls info
    ctx.font = "500 13px 'Inter', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("ARROW KEYS / WASD to move  •  SPACE to fire  •  F fullscreen  •  ESC pause", GW / 2, GH * 0.55);
    if (isMobile) {
      ctx.fillText("TAP left/right to move  •  TAP center to fire", GW / 2, GH * 0.60);
    }

    // High score
    if (highScore > 0) {
      ctx.font = "bold 14px 'Space Grotesk', monospace";
      ctx.fillStyle = C.gold;
      ctx.fillText("HIGH SCORE: " + highScore.toLocaleString(), GW / 2, GH * 0.66);
    }

    // Start button pulse
    const pulse = 0.8 + Math.sin(Date.now() * 0.004) * 0.2;
    ctx.globalAlpha = pulse;
    ctx.font = "800 22px 'Space Grotesk', sans-serif";
    ctx.fillStyle = C.violet;
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 20;
    ctx.fillText("[ PRESS ENTER OR TAP TO START ]", GW / 2, GH * 0.78);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Sound toggle
    ctx.font = "500 12px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("M to toggle sound: " + (soundEnabled ? "ON" : "OFF"), GW / 2, GH * 0.90);

    ctx.restore();
  }

  // ── WAVE INTRO ──
  function drawWaveIntro() {
    ctx.fillStyle = "rgba(5,2,20,0.7)";
    ctx.fillRect(0, 0, GW, GH);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "900 42px 'Space Grotesk', sans-serif";
    const grad = ctx.createLinearGradient(GW * 0.3, 0, GW * 0.7, 0);
    grad.addColorStop(0, C.white);
    grad.addColorStop(1, C.violet);
    ctx.fillStyle = grad;
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 25;
    ctx.fillText("WAVE " + wave, GW / 2, GH * 0.42);

    if (wave % 5 === 0) {
      ctx.font = "700 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = C.gold;
      ctx.shadowColor = C.gold;
      ctx.fillText("— BOSS INCOMING —", GW / 2, GH * 0.52);
    }

    // Tier label — tells player what zone they're in
    const tier = getWaveTier();
    const tierNames = ["", "SECTOR ALPHA", "SECTOR BETA", "SECTOR GAMMA", "SECTOR DELTA", "FINAL SECTOR"];
    const tierColors = ["", "rgba(138,43,226,0.7)", "rgba(100,43,226,0.8)", "rgba(200,43,180,0.8)", "rgba(226,80,43,0.8)", "rgba(255,43,43,0.9)"];
    ctx.font = "600 14px 'Space Grotesk', sans-serif";
    ctx.fillStyle = tierColors[tier] || C.violet;
    ctx.shadowColor = tierColors[tier] || C.violet;
    ctx.shadowBlur = 10;
    ctx.fillText(tierNames[tier] || "", GW / 2, GH * 0.35);

    // Difficulty warning at tier transitions
    if (wave === 5 || wave === 9 || wave === 13 || wave === 17) {
      ctx.font = "600 12px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(255,200,50,0.7)";
      ctx.shadowColor = "rgba(255,200,50,0.4)";
      ctx.fillText("⚠ DIFFICULTY INCREASING", GW / 2, GH * 0.58);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── PAUSE ──
  function drawPause() {
    ctx.fillStyle = "rgba(5,2,20,0.75)";
    ctx.fillRect(0, 0, GW, GH);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 36px 'Space Grotesk', sans-serif";
    ctx.fillStyle = C.violet;
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 20;
    ctx.fillText("PAUSED", GW / 2, GH * 0.45);
    ctx.shadowBlur = 0;
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Press ESC to resume", GW / 2, GH * 0.55);
    ctx.restore();
  }

  // ── GAME OVER ──
  function drawGameOver() {
    ctx.fillStyle = "rgba(5,2,20,0.85)";
    ctx.fillRect(0, 0, GW, GH);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "900 14px 'Space Grotesk', sans-serif";
    ctx.fillStyle = C.dim;
    ctx.fillText("VIOLET MEDIA GAMES", GW / 2, GH * 0.24);

    ctx.font = "900 46px 'Space Grotesk', sans-serif";
    ctx.fillStyle = C.violet;
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 25;
    ctx.fillText("GAME OVER", GW / 2, GH * 0.36);
    ctx.shadowBlur = 0;

    ctx.font = "bold 20px 'Space Grotesk', monospace";
    ctx.fillStyle = C.white;
    ctx.fillText("SCORE: " + score.toLocaleString(), GW / 2, GH * 0.48);

    if (score >= highScore && score > 0) {
      ctx.font = "bold 16px 'Space Grotesk', monospace";
      ctx.fillStyle = C.gold;
      ctx.fillText("NEW HIGH SCORE!", GW / 2, GH * 0.55);
    } else {
      ctx.font = "500 14px 'Inter', monospace";
      ctx.fillStyle = C.gold;
      ctx.fillText("HIGH SCORE: " + highScore.toLocaleString(), GW / 2, GH * 0.55);
    }

    ctx.font = "bold 14px 'Space Grotesk', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("WAVE REACHED: " + wave, GW / 2, GH * 0.62);

    const pulse = 0.7 + Math.sin(Date.now() * 0.004) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.font = "800 20px 'Space Grotesk', sans-serif";
    ctx.fillStyle = C.violet;
    ctx.fillText("[ PRESS ENTER OR TAP TO PLAY AGAIN ]", GW / 2, GH * 0.76);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ── MOBILE TOUCH CONTROLS OVERLAY ──
  function drawTouchControls() {
    if (!isMobile || gameState !== "playing") return;
    ctx.save();

    // Left arrow button — bottom left
    const btnSize = 60, margin = 20;
    const leftX = margin, leftY = GH - btnSize - margin;
    const rightX = margin + btnSize + 15, rightY = leftY;
    const fireX = GW - btnSize - margin, fireY = GH - btnSize - margin;

    // Left button
    ctx.globalAlpha = touchLeft ? 0.5 : 0.2;
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.arc(leftX + btnSize / 2, leftY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = touchLeft ? 1 : 0.6;
    ctx.fillStyle = C.white;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◀", leftX + btnSize / 2, leftY + btnSize / 2);

    // Right button
    ctx.globalAlpha = touchRight ? 0.5 : 0.2;
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.arc(rightX + btnSize / 2, rightY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = touchRight ? 1 : 0.6;
    ctx.fillStyle = C.white;
    ctx.fillText("▶", rightX + btnSize / 2, rightY + btnSize / 2);

    // Fire button — larger, bottom right
    const fireBtnSize = 75;
    ctx.globalAlpha = touchFire ? 0.6 : 0.25;
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.arc(fireX + fireBtnSize / 2 - 8, fireY + fireBtnSize / 2 - 8, fireBtnSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = touchFire ? 1 : 0.7;
    ctx.fillStyle = "#050214";
    ctx.font = "bold 16px 'Space Grotesk', sans-serif";
    ctx.fillText("FIRE", fireX + fireBtnSize / 2 - 8, fireY + fireBtnSize / 2 - 8);

    ctx.restore();
  }

  // ── GAME RESET ──
  function resetGame() {
    score = 0;
    lives = 3;
    wave = 1;
    bullets = [];
    enemyBullets = [];
    particles = [];
    powerups = [];
    boss = null;
    player.x = GW / 2 - PLAYER_W / 2;
    player.y = GH - 60;
    player.invincible = 0;
    player.shield = false;
    player.rapidFire = false;
    player.spreadShot = false;
    shakeMag = 0;
    gameState = "waveIntro";
    waveTimer = 0;
    spawnWave();
    startBgMusic();
  }

  // ── UPDATE ──
  function update(dt) {
    updateStars();
    updateParticles();
    applyShake();

    // Retry bg music if it was waiting for load
    if (bgMusicWaiting && bgMusic && !bgMusicPlaying) startBgMusic();

    if (gameState === "waveIntro") {
      waveTimer += dt;
      if (waveTimer > 1800) {
        gameState = "playing";
        waveTimer = 0;
      }
      return;
    }

    if (gameState !== "playing") return;

    // Powerup timers
    if (player.rapidFire && Date.now() > player.rapidEnd) player.rapidFire = false;
    if (player.spreadShot && Date.now() > player.spreadEnd) player.spreadShot = false;
    if (player.invincible > 0) player.invincible -= dt;

    // Player movement
    let dx = 0;
    if (keys["ArrowLeft"] || keys["KeyA"] || touchLeft) dx -= PLAYER_SPEED;
    if (keys["ArrowRight"] || keys["KeyD"] || touchRight) dx += PLAYER_SPEED;
    player.x = Math.max(0, Math.min(GW - player.w, player.x + dx));

    // Firing
    const now = Date.now();
    const cooldown = player.rapidFire ? FIRE_COOLDOWN / 2 : FIRE_COOLDOWN;
    if ((keys["Space"] || touchFire) && now - player.lastFire > cooldown) {
      player.lastFire = now;
      sfxShoot();
      const bx = player.x + player.w / 2 - 2;
      const by = player.y;
      bullets.push({ x: bx, y: by, w: 4, h: 10, vy: -BULLET_SPEED });
      if (player.spreadShot) {
        bullets.push({ x: bx - 8, y: by + 4, w: 4, h: 10, vy: -BULLET_SPEED, vx: -1.8 });
        bullets.push({ x: bx + 8, y: by + 4, w: 4, h: 10, vy: -BULLET_SPEED, vx: 1.8 });
      }
      // Muzzle flash particles
      spawnParticles(bx + 2, by, C.violet, 3, 2);
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy;
      if (b.vx) b.x += b.vx;
      if (b.y < -10 || b.x < -10 || b.x > GW + 10) bullets.splice(i, 1);
    }

    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += (b.vx || 0);
      b.y += b.vy;
      if (b.y > GH + 10 || b.x < -10 || b.x > GW + 10) enemyBullets.splice(i, 1);
    }

    // Update formation
    updateFormation(dt);

    // Update boss
    updateBoss(dt);

    // Update powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      powerups[i].y += powerups[i].vy;
      if (powerups[i].y > GH + 20) powerups.splice(i, 1);
    }

    // ── COLLISION: bullets vs enemies ──
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (aabb(b, e)) {
          e.hp--;
          if (e.hp <= 0) {
            e.alive = false;
            sfxHit();
            const pts = e.type === "commander" ? 200 : e.type === "striker" ? 150 : 100;
            score += pts;
            const eColor = e.type === "commander" ? C.gold : e.type === "striker" ? C.blue : C.purple;
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, eColor, 20, 4);
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.white, 8, 2);
            spawnPowerup(e.x + e.w / 2 - 8, e.y + e.h / 2 - 8);
          } else {
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.white, 6, 2);
          }
          hit = true;
          break;
        }
      }
      // Bullets vs boss
      if (!hit && boss && boss.alive && boss.phase > 0) {
        if (b.x < boss.x + boss.w && b.x + b.w > boss.x && b.y < boss.y + boss.h && b.y + b.h > boss.y) {
          boss.hp--;
          spawnParticles(b.x, b.y, C.gold, 4, 2);
          hit = true;
          if (boss.hp <= 0) {
            boss.alive = false;
            sfxExplosion();
            score += 2000 + wave * 500;
            shakeMag = 15;
            spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, C.gold, 40, 6);
            spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, C.violet, 30, 5);
          }
        }
      }
      if (hit) bullets.splice(bi, 1);
    }

    // ── COLLISION: enemy bullets vs player ──
    if (player.invincible <= 0) {
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        const ph = { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 8 };
        if (aabb(b, ph)) {
          enemyBullets.splice(i, 1);
          if (player.shield) {
            player.shield = false;
            shakeMag = 5;
            spawnParticles(player.x + player.w / 2, player.y + player.h / 2, C.gold, 10, 3);
          } else {
            playerHit();
          }
          break;
        }
      }
    }

    // ── COLLISION: diving enemies vs player ──
    if (player.invincible <= 0) {
      for (const e of enemies) {
        if (!e.alive || !e.diving) continue;
        const ph = { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 8 };
        if (aabb(e, ph)) {
          e.alive = false;
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.purple, 10, 3);
          if (player.shield) {
            player.shield = false;
            shakeMag = 5;
          } else {
            playerHit();
          }
          break;
        }
      }
    }

    // ── COLLISION: powerups vs player ──
    for (let i = powerups.length - 1; i >= 0; i--) {
      if (aabb(powerups[i], player)) {
        applyPowerup(powerups[i].type);
        powerups.splice(i, 1);
      }
    }

    // ── WAVE CLEAR CHECK ──
    const allDead = enemies.every(e => !e.alive);
    const bossGone = !boss || !boss.alive;
    if (allDead && bossGone) {
      wave++;
      gameState = "waveIntro";
      waveTimer = 0;
      bullets = [];
      enemyBullets = [];
      powerups = [];
      spawnWave();
    }
  }

  function playerHit() {
    lives--;
    sfxExplosion();
    shakeMag = 10;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, C.violet, 20, 4);
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, C.blue, 15, 3);
    if (lives <= 0) {
      gameState = "gameover";
      sfxGameOver();
      stopBgMusic();
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("vm_galaga_hi", highScore.toString());
      }
    } else {
      player.invincible = 2000;
      player.x = GW / 2 - PLAYER_W / 2;
    }
  }

  // ── DRAW ──
  function draw() {
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(-10, -10, GW + 20, GH + 20);
    drawStars();

    if (gameState === "menu") {
      drawMenu();
      ctx.restore();
      return;
    }

    // Game world
    for (const e of enemies) drawEnemy(e);
    drawBoss(boss);
    drawPlayer();

    // Player bullets — with glowing trail
    for (const b of bullets) {
      // Trail
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = C.violet;
      ctx.fillRect(b.x + 1, b.y + b.h, b.w - 2, 12);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(b.x + 1, b.y + b.h + 8, b.w - 2, 8);
      ctx.globalAlpha = 1;
      // Bullet body
      ctx.fillStyle = C.white;
      ctx.shadowColor = C.violet;
      ctx.shadowBlur = 12;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;
    }

    // Enemy bullets — amber glow trails
    for (const b of enemyBullets) {
      const ec = b.color || C.blue;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = ec;
      ctx.fillRect(b.x + 1, b.y - 8, b.w - 2, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ec;
      ctx.shadowColor = ec;
      ctx.shadowBlur = 8;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;
    }

    // Powerups
    for (const p of powerups) drawPowerup(p);

    // Particles
    drawParticles();

    // Touch controls
    drawTouchControls();

    // HUD
    drawHUD();

    // Overlays
    if (gameState === "waveIntro") drawWaveIntro();
    if (gameState === "paused") drawPause();
    if (gameState === "gameover") drawGameOver();

    ctx.restore();
  }

  // ── GAME LOOP ──
  function loop(timestamp) {
    const dt = Math.min(timestamp - (lastTime || timestamp), 33.33); // cap at ~30fps min
    lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ── FULLSCREEN ──
  function toggleFullscreen() {
    canvasContainer = canvas.parentElement;
    if (!document.fullscreenElement) {
      const el = canvasContainer || canvas;
      (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    }
  }

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
    if (isFullscreen) {
      // Scale canvas to fill screen while maintaining 4:3 aspect ratio
      const screenW = window.innerWidth || screen.width;
      const screenH = window.innerHeight || screen.height;
      const scaleX = screenW / GW;
      const scaleY = screenH / GH;
      renderScale = Math.min(scaleX, scaleY);
      const newW = Math.floor(GW * renderScale);
      const newH = Math.floor(GH * renderScale);
      canvas.width = GW;
      canvas.height = GH;
      canvas.style.width = newW + "px";
      canvas.style.height = newH + "px";
      canvas.style.maxWidth = "none";
      // Center in fullscreen container
      canvas.style.position = "fixed";
      canvas.style.top = "50%";
      canvas.style.left = "50%";
      canvas.style.transform = "translate(-50%, -50%)";
      canvas.style.zIndex = "9999";
    } else {
      // Restore original canvas styling
      renderScale = 1;
      canvas.width = GW;
      canvas.height = GH;
      canvas.style.width = "";
      canvas.style.height = "";
      canvas.style.maxWidth = "";
      canvas.style.position = "";
      canvas.style.top = "";
      canvas.style.left = "";
      canvas.style.transform = "";
      canvas.style.zIndex = "";
    }
  }

  // Expose for external button
  window.VioletGalagaFullscreen = toggleFullscreen;

  // ── INPUT ──
  function setupInput() {
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;

      if (e.code === "Enter" || e.code === "Space") {
        if (gameState === "menu") { initAudio(); resetGame(); e.preventDefault(); }
        else if (gameState === "gameover") { resetGame(); e.preventDefault(); }
      }
      if (e.code === "Escape") {
        if (gameState === "playing") gameState = "paused";
        else if (gameState === "paused") gameState = "playing";
      }
      if (e.code === "KeyM") { soundEnabled = !soundEnabled; updateBgMusicVolume(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Space") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    // Fullscreen change listener
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    // Touch — button-based controls
    const btnSize = 60, margin = 20, fireBtnSize = 75;
    function getTouchAction(tx, ty) {
      const leftX = margin, leftY = GH - btnSize - margin;
      const rightX = margin + btnSize + 15, rightY = leftY;
      const fireX = GW - fireBtnSize - margin + 8, fireY = GH - fireBtnSize - margin + 8;
      // Check fire button (circle hit test)
      const fdx = tx - (fireX + fireBtnSize / 2 - 8), fdy = ty - (fireY + fireBtnSize / 2 - 8);
      if (Math.sqrt(fdx * fdx + fdy * fdy) < fireBtnSize / 2 + 10) return "fire";
      // Check left button
      const ldx = tx - (leftX + btnSize / 2), ldy = ty - (leftY + btnSize / 2);
      if (Math.sqrt(ldx * ldx + ldy * ldy) < btnSize / 2 + 10) return "left";
      // Check right button
      const rdx = tx - (rightX + btnSize / 2), rdy = ty - (rightY + btnSize / 2);
      if (Math.sqrt(rdx * rdx + rdy * rdy) < btnSize / 2 + 10) return "right";
      // Tap anywhere else on screen = fire (convenient)
      return "fire";
    }
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      initAudio();
      if (gameState === "menu" || gameState === "gameover") { resetGame(); return; }
      for (const t of e.changedTouches || e.touches) {
        const rect = canvas.getBoundingClientRect();
        const tx = (t.clientX - rect.left) / rect.width * GW;
        const ty = (t.clientY - rect.top) / rect.height * GH;
        const action = getTouchAction(tx, ty);
        if (action === "left") touchLeft = true;
        else if (action === "right") touchRight = true;
        else if (action === "fire") touchFire = true;
      }
    }, { passive: false });
    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      touchLeft = false; touchRight = false; touchFire = false;
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      touchLeft = false; touchRight = false; touchFire = false;
      for (const t of e.changedTouches || e.touches) {
        const rect = canvas.getBoundingClientRect();
        const tx = (t.clientX - rect.left) / rect.width * GW;
        const ty = (t.clientY - rect.top) / rect.height * GH;
        const action = getTouchAction(tx, ty);
        if (action === "left") touchLeft = true;
        else if (action === "right") touchRight = true;
        else if (action === "fire") touchFire = true;
      }
    }, { passive: false });

    // Click (for desktop menu)
    canvas.addEventListener("click", () => {
      initAudio();
      if (gameState === "menu" || gameState === "gameover") resetGame();
    });
  }

  // ── INIT ──
  function init() {
    canvas = document.getElementById("galaga-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    canvas.width = GW;
    canvas.height = GH;

    isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    player.x = GW / 2 - PLAYER_W / 2;
    player.y = GH - 60;

    initStars();
    setupInput();
    requestAnimationFrame(loop);
  }

  // Export init
  window.VioletGalaga = { init };

  // Auto-init if canvas exists when script loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
