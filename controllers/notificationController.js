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
import { createData, deleteData, matchData, matchTwoData, readAllData, readAllLimitData, readFieldData, readSingleData, searchByIdentity, searchByKeyword, searchByTag, updateData } from "../DB/crumd.js";
import { storage } from "../DB/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addTextWatermarkToImage, addTextWatermarkToVideo, extractFrameFromVideo, uploadFile, uploadWaterMarkFile } from "../helper/mediaHelper.js";

dotenv.config()

const CACHE_DURATION = 24 * 60 * 60 * 1000; //24 hours

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const bucket = admin.storage().bucket()

/*
    Summery: Used for creating notification request for study and adding it in user doc study field
    Action: POST
    url: "http://localhost:8080/api/v1/notification/create-notification"
    req.body: {
        "message": "Not decided",
        "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
        "studyId": "9f88c762-2857-4266-8b55-78a82972d881"
    }
    response: {
        "success": true,
        "message": "Notification created successfully",
        "notification": {
            "notificationId": "6b4c1980-1774-45c2-aeca-7ecaf12b4140",
            "message": "New Study Added",
            "studyId": "553ed00c-36e7-4a7c-bc7a-a021092fb1e2",
            "studyTitle": "study title1",
            "studyDescription": "desc1",
            "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F553ed00c-36e7-4a7c-bc7a-a021092fb1e2%2Fimage%2Fundefined?alt=media&token=2a815476-0b56-44f1-9cf1-6807770c9dd4",
            "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
            "userName": "Ayush Sharma",
            "userEmail": "ayush.s.sharma04@gmail.com",
            "userBlocked": false,
            "approved": false,
            "date": "2024-08-15T10:07:53.125Z"
        }
    }
*/
// Create Notification
export const createNotification = async (req, res) => {
    try {
        const { message, userId, studyId } = req.body;
        const notificationId = uuidv4();

        // Initialize batch
        const batch = db.batch();

        var now = new Date();

        if (!message || !userId || !studyId) {
            return res.status(400).send({ message: 'Message, user info and study material info are required' });
        }

        const validateData = await matchTwoData(process.env.notificationCollection, 'userId', userId, 'studyId', studyId);
        if (!validateData.empty) {
            return res.status(400).send({ message: 'Request already exists' });
        }

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

        var userJson = userDoc.data();

        // Request Validation if the user already has the access of the video
        const validateStudies = userJson?.study?.filter(study => study?.studyId === studyId);
        if (validateStudies.length >= 1) {
            return res.status(400).send({ message: 'Request already exists' });
        }

        var studyJson = studyDoc.data();

        const notificationJson = {
            notificationId: notificationId,
            message: message,
            studyId: studyJson.studyId,
            studyTitle: studyJson.title,
            studyDescription: studyJson.description,
            studyImage: studyJson.imageUrl,
            userId: userJson.userId,
            userName: userJson.name,
            userEmail: userJson.email,
            userBlocked: userJson.blocked,
            approved: false,
            date: now.toISOString(),
        };

        const notificationRef = db.collection(process.env.notificationCollection).doc(notificationId);


        // Update user document's events field
        batch.update(userRef, {
            study: admin.firestore.FieldValue.arrayUnion({
                userId: userJson.userId,
                studyId: studyJson.studyId,
                studyTitle: studyJson.title,
                studyDescription: studyJson.description,
                studyImage: studyJson.imageUrl,
                approved: false,
                startDate: '',
                expiryDate: ''
            })
        });

        batch.set(notificationRef, notificationJson);

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


//function to read all notifications details
/* 
    request url = http://localhost:8080/api/v1/notification/read-all-notification
    method = GET
    response: {
        "success": true,
        "message": "notification read successfully",
        "notification": [
            {
            "date": "2024-08-15T10:07:53.125Z",
            "approved": false,
            "studyDescription": "desc1",
            "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F553ed00c-36e7-4a7c-bc7a-a021092fb1e2%2Fimage%2Fundefined?alt=media&token=2a815476-0b56-44f1-9cf1-6807770c9dd4",
            "notificationId": "6b4c1980-1774-45c2-aeca-7ecaf12b4140",
            "studyId": "553ed00c-36e7-4a7c-bc7a-a021092fb1e2",
            "userEmail": "ayush.s.sharma04@gmail.com",
            "studyTitle": "study title1",
            "userBlocked": false,
            "message": "New Study Added",
            "userName": "Ayush Sharma",
            "userId": "f2b077ed-e350-4783-8738-22c5969036dd"
            }
        ]
    }
*/

export const readAllNotification = async (req, res) => {
    try {
        // var notification = await readAllData(process.env.notificationCollection);
        var notification = await readAllData(process.env.notificationCollection);

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

//function to read single document of our Notification details
/* 
    request url = http://localhost:8080/api/v1/notification/read-notification
    method = POST
    {
      "notificationId": "jjhjhjsagsa" //your doc id
    }
    response: {
        "success": true,
        "message": "notification read successfully",
        "notification": {
            "date": "2024-08-15T10:07:53.125Z",
            "approved": false,
            "studyDescription": "desc1",
            "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F553ed00c-36e7-4a7c-bc7a-a021092fb1e2%2Fimage%2Fundefined?alt=media&token=2a815476-0b56-44f1-9cf1-6807770c9dd4",
            "notificationId": "6b4c1980-1774-45c2-aeca-7ecaf12b4140",
            "studyId": "553ed00c-36e7-4a7c-bc7a-a021092fb1e2",
            "userEmail": "ayush.s.sharma04@gmail.com",
            "studyTitle": "study title1",
            "userBlocked": false,
            "message": "New Study Added",
            "userName": "Ayush Sharma",
            "userId": "f2b077ed-e350-4783-8738-22c5969036dd"
        }
    }
*/
export const readSingleNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;

        if (!notificationId) {
            return res.status(400).send({ message: 'Error finding notification' });
        }

        var notificationData = await readSingleData(process.env.notificationCollection, notificationId);
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

//function to update our Notifications details
/* 
    request url = http://localhost:8080/api/v1/notification/update-notification
    method = POST
    req.body: {
        "notificationId": "jjhjhjsagsa" //your notification doc id,
        "approved": true/false 
    }
    response: {
        "success": true,
        "message": "Access Data updated successfully",
        "studyData": {
            "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
            "studyId": "33e93fad-d0e0-4a89-89ae-8f80cac2dd6c",
            "studyTitle": "study title2",
            "studyDescription": "desc2",
            "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33e93fad-d0e0-4a89-89ae-8f80cac2dd6c%2Fimage%2Fundefined?alt=media&token=873086c0-f8d5-4609-ae9a-59677cb6243c",
            "approved": false,
            "startDate": "",
            "expiryDate": ""
        },
        "updatedData": [
            {
                "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
                "studyId": "553ed00c-36e7-4a7c-bc7a-a021092fb1e2",
                "studyTitle": "study title1",
                "studyDescription": "desc1",
                "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F553ed00c-36e7-4a7c-bc7a-a021092fb1e2%2Fimage%2Fundefined?alt=media&token=2a815476-0b56-44f1-9cf1-6807770c9dd4",
                "approved": false,
                "startDate": "",
                "expiryDate": ""
            },
            {
                "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
                "studyId": "33e93fad-d0e0-4a89-89ae-8f80cac2dd6c",
                "studyTitle": "study title2",
                "studyDescription": "desc2",
                "studyImage": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33e93fad-d0e0-4a89-89ae-8f80cac2dd6c%2Fimage%2Fundefined?alt=media&token=873086c0-f8d5-4609-ae9a-59677cb6243c",
                "approved": true,
                "startDate": "2024-08-15T15:45:42.743Z",
                "expiryDate": "2024-11-15T15:45:42.743Z"
            }
        ]
    }
*/
export const updateNotification = async (req, res) => {
    try {
        const { notificationId, approved } = req.body;

        // Initialize batch
        const batch = db.batch();

        const notificationRef = db.collection(process.env.notificationCollection).doc(notificationId);

        const notificationDoc = await notificationRef.get();

        if (!notificationDoc.exists) {
            return res.status(404).send({
                success: false,
                message: 'No such notification exists',
            });
        }

        const notificationJson = notificationDoc.data();

        const userRef = db.collection(process.env.userCollection).doc(notificationJson?.userId);

        var userData = (await userRef.get()).get("study");

        var fieldData = userData.find(item => item.studyId === notificationJson.studyId)

        var updatedData;
        if (approved) {
            // Find and update the object
            updatedData = userData.map(item => {
                if (item.studyId === notificationJson.studyId) {
                    var now = new Date();

                    // Set the startDate to the current date
                    const startDate = now.toISOString(); // Converts to ISO string format

                    // Calculate the date 100 days from now
                    now.setMonth(now.getMonth() + 3);
                    const expiryDate = now.toISOString();
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
                study: updatedData
            });
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