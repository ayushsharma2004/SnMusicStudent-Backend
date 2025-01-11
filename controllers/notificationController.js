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
import { createData, deleteData, matchData, matchTwoData, readAllData, readAllLimitData, readAllSubData, readFieldData, readSingleData, readSingleSubData, searchByIdentity, searchByKeyword, searchByTag, updateData } from "../DB/crumd.js";
import { storage } from "../DB/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addTextWatermarkToImage, addTextWatermarkToVideo, extractFrameFromVideo, uploadFile, uploadWaterMarkFile } from "../helper/mediaHelper.js";

dotenv.config()

const CACHE_DURATION = 24 * 60 * 60 * 1000; //24 hours

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const bucket = admin.storage().bucket()

/* 
// Summary: Endpoint for creating a notification for study material access.
// Action: POST
// URL: "http://localhost:8080/api/v1/notification/create-notification"

// Request:
// req.body: {
//   "message": "Message text for the notification",
//   "userId": "user-uuid",
//   "studyId": "study-uuid"
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Notification created successfully",
//   "notification": {
//     "notificationId": "uuid",
//     "message": "Access granted",
//     "studyId": "study-uuid",
//     "studyTitle": "Study material title",
//     "studyDescription": "Study material description",
//     "studyImage": "https://storage.example.com/study/image.jpg",
//     "userId": "user-uuid",
//     "userName": "User Name",
//     "userEmail": "user@example.com",
//     "userBlocked": false,
//     "date": "2024-11-28T14:30:45.000Z",
//     "approved": false,
//   }
// }

//OR

// {
//   "success": true,
//   "message": "Notification created successfully",
//   "notification": {
//     "notificationId": "uuid",
//     "message": "Access granted",
//     "studyId": "study-uuid",
//     "studyTitle": "Study material title",
//     "studyDescription": "Study material description",
//     "studyImage": "https://storage.example.com/study/image.jpg",
//     "userId": "user-uuid",
//     "userName": "User Name",
//     "userEmail": "user@example.com",
//     "userBlocked": false,
//     "date": "2024-11-28T14:30:45.000Z",
//     "approved": true,
//     "time": "2024-11-28T14:30:45.000Z",
//     "startDate": "2024-11-28T14:30:45.000Z",
//     "expiryDate": "2025-02-28T14:30:45.000Z"
//   }
// }

// Failure:
// {
//   "success": false,
//   "message": "Detailed error message"
// }

// Notes:
// - Checks if required fields (`message`, `userId`, `studyId`) are provided.
// - Validates if the user has already requested access for the same study.
// - If the study is public, grants access and sends an approval notification to the user.
// - If the study is not public, sends a request notification to the user.
// - Uses Firestore batch operations to update user data and create the notification.
// - Deletes the notification cache to ensure fresh data.
// - Sends a 201 response with the notification data or a 500 error on failure.
*/

