const fs = require("fs");
const path = require("path");
const Evidence = require("../models/Evidence");
const Incident = require("../models/Incident");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const realtime = require("../realtime");
const { uploadDir } = require("../config/paths");
const { sha256File } = require("../utils/hash");
const { str, strArray } = require("../utils/validate");

const filePathOf = (ev) => path.join(uploadDir(), ev.storedName);
const removeFiles = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

// Appends one chain-of-custody entry
async function logCustody(ev, action, req, note) {
  ev.custodyLog.push({ action, by: req.user._id, ip: req.ip, note });
  await ev.save();
}

const populateEvidence = (ev) =>
  ev.populate([
    { path: "uploadedBy", select: "name email role" },
    { path: "custodyLog.by", select: "name role" },
  ]);

// POST /api/incidents/:id/evidence   multipart: files[] (+ tags, description)
exports.uploadEvidence = asyncHandler(async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) throw new ApiError(404, "Incident not found");
    if (incident.status === "closed") throw new ApiError(409, "Cannot add evidence to a closed incident");
    if (!req.files || !req.files.length) throw new ApiError(400, "Attach at least one file in the 'files' field");

    const tags = strArray(req.body.tags, "tags", { maxItems: 10, maxLen: 30, lower: true });
    const description = str(req.body.description, "Description", { max: 1000, required: false });

    const created = [];
    for (const file of req.files) {
      const sha256 = await sha256File(file.path); // hash at the moment of upload
      const ev = await Evidence.create({
        incident: incident._id,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        sha256,
        description,
        tags,
        uploadedBy: req.user._id,
        custodyLog: [{ action: "uploaded", by: req.user._id, ip: req.ip, note: `SHA-256 ${sha256}` }],
      });
      created.push(ev);
    }

    await Incident.updateOne(
      { _id: incident._id },
      {
        $push: {
          history: {
            action: "evidence_added",
            by: req.user._id,
            note: `${created.length} evidence file(s) uploaded: ${created.map((e) => e.originalName).join(", ")}`,
            at: new Date(),
          },
        },
      }
    );
    realtime.emit("incident:updated", { id: incident._id, incidentNumber: incident.incidentNumber });

    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    removeFiles(req.files); // don't leave orphaned files on failure
    throw err;
  }
});

// GET /api/incidents/:id/evidence
exports.listEvidence = asyncHandler(async (req, res) => {
  const items = await Evidence.find({ incident: req.params.id })
    .select("-custodyLog")
    .populate("uploadedBy", "name role")
    .sort("-createdAt");
  res.json({ success: true, count: items.length, data: items });
});

// GET /api/evidence/:id   (metadata + custody log; the view itself is logged)
exports.getEvidence = asyncHandler(async (req, res) => {
  const ev = await Evidence.findById(req.params.id);
  if (!ev) throw new ApiError(404, "Evidence not found");
  await logCustody(ev, "viewed", req);
  await populateEvidence(ev);
  res.json({ success: true, data: ev });
});

// GET /api/evidence/:id/custody
exports.getCustody = asyncHandler(async (req, res) => {
  const ev = await Evidence.findById(req.params.id).populate("custodyLog.by", "name role");
  if (!ev) throw new ApiError(404, "Evidence not found");
  res.json({ success: true, sha256: ev.sha256, count: ev.custodyLog.length, data: ev.custodyLog });
});

// Re-hashes the stored file and compares with the hash recorded at upload
async function checkIntegrity(ev, req) {
  const filePath = filePathOf(ev);
  if (!fs.existsSync(filePath)) {
    await logCustody(ev, "integrity_failed", req, "File is missing from storage");
    return { intact: false, reason: "File is missing from storage", expected: ev.sha256, actual: null, filePath };
  }
  const actual = await sha256File(filePath);
  if (actual !== ev.sha256) {
    await logCustody(ev, "integrity_failed", req, `Hash mismatch. Expected ${ev.sha256}, got ${actual}`);
    return { intact: false, reason: "Hash mismatch - file may have been altered", expected: ev.sha256, actual, filePath };
  }
  return { intact: true, expected: ev.sha256, actual, filePath };
}

// POST /api/evidence/:id/verify   (admin, analyst)
exports.verifyIntegrity = asyncHandler(async (req, res) => {
  const ev = await Evidence.findById(req.params.id);
  if (!ev) throw new ApiError(404, "Evidence not found");

  const result = await checkIntegrity(ev, req);
  if (result.intact) await logCustody(ev, "verified", req, "Integrity verified: hash matches");

  const { filePath, ...body } = result;
  res.json({ success: true, ...body });
});

// GET /api/evidence/:id/download   (verifies integrity first, refuses tampered files)
exports.downloadEvidence = asyncHandler(async (req, res) => {
  const ev = await Evidence.findById(req.params.id);
  if (!ev) throw new ApiError(404, "Evidence not found");

  const result = await checkIntegrity(ev, req);
  if (!result.intact) throw new ApiError(409, `Integrity check failed: ${result.reason}. Download blocked.`);

  await logCustody(ev, "downloaded", req, "Integrity verified before download");
  res.setHeader("X-Evidence-SHA256", ev.sha256);
  res.download(result.filePath, ev.originalName);
});

// PATCH /api/evidence/:id/tags   body: { add: [...], remove: [...] }
exports.updateTags = asyncHandler(async (req, res) => {
  const ev = await Evidence.findById(req.params.id);
  if (!ev) throw new ApiError(404, "Evidence not found");

  const opts = { maxItems: 10, maxLen: 30, lower: true };
  const add = strArray(req.body.add, "add", opts);
  const remove = strArray(req.body.remove, "remove", opts);
  if (!add.length && !remove.length) throw new ApiError(400, "Provide 'add' and/or 'remove' tags");

  const tags = new Set(ev.tags);
  remove.forEach((t) => tags.delete(t));
  add.forEach((t) => tags.add(t));
  if (tags.size > 20) throw new ApiError(400, "An evidence file can have at most 20 tags");
  ev.tags = [...tags];

  await logCustody(ev, "tagged", req, `Added: ${add.join(", ") || "-"} | Removed: ${remove.join(", ") || "-"}`);
  await populateEvidence(ev);
  res.json({ success: true, data: ev });
});
