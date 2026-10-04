const router = require("express").Router();
const c = require("../controllers/evidenceController");
const { protect, authorize } = require("../middleware/auth");
const validateId = require("../middleware/validateObjectId");

router.use(protect, validateId());

router.get("/:id", c.getEvidence);
router.get("/:id/custody", c.getCustody);
router.get("/:id/download", authorize("admin", "analyst", "responder"), c.downloadEvidence);
router.post("/:id/verify", authorize("admin", "analyst"), c.verifyIntegrity);
router.patch("/:id/tags", authorize("admin", "analyst", "responder"), c.updateTags);

module.exports = router;