export const createNotification = async (req, res) => {
    try {
        const { userId, studyId, validity } = req.body;
        const notificationId = Date.now().toString();
        console.log(notificationId);


        // Initialize batch
        const batch = db.batch();

        var now = new Date();

        var time = now.toISOString()


        if (!userId || !studyId) {
            return res.status(400).send({ message: 'Message, user info and study material info are required' });
        }

        const validateData = await matchTwoData(process.env.notificationCollection, 'userId', userId, 'videoId', studyId);
        if (!validateData?.empty) {
            return res.status(400).send({ message: 'Request already exists' });
        }
        console.log('valid1');


        const userRef = db.collection(process.env.userCollection).doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({
                success: false,
                message: 'No such user exists',
            });
        }

        const studyRef = db.collection(process.env.studyCollection).doc(studyId);
        const studyDoc = await studyRef.get();

        if (!studyDoc.exists) {
            return res.status(404).send({
                success: false,
                message: 'No such study exists',
            });
        }

        var userJson = userDoc?.data();

        // Request Validation if the user already has the access of the video
        const validateStudies = userJson?.myVideos?.filter(video => video?.videoId === studyId);
        if (validateStudies.length >= 1) {
            return res.status(400).send({ message: 'User already has access to the study' });
        }

        var studyJson = studyDoc.data();
        var notificationJson;


        if (studyJson?.public === true) {
            // Calculate the date 100 days from now
            if (validity) {
                now.setMonth(now.getMonth() + validity);
            } else {
                now.setMonth(now.getMonth() + 3);
            }

            now.setMonth(now.getMonth() + 1000);

            const expiryDate = now?.toISOString();

            notificationJson = {
                message: 'Access granted',
                notificationId: notificationId,
                videoId: studyJson.studyId,
                videoTitle: studyJson.title,
                videoDescription: studyJson.description,
                videoUrl: studyJson?.videoUrl,
                videoImage: studyJson.imageUrl,
                videoLink: studyJson?.link,
                public: studyJson?.public,
                userId: userJson.userId,
                userFname: userJson.fname,
                userLname: userJson.lname,
                userEmail: userJson.email,
                userAllowed: userJson.allowed,
                userVerified: userJson.verified,
                date: time,
                approved: true,
                time: time,
                startDate: time,
                expiryDate: expiryDate,
                validity: 1000,
                type: "videos"
            };

            batch.update(userRef, {
                myVideos: admin.firestore.FieldValue.arrayUnion({
                    userId: userJson.userId,
                    videoId: studyJson.studyId,
                    videoTitle: studyJson.title,
                    videoDescription: studyJson.description,
                    videoUrl: studyJson?.videoUrl,
                    videoImage: studyJson.imageUrl,
                    videoLink: studyJson?.link,
                    public: studyJson?.public,
                    approved: true,
                    time: time,
                    startDate: time,
                    validity: 1000,
                    expiryDate: expiryDate
                }),
                alert: admin.firestore.FieldValue.arrayUnion({
                    type: 2,
                    heading: "Access Accepted",
                    text: `You have been given access for ${studyJson?.title}`,
                    time: time
                })
            });
        } else if (studyJson?.public === false) {
            notificationJson = {
                message: 'Access requested',
                notificationId: notificationId,
                videoId: studyJson.studyId,
                videoTitle: studyJson.title,
                videoDescription: studyJson.description,
                videoUrl: studyJson?.videoUrl,
                videoImage: studyJson.imageUrl,
                videoLink: studyJson?.link,
                public: studyJson?.public,
                userId: userJson.userId,
                userFname: userJson.fname,
                userLname: userJson.lname,
                userEmail: userJson.email,
                userAllowed: userJson.allowed,
                userVerified: userJson.verified,
                validity: validity,
                approved: false,
                date: time,
                type: "videos"
            };

            const adminRef = db.collection(process.env.adminCollection).doc(process.env.adminId);
            const notificationRef = adminRef.collection(process.env.notificationCollection).doc(notificationId);


            // Update user document's events field
            batch.update(userRef, {
                myVideos: admin.firestore.FieldValue.arrayUnion({
                    userId: userJson.userId,
                    videoId: studyJson.studyId,
                    videoTitle: studyJson.title,
                    videoDescription: studyJson.description,
                    videoUrl: studyJson?.videoUrl,
                    videoImage: studyJson.imageUrl,
                    videoLink: studyJson?.link,
                    public: studyJson?.public,
                    validity: validity,
                    approved: false,
                    time: time,
                    startDate: '',
                    expiryDate: ''
                }),
                alert: admin.firestore.FieldValue.arrayUnion({
                    type: 1,
                    heading: "Request Send",
                    text: `You have requested access for ${studyJson.title}`,
                    time: time
                })
            });

            batch.set(notificationRef, notificationJson);
        }

        cache.del('all_notification');

        // Commit batch
        await batch.commit();

        res.status(201).send({
            success: true,
            message: 'Notification created successfully',
            notification: notificationJson,
        });
    } catch (error) {
        console.error('Error in notification creation:', error);
        res.status(500).send({
            success: false,
            message: 'Error in notification creation',
            error: error.message,
        });
    }
};

