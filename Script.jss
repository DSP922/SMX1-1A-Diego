const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 500;

// Marcador
let playerScore = 0;
let aiScore = 0;

// Pales
const paddleWidth = 15;
const paddleHeight = 100;

const player = { x: 20, y: canvas.height / 2 - paddleHeight / 2, speed: 8 };
const ai = { x: canvas.width - 35, y: canvas.height / 2 - paddleHeight / 2, speed: 5 };

// Pilota
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 12,
    speedX: 5,
    speedY: 5
};

// Control jugador
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") player.y -= player.speed;
    if (e.key === "ArrowDown") player.y += player.speed;
});

// Dibuixar rectangle
function rect(x, y, w, h, color = "white") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

// Dibuixar pilota
function drawBall() {
    ctx.fillStyle = "white";
    ctx.fillRect(ball.x, ball.y, ball.size, ball.size);
}

// Dibuixar marcador
function drawScore() {
    ctx.fillStyle = "white";
    ctx.font = "32px Arial";
    ctx.fillText(playerScore, canvas.width / 4, 40);
    ctx.fillText(aiScore, (canvas.width / 4) * 3, 40);
}

// Reset de la pilota després de punt
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX *= -1;

    // Lleugera variació perquè no sigui repetitiu
    ball.speedY = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 3);
}

// Actualitzar física del joc
function update() {
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Rebot vertical
    if (ball.y <= 0 || ball.y + ball.size >= canvas.height) {
        ball.speedY *= -1;
    }

    // Rebot amb el jugador
    if (
        ball.x <= player.x + paddleWidth &&
        ball.y + ball.size >= player.y &&
        ball.y <= player.y + paddleHeight
    ) {
        ball.speedX *= -1.1; // mica més ràpida
    }

    // Rebot amb la IA
    if (
        ball.x + ball.size >= ai.x &&
        ball.y + ball.size >= ai.y &&
        ball.y <= ai.y + paddleHeight
    ) {
        ball.speedX *= -1.1;
    }

    // Punt per IA
    if (ball.x < 0) {
        aiScore++;
        resetBall();
    }

    // Punt per jugador
    if (ball.x > canvas.width) {
        playerScore++;
        resetBall();
    }

    // Moviment IA
    if (ai.y + paddleHeight / 2 < ball.y) ai.y += ai.speed;
    else ai.y -= ai.speed;
}

// Dibuixar pantalla
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibuixar jugador i IA
    rect(player.x, player.y, paddleWidth, paddleHeight);
    rect(ai.x, ai.y, paddleWidth, paddleHeight);

    // Pilota
    drawBall();

    // Marcador
    drawScore();
}

// Bucle del joc
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

