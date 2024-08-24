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

//Verify Phone Number || POST
router.get('/read-all-user', readAllUser);

//Verify Phone Number || POST
router.post('/read-identity-user', readIdentityUser);

//Verify Phone Number || POST
router.post('/read-user', readSingleUser);

//Verify Phone Number || POST
router.post('/read-user-study', readUserStudy);

//Verify Phone Number || POST
router.post('/read-user-alert', readAllUserAlert);

//Verify Phone Number || POST
router.post('/read-limit-user-study', readLimitedUserStudy);

//Verify Phone Number || POST
router.post('/read-user-unapproved-study', readUserUnapprovedStudy);

//Verify Phone Number || POST
router.post('/read-single-user-study', readSingleUserStudy);


export default router;