/* 
// Summary: Endpoint for reading all notifications.
// Action: GET
// URL: "http://localhost:8080/api/v1/notification/read-all-notification"

// Request:
// req.body: {}  // No body required for this request

// Response:
// Success:
// {
//   "success": true,
//   "message": "Notification read successfully",
//   "notification": [
//   {
//   "success": true,
//   "message": "Notification created successfully",
//   "notification": {
//     "notificationId": "uuid",
//     "message": "Access granted",
//     "studyId": "study-uuid",
//     "studyTitle": "Study material title",
//     "studyDescription": "Study material description",
//     "studyImage": "https://storage.example.com/study/image.jpg",
//     "userId": "user-uuid",
//     "userName": "User Name",
//     "userEmail": "user@example.com",
//     "userBlocked": false,
//     "date": "2024-11-28T14:30:45.000Z",
//     "approved": false,
//   }
// },
//     {
//       "notificationId": "uuid",
//       "message": "Access granted",
//       "studyId": "study-uuid",
//       "studyTitle": "Study material title",
//       "studyDescription": "Study material description",
//       "studyImage": "https://storage.example.com/study/image.jpg",
//       "userId": "user-uuid",
//       "userName": "User Name",
//       "userEmail": "user@example.com",
//       "userBlocked": false,
//       "date": "2024-11-28T14:30:45.000Z",
//       "approved": true,
//       "time": "2024-11-28T14:30:45.000Z",
//       "startDate": "2024-11-28T14:30:45.000Z",
//       "expiryDate": "2025-02-28T14:30:45.000Z"
//     },
//     ...
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading all notification",
//   "error": "Detailed error message"
// }

// Notes:
// - Fetches all notifications from the Firestore `notificationCollection`.
// - Returns a list of notifications associated with different users and studies.
// - If successful, returns a 201 status with the list of notifications.
// - If any error occurs, returns a 500 status with the error details.
*/
export const readAllNotification = async (req, res) => {
    try {
        // var notification = await readAllData(process.env.notificationCollection);
        var notification = await readAllSubData(process.env.adminCollection, process.env.notificationCollection, process.env.adminId);

        return res.status(201).send({
            success: true,
            message: 'notification read successfully',
            notification: notification
        });
    } catch (error) {
        console.error('Error in reading all notification:', error);
        return res.status(500).send({
            success: false,
            message: 'Error in reading all notification',
            error: error.message,
        });
    }
};
/* 
// Summary: Endpoint for reading a single notification by its ID.
// Action: POST
// URL: "http://localhost:8080/api/v1/notification/read-single-notification"

// Request:
// req.body: {
//   "notificationId": "uuid"  // Unique ID of the notification to be read
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Notification created successfully",
//   "notification": {
//     "notificationId": "uuid",
//     "message": "Access granted",
//     "studyId": "study-uuid",
//     "studyTitle": "Study material title",
//     "studyDescription": "Study material description",
//     "studyImage": "https://storage.example.com/study/image.jpg",
//     "userId": "user-uuid",
//     "userName": "User Name",
//     "userEmail": "user@example.com",
//     "userBlocked": false,
//     "date": "2024-11-28T14:30:45.000Z",
//     "approved": false,
//   }
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in reading notification",
//   "error": "Detailed error message"
// }

// Notes:
// - The `notificationId` field in the request body is required to fetch the notification data.
// - If the `notificationId` is not provided, the server responds with a 400 status code and an error message.
// - If the notification with the given ID is found, it returns a 201 status with the notification data.
// - If any error occurs, a 500 status code is returned with the error details.
*/
export const readSingleNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;

        if (!notificationId) {
            return res.status(400).send({ message: 'Error finding notification' });
        }

        var notificationData = await readSingleSubData(process.env.adminCollection, process.env.adminId, process.env.notificationCollection, notificationId);
        console.log('success');

        return res.status(201).send({
            success: true,
            message: 'notification read successfully',
            notification: notificationData
        });
    } catch (error) {
        console.error('Error in reading notification:', error);
        return res.status(500).send({
            success: false,
            message: 'Error in reading notification',
            error: error.message,
        });
    }
};

