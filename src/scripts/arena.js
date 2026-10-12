import { FIGHTERS, originalSpriteUrl, spriteFile } from './fighters.mjs';
import { BOARD, createBattle, updateBattle, getSpriteFrame } from './battle.mjs';

const canvas = document.getElementById('arena');
if (!canvas) throw new Error('O elemento #arena nao foi encontrado.');
const ctx = canvas.getContext('2d', { alpha: false });
const base = (canvas.dataset.base || '/').replace(/\/?$/, '/');
const stage = document.getElementById('stage');
const restart = document.getElementById('restart');
const overlay = document.getElementById('outcome');
const outcomeTitle = document.getElementById('outcome-title');
const outcomeSubtitle = document.getElementById('outcome-subtitle');
const stateText = document.getElementById('state-text');
const activityText = document.getElementById('activity-text');
const loading = document.getElementById('loading');
const hpBars = [document.getElementById('hp-0'), document.getElementById('hp-1')];
const hpTexts = [document.getElementById('hp-text-0'), document.getElementById('hp-text-1')];
const avatarCanvases = [document.getElementById('avatar-0'), document.getElementById('avatar-1')];

let battle = createBattle();
let lastTime = 0;
let lastHudUpdate = -1;
const sprites = new Map();
let deviceScale = 1;

