import express from 'express';
import { } from './firebase.js';
import { db } from './firestore.js';
import dotenv from 'dotenv';
// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

dotenv.config();

//rest object
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

export const createData = async (collectionName, id, data) => {
  try {
    const create = await db.collection(collectionName).doc(id).set(data);
    return create;
  } catch (error) {
    console.log(error);
  }
};

export const createCollection = async (firstCollectionName, secondCollectionName, id, data, initialDoc = false) => {
  try {
    // Create the document with the specified ID and timestamp
    await db.collection(firstCollectionName).doc(id).set(data);

    // Create a reference to the nested collection
    const collectionRef = db.collection(firstCollectionName).doc(id).collection(secondCollectionName);

    // If initialDoc is provided, add it to the nested collection
    if (initialDoc) {
      await collectionRef.add(initialDoc);
    }

    return create;
  } catch (error) {
    console.log(error);
  }
};

export const createSubData = async (firstCollectionName, secondCollectionName, id1, id2, data) => {
  try {
    // Create a reference to the nested collection
    const collectionRef = db.collection(firstCollectionName).doc(id1);

    // If initialDoc is provided, add it to the nested collection
    if (data) {
      await collectionRef.collection(secondCollectionName).doc(id2).set(data);
    }

    return data;
  } catch (error) {
    console.log(error);
  }
};


export const readAllData = async (collectionName) => {
  try {
    //Retrieve user data
    const querySnapshot = await db
      .collection(collectionName)
      .get();
    let queryData = [];
    querySnapshot.forEach((doc) => {
      queryData.push(doc.data());
    });
    return queryData;
  } catch (error) {
    console.log(error);
  }
};

export const readAllLimitData = async (collectionName, fields) => {
  try {
    let query = db.collection(collectionName).limit(100); // Adjust the limit according to your needs

    // Apply the select if fields are provided
    if (fields && fields.length > 0) {
      query = query.select(...fields);
    }

    const querySnapshot = await query.get();

    let queryData = [];
    querySnapshot.forEach((doc) => {
      queryData.push(doc.data());
    });

    return queryData;
  } catch (error) {
    console.error("Error retrieving data:", error);
    throw error; // Re-throw the error after logging it
  }
};
export const readAllLimitPaginate = async (collectionName, fields, startAfterDoc = null, pageSize = 20) => {
  try {
    let query = null;
    if (startAfterDoc) {
      console.log(startAfterDoc);
      console.log(startAfterDoc?.timestamp);

      query = db.collection(collectionName)
        .orderBy('timestamp', 'desc')
        .startAfter(startAfterDoc?.timestamp)
        .limit(pageSize); // Assuming you have a 'timestamp' field for ordering
    } else {
      query = db.collection(collectionName)
        .orderBy('timestamp', 'desc')
        .limit(pageSize); // Assuming you have a 'timestamp' field for ordering
    }

    // if (fields && fields.length > 0) {
    //   query = query.select(...fields);
    // }

    const querySnapshot = await query.get();

    const queryData = querySnapshot.docs.map(doc => doc.data());

    // Get the last document in the snapshot to use for the next page
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return {
      data: queryData,
      lastDoc: lastDoc ? lastDoc.data() : null // Return the document reference (_ref) for pagination
    };
  } catch (error) {
    console.error("Error retrieving data:", error);
    throw error;
  }
};


export const readAllSubData = async (firstCollectionName, secondCollectionName, id) => {
  try {
    //Retrieve user data
    const querySnapshot = await db
      .collection(firstCollectionName)
      .doc(id).
      collection(secondCollectionName).
      get();
    let queryData = [];
    querySnapshot.forEach((doc) => {
      queryData.push(doc.data());
    });
    return queryData;
  } catch (error) {
    console.log(error);
  }
};

