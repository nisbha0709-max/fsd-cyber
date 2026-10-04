const jwt = require("jsonwebtoken");
const User = require("./models/User");

let io = null;

function init(httpServer) {
  const { Server } = require("socket.io");
  const origins = (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((s) => s.trim());
  io = new Server(httpServer, { cors: { origin: origins, credentials: true } });

  // Client connects with: io(URL, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) throw new Error("no token");
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id);
      if (!user || !user.isActive) throw new Error("inactive");
      socket.user = user;
      next();
    } catch (e) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`); // personal room for "assigned to you" alerts
  });

  return io;
}

// Broadcast to every connected, authenticated client
const emit = (event, payload) => io && io.emit(event, payload);
// Send to one user's room
const emitToUser = (userId, event, payload) => io && userId && io.to(`user:${userId}`).emit(event, payload);

module.exports = { init, emit, emitToUser };
