import express from 'express';
import { createTag, readAllTag } from '../controllers/tagController.js';


//route object
const router = express.Router();

//routing
// Upload a new study material (image, video) || POST
router.post('/create-tag', createTag);

// Retrieve all study materials || GET
router.get('/read-all-tag', readAllTag);

export default router;
