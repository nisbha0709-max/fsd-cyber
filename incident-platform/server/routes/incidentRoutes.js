const router = require("express").Router();
const c = require("../controllers/incidentController");
const ev = require("../controllers/evidenceController");
const { protect, authorize } = require("../middleware/auth");
const validateId = require("../middleware/validateObjectId");
const upload = require("../middleware/upload");

router.use(protect);

router.get("/", c.listIncidents);
router.post("/", authorize("admin", "analyst"), c.createIncident);

router.get("/:id", validateId(), c.getIncident);
router.patch("/:id", authorize("admin", "analyst"), validateId(), c.updateIncident);
router.delete("/:id", authorize("admin"), validateId(), c.deleteIncident);

router.patch("/:id/assign", authorize("admin", "analyst"), validateId(), c.assignIncident);
router.patch("/:id/status", authorize("admin", "analyst", "responder"), validateId(), c.changeStatus);
router.post("/:id/notes", authorize("admin", "analyst", "responder"), validateId(), c.addNote);

// Evidence belonging to an incident
router.get("/:id/evidence", validateId(), ev.listEvidence);
router.post("/:id/evidence", authorize("admin", "analyst", "responder"), validateId(), upload, ev.uploadEvidence);

module.exports = router;
