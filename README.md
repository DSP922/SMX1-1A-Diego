<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<title>Pong</title>

<style>
    body {
        background: #111;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        overflow: hidden;
    }

    canvas {
        background: #222;
        border: 3px solid white;
    }

    #marcador {
        position: absolute;
        top: 20px;
        color: white;
        font-size: 32px;
        font-family: Arial, sans-serif;
    }
</style>

</head>
<body>

<div id="marcador">Jugador: 0 | Oponent: 0</div>
<canvas id="joc" width="700" height="500"></canvas>

<script>
const canvas = document.getElementById("joc");
const ctx = canvas.getContext("2d");
const marcador = document.getElementById("marcador");

let jugadorPunts = 0;
let oponentPunts = 0;

const raqueta = {
    ample: 10,
    alt: 80,
    x: 20,
    y: canvas.height / 2 - 40,
    velocitat: 6
};

const oponent = {
    ample: 10,
    alt: 80,
    x: canvas.width - 30,
    y: canvas.height / 2 - 40,
    velocitat: 4
};

const pilota = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radi: 10,
    velX: 5,
    velY: 5
};

let amunt = false;
let avall = false;

document.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") amunt = true;
    if (e.key === "ArrowDown") avall = true;
});

document.addEventListener("keyup", e => {
    if (e.key === "ArrowUp") amunt = false;
    if (e.key === "ArrowDown") avall = false;
});

function mouJugador() {
    if (amunt && raqueta.y > 0) raqueta.y -= raqueta.velocitat;
    if (avall && raqueta.y + raqueta.alt < canvas.height) raqueta.y += raqueta.velocitat;
}

function mouOponent() {
    if (oponent.y + oponent.alt / 2 < pilota.y) oponent.y += oponent.velocitat;
    else oponent.y -= oponent.velocitat;
}

function mouPilota() {
    pilota.x += pilota.velX;
    pilota.y += pilota.velY;

    if (pilota.y - pilota.radi < 0 || pilota.y + pilota.radi > canvas.height) {
        pilota.velY *= -1;
    }

    if (
        pilota.x - pilota.radi < raqueta.x + raqueta.ample &&
        pilota.y > raqueta.y &&
        pilota.y < raqueta.y + raqueta.alt
    ) {
        pilota.velX *= -1;
    }

    if (
        pilota.x + pilota.radi > oponent.x &&
        pilota.y > oponent.y &&
        pilota.

