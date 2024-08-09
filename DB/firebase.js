// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import dotenv from "dotenv"

dotenv.config();

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

console.log(process.env.apiKey);

const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId,
  measurementId: process.env.measurementId,
};

// Initialize Firebase
const fapp = initializeApp(firebaseConfig);
const storage = getStorage(fapp);

export { fapp, storage };