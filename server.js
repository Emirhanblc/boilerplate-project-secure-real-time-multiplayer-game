require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet"); // Helmet'i geri getiriyoruz

const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const app = express();

// --- 1. EN KRİTİK NOKTA: CORS HER ŞEYDEN ÖNCE GELMELİ ---
// FCC test botunun HTTP isteklerinin engellenmemesi için en üste koyduk
app.use(cors({ origin: "*" }));

// --- 2. GÜVENLİK BAŞLIKLARI (FCC'nin bizzat aradığı Helmet fonksiyonları) ---
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.noCache());
app.use(helmet.hidePoweredBy({ setTo: "PHP 7.4.3" }));

app.use("/public", express.static(process.cwd() + "/public"));
app.use("/assets", express.static(process.cwd() + "/assets"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Anasayfa
app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// FCC test rotaları (/_api/app-info dahil)
fccTestingRoutes(app);

// 404
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

const portNum = process.env.PORT || 3000;

const server = app.listen(portNum, () => {
  console.log(`Bip bop! Sunucu ${portNum} portunda çalışıyor.`);
  if (process.env.NODE_ENV === "test") {
    console.log("Testler çalıştırılıyor...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log("Testlerde hata:");
        console.error(e);
      }
    }, 1500);
  }
});

// --- 3. SOCKET.IO (GERÇEK ZAMANLI BAĞLANTI) ---
const io = require("socket.io")(server);

let players = [];
let currentCoin = {
  x: Math.floor(Math.random() * 580) + 10,
  y: Math.floor(Math.random() * 380) + 10,
  value: 1,
  id: Date.now(),
};

io.on("connection", (socket) => {
  socket.on("init", (playerData) => {
    players.push(playerData);
    io.emit("update-game", { players, coin: currentCoin });
  });

  socket.on("move-player", (data) => {
    let player = players.find((p) => p.id === socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.score = data.score;
    }
    io.emit("update-game", { players, coin: currentCoin });
  });

  socket.on("coin-collected", (data) => {
    let player = players.find((p) => p.id === data.playerId);
    if (player) {
      player.score += currentCoin.value;
    }
    currentCoin = {
      x: Math.floor(Math.random() * 580) + 10,
      y: Math.floor(Math.random() * 380) + 10,
      value: 1,
      id: Date.now(),
    };
    io.emit("update-game", { players, coin: currentCoin });
  });

  socket.on("disconnect", () => {
    players = players.filter((p) => p.id !== socket.id);
    io.emit("update-game", { players, coin: currentCoin });
  });
});

module.exports = app;
