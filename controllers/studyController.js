import { faL } from "@fortawesome/free-solid-svg-icons";
import { db, admin } from "../DB/firestore.js";
import multer from 'multer';
import dotenv from "dotenv"
import express from 'express';
import { FieldValue } from "firebase-admin/firestore"
import slugify from "slugify";
import { v4 as uuidv4 } from 'uuid';
import { uploadVideo } from "../DB/storage.js";
import cache from "memory-cache"
import { createData, deleteData, matchData, readAllData, readAllLimitData, readAllLimitPaginate, readFieldData, readSingleData, searchByIDs, searchByKeyword, searchByTag, updateData } from "../DB/crumd.js";
import { storage } from "../DB/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addTextWatermarkToImage, addTextWatermarkToVideo, extractFrameFromVideo, uploadFile, uploadWaterMarkFile } from "../helper/mediaHelper.js";

dotenv.config()

const CACHE_DURATION = 1 * 60 * 60 * 1000; //1 hour

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const bucket = admin.storage().bucket()


/* 
// Summary: Endpoint for the admin to upload study materials (videos and optional images) for flute classes.
// Action: POST
// URL: "http://localhost:8080/api/v1/study/create-study"

// Request:
// Headers:
// Content-Type: multipart/form-data

// Body:
// req.body: {
//   "title": "Beginner Flute Lesson 1",
//   "description": "Introduction to flute basics",
//   "tags": ["Beginner", "Flute", "Basics"],
//   "isPublic": true,
//   "link": "https://example.com/existing-video-link" // Optional, alternative to uploading a video
// }
// req.files: {
//   "video": [<Buffer>], // Video file buffer (required if `link` is not provided)
//   "image": [<Buffer>]  // Image file buffer (optional)
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Study created successfully",
//   "study": 
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "tags": ["flute", "scales", "advanced"],
//       "description": "Introduction to flute basics",
//       "imageUrl": null,
//       "videoUrl": null,
//       "link": "https://example.com/existing-video-link",
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
// }

// Failure:
// {
//   "success": false,
//   "message": "Title, description, and video are required"
// }
// OR
// {
//   "success": false,
//   "message": "Study material with the same title already exists"
// }
// OR
// {
//   "success": false,
//   "message": "Error in creating study material",
//   "error": "Detailed error message"
// }

// Notes:
// - Admin can either provide a video `link` or upload a video file.
// - If no image is uploaded, an image frame is extracted from the video.
// - A watermark ("SN MUSIC") is added to both videos and images before storing.
// - Files are saved in a structured cloud storage path for efficient access.
// - A unique `studyId` is generated for each uploaded material.
// - Tags help in categorizing and searching study materials.
// - Clears the 'all_study' cache to ensure the latest study materials are available to students.
// - Students can view and access uploaded videos through their accounts.
*/
export const createStudy = async (req, res) => {
  try {
    const { title, description, tags, isPublic, link } = req.body;
    const files = req?.files;
    const studyId = uuidv4();

    var now = new Date();
    var time = now.toISOString();

    // Check if title, description, and video/link are present
    if (!title || !description || (!link && (!files || !files.video))) {
      return res.status(400).send({ message: 'Title, description, and video are required' });
    }

    const validateData = await matchData(process.env.studyCollection, 'title', title);
    if (!validateData.empty) {
      return res.status(400).send({ message: 'Study already exists' });
    }

    var vidWatermark, vidWatermarkUrl, imgWatermarkUrl;

    // Handle video and image processing only if link is not provided
    if (!link && files.video && files.video.length > 0) {
      const videoFile = files.video[0];

      // Add watermark to video
      vidWatermark = await addTextWatermarkToVideo(videoFile.buffer, 'SN MUSIC');
      vidWatermarkUrl = await uploadWaterMarkFile(vidWatermark, 'videos', `study/${studyId}/watermark/${videoFile.originalname}`);

      // Handle image processing
      if (files.image && files.image.length > 0) {
        const imageFile = files.image[0];
        const watermarkedFrameBuffer = await addTextWatermarkToImage(imageFile.buffer, 'SN MUSIC');
        imgWatermarkUrl = await uploadFile(watermarkedFrameBuffer, 'images', `study/${studyId}/image/${watermarkedFrameBuffer.originalname}`);
      } else {
        const frameBuffer = await extractFrameFromVideo(videoFile.buffer);
        const frameFile = {
          originalname: 'frame.jpg',
          mimetype: 'image/jpeg',
          buffer: frameBuffer,
        };
        const watermarkedFrameBuffer = await addTextWatermarkToImage(frameFile.buffer, 'SN MUSIC');
        imgWatermarkUrl = await uploadFile(watermarkedFrameBuffer, 'images', `study/${studyId}/image/${watermarkedFrameBuffer.originalname}`);
      }
    } else if (!link) {
      throw new Error('Video file is required.');
    }

    // Construct the study JSON object
    const studyJson = {
      studyId: studyId,
      title: title,
      description: description,
      videoUrl: vidWatermarkUrl || null, // Ensure this is either null or a valid URL
      imageUrl: imgWatermarkUrl || null, // Ensure this is either null or a valid URL
      link: link || null, // Set link to null if it's not provided
      tags: tags || [], // Ensure tags are an array
      public: isPublic || false, // Ensure isPublic is a boolean
      timestamp: time,
    };

    await createData(process.env.studyCollection, studyId, studyJson);

    cache.del('all_study');

    res.status(201).send({
      success: true,
      message: 'Study created successfully',
      study: studyJson,
    });
  } catch (error) {
    console.error('Error in study creation:', error);
    res.status(500).send({
      success: false,
      message: 'Error in study creation',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint for retrieving all study materials available in the flute classes.
// Action: GET
// URL: "http://localhost:8080/api/v1/study/read-all-study"

// Request:
// No request body is required for this endpoint.

// Response:
// Success:
// {
//   "success": true,
//   "message": "Study read successfully",
//   "study": [
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": null,
//       "videoUrl": null,
//       "link": "https://example.com/existing-video-link",
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/image/frame.jpg",
//       "videoUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/watermark/video.mp4",
//       "link": null,
//       "public": false,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading all study",
//   "error": "Detailed error message"
// }

// Notes:
// - If the Video will have link then video url will be null and vice versa
// - Retrieves a limited set of fields for all study materials, including `studyId`, `title`, `description`, `imageUrl`, `videoUrl`, `link`, `public`, and `timestamp`.
// - Data is cached for a duration specified by `CACHE_DURATION` to optimize performance.
// - Students can view these study materials directly from the response.
*/
export const readAllStudy = async (req, res) => {
  try {
    var key = 'all_study'
    // var study = await readAllData(process.env.studyCollection);
    var study = await readAllLimitData(process.env.studyCollection, ['studyId', 'imageUrl', 'description', 'title', 'videoUrl', 'link', 'public', 'timestamp', 'tags']);

    console.log("setting data in cache")
    var response = {
      success: true,
      message: 'study read successfully',
      study: study
    }
    cache.put(key, response, CACHE_DURATION)

    return res.status(201).send({
      success: true,
      message: 'study read successfully',
      study: study
    });
  } catch (error) {
    console.error('Error in reading all study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading all study',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint for retrieving paginated study materials for flute classes.
// Action: POST
// URL: "http://localhost:8080/api/v1/study/read-paginate-all-study"

// Request:
// req.body: {
//   "lastDoc": {
//     "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2"
//   },
//   "pageSize": 10
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Study read successfully",
//   "study": [
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": null,
//       "videoUrl": null,
//       "link": "https://example.com/existing-video-link",
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/image/frame.jpg",
//       "videoUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/watermark/video.mp4",
//       "link": null,
//       "public": false,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     ...
//   ],
//   "lastDoc": {
//    "other firestore fields, study material fields"
//     "studyId": "7f8d3459-349c-4df8-bf09-93b346b5e8e3"
//   },
//   "count": 10
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading all study",
//   "error": "Detailed error message"
// }

// Notes:
// - Supports pagination by passing the `lastDoc` field in the request to fetch the next set of results.
// - `pageSize` determines the number of study materials fetched per request.
// - Returns the `lastDoc` for subsequent paginated calls.
// - Caches the response using `CACHE_DURATION` to optimize repeated queries.
// - Useful for fetching a manageable set of study materials, especially for large datasets.
*/
export const readPaginateAllStudy = async (req, res) => {
  try {
    const { lastDoc, pageSize } = req.body;
    const key = 'all_study';

    let startAfterDoc = null;

    // Use lastDoc._ref if it exists, or use a field like 'studyId' for pagination
    if (lastDoc && lastDoc?.studyId) {
      console.log('lastDoc');

      startAfterDoc = lastDoc; // Firestore document reference
    }

    const study = await readAllLimitPaginate(
      process.env.studyCollection,
      ['studyId', 'imageUrl', 'description', 'title', 'videoUrl', 'link', 'public', 'timestamp', 'tags'],
      startAfterDoc, // Pass the correct reference for pagination
      pageSize
    );

    const response = {
      success: true,
      message: 'Study read successfully',
      study: study?.data, // The fetched data
      lastDoc: study?.lastDoc, // Pass the last document reference back
      count: study?.count // Pass the last document reference back
    };

    // Cache the response
    cache.put(key, response, CACHE_DURATION);

    return res.status(200).send(response);
  } catch (error) {
    console.error('Error in reading all study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading all study',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve all public study materials for flute classes.
// Action: GET
// URL: "http://localhost:8080/api/v1/study/read-all-public"

// Description:
// - Fetches all study materials marked as public (`public: true`) from the Firestore database.
// - Utilizes caching to optimize repeated requests, storing data with a key `study_public`.
// - Maps the fetched documents to extract and structure their data for the response.

// Request:
// - No parameters or body required for this request.

// Response:
// Success (201):
// {
//   "success": true,
//   "message": "public study read successfully",
//   "study": [
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": null,
//       "videoUrl": null,
//       "link": "https://example.com/existing-video-link",
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/image/frame.jpg",
//       "videoUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/watermark/video.mp4",
//       "link": null,
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     ...
//   ]
// }

// Failure (500):
// {
//   "success": false,
//   "message": "Error in reading all study",
//   "error": "Detailed error message"
// }

// Process:
// 1. Call `matchData` to fetch documents from the `studyCollection` where the `public` field is `true`.
// 2. Extract document data using the `map` function on the Firestore query snapshot.
// 3. Cache the response using a key (`study_public`) with a predefined `CACHE_DURATION`.
// 4. Send a 201 response with the structured study materials data.
// 5. Handle and log errors, returning a 500 response with error details in case of failures.

// Notes:
// - The function leverages Firestore's query capabilities for filtering (`matchData` utility).
// - Caching ensures faster response times for frequently accessed data.
// - Only documents with the `public` field set to `true` are included in the response.
*/
export const readAllPublicStudy = async (req, res) => {
  try {
    var key = 'study_public'

    // var study = await readAllData(process.env.studyCollection);
    var study = await matchData(process.env.studyCollection, 'public', true);

    // Use map to extract the data from the documents
    const studyData = study.docs.map((doc) => doc.data());

    var response = {
      success: true,
      message: 'public study read successfully',
      study: studyData
    }
    cache.put(key, response, CACHE_DURATION)

    return res.status(201).send({
      success: true,
      message: 'study read successfully',
      study: studyData
    });
  } catch (error) {
    console.error('Error in reading all study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading all study',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint for searching study materials based on a keyword for flute classes.
// Action: POST
// URL: "http://localhost:8080/api/v1/study/read-keyword-study"

// Request:
// req.body: {
//   "keyword": "Beginner Flute"
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "study read successfully",
//   "study": [
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": null,
//       "videoUrl": null,
//       "link": "https://example.com/existing-video-link",
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 2",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/image/frame.jpg",
//       "videoUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/watermark/video.mp4",
//       "link": null,
//       "public": false,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading study",
//   "error": "Detailed error message"
// }

// Notes:
// - Requires a `keyword` in the request body to search for study materials.
// - Searches in `title`, `description`, and `tags` fields of the study materials.
// - Returns study materials matching the keyword, including metadata such as `studyId`, URLs, and tags.
// - Uses the `searchByKeyword` utility function for querying the database.
*/
export const readKeywordStudy = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).send({ message: 'Error finding study' });
    }

    var studyData = await searchByKeyword(process.env.studyCollection, keyword);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'study read successfully',
      study: studyData
    });
  } catch (error) {
    console.error('Error in reading study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading study',
      error: error.message,
    });
  }
};

/*
// Summary: Endpoint to retrieve study materials based on tags and optional keywords for flute classes.
// Action: POST
// URL: "http://localhost:8080/api/v1/study/read-tags"

// Description:
// - This function allows fetching study materials based on specific tags and an optional keyword.
// - Uses the `searchByTag` helper function to query the Firestore database for documents that match the specified criteria.

// Request Body:
// {
//   "keyword": "scales",
//   "tag": ["flute", "advanced"]
// }

// Response:
// Success (201):
// {
//   "success": true,
//   "message": "study read successfully",
//   "study": [
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 1",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": null,
//       "videoUrl": null,
//       "link": "https://example.com/existing-video-link",
//       "public": true,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     {
//       "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//       "title": "Beginner Flute Lesson 2",
//       "description": "Introduction to flute basics",
//       "tags": ["flute", "scales", "advanced"],
//       "imageUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/image/frame.jpg",
//       "videoUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/watermark/video.mp4",
//       "link": null,
//       "public": false,
//       "timestamp": "2024-11-28T14:30:45.000Z"
//     },
//     ...
//   ]
// }

// Failure (500):
// {
//   "success": false,
//   "message": "Error in reading study",
//   "error": "Detailed error message"
// }

// Process:
// 1. Validate if the required `tag` field is present in the request body.
//    - If `tag` is missing, respond with a 400 error.
// 2. If the optional `keyword` is missing, set it to `false` to skip keyword filtering.
// 3. Call the `searchByTag` helper function to query the database.
//    - Pass the collection name, keyword, and tags to the function.
// 4. Return the results with a 201 status code if the query is successful.
// 5. Log errors and respond with a 500 status code if any issues occur.

// Notes:
// - The `searchByTag` function handles case-insensitive matching for keywords and tag validation.
// - Useful for targeted searches in the study materials database, such as finding advanced flute lessons.
*/
export const readTagsStudy = async (req, res) => {
  try {
    var { keyword, tag } = req.body;

    if (!tag) {
      return res.status(400).send({ message: 'Error finding study' });
    }
    if (!keyword) {
      keyword = false;
    }

    var studyData = await searchByTag(process.env.studyCollection, keyword, tag);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'study read successfully',
      study: studyData
    });
  } catch (error) {
    console.error('Error in reading study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading study',
      error: error.message,
    });
  }
};

/*
// Summary: Endpoint to retrieve study materials based on provided study IDs.
// Action: POST
// URL: "http://localhost:8080/api/v1/study/read-ids"

// Description:
// - This function fetches study materials from the Firestore database based on an array of provided study IDs.
// - Allows optional customization of the maximum number of documents to return via the `limit` field.
// - Utilizes the `searchByIDs` helper function to perform the database query and matching logic.

// Request Body:
// {
//   "ids": ["id1", "id2", "id3"],
//   "limit": 10
// }

// Response:
// Success (201):
// {
//   "success": true,
//   "message": "study read successfully",
//   "study": [
//     {
//       "studyId": "id1",
//       "title": "Introduction to Algorithms",
//       "description": "A comprehensive guide to algorithms.",
//       ...
//     },
//     ...
//   ]
// }

// Failure (500):
// {
//   "success": false,
//   "message": "Error in reading study",
//   "error": "Detailed error message"
// }

// Process:
// 1. Extract `ids` (array of study IDs) and `limit` (maximum number of results) from the request body.
//    - Set a default `limit` of 20 if not provided.
// 2. Validate the presence of the required `ids` field.
//    - If `ids` is missing, respond with a 400 status code and error message.
// 3. Use the `searchByIDs` helper function to query the database for matching study materials.
//    - Pass the collection name, `ids`, and `limit` to the helper function.
// 4. Return the results with a 201 status code if the query is successful.
// 5. Log any errors and respond with a 500 status code in case of issues.

// Notes:
// - The `searchByIDs` function efficiently matches documents based on their unique `studyId` field.
// - Ideal for scenarios where study materials need to be retrieved by their specific IDs, such as user-saved items.
*/
export const readIDsStudy = async (req, res) => {
  try {
    var { ids, limit } = req.body;
    var lim = 20

    if (limit) {
      lim = limit
    }

    if (!ids) {
      return res.status(400).send({ message: 'Error finding study' });
    }

    var studyData = await searchByIDs(process.env.studyCollection, ids, lim);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'study read successfully',
      study: studyData
    });
  } catch (error) {
    console.error('Error in reading study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading study',
      error: error.message,
    });
  }
};

