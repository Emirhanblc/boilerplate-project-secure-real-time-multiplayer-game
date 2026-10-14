import Player from "./Player.mjs";
import Collectible from "./Collectible.mjs";

const socket = io();
const canvas = document.getElementById("game-window");
const context = canvas.getContext("2d");

let myPlayer;
let otherPlayers = [];
let currentCoin;

socket.on("connect", () => {
  myPlayer = new Player({
    x: Math.floor(Math.random() * 580) + 10,
    y: Math.floor(Math.random() * 380) + 10,
    score: 0,
    id: socket.id,
  });
  // Sunucuya "Ben geldim, koordinatlarım bunlar" de
  socket.emit("init", myPlayer);
});

// Sunucudan gelen oyun güncellemelerini dinle
socket.on("update-game", (data) => {
  // 1. KENDİ oyuncumuzun güncel bilgilerini (özellikle artan skoru) sunucudan al
  const serverMe = data.players.find((p) => p.id === socket.id);
  if (serverMe && myPlayer) {
    myPlayer.score = serverMe.score;
  }

  // Kendimiz hariç diğer tüm oyuncuları filtreleyerek al
  otherPlayers = data.players.filter((p) => p.id !== socket.id);
  // Altının güncel konumunu al
  currentCoin = new Collectible(data.coin);
});

// Klavye tuş dinleyicileri (WASD / Ok Tuşları)
document.addEventListener("keydown", (e) => {
  if (!myPlayer) return;

  let dir = null;
  if (e.key === "w" || e.key === "ArrowUp") dir = "up";
  if (e.key === "s" || e.key === "ArrowDown") dir = "down";
  if (e.key === "a" || e.key === "ArrowLeft") dir = "left";
  if (e.key === "d" || e.key === "ArrowRight") dir = "right";

  if (dir) {
    myPlayer.moveDir(dir);

    // 1. Her halükarda yeni koordinatımızı sunucuya yolla
    socket.emit("move-player", myPlayer);

    // 2. Eğer o koordinatta altın varsa, altını aldığımızı da yolla
    if (currentCoin && myPlayer.collision(currentCoin)) {
      socket.emit("coin-collected", { playerId: myPlayer.id });
    }
  }
});

function update() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Arka plan rengi
  context.fillStyle = "#222";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Altını (Sarı Daire) çiz
  if (currentCoin) {
    context.fillStyle = "gold";
    context.beginPath();
    context.arc(currentCoin.x + 10, currentCoin.y + 10, 10, 0, 2 * Math.PI);
    context.fill();
  }

  // Kendi oyuncumuzu (Beyaz Kare) çiz
  if (myPlayer) {
    context.fillStyle = "white";
    context.fillRect(myPlayer.x, myPlayer.y, 20, 20);

    // UI: Sol üste skor ve rütbe yazdır
    context.font = "16px Arial";
    context.fillStyle = "white";
    context.fillText(`Score: ${myPlayer.score}`, 10, 20);

    // myPlayer'ı otherPlayers dizisiyle birleştirip calculateRank fonksiyonuna yolluyoruz
    const allPlayers = [myPlayer, ...otherPlayers];
    context.fillText(myPlayer.calculateRank(allPlayers), 10, 40);
  }

  // Diğer oyuncuları (Kırmızı Kare) çiz
  otherPlayers.forEach((p) => {
    context.fillStyle = "red";
    context.fillRect(p.x, p.y, 20, 20);
  });

  requestAnimationFrame(update);
}

requestAnimationFrame(update);