export const readAllLimitSubData = async (firstCollectionName, secondCollectionName, id, fields) => {
  try {
    //Retrieve user data
    var query = db
      .collection(firstCollectionName)
      .doc(id).
      collection(secondCollectionName).
      limit(100);
    // Apply the select if fields are provided
    if (fields && fields.length > 0) {
      query = query.select(...fields);
    }

    const querySnapshot = await query.get();

    let queryData = [];
    querySnapshot.forEach((doc) => {
      queryData.push(doc.data());
    });

    return queryData;
  } catch (error) {
    console.log(error);
  }
};

export const readSingleData = async (collectionName, id) => {
  try {
    const userRef = await db.collection(collectionName).doc(id).get();
    return userRef.data();
  } catch (error) {
    console.log(error);
  }
};

export const readSingleSubData = async (firstCollectionName, secondCollectionName, id1, id2) => {
  try {
    //Retrieve user data
    const userRef = await db.collection(firstCollectionName).doc(id1).collection(secondCollectionName).doc(id2).get();
    return userRef.data();
  } catch (error) {
    console.log(error);
  }
};

export const readFieldData = async (collectionName, id, fieldName, sort = false) => {
  try {
    const docRef = await db.collection(collectionName).doc(id).get();

    if (docRef.exists) {
      var fieldValue = docRef.get(fieldName);

      if (sort && Array.isArray(fieldValue)) {
        console.log(sort);
        fieldValue = fieldValue.sort((a, b) => new Date(b[sort]) - new Date(a[sort]));
        console.log(fieldValue);
      }

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

export const readSubFieldData = async (firstCollectionName, secondCollectionName, id, subId, fieldName) => {
  try {
    // Get the document reference
    const docRef = await db.collection(firstCollectionName).doc(id).collection(secondCollectionName).doc(subId).get();
    console.log(docRef.data());
    if (docRef.exists) {
      const fieldValue = docRef.get(fieldName);
      return fieldValue;
    } else {
      console.log("Document does not exist");
      return null;
    }
  } catch (error) {
    console.error('Error reading document:', error);
    return null;
  }
};

/* 
// Summary: Retrieves and filters study data based on a user's document and a specified filter.
// Action: Fetches data from a specific field in the user's document and filters it based on the provided criteria.
// Input:
// collectionName: The collection name (e.g., users) where the user's data is stored.
// id: The user's unique identifier (userId).
// fieldName: The field name (e.g., 'study') in the document to extract data from.
// filterName: The field in the data to filter on (e.g., 'approved').
// filterValue: The value to match (e.g., true for approved studies).
// Output: Returns filtered study data where the specified field matches the filter value (e.g., approved = true).
// Error Handling: If the document or the field data is not found, returns null.
*/
export const searchInnerFieldData = async (collectionName, id, fieldName, filterName, filterValue) => {
  try {    // Reference to the user's document
    const docRef = db.collection(collectionName).doc(id);

    // Get the user document
    const doc = (await docRef.get()).get(fieldName);

    // Check if the document exists
    if (!doc) {
      throw new Error('Not found');
    }

    // Extract the study field from the user document
    const fieldData = doc || [];

    // Filter studies to include only those where `approved` is true
    const approvedField = fieldData.filter(fieldName => fieldName[filterName] === filterValue);

    // Return the filtered studies
    return approvedField;
  } catch (error) {
    console.error('Error reading document:', error);
    return null;
  }
};

/* 
// Summary: Retrieves and filters a limited number of study data based on a user's document and specified filter.
// Action: Fetches data from a specific field in the user's document, filters it by a given condition, and limits the number of returned results.
// Input:
// collectionName: The collection name (e.g., users) where the user's data is stored.
// id: The user's unique identifier (userId).
// fieldName: The field name (e.g., 'study') in the document to extract data from.
// filterName: The field in the data to filter on (e.g., 'approved').
// filterValue: The value to match (e.g., true for approved studies).
// limit: The maximum number of items to return.
// Output: Returns a limited set of filtered study data based on the criteria provided.
// Error Handling: If the document or the field data is not found, returns null.
*/
export const searchLimitInnerFieldData = async (collectionName, id, fieldName, filterName, filterValue, limit) => {
  try {    // Reference to the user's document
    const docRef = db.collection(collectionName).doc(id);

    // Get the user document
    const doc = (await docRef.get()).get(fieldName);

    // Check if the document exists
    if (!doc) {
      throw new Error('Not found');
    }

    // Extract the study field from the user document
    const fieldData = doc || [];

    // Filter studies to include only those where `approved` is true
    const approvedField = fieldData.filter(fieldName => fieldName[filterName] === filterValue);

    // Limit the number of items returned
    const limitedFieldData = approvedField.slice(0, limit);

    // Return the filtered studies
    return limitedFieldData;
  } catch (error) {
    console.error('Error reading document:', error);
    return null;
  }
};

/* 
// Summary: Utility function for performing a keyword search in a Firestore collection.
// Parameters:
// - collectionName (string): The name of the Firestore collection to search.
// - keyword (string): The keyword to filter the documents by (case-insensitive).
// - limit (number): The maximum number of documents to retrieve (default is 20).
// Returns:
// - An array of documents that match the keyword in their `title`, `description`, or `tags` fields.
// Notes:
// - Filters results case-insensitively by converting the keyword and fields to lowercase.
// - Returns matching results with a default limit of 20 documents for optimization.
// - Logs and rethrows any errors encountered during the process.
*/

export const searchByKeyword = async (collectionName, keyword, limit = 20) => {
  try {
    // Convert the keyword to lowercase for case-insensitive comparison
    const lowerCaseKeyword = keyword.toLowerCase();

    // Fetch documents with a limit
    const querySnapshot = await db.collection(collectionName).limit(limit).get();

    let results = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Perform keyword filtering on desired fields in a case-insensitive manner
      if (
        (data?.title && data?.title.toLowerCase().includes(lowerCaseKeyword)) ||
        (data?.description && data?.description.toLowerCase().includes(lowerCaseKeyword)) ||
        data?.tags && data?.tags?.includes(lowerCaseKeyword)
      ) {
        results.push(data);
      }
    });

    return results;
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error; // Re-throw the error after logging it
  }
};

/*
// Summary: Helper function to search for documents in a Firestore collection by tags and optional keywords.

// Parameters:
// - collectionName (string): Name of the Firestore collection to query.
// - keyword (string): Optional keyword for filtering (default: '').
// - tags (array): Tags to filter documents by (e.g., ["flute", "advanced"]).
// - limit (number): Number of documents to fetch (default: 20).

// Returns:
// - An array of matching documents from the Firestore collection.

// Process:
// 1. Convert the `keyword` to lowercase for case-insensitive comparison.
// 2. Query Firestore to fetch a limited number of documents from the specified collection.
// 3. Iterate through the documents and perform the following checks:
//    - Check if the `tags` field in the document includes any of the specified tags.
//    - Check if the `title` or `description` fields contain the keyword (case-insensitive).
// 4. Add documents to the results array if they match either the tags or the keyword criteria.
// 5. Return the results array.
// 6. Log errors and re-throw them for higher-level error handling.

// Notes:
// - Supports partial keyword matching on the `title` and `description` fields.
// - Can be extended to include additional fields or conditions for filtering.
*/
export const searchByTag = async (collectionName, keyword = '', tags = [], limit = 20) => {
  try {
    // Convert the keyword to lowercase for case-insensitive comparison
    const lowerCaseKeyword = keyword.toLowerCase();

    // Fetch documents with a limit
    const querySnapshot = await db.collection(collectionName).limit(limit).get();

    // Initialize results array
    let results = [];

    // Iterate through the fetched documents
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      var matchesTag = false;

      // Check if the document matches the criteria Check if the tags array contains all the specified tags
      tags.forEach((tag) => {
        if (
          data?.tags && data?.tags.includes(tag)
        ) {
          matchesTag = true;
        }
      })
      var matchesKeyword = false;
      // Perform keyword filtering on desired fields in a case-insensitive manner
      if (
        (data?.title && data?.title.toLowerCase().includes(lowerCaseKeyword)) ||
        (data?.description && data?.description.toLowerCase().includes(lowerCaseKeyword))
      ) {
        matchesKeyword = true;
      }

      // Add document to results if it matches either criterion
      if (matchesTag || matchesKeyword) {
        results.push(data);
      }
    });

    return results;
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error; // Re-throw the error after logging it
  }
};

