const router = require("express").Router();
const c = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");
const validateId = require("../middleware/validateObjectId");

router.use(protect);
router.get("/", authorize("admin", "analyst"), c.listUsers);
router.post("/", authorize("admin"), c.createUser);
router.patch("/:id", authorize("admin"), validateId(), c.updateUser);

module.exports = router;
