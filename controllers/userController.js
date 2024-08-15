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
import { readAllLimitData, readSingleData, searchByIdentity, searchInnerFieldData, searchLimitInnerFieldData } from "../DB/crumd.js";
import { storage } from "../DB/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addTextWatermarkToImage, addTextWatermarkToVideo, extractFrameFromVideo, uploadFile, uploadWaterMarkFile } from "../helper/mediaHelper.js";

dotenv.config()

const CACHE_DURATION = 24 * 60 * 60 * 1000; //24 hours

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const bucket = admin.storage().bucket()


//function to read all users details
/* 
    request url = http://localhost:8080/api/v1/user/read-all-user
    method = GET
    response: [
    {
      "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
      "name": "Ayush Sharma",
      "email": "ayush.s.sharma04@gmail.com",
      "phone": "9326242640",
      "address": "Mumbai",
      "study": [],
      "blocked": false,
      "role": 1
    },
    {
      "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
      "name": "Ayush Sharma",
      "email": "ayush.s.sharma04@gmail.com",
      "phone": "9326242640",
      "address": "Mumbai",
      "study": [],
      "blocked": false,
      "role": 1
    }
  ]
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

//function to search all users details according to the identity
/* 
    request url = http://localhost:8080/api/v1/user/read-identity-user
    method = POST
    req.body: {
      "identity": "userId/name/email/address"
    }
    response: [
    {
      "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
      "name": "Ayush Sharma",
      "email": "ayush.s.sharma04@gmail.com",
      "phone": "9326242640",
      "address": "Mumbai",
      "study": [],
      "blocked": false,
      "role": 1
    },
    {
      "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
      "name": "Ayush Sharma",
      "email": "ayush.s.sharma04@gmail.com",
      "phone": "9326242640",
      "address": "Mumbai",
      "study": [],
      "blocked": false,
      "role": 1
    }
  ]
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

//function to read single document of our User details
/* 
    request url = http://localhost:8080/api/v1/user/read-user
    method = POST
    {
      "userId": "jjhjhjsagsa" //your doc id
    }
      response: {
        "success": true,
        "message": "User read successfully",
        "user": {
          "userId": "0cfc8500-8ebd-44ac-b2f8-f46e712e24ed",
          "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/user%2Fviddemo1.mp4?alt=media&token=c1a87355-2d6e-49f5-b87c-8d67eaf0784b",
          "description": "gjygkjhjk",
          "title": "title2",
          "imageUrl": "hgjhghj.com"
        }
      }
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