/* 
// Summary: Function to search users by identity in the Firestore collection based on a keyword.
// Action: Function
// URL: N/A (Used internally in the main code)

// Parameters:
// - collectionName: The name of the Firestore collection (e.g., 'users') to search within.
// - identity: The keyword used to match users' fields (name, email, userId, address).
// - limit: The maximum number of user results to return (default is 20).

// Returns:
// An array of user data objects that match the provided identity keyword.


// Notes:
// - Searches for partial matches of the `identity` keyword across the fields: `name`, `email`, `userId`, and `address`.
// - The search is case-insensitive and supports partial matching (e.g., "john" can match "John Doe" and "johnny@example.com").
// - The function fetches a maximum of 20 results by default, or a custom number if specified in the `limit` parameter.
// - If no matching users are found, an empty array is returned.
*/
export const searchByIdentity = async (collectionName, identity, limit = 20) => {
  try {
    // Fetch documents with a limit
    const querySnapshot = await db.collection(collectionName).limit(limit).get();

    let results = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Perform keyword filtering on desired fields
      if (
        data.name && data.name.toLowerCase().includes(identity.toLowerCase()) ||
        data.email && data.email.toLowerCase().includes(identity.toLowerCase()) ||
        data.userId && data.userId.toLowerCase().includes(identity.toLowerCase()) ||
        data.address && data.address.toLowerCase().includes(identity.toLowerCase())
      ) {
        results.push(data);
      }
    });

    return results;
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error; // Re-throw the error after logging it
  }
};

