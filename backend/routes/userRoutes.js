const express = require("express");
const router = express.Router();
const { requireObjectBody } = require("../middleware/errorMiddleware");
router.use(requireObjectBody);
const {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  getUser,
  updateUser,
  deleteUser,
  getUserOne,
  updateUserOne,
  manageUserOne,
} = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");
const {
  adminOrExec,
  requirePermission,
} = require("../middleware/adminPermissions");
const { canUpdateUser } = require("../middleware/userUpdatePermissions");

router.post("/", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:resetToken", resetPassword);
router.put("/change-password", protect, changePassword);
router.get("/me", protect, getMe);
router.delete(
  "/:id",
  protect,
  adminOrExec,
  requirePermission("Manage Users"),
  deleteUser,
);

router.route("/user").get(protect, getUser);
router
  .route("/user/:id")
  .delete(protect, adminOrExec, requirePermission("Manage Users"), deleteUser);
router.route("/user/:id").put(protect, canUpdateUser, updateUser);
router.route("/userOne/:paramsField").get(protect, getUserOne);
router.route("/userOne/:id").put(protect, canUpdateUser, updateUserOne);
router
  .route("/manageUserOne/:id")
  .put(protect, adminOrExec, requirePermission("Manage Users"), manageUserOne);

module.exports = router;
