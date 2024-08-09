import express from 'express';
import multer from 'multer';
import { createNotification, readAllNotification, readSingleNotification, updateNotification } from '../controllers/notificationController.js';

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
router.post('/create-notification', createNotification);

//Verify Phone Number || POST
router.get('/read-all-notification', readAllNotification);

//Verify Phone Number || POST
router.post('/read-notification', readSingleNotification);

//Verify Phone Number || POST
router.post('/update-notification', updateNotification);

export default router;