/*
// Summary: Helper function to retrieve documents from Firestore by study IDs.
// Description:
// - Fetches all documents from a specified Firestore collection, ordered by `timestamp` in descending order.
// - Filters the documents to include only those whose `studyId` matches any ID in the provided `ids` array.
// - Limits the number of results returned to the specified value (default: 20).

// Parameters:
// - `collectionName` (string): Name of the Firestore collection to query.
// - `ids` (array): Array of study IDs to match against the `studyId` field.
// - `limit` (number): Maximum number of documents to return (default: 20).

// Returns:
// - An array of study materials that match the provided IDs.

// Notes:
// - Performs exact matching for the `studyId` field in a case-sensitive manner.
// - Ensures consistent ordering by `timestamp` in descending order.
// - Supports additional filtering and validation if needed for specific use cases.
*/
export const searchByIDs = async (collectionName, ids = [], limit = 20) => {
  try {
    // Fetch documents with a limit
    const querySnapshot = await db.collection(collectionName)
      .orderBy('timestamp', 'desc')
      .get();

    // Initialize results array
    let results = [];

    // Iterate through the fetched documents
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      var matchesIds = false;

      // Check if the document matches the criteria Check if the tags array contains all the specified tags
      ids.forEach((id) => {
        if (
          data?.studyId === id
        ) {
          matchesIds = true;
        }
      })

      // Add document to results if it matches either criterion
      if (matchesIds) {
        results.push(data);
      }
    });

    return results;
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error; // Re-throw the error after logging it
  }
};

export const matchData = async (collectionName, key, value) => {
  const querySnapshot = await db
    .collection(collectionName)
    .where(key, '==', value)
    .get();
  return querySnapshot;
}

export const matchSubData = async (firstCollectionName, secondCollectionName, id, key, value) => {
  const querySnapshot = await db
    .collection(firstCollectionName)
    .doc(id)
    .collection(secondCollectionName)
    .where(key, '==', value)
    .get();
  return querySnapshot;
}