/*
// Summary: Endpoint to retrieve a single flute study material based on the provided study ID.
// Action: POST
// URL: "http://localhost:8080/api/v1/study/read-single"

// Description:
// - This endpoint retrieves a single study material based on the provided study ID.
// - Utilizes the `readSingleData` helper function to query the Firestore database and fetch the document matching the provided `studyId`.

// Request Body:
// {
//   "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2"
// }

// Response:
// Success (201):
// {
//   "success": true,
//   "message": "study read successfully",
//   "study": {
//     "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//     "title": "Beginner Flute Lesson 1",
//     "description": "Introduction to flute basics",
//     "tags": ["flute", "scales", "advanced"],
//     "imageUrl": null,
//     "videoUrl": null,
//     "link": "https://example.com/existing-video-link",
//     "public": true,
//     "timestamp": "2024-11-28T14:30:45.000Z"
//   }
// }

// Failure (500):
// {
//   "success": false,
//   "message": "Error in reading study",
//   "error": "Detailed error message"
// }

// Process:
// 1. Extract the `studyId` from the request body.
//    - Respond with a 400 status code if `studyId` is missing.
// 2. Use the `readSingleData` helper function to query the database for the study material.
//    - Pass the collection name and `studyId` to the function.
// 3. Return the retrieved study material with a 201 status code if successful.
// 4. Log errors and respond with a 500 status code in case of issues.

// Notes:
// - The `readSingleData` function handles fetching a single document based on the provided `studyId`.
// - This endpoint is useful for retrieving detailed information about a specific flute study lesson.
*/
export const readSingleStudy = async (req, res) => {
  try {
    const { studyId } = req.body;

    if (!studyId) {
      return res.status(400).send({ message: 'Error finding study' });
    }

    var studyData = await readSingleData(process.env.studyCollection, studyId);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'study read successfully',
      study: studyData
    });
  } catch (error) {
    console.error('Error in reading study:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading study',
      error: error.message,
    });
  }
};