function sizeCanvas() {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  if (deviceScale === scale && canvas.width === BOARD.width * scale) return;
  deviceScale = scale;
  canvas.width = BOARD.width * scale;
  canvas.height = BOARD.height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
window.addEventListener('resize', sizeCanvas);
sizeCanvas();

function loadSprite(fighter, animation) {
  return new Promise(resolve => {
    const pic = new Image();
    let usingOrigin = false;
    pic.decoding = 'async';
    pic.onload = () => {
      sprites.set(`${fighter.id}:${animation}`, pic);
      resolve(true);
    };
    pic.onerror = () => {
      if (!usingOrigin) {
        usingOrigin = true;
        pic.src = originalSpriteUrl(fighter, animation);
      } else resolve(false);
    };
    pic.src = `${base}sprites/${spriteFile(fighter, animation)}`;
  });
}

const loadingImages = FIGHTERS.flatMap(type => Object.keys(type.sprites).map(action => loadSprite(type, action)));
Promise.all(loadingImages).then(results => {
  loading.hidden = true;
  if (!results.some(Boolean)) activityText.textContent = 'Sprites indisponiveis; modo demonstracao ativo';
});

const glow = (x, y, radius, color, opacity = 1) => {
  ctx.save();
  ctx.globalAlpha = opacity;
  const g = ctx.createRadialGradient(x, y, 1, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
};

function ellipse(x, y, rx, ry, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawStage(t) {
  const bg = ctx.createLinearGradient(0, 0, 0, BOARD.height);
  bg.addColorStop(0, '#111d31');
  bg.addColorStop(.48, '#152440');
  bg.addColorStop(1, '#080f20');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);

  glow(222, 125, 260, '#104263', .25);
  glow(910, 130, 280, '#45265a', .32);
  glow(564, 310, 290, '#3a6988', .12);

  // Arquitetura do estadio, simples e totalmente desenhada por Canvas.
  for (const [x, flip] of [[72, 1], [1048, -1]]) {
    ctx.save();
    ctx.translate(x, 0); ctx.scale(flip, 1);
    ctx.fillStyle = '#0b1627';
    ctx.fillRect(-60, 0, 70, 480);
    ctx.fillStyle = '#1b3150';
    ctx.fillRect(-60, 0, 9, 480);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#203a5b' : '#162844';
      ctx.fillRect(-52, 38 + i * 91, 62, 8);
    }
    ctx.restore();
  }
  ctx.fillStyle = '#0c172a';
  ctx.fillRect(0, 495, BOARD.width, 95);
  ctx.fillStyle = 'rgba(115, 185, 211, .06)';
  ctx.fillRect(0, 493, BOARD.width, 2);

  ctx.save();
  ctx.shadowColor = '#284e87';
  ctx.shadowBlur = 42;
  ellipse(560, 426, 512, 164, '#11233d', '#52708b', 2);
  ctx.restore();
  ellipse(560, 420, 497, 154, '#162944', '#536b85', 2);
  ellipse(560, 419, 467, 137, null, 'rgba(119,169,201,.23)', 1.5);
  ellipse(560, 420, 396, 112, null, 'rgba(122,176,216,.10)', 1.2);

  ctx.save();
  ctx.beginPath(); ctx.ellipse(560, 420, 465, 136, 0, 0, Math.PI * 2); ctx.clip();
  // Linhas da quadra imitando pedras tecnomagicas.
  for (let x = -120; x <= 1290; x += 76) {
    ctx.strokeStyle = 'rgba(111,170,203,.085)';
    ctx.lineWidth = 1;
    ctx.beginPath();ctx.moveTo(x - 190, 280);ctx.lineTo(x + 190, 580);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x + 190, 280);ctx.lineTo(x - 190, 580);ctx.stroke();
  }
  for (let y = 316; y <= 560; y += 42) {
    ctx.strokeStyle = 'rgba(100,155,186,.05)';
    ctx.beginPath();ctx.moveTo(55, y);ctx.lineTo(1065, y);ctx.stroke();
  }
  ctx.restore();

  ellipse(560, 412, 112, 58, 'rgba(81,150,191,.032)', 'rgba(105,190,219,.18)', 1.5);
  ellipse(560, 412, 80, 40, null, 'rgba(105,190,219,.12)', 1);
  glow(560, 410, 132, '#2878aa', .085 + .03 * Math.sin(t * 2));
  ctx.save();ctx.translate(560, 412);ctx.scale(1, .5);ctx.rotate(t * .08);
  ctx.strokeStyle = 'rgba(116,195,236,.17)';ctx.lineWidth = 2;
  for (let i=0;i<4;i++){
    ctx.rotate(Math.PI/2);
    ctx.beginPath();ctx.moveTo(0,-39);ctx.lineTo(14,-23);ctx.lineTo(0,-6);ctx.lineTo(-14,-23);ctx.closePath();ctx.stroke();
  }
  ctx.restore();
  // Pontos de luz do cenario: posicoes deterministicas, sem flicker aleatorio.
  for (let i = 0; i < 21; i++) {
    const x = (i * 213.73 + 127) % 1120, y = (i * 73.21 + 41) % 285;
    const alpha = .13 + .09 * Math.sin(t * 1.1 + i);
    ctx.fillStyle = `rgba(187,218,249,${alpha})`;
    ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
}

function drawShadow(f) {
  ctx.save();
  const r = f.defeated ? 23 : 57;
  const fill = ctx.createRadialGradient(f.x, f.y + 4, 2, f.x, f.y + 4, r);
  fill.addColorStop(0, 'rgba(0,0,0,.47)');
  fill.addColorStop(1, 'transparent');
  ellipse(f.x, f.y + 4, r, r * .33, fill);
  ellipse(f.x, f.y + 5, r * .72, r * .23, null, f.defeated ? 'rgba(255,255,255,.05)' : `${f.type.color}3b`, 1.4);
  ctx.restore();
}

function drawPokemon(f, time) {
  if (f.defeated) return; // ao perder a vida, o Pokemon some da arena.
  const image = sprites.get(`${f.type.id}:${f.action}`) || sprites.get(`${f.type.id}:Idle`);
  ctx.save();
  let offsetY = 0;
  if (f.action === 'Walk') offsetY = Math.sin(time * 13) * 3;
  if (f.action === 'Attack') offsetY = Math.sin(f.actionTime * 22) * -1.8;
  if (f.hitFlash > 0) {
    glow(f.x, f.y - 72, 80, '#ffffff', f.hitFlash * .7);
  }
  if (image?.naturalWidth) {
    const action = sprites.has(`${f.type.id}:${f.action}`) ? f.action : 'Idle';
    const meta = f.type.sprites[action];
    const tileX = getSpriteFrame(meta.durations, f.actionTime, action !== 'Attack' && action !== 'Hurt');
    const rows = Math.floor(image.naturalHeight / meta.height);
    const direction = rows === 8 ? f.facing : 0;
    const scale = f.type.id === 'gengar' ? 3.25 : 3.2;
    const sx = tileX * meta.width, sy = direction * meta.height;
    const width = meta.width * scale, height = meta.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, meta.width, meta.height,
      Math.round(f.x - width / 2), Math.round(f.y - height + 17 + offsetY),
      Math.round(width), Math.round(height));
    ctx.imageSmoothingEnabled = true;
  } else {
    // Aparencia simples enquanto sprites sao carregados/offline.
    glow(f.x, f.y - 83, 75, f.type.color, .14);
    ctx.fillStyle = f.type.darkColor;
    ellipse(f.x, f.y - 75 + offsetY, 40, 48, f.type.darkColor, f.type.color, 3);
    ctx.textAlign = 'center';
    ctx.font = '700 42px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(f.side === 0 ? '✦' : '✧', f.x, f.y - 63 + offsetY);
  }
  ctx.restore();
}

