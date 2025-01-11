import express from 'express';
import { createCategory, readAllCategory } from '../controllers/categoryController.js';


//route object
const router = express.Router();

//routing
// Upload a new study material (image, video) || POST
router.post('/create-category', createCategory);

// Retrieve all study materials || GET
router.get('/read-all-category', readAllCategory);

export default router;
