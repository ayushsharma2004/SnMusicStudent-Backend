import express from 'express';
import multer from 'multer';
import { createStudy, deleteStudy, readAllPublicStudy, readAllStudy, readIDsStudy, readKeywordStudy, readPaginateAllStudy, readSingleStudy, readTagsStudy, readWithFilter, updateStudy } from '../controllers/studyController.js';
import { verifyToken, verifyTokenAdmin } from '../middleware/authMiddleware.js';

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
// Upload a new study material (image, video) || POST
router.post('/create-study', verifyTokenAdmin, upload, createStudy);

// Retrieve all study materials || GET
router.get('/read-all-study', readAllStudy);

// Retrieve study materials with pagination || POST
router.post('/read-paginate-all-study', readPaginateAllStudy);

// Retrieve all public study materials || GET
router.get('/read-all-public-study', readAllPublicStudy);

// Search study materials by keyword || POST
router.post('/read-keyword-study', readKeywordStudy);

// Search study materials by tag || POST
router.post('/read-tag-study', readTagsStudy);

// Search study materials by tag || POST
router.post('/read-with-filter', readWithFilter);

// Retrieve study materials by a list of IDs || POST
router.post('/read-ids-study', readIDsStudy);

// Retrieve a single study material || POST
router.post('/read-study', readSingleStudy);

// Update an existing study material || POST
router.post('/update-study', upload, updateStudy);

// Delete a study material || POST
router.post('/delete-study', deleteStudy);

export default router;