export const matchTwoData = async (collectionName, key1, value1, key2, value2) => {
  const querySnapshot = await db
    .collection(collectionName)
    .where(key1, '==', value1)
    .where(key2, '==', value2)
    .get();
  return querySnapshot;
}

export const matchNestedData = async (firstCollectionName, secondCollectionName, id, key, value) => {
  const querySnapshot = await db
    .collection(firstCollectionName).
    doc(id).
    collection(secondCollectionName)
    .where(key, '==', value)
    .get();
  return querySnapshot;
}

export const updateData = async (collectionName, id, data) => {
  try {
    const userRef = await db.collection(collectionName).doc(id).update(data);
    return userRef
  } catch (error) {
    console.log(error);
  }
};

export const updateSubData = async (firstCollectionName, secondCollectionName, id1, id2, data) => {
  try {
    const userRef = await db.collection(firstCollectionName).doc(id1).collection(secondCollectionName).doc(id2).update(data);
    return userRef
  } catch (error) {
    console.log(error);
  }
};

export const updateSubFieldData = async (collectionName, id, fieldName, subId, newObject) => {
  try {
    // Get the document reference
    const docRef = db.collection(collectionName).doc(id);

    const docSnap = await docRef.get();

    if (!docSnap) {
      console.log('No such document!');
      return null;
    }

    // Get the data from the document
    const data = docSnap.data();

    if (!data || !data[fieldName]) {
      console.log('No field data found!');
      return null;
    }

    // Find the index of the object with the specified imageId
    const itemIndex = data[fieldName].findIndex((item) => item.imageId === subId);

    if (itemIndex === -1) {
      console.log('No item found with the specified imageId!');
      return null;
    }

    // 5. Replace the object in the array with the new object
    var updateData = data[fieldName][itemIndex] = { ...newObject, subId }; // Ensures the imageId remains the same

    const update = docRef.update({
      [fieldName]: data[fieldName],
    });

    // Return the found item
    return updateData;
  } catch (error) {
    console.error('Error reading document:', error);
    return null;
  }
};

export const updateMatchData = async (collectionName, key, value, data) => {
  // Query the document by email
  const userRef = db.collection(collectionName).where(key, '==', value);
  const querySnapshot = await userRef.get();

  // Check if the document exists
  if (querySnapshot.empty) {
    console.log('No matching document found.');
    return;
  }

  // Since email is unique, assume there's only one document to update
  const doc = querySnapshot.docs[0];
  const docId = doc.id;

  // Update the document
  await db.collection(collectionName).doc(docId).update(data);
  return doc;
}


export const deleteData = async (collectionName, id) => {
  try {
    const response = await db
      .collection(collectionName)
      .doc(id)
      .delete();
    console.log(response);
    return response;
  } catch (error) {
    console.log(error);
  }
};

export const deleteSubData = async (firstCollectionName, secondCollectionName, id1, id2) => {
  try {
    const response = await db
      .collection(firstCollectionName)
      .doc(id1)
      .collection(secondCollectionName)
      .doc(id2)
      .delete();
    console.log(response);
    return response;
  } catch (error) {
    console.log(error);
  }
};

export const deleteSubFieldData = async (collectionName, id, fieldName, subId) => {
  try {
    // Get the document reference
    const docRef = db.collection(collectionName).doc(id);

    const docSnap = await docRef.get();

    if (!docSnap) {
      console.log('No such document!');
      return null;
    }

    // Get the data from the document
    const data = docSnap.data();

    if (!data || !data[fieldName]) {
      console.log('No field data found!');
      return null;
    }

    // Find the index of the object with the specified imageId
    const itemIndex = data[fieldName].findIndex((item) => item.imageId === subId);

    if (itemIndex === -1) {
      console.log('No item found with the specified imageId!');
      return null;
    }

    // 5. Remove the object from the array
    var updateData = data[fieldName].splice(itemIndex, 1);

    const update = docRef.update({
      [fieldName]: data[fieldName],
    });

    // Return the found item
    return updateData;
  } catch (error) {
    console.error('Error reading document:', error);
    return null;
  }
};