function drawProjectiles() {
  for (const p of battle.projectiles) {
    const color = battle.fighters[p.owner].type.color;
    for (let i = p.trail.length - 1; i >= 0; i--) {
      const trail = p.trail[i];
      glow(trail.x, trail.y, 22, color, .06 + (p.trail.length - i) * .03);
      ellipse(trail.x, trail.y, Math.max(1, 5 - i * .6), Math.max(1, 5 - i * .6), color);
    }
    glow(p.x, p.y, 45, color, .56);
    ctx.save();ctx.shadowColor = color;ctx.shadowBlur=16;
    ellipse(p.x,p.y,10,10,'#fff',color,3);
    ctx.restore();
  }
}

function drawEffects() {
  for (const fx of battle.effects) {
    const progress = 1 - fx.time / fx.maxTime;
    glow(fx.x, fx.y, fx.r * (1 + progress), fx.color, (1-progress) * .65);
    ctx.save();ctx.globalAlpha = (1-progress) * .82;
    ellipse(fx.x, fx.y, fx.r * (.45 + progress), fx.r * (.45 + progress), null, fx.color, 4 - progress * 3);
    ctx.restore();
  }
  for (const floater of battle.floaters) {
    const progress = 1 - floater.time / floater.maxTime;
    ctx.save();
    ctx.globalAlpha = Math.min(1, floater.time * 3);
    ctx.fillStyle = floater.color;
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
    ctx.textAlign = 'center';ctx.font = '800 29px system-ui, sans-serif';
    ctx.fillText(floater.text, floater.x, floater.y - progress * 44);
    ctx.restore();
  }
}

function draw(t) {
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  drawStage(t);
  // Sombras antes dos sprites; todo o combate e 100% automatico.
  battle.fighters.forEach(drawShadow);
  battle.fighters.forEach(f => drawPokemon(f, t));
  drawProjectiles();
  drawEffects();
  if (battle.phase === 'finished') {
    const winner = battle.fighters[battle.winner];
    glow(winner.x, winner.y - 105, 120, winner.type.color, .16 + .07 * Math.sin(t * 4));
  }
}

function drawAvatars() {
  avatarCanvases.forEach((avatar, i) => {
    if (!avatar) return;
    const c = avatar.getContext('2d');
    const f = FIGHTERS[i], sprite = sprites.get(`${f.id}:Idle`);
    c.clearRect(0, 0, avatar.width, avatar.height);
    if (sprite) {
      const meta = f.sprites.Idle;
      c.imageSmoothingEnabled = false;
      c.drawImage(sprite, 0, 0, meta.width, meta.height, 7, 0, 80, 86);
    }
  });
}
Promise.all(loadingImages).then(drawAvatars);

function updateHud(force = false) {
  const now = performance.now();
  if (!force && now - lastHudUpdate < 60) return;
  lastHudUpdate = now;
  battle.fighters.forEach((f, i) => {
    hpBars[i].style.width = `${f.health}%`;
    hpTexts[i].textContent = `${f.health} / ${f.maxHealth}`;
    hpBars[i].classList.toggle('low-health', f.health < 30);
  });
  if (battle.phase === 'approaching') {
    stateText.textContent = 'SE APROXIMANDO';
    activityText.textContent = 'Os dois combatentes estao entrando no alcance';
  } else if (battle.phase === 'fighting') {
    stateText.textContent = 'EM COMBATE';
    activityText.textContent = 'Ataques automaticos • ate restar um vencedor';
  } else {
    stateText.textContent = 'LUTA ENCERRADA';
    activityText.textContent = 'Temos um vencedor!';
  }
}

function finish() {
  const win = battle.fighters[battle.winner];
  outcomeTitle.textContent = `${win.type.name} venceu!`;
  outcomeSubtitle.textContent = 'O adversario ficou sem pontos de vida.';
  overlay.hidden = false;
  stage.classList.add('finished');
  restart.classList.add('ready');
}

function restartBattle() {
  battle = createBattle();
  overlay.hidden = true;
  stage.classList.remove('finished');
  restart.classList.remove('ready');
  updateHud(true);
}
restart.addEventListener('click', restartBattle);
document.getElementById('again')?.addEventListener('click', restartBattle);

function tick(timestamp) {
  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
  lastTime = timestamp;
  if (!document.hidden) {
    const previousPhase = battle.phase;
    updateBattle(battle, dt);
    if (previousPhase !== 'finished' && battle.phase === 'finished') finish();
    updateHud();
    draw(timestamp / 1000);
  }
  window.requestAnimationFrame(tick);
}
updateHud(true);
window.requestAnimationFrame(tick);
