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


//function to create our Notifications details
/* 
    request url = http://localhost:8080/api/v1/notification/create-notification
    method = POST
    FormData: 
    fields: {
      "title": "title1",
      "description": "desc1"
    }
    files: { //req.file
      "video": "video file",
      "image": "image file for thumbnail"
    }
    response: {
      "success": true,
      "message": "Notification created successfully",
      "notification": {
        "notificationId": "bb9ee1bc-f704-4aa0-a1cb-fbe255e9c5be",
        "title": "title9",
        "description": "desc9",
        "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/notification%2Fbb9ee1bc-f704-4aa0-a1cb-fbe255e9c5be%2Fwatermark%2FvidInstrument2.mp4?alt=media&token=7f2bdbf5-22d5-4d04-8415-1c56ffe9e4e4",
        "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/notification%2Fbb9ee1bc-f704-4aa0-a1cb-fbe255e9c5be%2Fimage%2Fundefined?alt=media&token=f12e8276-8070-4b82-96d0-fd3334c1abb6",
        "timestamp": "2024-07-22T16:27:20.343Z"
      }
    }
*/
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
                message: 'No such user exists',
            });
        }

        var userJson = userDoc.data();
        var studyJson = studyDoc.data();

        const validateStudies = userJson?.study?.filter(study => study?.studyId === studyId);

        if (validateStudies.length >= 1) {
            return res.status(400).send({ message: 'Request already exists' });
        }

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
    response: [
    {
      "notificationId": "35e5869f-2e88-4880-8ae8-cff13d140ec9",
      "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/notification%2F35e5869f-2e88-4880-8ae8-cff13d140ec9%2Fimage%2Fframe.jpg?alt=media&token=fcdcb285-db66-4a30-992e-3c2d80a9641b",
      "description": "desc5",
      "title": "title5"
    },
    {
      "notificationId": "44588c1b-125b-44eb-9179-f6c59d9d7344",
      "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/notification%2F44588c1b-125b-44eb-9179-f6c59d9d7344%2Fimage%2Fframe.jpg?alt=media&token=ac167b7e-0a3e-49fe-937a-490cd9cefafa",
      "description": "desc3",
      "title": "title3"
    }
  ]
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
        "message": "Notification read successfully",
        "notification": {
          "notificationId": "0cfc8500-8ebd-44ac-b2f8-f46e712e24ed",
          "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/notification%2Fviddemo1.mp4?alt=media&token=c1a87355-2d6e-49f5-b87c-8d67eaf0784b",
          "description": "gjygkjhjk",
          "title": "title2",
          "imageUrl": "hgjhghj.com"
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