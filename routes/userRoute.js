import express from 'express';
import multer from 'multer';
import { readAllUser, readAllUserAlert, readIdentityUser, readLimitedUserStudy, readSingleUser, readSingleUserStudy, readUserStudy, readUserUnapprovedStudy } from '../controllers/userController.js';

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB file size limit
}).fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
]);

//route object
const router = express.Router();

//routing

// Route to read all users || GET
router.get('/read-all-user', readAllUser);

// Route to read user identity || POST
router.post('/read-identity-user', readIdentityUser);

// Route to read a single user || POST
router.post('/read-user', readSingleUser);

// Route to read approved studies for a user || POST
router.post('/read-user-study', readUserStudy);

// Route to read all user alerts || POST
router.post('/read-user-alert', readAllUserAlert);

// Route to read limited approved studies for a user || POST
router.post('/read-limit-user-study', readLimitedUserStudy);

// Route to read unapproved studies for a user || POST
router.post('/read-user-unapproved-study', readUserUnapprovedStudy);

// Route to read a single study for a user || POST
router.post('/read-single-user-study', readSingleUserStudy);



export default router;
