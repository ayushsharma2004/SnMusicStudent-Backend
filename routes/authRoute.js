import express from 'express';
import {
  registerController,
  loginController,
  sendMail,
  verifyMail,
  forgotPasswordController,
  blockUser,
  updateUserController,
  allowUser,
  registerAdmin,
  loginAdmin,
  rejectUser,
} from '../controllers/authController.js';
import { isStudent, requireSignIn, verifyTokenAdmin } from '../middleware/authMiddleware.js';
import multer, { memoryStorage } from 'multer';
// import { create } from '../DB/FCRUD.js';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory (not on disk)
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
});



//route object
const router = express.Router();

//routing

// Register a new user || POST
router.post('/register-user', upload.single('file'), registerController);

// Log in an existing user || POST
router.post('/login-user', loginController);

// Send OTP to user email || POST
router.post("/send-mail", sendMail);

// Verify OTP from user email || POST
router.post("/verify-mail", verifyMail);

// Update user password || POST
router.post("/forgot-password", forgotPasswordController);

// Update user details || POST
router.post("/update-user", updateUserController);

// Block a user || POST
router.post('/block-user', blockUser);

router.post('/allow-user', verifyTokenAdmin, allowUser);

router.post('/reject-user', verifyTokenAdmin, rejectUser);

router.post("/register-admin", registerAdmin)

router.post("/login-admin", loginAdmin)

export default router;
