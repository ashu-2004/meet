const fs = require("fs");
const https = require("https");
const http = require("http");
const express = require("express");
const app = express();
const path = require("path");
app.use(express.static("public"));
const transcriptionRoutes = require("./routes/transcriptionRoutes");
const key = fs.readFileSync("../meetings-certs/privkey.pem");
const cert = fs.readFileSync("../meetings-certs/fullchain.pem");
const options = { key, cert };
const httpsServer = https.createServer(options, app);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const socketio = require("socket.io");
const config = require("./config/config");

const io = socketio(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

const initSocket = require("./socket/socket");
initSocket(io);

const bodyParser = require("body-parser");
app.use(bodyParser.json());

app.use("/api", transcriptionRoutes);

app.use(express.static(path.join(__dirname, "../front-end/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../front-end/dist/index.html"));
});
console.log(`HTTPS Server running on port ${config.port}`);
httpsServer.listen(config.port);