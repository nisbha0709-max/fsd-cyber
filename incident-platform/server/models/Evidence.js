const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

// Chain of custody: every touch on the file is recorded
const custodySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["uploaded", "viewed", "downloaded", "verified", "tagged", "integrity_failed"],
      required: true,
    },
    by: { type: ObjectId, ref: "User", required: true },
    at: { type: Date, default: Date.now },
    ip: String,
    note: String,
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    incident: { type: ObjectId, ref: "Incident", required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // random name on disk
    mimeType: String,
    size: Number,
    sha256: { type: String, required: true }, // hash computed at upload time
    description: { type: String, trim: true, maxlength: 1000 },
    tags: [{ type: String, trim: true, lowercase: true }],
    uploadedBy: { type: ObjectId, ref: "User", required: true },
    custodyLog: [custodySchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.storedName; // never expose server file paths
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Evidence", evidenceSchema);
