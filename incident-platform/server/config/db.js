const mongoose = require("mongoose");

// In‑memory MongoDB for demo mode
let memoryServer;

module.exports = async function connectDB() {
  let uri;
  if (process.env.USE_DUMMY_DATA === "true") {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.log("🧪 Using in‑memory MongoDB for demo data.");
  } else {
    uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/incident_platform";
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }

  // Gracefully shut down the in‑memory server on process exit
  if (memoryServer) {
    process.on("SIGINT", async () => {
      await memoryServer.stop();
      process.exit(0);
    });
  }
};
