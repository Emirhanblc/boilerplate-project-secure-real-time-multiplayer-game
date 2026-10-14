require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");

const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const app = express();

app.use(cors({ origin: "*" }));

// FCC Test Botunun tam olarak aradığı kelimeler:
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

// Socket.io
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true, // <-- İŞTE BÜTÜN DÜĞÜMÜ ÇÖZECEK OLAN SİHİRLİ KOD (Eski FCC botlarına izin verir)
});

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
