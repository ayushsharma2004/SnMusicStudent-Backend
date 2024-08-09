import express from 'express';
import { storage } from './firebase.js';
import { db } from './firestore.js';
import dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

dotenv.config();

const upload = multer(); //

//rest object
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

export const uploadVideo = async (file, folderRef) => {
    if (!file) {
        throw new Error("No file uploaded");
    }

    try {
        console.log("File details: ", file);

        const fileName = `${uuidv4()}_${file.originalname}`;
        const fileRef = ref(folderRef, file.originalname);
        const metadata = { contentType: file.mimetype };

        console.log("Folder reference: ", folderRef);
        console.log("File reference: ", fileRef);

        uploadBytes(fileRef, file.buffer, metadata)
            .then(() => {
                getDownloadURL(fileRef).then(url => {
                    fname = fileRef.name
                    urll = url
                    console.log("fname: " + fname);
                    console.log("urll: " + urll);
                    return url
                })
                    .catch(err => {
                        console.log(err);
                    })
            })
        console.log("File URL: ", url);

        return url;
    } catch (err) {
        console.error("Error uploading file: ", err);
        throw new Error("Failed to upload file to Firebase Storage.");
    }
};

export const uploadImage = async (file, folderName) => {
    if (!file) {
        return { error: "No File uploaded" };
    }

    const uniqueId = uuidv4(); // Generate a unique ID
    const folderRef = ref(storage, folderName);
    const fileRef = ref(folderRef, `${uniqueId}_${file.originalname}`);
    const metadata = { contentType: 'image/*' };
    try {
        await uploadBytes(fileRef, file.buffer, metadata);
        const url = await getDownloadURL(fileRef);
        const fname = fileRef.name;
        const urll = url;
        console.log("fname: " + fname);
        console.log("urll: " + urll);
        return { url };
    } catch (err) {
        console.error(err);
        return { error: err.message };
    }
};
