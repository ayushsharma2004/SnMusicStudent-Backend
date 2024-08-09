import { db } from "../DB/firestore.js";
import dotenv from 'dotenv';

//configure env
dotenv.config();

export const createData = async (collectionName, docId, data) => {
    const create = await db.collection(collectionName).doc(docId).set(data);
    return create;
}

export const readAllData = async (collectionName) => {
    //Retrieve user data
    const querySnapshot = await db
        .collection(collectionName)
        .get();
    let queryData = [];
    querySnapshot.forEach((doc) => {
        queryData.push(doc.data());
    });
    return queryData;
}

export const readSingleData = async (collectionName, docId) => {
    const userRef = await db.collection(collectionName).doc(docId).get();
    return userRef.data();
}

export const readFieldData = async (collectionName, docId, fieldName) => {
    try {
        const docRef = await db.collection(collectionName).doc(docId).get();

        if (docRef.exists) {
            const fieldValue = docRef.get(fieldName);
            return fieldValue;
        } else {
            console.log("Document does not exist");
            return null;
        }
    } catch (error) {
        console.error("Error reading field:", error);
        throw error;
    }
}

export const updateData = async (collectionName, docId, key, value) => {
    const updateObject = {};
    updateObject[key] = value;
    const userRef = await db.collection(collectionName).doc(docId).update(updateObject);
    return userRef
}


export const matchData = async (collectionName, key, value) => {
    const querySnapshot = await db
        .collection(collectionName)
        .where(key, '==', value)
        .get();
    return querySnapshot;
}