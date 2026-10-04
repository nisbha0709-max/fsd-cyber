const path = require("path");

// Evaluated lazily so dotenv has already loaded
module.exports = {
  uploadDir: () => path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads")),
};
