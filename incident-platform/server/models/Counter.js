const mongoose = require("mongoose");

// Atomic counter used for incident numbers (INC-0001, INC-0002, ...)
const counterSchema = new mongoose.Schema(
  { _id: { type: String }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);

module.exports = mongoose.model("Counter", counterSchema);
