require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");

const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const app = express();

// 1. CHROME PNA VE CORS ENGELİNİ AŞAN ÖZEL GÜVENLİK DUVARI
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type",
  );
  // Chrome'un localhost isteklerine izin vermesini sağlayan kritik satır:
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  // FCC'nin başlıkları görebilmesi için görünürlük ayarı:
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-Powered-By, X-XSS-Protection, X-Content-Type-Options, Surrogate-Control, Cache-Control, Pragma, Expires",
  );

  // Ön uç (preflight) sorgularını anında kabul et:
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// 2. HELMET KODLARI (FCC'nin kod tarayıcısından geçmesi için)
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.noCache());
app.use(helmet.hidePoweredBy({ setTo: "PHP 7.4.3" }));

app.use("/public", express.static(process.cwd() + "/public"));
app.use("/assets", express.static(process.cwd() + "/assets"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

fccTestingRoutes(app);

app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

const portNum = process.env.PORT || 3000;

const server = app.listen(portNum, "0.0.0.0", () => {
  console.log(`Bip bop! Sunucu ${portNum} portunda çalışıyor.`);
  if (process.env.NODE_ENV === "test") {
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.error(e);
      }
    }, 1500);
  }
});

// --- 3. SOCKET.IO ---
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

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
