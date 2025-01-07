import express from 'express';
import multer from 'multer';
import { createNotification, readAllNotification, readSingleNotification, updateNotification } from '../controllers/notificationController.js';
import { verifyTokenAdmin } from '../middleware/authMiddleware.js';

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

// Route to create a new notification || POST
router.post('/create-notification', createNotification);

// Route to read all notifications || GET
router.get('/read-all-notification', readAllNotification);

// Route to read a single notification || POST
router.post('/read-notification', verifyTokenAdmin, readSingleNotification);

// Route to update a notification || POST
router.post('/update-notification', updateNotification);


export default router;
