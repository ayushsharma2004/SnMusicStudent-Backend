import express from 'express';
import multer from 'multer';
import { createStudy, deleteStudy, readAllStudy, readIDsStudy, readKeywordStudy, readSingleStudy, readStudyVideo, readTagsStudy, updateStudy } from '../controllers/studyController.js';

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
router.post('/create-study', upload, createStudy);

//Verify Phone Number || POST
router.get('/read-all-study', readAllStudy);

//Verify Phone Number || POST
router.post('/read-keyword-study', readKeywordStudy);

//Verify Phone Number || POST
router.post('/read-tag-study', readTagsStudy);

//Verify Phone Number || POST
router.post('/read-ids-study', readIDsStudy);

//Verify Phone Number || POST
router.post('/read-study', readSingleStudy);

//Verify Phone Number || POST
router.post('/read-study', readSingleStudy);

//Verify Phone Number || POST
router.post('/read-study-video', readStudyVideo);

//Verify Phone Number || POST
router.post('/update-study', upload, updateStudy);

//Verify Phone Number || POST
router.post('/delete-study', deleteStudy);

export default router;
