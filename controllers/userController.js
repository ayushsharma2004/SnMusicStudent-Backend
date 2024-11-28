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
import { readAllLimitData, readFieldData, readSingleData, searchByIdentity, searchInnerFieldData, searchLimitInnerFieldData } from "../DB/crumd.js";
import { storage } from "../DB/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addTextWatermarkToImage, addTextWatermarkToVideo, extractFrameFromVideo, uploadFile, uploadWaterMarkFile } from "../helper/mediaHelper.js";

dotenv.config()

const CACHE_DURATION = 24 * 60 * 60 * 1000; //24 hours

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const bucket = admin.storage().bucket()

/* 
// Summary: Endpoint for retrieving all user data with limited fields.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-all-user"

// Request:
// req.body: {}
// No body content required as it fetches all users.

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "user": [
//     {
//       "userId": "user-uuid",
//       "name": "John Doe",
//       "phone": "+1234567890",
//       "email": "johndoe@example.com",
//       "address": "123 Main Street, City, Country"
//     },
//     {
//       "userId": "user-uuid-2",
//       "name": "Jane Smith",
//       "phone": "+0987654321",
//       "email": "janesmith@example.com",
//       "address": "456 Elm Street, City, Country"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading all user",
//   "error": "Detailed error message"
// }

// Notes:
// - Fetches all users from the user collection, limiting the fields to `name`, `userId`, `phone`, `email`, and `address`.
// - The `readAllLimitData` function is used to optimize the data retrieval by limiting unnecessary fields.
// - Returns a list of user objects with basic details.
// - If any error occurs during the database operation, a 500 status code with error details is returned.
*/
export const readAllUser = async (req, res) => {
  try {
    // var user = await readAllData(process.env.userCollection);
    var user = await readAllLimitData(process.env.userCollection, ['name', 'userId', 'phone', 'email', "address"]);

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      user: user
    });
  } catch (error) {
    console.error('Error in reading all user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading all user',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to search and retrieve user data based on a given identity keyword.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-identity-user"

// Request:
// req.body: {
//   "identity": "search_term"  // The identity keyword to search in the fields (name, email, userId, address)
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "user": [
//     {
//       "name": "John Doe",               // Matched user data
//       "email": "johndoe@example.com",    // Matched email
//       "userId": "user-12345",            // Matched userId
//       "address": "123 Main St, City, Country"  // Matched address
//     },
//     {
//       "name": "Jane Smith",
//       "email": "janesmith@example.com",
//       "userId": "user-67890",
//       "address": "456 Elm St, City, Country"
//     }
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading user",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint searches for users in the `userCollection` based on a keyword (`identity`).
// - The search checks four fields: `name`, `email`, `userId`, and `address` for partial matching.
// - The result is case-insensitive and returns up to 20 matched users (default limit).
// - If the keyword is not found, an empty array will be returned in the `user` field.
*/
export const readIdentityUser = async (req, res) => {
  try {
    const { identity } = req.body;

    if (!identity) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var userData = await searchByIdentity(process.env.userCollection, identity);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      user: userData
    });
  } catch (error) {
    console.error('Error in reading user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading user',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve a single user by their userId.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-user"

// Request:
// req.body: {
//   "userId": "user-uuid"  // The unique identifier (userId) of the user to be retrieved
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "user": {
//     "userId": "user-uuid",
//     "name": "John Doe",
//     "phone": "+1234567890",
//     "email": "johndoe@example.com",
//     "address": "123 Main Street, City, Country"
//   }
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading user",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint retrieves a single user based on their `userId`.
// - The `readSingleData` function is used to fetch the user from the database by their unique identifier.
// - If the `userId` is missing from the request body, a `400` status code will be returned with an appropriate error message.
// - If the user is found, the full user object is returned in the response.
// - If an error occurs during the retrieval process, a `500` status code with the error message is returned.
*/
export const readSingleUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var userData = await readSingleData(process.env.userCollection, userId);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      user: userData
    });
  } catch (error) {
    console.error('Error in reading user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading user',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve all alerts for a specific user, sorted by time.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-user-alert"

// Request:
// req.body: {
//   "userId": "user-uuid"  // The unique identifier (userId) of the user whose alerts need to be fetched
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "alerts": [
//     {
//       "type": 0,
//       "heading": "Access Denied",
//       "text": "Your request has been denied for study title2",
//       "time": "2024-08-23T17:17:11.330Z"
//     },
//     {
//       "type": 1,
//       "heading": "Request Send",
//       "text": "You have requested access for study title2",
//       "time": "2024-08-23T17:16:41.002Z"
//     },
//     {
//       "type": 2,
//       "heading": "Access Accepted",
//       "text": "You have been given access for study title1",
//       "time": "2024-08-23T17:15:58.216Z"
//     },
//     {
//       "type": 1,
//       "heading": "Request Send",
//       "text": "You have requested access for study title1",
//       "time": "2024-08-23T17:03:20.137Z"
//     },
//     {
//       "type": 1,
//       "heading": "Welcome to SNMUSIC",
//       "text": "You have been successfully registered",
//       "time": "2024-08-23T16:46:41.811Z"
//     }
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading alerts",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint retrieves all alerts for a user, identified by `userId`.
// - The alerts are sorted by the `time` field in descending order.
// - The `readFieldData` function is used to fetch the alerts for the given `userId` from the database.
// - If the `userId` is missing from the request body, a `400` status code will be returned with an appropriate error message.
// - The response will contain an array of alert objects, with each object including a `type`, `heading`, `text`, and `time` field.
// - If any error occurs during the database operation, a `500` status code with the error details is returned.
*/
export const readAllUserAlert = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var alerts = await readFieldData(process.env.userCollection, userId, 'alert', 'time');
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      alerts: alerts
    });
  } catch (error) {
    console.error('Error in reading alerts:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading alerts',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve all approved studies for a specific user.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-user-study"

// Request:
// req.body: {
//   "userId": "user-uuid"  // The unique identifier (userId) of the user whose approved studies need to be fetched
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "study": [
//     {
//       "studyId": "8720e387-1e4e-41f3-8c25-78a28154be10",
//       "studyTitle": "Study Title8",
//       "studyDescription": "Desc8",
//       "approved": true,
//       "expiryDate": "2024-12-13T08:39:32.374Z",
//       "startDate": "2024-09-13T08:39:32.374Z",
//       "studyImage": null,
//       "time": "2024-09-13T08:39:32.374Z"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading user",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint retrieves all approved studies for a user, identified by `userId`.
// - The studies are filtered based on the `approved` field, which must be `true`.
// - The `searchInnerFieldData` function is used to retrieve studies from the `study` field in the user document.
// - The response includes an array of study objects, each containing details like `studyId`, `studyTitle`, `studyDescription`, `approved`, `expiryDate`, `startDate`, `studyImage`, and `time`.
// - If the `userId` is missing from the request body, a `400` status code will be returned with an error message.
// - If any error occurs during the database operation, a `500` status code with the error details is returned.
*/
export const readUserStudy = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var approvedStudies = await searchInnerFieldData(process.env.userCollection, userId, 'study', 'approved', true);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      study: approvedStudies
    });
  } catch (error) {
    console.error('Error in reading user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading user',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve a limited number of approved studies for a specific user.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-limited-user-study"

// Request:
// req.body: {
//   "userId": "user-uuid",  // The unique identifier (userId) of the user whose approved studies need to be fetched
//   "limit": 5             // The number of studies to return (limit)
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "study": [
//     {
//       "studyId": "8720e387-1e4e-41f3-8c25-78a28154be10",
//       "studyTitle": "Study Title8",
//       "studyDescription": "Desc8",
//       "approved": true,
//       "expiryDate": "2024-12-13T08:39:32.374Z",
//       "startDate": "2024-09-13T08:39:32.374Z",
//       "studyImage": null,
//       "time": "2024-09-13T08:39:32.374Z"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading user",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint retrieves a limited number of approved studies for a user, identified by `userId`.
// - The number of studies returned is controlled by the `limit` parameter.
// - The studies are filtered based on the `approved` field, which must be `true`.
// - The `searchLimitInnerFieldData` function is used to retrieve studies from the `study` field in the user document and limit the results.
// - The response includes an array of study objects, each containing details like `studyId`, `studyTitle`, `studyDescription`, `approved`, `expiryDate`, `startDate`, `studyImage`, and `time`.
// - If the `userId` or `limit` is missing from the request body, a `400` status code will be returned with an error message.
// - If any error occurs during the database operation, a `500` status code with the error details is returned.
*/
export const readLimitedUserStudy = async (req, res) => {
  try {
    const { userId, limit } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var approvedStudies = await searchLimitInnerFieldData(process.env.userCollection, userId, 'study', 'approved', true, limit);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      study: approvedStudies
    });
  } catch (error) {
    console.error('Error in reading user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading user',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve unapproved studies for a specific user.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-user-unapproved-study"

// Request:
// req.body: {
//   "userId": "user-uuid"   // The unique identifier (userId) of the user whose unapproved studies need to be fetched
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "study": [
//     {
//       "studyId": "7a5b2feb-d970-475e-b079-27c44e581bf7",
//       "studyTitle": "Study Title2",
//       "studyDescription": "Desc2",
//       "approved": false,
//       "expiryDate": "",
//       "startDate": "",
//       "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F7a5b2feb-d970-475e-b079-27c44e581bf7%2Fimage%2Fundefined?alt=media&token=ae797b33-682d-4957-8160-e3ae9c8292bb",
//       "time": "2024-11-04T17:55:46.195Z"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading user",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint retrieves all unapproved studies for a user, identified by `userId`.
// - The studies are filtered based on the `approved` field, which must be `false`.
// - The response contains an array of study objects, each with fields like `studyId`, `studyTitle`, `studyDescription`, `approved`, `expiryDate`, `startDate`, `studyImage`, and `time`.
// - `studyImage` contains a URL to the study's image, which may be empty or undefined.
// - The `expiryDate` and `startDate` fields may be empty for unapproved studies.
// - If the `userId` is missing, the response will include a `400` status code with an error message.
// - In case of an error while fetching data from the database, a `500` status code with the error message will be returned.
*/
export const readUserUnapprovedStudy = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var approvedStudies = await searchInnerFieldData(process.env.userCollection, userId, 'study', 'approved', false);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      study: approvedStudies
    });
  } catch (error) {
    console.error('Error in reading user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading user',
      error: error.message,
    });
  }
};

/* 
// Summary: Endpoint to retrieve a single study for a specific user by `studyId`.
// Action: POST
// URL: "http://localhost:8080/api/v1/user/read-single-user-study"

// Request:
// req.body: {
//   "userId": "user-uuid",  // The unique identifier (userId) of the user whose study needs to be fetched
//   "studyId": "study-uuid" // The unique identifier (studyId) of the study to be fetched
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "user read successfully",
//   "study": {
//     "studyId": "7a5b2feb-d970-475e-b079-27c44e581bf7",
//     "studyTitle": "Study Title2",
//     "studyDescription": "Desc2",
//     "approved": false,
//     "expiryDate": "",
//     "startDate": "",
//     "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F7a5b2feb-d970-475e-b079-27c44e581bf7%2Fimage%2Fundefined?alt=media&token=ae797b33-682d-4957-8160-e3ae9c8292bb",
//     "time": "2024-11-04T17:55:46.195Z"
//   }
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading user",
//   "error": "Detailed error message"
// }

// Notes:
// - This endpoint retrieves a specific study for a user, identified by both `userId` and `studyId`.
// - The study is fetched by filtering on `studyId`.
// - The response contains a study object with fields such as `studyId`, `studyTitle`, `studyDescription`, `approved`, `expiryDate`, `startDate`, `studyImage`, and `time`.
// - If the `userId` or `studyId` is missing, the response will include a `400` status code with an error message.
// - In case of an error while fetching data from the database, a `500` status code with the error message will be returned.
*/
export const readSingleUserStudy = async (req, res) => {
  try {
    const { userId, studyId } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var approvedStudies = await searchInnerFieldData(process.env.userCollection, userId, 'study', 'studyId', studyId);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'user read successfully',
      study: approvedStudies
    });
  } catch (error) {
    console.error('Error in reading user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in reading user',
      error: error.message,
    });
  }
};
