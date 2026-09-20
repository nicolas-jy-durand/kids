const area = document.querySelector('#game-area');
const answer = document.querySelector('#answer');
const scoreEl = document.querySelector('#score');
const levelEl = document.querySelector('#level');
const statusEl = document.querySelector('#status-message');
const startScreen = document.querySelector('#start-screen');
const gameOverModal = document.querySelector('#gameover-modal');
const freezeOverlay = document.querySelector('#freeze-overlay');
const freezeCount = document.querySelector('#freeze-count');

let game = null;
let audioCtx;

function tone(freq, duration, type = 'sine', slide = 0) {
  try {
    audioCtx ??= new AudioContext();
    const oscillator = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(.075, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    oscillator.connect(gain).connect(audioCtx.destination); oscillator.start(); oscillator.stop(audioCtx.currentTime + duration);
  } catch (_) { /* Audio is optional when unavailable. */ }
}

function setStatus(text, kind = '') { statusEl.textContent = text; statusEl.className = `status-message ${kind}`; }
function scoreText(value) { scoreEl.textContent = String(value).padStart(4, '0'); }

function makeProblem(bonus = false) {
  let a = 1 + Math.floor(Math.random() * 20); let b = 1 + Math.floor(Math.random() * 20);
  const subtract = Math.random() > .5;
  if (subtract && b > a) [a, b] = [b, a];
  const result = subtract ? a - b : a + b;
  return { text: `${a} ${subtract ? '−' : '+'} ${b}`, result, bonus };
}

function spawnOperation(bonus = false) {
  if (!game?.running || game.frozen || game.operations.length >= 3) return;
  const problem = makeProblem(bonus); const element = document.createElement('div');
  element.className = `operation${bonus ? ' bonus' : ''}`;
  element.innerHTML = bonus ? `<small>BONUS VITESSE</small><span>${problem.text}</span>` : problem.text;
  const maxX = Math.max(8, area.clientWidth - (bonus ? 205 : 142) - 12);
  const op = { ...problem, element, x: 7 + Math.random() * maxX, y: 72, speed: 19 + game.level * 4 + Math.random() * 8 };
  element.style.left = `${op.x}px`; element.style.top = `${op.y}px`; area.append(element); game.operations.push(op);
}

function particles(op) {
  const rect = op.element.getBoundingClientRect(); const parent = area.getBoundingClientRect();
  for (let i = 0; i < 16; i++) { const spark = document.createElement('i'); spark.className = 'spark'; spark.style.left = `${rect.left - parent.left + rect.width / 2}px`; spark.style.top = `${rect.top - parent.top + rect.height / 2}px`; spark.style.color = op.bonus ? '#fff35c' : '#59f5ff'; spark.style.setProperty('--x', `${(Math.random() - .5) * 100}px`); spark.style.setProperty('--y', `${(Math.random() - .5) * 100}px`); document.querySelector('#particles').append(spark); setTimeout(() => spark.remove(), 600); }
  const points = document.createElement('div'); points.className = 'pop-text'; points.textContent = op.bonus ? 'FREEZE !' : `+${op.points} PTS`;
  points.style.left = `${op.x + 25}px`; points.style.top = `${op.y}px`; area.append(points); setTimeout(() => points.remove(), 850);
}

function solve(op) {
  game.operations = game.operations.filter(item => item !== op);
  if (op.bonus) { op.element.classList.add('exploding'); particles(op); setTimeout(() => op.element.remove(), 180); tone(270, .24, 'sawtooth', 650); freeze(); setStatus('BONUS VITESSE ! Tout est gelé pendant 5 secondes.', 'good'); return; }
  game.solved++; const heightBonus = Math.max(0, Math.round((area.clientHeight - op.y) / area.clientHeight * 55)); op.points = 100 + heightBonus;
  op.element.classList.add('exploding'); particles(op); setTimeout(() => op.element.remove(), 180);
  game.score += op.points; scoreText(game.score); const nextLevel = Math.floor(game.score / 500) + 1;
  if (nextLevel > game.level) { game.level = nextLevel; levelEl.textContent = String(game.level).padStart(2, '0'); setStatus(`NIVEAU ${game.level} ! Les calculs accélèrent.`, 'good'); }
  else setStatus(`Bien joué ! +${op.points} points`, 'good');
  tone(460, .11, 'square', 230);
  if (game.solved % 5 === 0) setTimeout(() => spawnOperation(true), 330);
}

function freeze() {
  game.frozen = true; freezeOverlay.classList.add('active'); let remaining = 5; freezeCount.textContent = remaining;
  game.freezeTimer = setInterval(() => { remaining--; freezeCount.textContent = remaining; if (remaining <= 0) { clearInterval(game.freezeTimer); game.frozen = false; freezeOverlay.classList.remove('active'); setStatus('Le temps repart ! Reste concentré.', ''); } }, 1000);
}

function checkAnswer() {
  if (!game?.running || !answer.value.trim()) return;
  const value = Number(answer.value); const matches = game.operations.filter(op => op.result === value);
  if (matches.length) { answer.value = ''; matches.forEach(solve); } else { tone(130, .08, 'triangle', -40); setStatus('Pas encore... essaie un autre calcul !', 'miss'); answer.select(); }
}

function gameOver() {
  if (!game?.running) return; game.running = false; clearInterval(game.freezeTimer); freezeOverlay.classList.remove('active'); answer.disabled = true; tone(180, .55, 'sawtooth', -120);
  const previous = Number(localStorage.getItem('sauvetage-math-high-score') || 0); const high = Math.max(previous, game.score); localStorage.setItem('sauvetage-math-high-score', high);
  document.querySelector('#final-score').textContent = game.score; document.querySelector('#high-score').textContent = high; gameOverModal.classList.remove('hidden');
}

function tick(time) {
  if (!game?.running) return; const dt = Math.min((time - game.lastTime) / 1000, .05); game.lastTime = time;
  if (!game.frozen) {
    const dangerY = area.clientHeight - 35;
    for (const op of [...game.operations]) { op.y += op.speed * dt; op.element.style.top = `${op.y}px`; if (op.y + op.element.offsetHeight >= dangerY) return gameOver(); }
    if (time >= game.nextSpawn && game.operations.length < Math.min(3, game.level)) { spawnOperation(); game.nextSpawn = time + Math.max(1150, 3100 - game.level * 230); }
  }
  requestAnimationFrame(tick);
}

function startGame() {
  game?.operations?.forEach(op => op.element.remove()); clearInterval(game?.freezeTimer); game = { running:true, score:0, level:1, solved:0, operations:[], frozen:false, nextSpawn:performance.now() + 1000, lastTime:performance.now() };
  scoreText(0); levelEl.textContent = '01'; answer.disabled = false; answer.value = ''; startScreen.style.display = 'none'; gameOverModal.classList.add('hidden'); setStatus('Repère le calcul et tape sa réponse !'); spawnOperation(); answer.focus(); requestAnimationFrame(tick);
}

document.querySelector('#start-button').addEventListener('click', startGame); document.querySelector('#restart-button').addEventListener('click', startGame);
answer.addEventListener('keydown', event => { if (event.key === 'Enter') checkAnswer(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && game?.running) answer.focus(); });
