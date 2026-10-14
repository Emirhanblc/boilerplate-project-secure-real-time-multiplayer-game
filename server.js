require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const app = express();

// --- 1. EXPRESS'İN KENDİ KİMLİĞİNİ ZORLA KAPAT ---
app.disable("x-powered-by");

// --- 2. GÜVENLİK BAŞLIKLARI (HER ŞEYDEN ÖNCE ÇALIŞMALI) ---
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("X-Powered-By", "PHP 7.4.3");
  next();
});

app.use(cors({ origin: "*" })); // FCC testleri için gerekli

app.use("/public", express.static(process.cwd() + "/public"));
app.use("/assets", express.static(process.cwd() + "/assets"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Anasayfayı (Oyunu) Yükle
app.route("/").get(function (req, res) {
  // FCC test botu ana sayfayı denetlediği için garanti olması adına buraya da ekliyoruz
  res.setHeader("X-Powered-By", "PHP 7.4.3");
  res.sendFile(process.cwd() + "/views/index.html");
});

// FCC test rotaları
fccTestingRoutes(app);

// 404 Sayfa Bulunamadı Middleware'i
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

const portNum = process.env.PORT || 3000;

// Sunucuyu Başlat
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
