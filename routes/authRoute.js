import express from 'express';
import {
  registerController,
  loginController,
  sendMail,
  verifyMail,
  forgotPasswordController,
  blockUser,
} from '../controllers/authController.js';
import { isStudent, requireSignIn } from '../middleware/authMiddleware.js';
import multer, { memoryStorage } from 'multer';
// import { create } from '../DB/FCRUD.js';
const upload = multer({ storage: multer.memoryStorage() })

//route object
const router = express.Router();

//routing

//Register User || POST
router.post('/register-user', registerController);

//Login User || POST
router.post('/login-user', loginController);

//Send otp to User mail || POST
router.post("/send-mail", sendMail)

//Verify otp to User mail || POST
router.post("/verify-mail", verifyMail)

//Update old password with new new password || POST
router.post("/forgot-password", forgotPasswordController)

//Login User || POST
router.post('/block-user', blockUser);


export default router;