/*
// Summary: Endpoint to update details of a specific flute study material.
// Action: PUT
// URL: "http://localhost:8080/api/v1/study/update"

// Description:
// - This endpoint allows updating the details of a specific study material based on the provided `studyId`.
// - It supports updating the title, description, and optional image/video files with a watermark.
// - The `updateStudy` function processes the provided fields and files, applies watermarks to the video/image, and stores the updated data in the Firestore collection.

// Request Body:
// {
//   "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//   "title": "Updated Flute Lesson 1",
//   "description": "New introduction to flute basics",
//   "image": "imageFile",
//   "video": "videoFile"
// }

// Response:
// Success (201):
// {
//   "success": true,
//   "message": "Study updated successfully",
//   "study": {
//     "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//     "title": "Updated Flute Lesson 1",
//     "description": "New introduction to flute basics",
//     "link": null,
//     "imageUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/image/watermarked.jpg",
//     "videoUrl": "https://storage.example.com/study/4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2/video/watermarked.mp4",
//     "timestamp": "2024-11-28T14:30:45.000Z"
//   }
// }

// Failure (400):
// {
//   "success": false,
//   "message": "Title, description, and video are required"
// }

// Failure (404):
// {
//   "success": false,
//   "message": "Study not found"
// }

// Failure (500):
// {
//   "success": false,
//   "message": "Error in updating study",
//   "error": "Detailed error message"
// }

// Process:
// 1. Validate that the required `studyId`, `title`, and `description` are provided in the request body.
// 2. If the study does not exist in the database, return a 404 error.
// 3. Check if files (video and/or image) are provided.
// 4. Apply watermark to the video and/or image files if present.
// 5. Upload the watermarked video/image to the storage and update the corresponding URLs.
// 6. Update the study record in the Firestore database with the new data.
// 7. Clear the cache for all study materials to ensure the updated data is reflected.
// 8. Respond with a success message and the updated study data.
// 9. Log errors and respond with a 500 status code if any issues occur.

// Notes:
// - The `addTextWatermarkToImage` and `addTextWatermarkToVideo` functions are used to apply the watermark text ("SN MUSIC") to images and videos.
// - The `uploadFile` and `uploadWaterMarkFile` functions handle uploading the files to the storage system.
*/
export const updateStudy = async (req, res) => {
  try {
    const { studyId, title, description, link } = req.body;
    const files = req.files;

    // Create the updates object only with provided fields
    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (link) updates.link = link;
    const watermarkPath = "../../SNmusicAdmin/admin/src/images/watermark2.png";

    if (!studyId) {
      return res.status(400).send({ message: 'Error finding study' });
    }

    if (!title && !description && !link && !files) {
      return res.status(400).send({ message: 'Title, description, and video are required' });
    }

    const validateData = await readSingleData(process.env.studyCollection, studyId);

    if (!validateData) {
      return res.status(404).send({ message: 'Study not found' });
    }

    let imageUrl = null;
    let videoUrl = null;
    var imgWatermarkUrl, vidWatermarkUrl, vidWatermark;

    if (files.video && files.video.length > 0) {
      const videoFile = files.video[0];
      console.log(videoFile);
      // videoUrl = await uploadFile(videoFile, 'videos', `study/${studyId}/video/${videoFile.originalname}`);
      vidWatermark = await addTextWatermarkToVideo(videoFile.buffer, 'SN MUSIC')
      vidWatermarkUrl = await uploadWaterMarkFile(vidWatermark, 'videos', `study/${studyId}/watermark/${videoFile.originalname}`);
      updates.videoUrl = vidWatermarkUrl;
    }

    if (files.image && files.image.length > 0) {
      const imageFile = files.image[0];
      console.log(imageFile);
      const watermarkedFrameBuffer = await addTextWatermarkToImage(imageFile.buffer, 'SN MUSIC');
      imgWatermarkUrl = await uploadFile(watermarkedFrameBuffer, 'images', `study/${studyId}/image/${watermarkedFrameBuffer.originalname}`);
      updates.imageUrl = imgWatermarkUrl;
    }

    const student = await updateData(process.env.studyCollection, studyId, updates)
    console.log('success');
    cache.del('all_study');
    updates.studyId = studyId;

    res.status(201).send({
      success: true,
      message: 'Study updated successfully',
      study: updates,
    });
  } catch (error) {
    console.error('Error in updating study:', error);
    res.status(500).send({
      success: false,
      message: 'Error in updating study',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to delete a study material based on studyId.
// Action: DELETE
// URL: "http://localhost:8080/api/v1/study/delete"

// Description:
// - Deletes a specific study material from the Firestore database based on the provided `studyId`.
// - Validates that the study exists before attempting to delete it.
// - Removes any cached data related to the study using the cache key `all_study`.
// - Sends a success response if the deletion is successful, or an error response if not.

// Request:
// - Body: A JSON object containing the `studyId` of the study material to be deleted.
// {
//   "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2"
// }

// Response:
// Success (201):
// {
//   "success": true,
//   "message": "study deleted successfully",
//   "study": {
//     "studyId": "4d21f9b1-2c4d-483e-9bf7-9b8ab3b743b2",
//     "title": "Beginner Flute Lesson 1",
//     "description": "Introduction to flute basics",
//     "tags": ["flute", "scales", "advanced"],
//     "public": true,
//     "timestamp": "2024-11-28T14:30:45.000Z"
//   }
// }

// Failure (500):
// {
//   "success": false,
//   "message": "Error in deleting study",
//   "error": "Detailed error message"
// }

// Process:
// 1. Check if the `studyId` is provided in the request body.
// 2. Validate if the study with the given `studyId` exists in the Firestore database.
// 3. If the study exists, delete it from the database using `deleteData` function.
// 4. Clear the `all_study` cache to ensure the deleted study is not included in subsequent requests.
// 5. Send a success response with the deleted study's data.
// 6. If validation fails or the study does not exist, send an error response with a relevant message.
// 7. Handle and log any errors that occur during the process, sending a 500 response in case of failure.

// Notes:
// - The `studyId` is required to identify which study to delete.
// - The cache is cleared after each deletion to ensure data consistency across requests.
// - Error handling is in place to return detailed error messages in case of failure.
*/
export const deleteStudy = async (req, res) => {
  try {
    let { studyId } = req.body;

    if (studyId) {
      const validateData = await readSingleData(process.env.studyCollection, studyId)
      if (validateData) {
        var studyData = await deleteData(process.env.studyCollection, studyId);
        console.log('success');
        cache.del('all_study');

        return res.status(201).send({
          success: true,
          message: 'study deleted successfully',
          study: studyData
        });
      }
    } else {
      cache.del('all_study');

      return res.send({ message: "Error while finding study" })
    }
    cache.del('all_study');

  } catch (error) {
    console.error('Error in study deletion:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in student deletion',
      error: error.message,
    });
  }
};