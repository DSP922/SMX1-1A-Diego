<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pong - Joc senzill</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="game-container">
    <div class="score">
      <span id="playerScore">0</span> - <span id="aiScore">0</span>
    </div>
    <canvas id="gameCanvas" width="800" height="400"></canvas>
    <div class="game-over" id="gameOver" style="display: none;">
      <h2 id="winner"></h2>
      <button onclick="resetGame()">Jugar de nou</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>
