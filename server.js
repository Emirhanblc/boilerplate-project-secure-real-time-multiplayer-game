require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const expect = require("chai");
const socket = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");

const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const app = express();

// 1. CORS ayarı (/_api/app-info rotasının tarayıcıdan okunabilmesi için en üstte olmalı)
app.use(cors({ origin: "*" }));

// 2. Helmet güvenlik katmanları (16, 17, 18 ve 19. isterler)
if (typeof helmet.noSniff === "function") app.use(helmet.noSniff());
if (typeof helmet.xssFilter === "function") app.use(helmet.xssFilter());
if (typeof helmet.noCache === "function") app.use(helmet.noCache());
if (typeof helmet.hidePoweredBy === "function") {
  app.use(helmet.hidePoweredBy({ setTo: "PHP 7.4.3" }));
}

// 3. Sürüm farklarından etkilenmemek için başlıkları kesinleştiren middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Powered-By", "PHP 7.4.3");
  next();
});

app.use("/public", express.static(process.cwd() + "/public"));
app.use("/assets", express.static(process.cwd() + "/assets"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ana sayfa
app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// freeCodeCamp test rotaları (Güvenlik ve CORS tanımlamalarından SONRA çağrılmalı)
fccTestingRoutes(app);

// 404 Yakalayıcı
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

const portNum = process.env.PORT || 3000;

// Sunucuyu başlatma ve testleri çalıştırma
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === "test") {
    console.log("Running Tests...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log("Tests are not valid:");
        console.error(error);
      }
    }, 1500);
  }
});

// Socket.io gerçek zamanlı çok oyunculu bağlantı yönetimi
const io = socket(server);
let players = [];
let collectible = {
  x: Math.floor(Math.random() * 500) + 50,
  y: Math.floor(Math.random() * 350) + 50,
  value: 1,
  id: Date.now(),
};

io.on("connection", (sock) => {
  console.log(`Yeni oyuncu bağlandı: ${sock.id}`);

  sock.emit("init", { id: sock.id, players, collectible });

  sock.on("new-player", (newPlayer) => {
    players.push(newPlayer);
    io.emit("update-players", players);
  });

  sock.on("move-player", (dir, obj) => {
    const movingPlayer = players.find((p) => p.id === sock.id);
    if (movingPlayer) {
      movingPlayer.x = obj.x;
      movingPlayer.y = obj.y;
      io.emit("move-player", {
        id: sock.id,
        dir,
        posObj: { x: movingPlayer.x, y: movingPlayer.y },
      });
    }
  });

  sock.on("stop-player", (dir, obj) => {
    const stoppingPlayer = players.find((p) => p.id === sock.id);
    if (stoppingPlayer) {
      stoppingPlayer.x = obj.x;
      stoppingPlayer.y = obj.y;
      io.emit("stop-player", {
        id: sock.id,
        dir,
        posObj: { x: stoppingPlayer.x, y: stoppingPlayer.y },
      });
    }
  });

  sock.on("update-player", (updatedPlayer) => {
    const index = players.findIndex((p) => p.id === updatedPlayer.id);
    if (index !== -1) {
      players[index] = updatedPlayer;
    } else {
      players.push(updatedPlayer);
    }
    io.emit("update-players", players);
  });

  sock.on("destroy-item", ({ playerId, itemValue, itemId }) => {
    if (collectible.id === itemId) {
      const scoringPlayer = players.find((p) => p.id === playerId);
      if (scoringPlayer) {
        scoringPlayer.score += itemValue;
      }
      collectible = {
        x: Math.floor(Math.random() * 500) + 50,
        y: Math.floor(Math.random() * 350) + 50,
        value: Math.floor(Math.random() * 3) + 1,
        id: Date.now(),
      };
      io.emit("new-collectible", collectible);
      io.emit("update-players", players);
    }
  });

  sock.on("disconnect", () => {
    console.log(`Oyuncu ayrıldı: ${sock.id}`);
    players = players.filter((p) => p.id !== sock.id);
    io.emit("remove-player", sock.id);
    io.emit("update-players", players);
  });
});

module.exports = app; // Testler için dışa aktarım