/* 
// Summary: Endpoint for updating a notification and the associated study access for a user.
// Action: POST
// URL: "http://localhost:8080/api/v1/notification/update-notification"

// Request:
// req.body: {
//   "notificationId": "uuid",  // Unique ID of the notification to update
//   "approved": true/false      // Approval status for the notification (true = approved, false = denied)
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Access Data updated successfully",
//   "studyData": {
//     "studyId": "study-uuid",
//     "studyTitle": "Study material title",
//     "studyDescription": "Study material description",
//     "studyImage": "https://storage.example.com/study/image.jpg",
//     "approved": true,
//     "startDate": "2024-11-28T14:30:45.000Z",
//     "expiryDate": "2025-02-28T14:30:45.000Z"
//   },
//   "updatedData": [
//     {
//       "userId": "user-uuid",
//       "studyId": "study-uuid",
//       "approved": true,
//       "startDate": "2024-11-28T14:30:45.000Z",
//       "expiryDate": "2025-02-28T14:30:45.000Z",
//       "studyTitle": "Study material title"
//     }
//   ]
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in updating study",
//   "error": "Detailed error message"
// }

// Notes:
// - The `notificationId` is required to identify the notification that needs to be updated.
// - The `approved` field indicates whether the request is approved (true) or denied (false).
// - If approved, the user's study access is updated with the start date and expiry date set to 3 months from now.
// - If denied, the study access is removed from the user's study list.
// - The corresponding alert is added to the user's alerts and the notification is deleted.
// - If the notification does not exist, a 404 status code is returned.
// - Returns the updated study data and the modified user data.
*/
export const updateNotification = async (req, res) => {
    try {
        const { notificationId, approved } = req.body;
        var type;

        // Initialize batch
        const batch = db.batch();

        const adminRef = db.collection(process.env.adminCollection).doc(process.env.adminId);

        const notificationRef = adminRef.collection(process.env.notificationCollection).doc(notificationId);

        const notificationDoc = await notificationRef.get();

        if (!notificationDoc.exists) {
            return res.status(404).send({
                success: false,
                message: 'No such notification exists',
            });
        }

        const notificationJson = notificationDoc.data();

        const userRef = db.collection(process.env.userCollection).doc(notificationJson?.userId);

        var userData = (await userRef.get()).get("myVideos");

        var fieldData = userData.find(item => item.videoId === notificationJson?.videoId)

        var updatedData;
        var now = new Date();

        // Set the startDate to the current date
        const startDate = now.toISOString(); // Converts to ISO string format
        if (notificationJson?.validity) {
            // Calculate the date 100 days from now
            now.setMonth(now.getMonth() + notificationJson?.validity);
        } else {
            // Calculate the date 100 days from now
            now.setMonth(now.getMonth() + 3);
        }
        const expiryDate = now.toISOString();
        if (approved) {
            type = 2;
            // Find and update the object
            updatedData = userData.map(item => {
                if (item.studyId === notificationJson.studyId) {
                    return {
                        ...item,
                        approved: approved,
                        startDate: startDate,
                        expiryDate: expiryDate,
                    };
                }
                return item;
            });
            console.log(updatedData);
            // Update user document's events field
            batch.update(userRef, {
                myVideos: updatedData,
                alert: admin.firestore.FieldValue.arrayUnion({
                    type: type,
                    heading: "Access Accepted",
                    text: `You have been given access for ${notificationJson.videoTitle}`,
                    time: startDate
                })
            });
        } else {
            type = 0;

            // Filter out the object with the matching studyId
            updatedData = userData.filter(item => item.videoId !== notificationJson.videoId);

            batch.update(userRef, {
                myVideos: updatedData,
                alert: admin.firestore.FieldValue.arrayUnion({
                    type: type,
                    heading: "Access Denied",
                    text: `Your request has been denied for ${notificationJson.videoTitle}`,
                    time: startDate
                })
            })
        }

        batch.delete(notificationRef);

        await batch.commit();

        console.log("success");

        res.status(201).send({
            success: true,
            message: 'Access Data updated successfully',
            studyData: fieldData,
            updatedData: updatedData,
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