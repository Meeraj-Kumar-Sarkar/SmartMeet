const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", socket.id);
    });

    socket.on("offer", ({ roomId, offer, sender }) => {
        socket.to(roomId).emit("offer", { offer, sender });
    });

    socket.on("answer", ({ roomId, answer, sender }) => {
        socket.to(roomId).emit("answer", { answer, sender });
    });

    socket.on("ice-candidate", ({ roomId, candidate, sender }) => {
        socket.to(roomId).emit("ice-candidate", { candidate, sender });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
