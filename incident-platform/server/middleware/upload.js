const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { uploadDir } = require("../config/paths");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = uploadDir();
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  // Random on-disk name; the original name is kept in the database only
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^.\w]/g, "").slice(0, 10);
    cb(null, crypto.randomBytes(16).toString("hex") + ext);
  },
});

const maxMb = () => Number(process.env.MAX_FILE_MB) || 25;

// Up to 10 files per request, field name "files"
module.exports = (req, res, next) =>
  multer({ storage, limits: { fileSize: maxMb() * 1024 * 1024, files: 10 } }).array("files", 10)(req, res, next);
