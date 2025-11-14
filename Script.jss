const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');
const gameOverEl = document.getElementById('gameOver');
const winnerEl = document.getElementById('winner');

// Configuració del joc
let gameRunning = true;
let playerScore = 0;
let aiScore = 0;
const WINNING_SCORE = 11;

// Elements del joc
const paddleWidth = 15;
const paddleHeight = 80;
const ballSize = 12;

let player = {
  x: canvas.width - paddleWidth - 10,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
  dy: 0,
  speed: 8
};

let ai = {
  x: 10,
  y: canvas.height / 2 - paddleHeight / 2,
  width: paddleWidth,
  height: paddleHeight,
  dy: 0,
  speed: 6
};

let ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  width: ballSize,
  height: ballSize,
  dx: 7 * (Math.random() > 0.5 ? 1 : -1),
  dy: 7 * (Math.random() - 0.5),
  speed: 7
};

// Controls
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

// Bucle principal del joc
function gameLoop() {
  if (!gameRunning) return;

  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Actualitzar posicions
function update() {
  // Moviment jugador
  if (keys['ArrowUp'] && player.y > 0) {
    player.y -= player.speed;
  }
  if (keys['ArrowDown'] && player.y < canvas.height - player.height) {
    player.y += player.speed;
  }

  // IA simple (seguesix la pilota)
  const targetY = ball.y - ai.height / 2;
  if (ai.y + ai.dy > 0 && ai.y + ai.dy < canvas.height - ai.height) {
    ai.dy = (targetY - ai.y) * 0.15;
    ai.y += ai.dy;
  }

  // Moviment pilota
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Rebot amb pals
  if (collides(ball, player) || collides(ball, ai)) {
    ball.dx *= -1;
    ball.speed += 0.2; // Acelera lleugerament
  }

  // Rebot amb parets superiors/inferiors
  if (ball.y <= 0 || ball.y >= canvas.height - ball.height) {
    ball.dy *= -1;
  }

  // Punts - pilota surt de la pantalla
  if (ball.x < 0) {
    playerScore++;
    playerScoreEl.textContent = playerScore;
    resetBall();
    checkWin();
  }
  if (ball.x > canvas.width) {
    aiScore++;
    aiScoreEl.textContent = aiScore;
    resetBall();
    checkWin();
  }
}

// Detecció de col·lisions
function collides(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

// Reiniciar pilota
function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.dx = ball.speed * (Math.random() > 0.5 ? 1 : -1);
  ball.dy = ball.speed * (Math.random() - 0.5);
  ball.speed = 7;
}

// Comprovar guanyador
function checkWin() {
  if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
    gameRunning = false;
    const winner = playerScore >= WINNING_SCORE ? '🎉 HAS GUANYAT!' : '🤖 L\'IA HA GUANYAT!';
    winnerEl.textContent = winner;
    gameOverEl.style.display = 'block';
  }
}

// Dibuixar tot
function draw() {
  // Fons negre
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Línia central
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 4;
  ctx.setLineDash([15, 15]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pal jugador (verd)
  ctx.fillStyle = '#00ff88';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Pal IA (vermell)
  ctx.fillStyle = '#ff0040';
  ctx.fillRect(ai.x, ai.y, ai.width, ai.height);

  // Pilota (blanc amb brillantor)
  ctx.fillStyle = '#fff';
  ctx.fillRect(ball.x, ball.y, ball.width, ball.height);
  
  // Reflecció a la pilota
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(ball.x + 2, ball.y + 2, 4, 4);
}

// Reiniciar joc
function resetGame() {
  playerScore = 0;
  aiScore = 0;
  playerScoreEl.textContent = '0';
  aiScoreEl.textContent = '0';
  gameOverEl.style.display = 'none';
  gameRunning = true;
  
  // Reiniciar posicions
  player.y = canvas.height / 2 - paddleHeight / 2;
  ai.y = canvas.height / 2 - paddleHeight / 2;
  resetBall();
  
  gameLoop();
}

// Iniciar joc
gameLoop();
