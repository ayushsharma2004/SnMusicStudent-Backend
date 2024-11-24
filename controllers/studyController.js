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

//function to create our Studys details
/* 
    request url = http://localhost:8080/api/v1/study/create-study
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
      "message": "Study created successfully",
      "study": {
        "studyId": "bb9ee1bc-f704-4aa0-a1cb-fbe255e9c5be",
        "title": "title9",
        "description": "desc9",
        "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fbb9ee1bc-f704-4aa0-a1cb-fbe255e9c5be%2Fwatermark%2FvidInstrument2.mp4?alt=media&token=7f2bdbf5-22d5-4d04-8415-1c56ffe9e4e4",
        "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fbb9ee1bc-f704-4aa0-a1cb-fbe255e9c5be%2Fimage%2Fundefined?alt=media&token=f12e8276-8070-4b82-96d0-fd3334c1abb6",
        "timestamp": "2024-07-22T16:27:20.343Z"
      }
    }
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

    let imageUrl = null;
    let videoUrl = null;
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

//function to read all our Study details
/* 
    request url = http://localhost:8080/api/v1/study/read-all-study
    method = GET
    response: [
    {
      "studyId": "35e5869f-2e88-4880-8ae8-cff13d140ec9",
      "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33b84a50-8c40-407a-b259-eed837c6b2af%2Fwatermark%2FvidInstrument8.mp4?alt=media&token=62ab1750-63f1-4662-944a-7e5c40366e09",
      "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F35e5869f-2e88-4880-8ae8-cff13d140ec9%2Fimage%2Fframe.jpg?alt=media&token=fcdcb285-db66-4a30-992e-3c2d80a9641b",
      "description": "desc5",
      "title": "title5"
    },
    {
      "studyId": "44588c1b-125b-44eb-9179-f6c59d9d7344",
      "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33b84a50-8c40-407a-b259-eed837c6b2af%2Fwatermark%2FvidInstrument8.mp4?alt=media&token=62ab1750-63f1-4662-944a-7e5c40366e09",
      "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F44588c1b-125b-44eb-9179-f6c59d9d7344%2Fimage%2Fframe.jpg?alt=media&token=ac167b7e-0a3e-49fe-937a-490cd9cefafa",
      "description": "desc3",
      "title": "title3"
    }
  ]
*/

