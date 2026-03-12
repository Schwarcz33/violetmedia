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

  // ── AUDIO (Web Audio API synth) ──
  let audioCtx = null;
  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
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

  // ── STARS BACKGROUND ──
  function initStars() {
    stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * GW,
        y: Math.random() * GH,
        speed: Math.random() * 1.5 + 0.3,
        size: Math.random() * 1.8 + 0.3,
        color: [C.white, C.violet, C.blue, C.purple][Math.floor(Math.random() * 4)],
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
  }
  function updateStars() {
    for (const s of stars) {
      s.y += s.speed;
      if (s.y > GH) { s.y = 0; s.x = Math.random() * GW; }
    }
  }
  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.size, s.size);
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
        decay: Math.random() * 0.03 + 0.02,
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
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
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

    // Eye/core
    ctx.fillStyle = C.white;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.globalAlpha = 1;

    // Commander hit indicator
    if (e.type === "commander" && e.hp === 1) {
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, e.w / 2 + 3, 0, Math.PI * 2);
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
  function spawnWave() {
    enemies = [];
    boss = null;
    formationX = 0;
    formationDir = 1;
    formationSpeed = 0.4 + wave * 0.06;
    diveInterval = Math.max(800, 2500 - wave * 150);
    diveTimer = 0;

    if (wave % 5 === 0) {
      // Boss wave — fewer grunts + boss
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < COLS; c++) {
          enemies.push(createEnemy(c, r, r === 0 ? "striker" : "grunt"));
        }
      }
      boss = createBoss();
    } else {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          let type = "grunt";
          if (r === 0) type = "commander";
          else if (r <= 1 + Math.floor(wave / 3)) type = "striker";
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
        // At higher waves, send pairs
        if (wave >= 3 && Math.random() < 0.4 && available.length > 1) {
          const second = available.filter(e => e !== diver);
          if (second.length > 0) startDive(second[Math.floor(Math.random() * second.length)]);
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

      // Enemy fires while diving
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = 800 + Math.random() * 600;
        enemyBullets.push({
          x: e.x + e.w / 2 - 2, y: e.y + e.h,
          vx: (Math.random() - 0.5) * 1.5, vy: ENEMY_BULLET_SPEED,
          w: 4, h: 8, color: e.type === "striker" ? C.blue : C.purple,
        });
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
      // Kill all enemies on screen
      for (const e of enemies) {
        if (e.alive) {
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.violet, 8, 4);
          score += e.type === "commander" ? 200 : e.type === "striker" ? 150 : 100;
          e.alive = false;
        }
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
    ctx.fillText("ARROW KEYS / WASD to move  •  SPACE to fire  •  ESC to pause", GW / 2, GH * 0.55);
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
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1;
    // Left zone
    ctx.strokeRect(0, GH * 0.6, GW * 0.33, GH * 0.4);
    // Right zone
    ctx.strokeRect(GW * 0.67, GH * 0.6, GW * 0.33, GH * 0.4);
    // Fire zone
    ctx.strokeRect(GW * 0.33, GH * 0.6, GW * 0.34, GH * 0.4);

    ctx.globalAlpha = 0.2;
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.white;
    ctx.fillText("<", GW * 0.165, GH * 0.8);
    ctx.fillText("FIRE", GW * 0.5, GH * 0.8);
    ctx.fillText(">", GW * 0.835, GH * 0.8);
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
  }

  // ── UPDATE ──
  function update(dt) {
    updateStars();
    updateParticles();
    applyShake();

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
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, eColor, 12, 3);
            spawnPowerup(e.x + e.w / 2 - 8, e.y + e.h / 2 - 8);
          } else {
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, C.white, 4, 2);
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

    // Bullets
    ctx.shadowColor = C.violet;
    ctx.shadowBlur = 8;
    for (const b of bullets) {
      ctx.fillStyle = C.violet;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.shadowBlur = 0;

    // Enemy bullets
    for (const b of enemyBullets) {
      ctx.fillStyle = b.color || C.blue;
      ctx.shadowColor = b.color || C.blue;
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.shadowBlur = 0;

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
      if (e.code === "KeyM") soundEnabled = !soundEnabled;
      if (e.code === "Space") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    // Touch
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      initAudio();
      if (gameState === "menu" || gameState === "gameover") { resetGame(); return; }
      for (const t of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        const tx = (t.clientX - rect.left) / rect.width * GW;
        if (tx < GW * 0.33) touchLeft = true;
        else if (tx > GW * 0.67) touchRight = true;
        else touchFire = true;
      }
    }, { passive: false });
    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      touchLeft = false; touchRight = false; touchFire = false;
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });

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
