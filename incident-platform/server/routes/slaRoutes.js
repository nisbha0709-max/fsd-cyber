const router = require("express").Router();
const c = require("../controllers/slaController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.get("/", c.listRules);
router.put("/:severity", authorize("admin"), c.updateRule);

module.exports = router;