export const readAllStudy = async (req, res) => {
  try {
    var key = 'all_study'
    // var study = await readAllData(process.env.studyCollection);
    var study = await readAllLimitData(process.env.studyCollection, ['studyId', 'imageUrl', 'description', 'title', 'videoUrl', 'link', 'public', 'timestamp']);

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
      ['studyId', 'imageUrl', 'description', 'title', 'videoUrl', 'link', 'public', 'timestamp'],
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
  Summary: Funcyion to search study materials by a keyword
  Action: POST
  url: "http://localhost:8080/api/v1/study/read-study-keyword"
  req.body: {
    "keyword": "tracks"
  }
  response: {
    "success": true,
    "message": "study read successfully",
    "study": [
      {
        "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33e93fad-d0e0-4a89-89ae-8f80cac2dd6c%2Fwatermark%2FvidInstrument6.mp4?alt=media&token=fb501109-032b-4051-becf-92dd48167bbd",
        "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33e93fad-d0e0-4a89-89ae-8f80cac2dd6c%2Fimage%2Fundefined?alt=media&token=873086c0-f8d5-4609-ae9a-59677cb6243c",
        "description": "desc2",
        "studyId": "33e93fad-d0e0-4a89-89ae-8f80cac2dd6c",
        "tags": [
          "rag",
          "songs"
        ],
        "timestamp": {
          "_seconds": 1722241643,
          "_nanoseconds": 921000000
        },
        "title": "study title2"
      }
    ]
  }
*/
// search study material by keyword
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
  Summary: Funcyion to search study materials by a tags and keyword (optional)
  Action: POST
  url: "http://localhost:8080/api/v1/study/read-tag-study"
  req.body: {
    "keyword": "songs", (optional)
    "tag": ["songs", "spiritual"]
  }
  response: {
    "success": true,
    "message": "study read successfully",
    "study": [
      {
        "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33e93fad-d0e0-4a89-89ae-8f80cac2dd6c%2Fwatermark%2FvidInstrument6.mp4?alt=media&token=fb501109-032b-4051-becf-92dd48167bbd",
        "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F33e93fad-d0e0-4a89-89ae-8f80cac2dd6c%2Fimage%2Fundefined?alt=media&token=873086c0-f8d5-4609-ae9a-59677cb6243c",
        "description": "desc2",
        "studyId": "33e93fad-d0e0-4a89-89ae-8f80cac2dd6c",
        "tags": [
          "rag",
          "songs"
        ],
        "timestamp": {
          "_seconds": 1722241643,
          "_nanoseconds": 921000000
        },
        "title": "study title2"
      },
      {
        "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fc2090832-69d6-4d18-ac09-8375149966da%2Fwatermark%2FvidInstrument7.mp4?alt=media&token=6420eeed-8789-49a0-abe1-a44a717514b0",
        "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fc2090832-69d6-4d18-ac09-8375149966da%2Fimage%2Fundefined?alt=media&token=0d028104-4b2f-498d-9d7f-23404d3bc6c3",
        "description": "desc3",
        "studyId": "c2090832-69d6-4d18-ac09-8375149966da",
        "tags": [
          "spiritual",
          "tracks"
        ],
        "timestamp": {
          "_seconds": 1722241717,
          "_nanoseconds": 667000000
        },
        "title": "study title3"
      }
    ]
  }
*/
//
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
  Summary: Funcyion to search study materials by a keyword
  Action: POST
  url: "http://localhost:8080/api/v1/study/read-tag-study"
  req.body: {
    "ids": ["c2090832-69d6-4d18-ac09-8375149966da", "553ed00c-36e7-4a7c-bc7a-a021092fb1e2"]
  }
  response: {
  "success": true,
  "message": "study read successfully",
  "study": [
    {
      "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F553ed00c-36e7-4a7c-bc7a-a021092fb1e2%2Fwatermark%2FvidInstrument5.mp4?alt=media&token=2ce4ba8e-74fa-4552-99db-46aa14db7d47",
      "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F553ed00c-36e7-4a7c-bc7a-a021092fb1e2%2Fimage%2Fundefined?alt=media&token=2a815476-0b56-44f1-9cf1-6807770c9dd4",
      "description": "desc1",
      "studyId": "553ed00c-36e7-4a7c-bc7a-a021092fb1e2",
      "tags": [
        "rag",
        "tracks"
      ],
      "timestamp": {
        "_seconds": 1722241543,
        "_nanoseconds": 342000000
      },
      "title": "study title1"
    },
    {
      "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fc2090832-69d6-4d18-ac09-8375149966da%2Fwatermark%2FvidInstrument7.mp4?alt=media&token=6420eeed-8789-49a0-abe1-a44a717514b0",
      "imageUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fc2090832-69d6-4d18-ac09-8375149966da%2Fimage%2Fundefined?alt=media&token=0d028104-4b2f-498d-9d7f-23404d3bc6c3",
      "description": "desc3",
      "studyId": "c2090832-69d6-4d18-ac09-8375149966da",
      "tags": [
        "spiritual",
        "tracks"
      ],
      "timestamp": {
        "_seconds": 1722241717,
        "_nanoseconds": 667000000
      },
      "title": "study title3"
    }
  ]
}
*/
// Getting all study items from user doc study field  
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

//function to read single videoUrl of our Study details
/* 
    request url = http://localhost:8080/api/v1/study/read-study-video
    method = POST
    {
      "studyId": "jjhjhjsagsa" //your doc id
    }
    response: {
      "success": true,
      "message": "study video read successfully",
      "study": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fa7c59a85-9090-43d5-b974-36f38ce23197%2Fwatermark%2FvidInstrument2.mp4?alt=media&token=365595af-367a-4fa7-91f5-047044c3c453"
    }
*/

export const readStudyVideo = async (req, res) => {
  try {
    const { studyId } = req.body;
    if (!studyId) {
      return res.status(400).send({ message: 'Study id is required' });
    }
    // var study = await readAllData(process.env.studyCollection);
    var study = await readFieldData(process.env.studyCollection, studyId, 'videoUrl');
    console.log(study);

    return res.status(201).send({
      success: true,
      message: 'study video read successfully',
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


//function to read single document of our Study details
/* 
    request url = http://localhost:8080/api/v1/study/read-study
    method = POST
    {
      "studyId": "jjhjhjsagsa" //your doc id
    }
      response: {
        "success": true,
        "message": "Study read successfully",
        "student": {
          "studentId": "0cfc8500-8ebd-44ac-b2f8-f46e712e24ed",
          "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2Fviddemo1.mp4?alt=media&token=c1a87355-2d6e-49f5-b87c-8d67eaf0784b",
          "description": "gjygkjhjk",
          "title": "title2",
          "imageUrl": "hgjhghj.com"
        }
      }
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

//function to update single our Study details
/* 
    request url = http://localhost:8080/api/v1/study/update-study
    method = POST
    FormData: 
    fields: {
      "studyId": "studyId"
      "title": "title1",
      "description": "desc1"
    }
    files: { //req.files
      "video": "video file",
      "image": "image file"
    }
    response: {
      "success": true,
      "message": "Student updated successfully",
      "study": {
        "description": "desc1_jhjhkhhkjhhkjjhjhkhkjkh",
        "imageUrl": "hgjhghj.com"
        "videoUrl": "https://firebasestorage.googleapis.com/v0/b/snmusic-ca00f.appspot.com/o/study%2F6638b142-4a0c-4eb8-8ed3-128ec3665e58%2Fviddemo4.mp4?alt=media&token=726d4053-bb5a-48a8-a1a9-b91764cdfb53"
      }
    }
*/
export const updateStudy = async (req, res) => {
  try {
    const { studyId, title, description } = req.body;
    const files = req.files;

    // Create the updates object only with provided fields
    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    const watermarkPath = "../../SNmusicAdmin/admin/src/images/watermark2.png";

    if (!studyId) {
      return res.status(400).send({ message: 'Error finding study' });
    }

    if (!title && !description && !files) {
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

//function to delete single our Study details
/* 
    request url = http://localhost:8080/api/v1/study/delete-study
    method = POST
    req.body: 
    {
      "studyId": "studyId"
    }
    response: {
      "success": true,
      "message": "study deleted successfully",
      "study": {
        "_writeTime": {
          "_seconds": 1721336310,
          "_nanoseconds": 790740000
        }
      }
    }
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