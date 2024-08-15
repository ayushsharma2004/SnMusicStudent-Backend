// import { matchData, readSingleData, updateData } from '../DB/crumd.js';
// import { db, admin } from '../DB/firestore.js';
// import { comparePassword, hashPassword, sendOtpToEmail, verifyOtp } from '../helper/authHelper.js';
// import JWT from 'jsonwebtoken';
// import { v4 as uuidv4 } from 'uuid';



// NOTE: This is of no use



// export const requestStudyController = async (req, res) => {
//     try {
//         const { studyTitle, userId, email } = req.body;

//         if (!studyTitle) {
//             return res.status(400).send({ message: 'Study Title is required' });
//         }

//         // Initialize batch
//         const batch = db.batch();

//         // Retrieve event data
//         const studyQuerySnapshot = await db
//             .collection(process.env.studyCollection)
//             .where('title', '==', studyTitle)
//             .limit(1)  // Limit to one document for efficiency
//             .get();

//         if (studyQuerySnapshot.empty) {
//             return res.status(404).send({
//                 success: false,
//                 message: 'No such study exists',
//             });
//         }

//         const studyData = studyQuerySnapshot.docs[0].data();

//         // Retrieve user document
//         const userDocRef = db.collection(process.env.userCollection).doc(userId);
//         const userDoc = await userDocRef.get();

//         if (!userDoc.exists) {
//             return res.status(404).send({
//                 success: false,
//                 message: 'No such user exists',
//             });
//         }

//         // Prepare accessJson
//         const accessJson = {
//             userId: userId,
//             email: email,
//             studyId: studyData.studyId,
//             title: studyData.title,
//             description: studyData.description,
//             imageUrl: studyData.imageUrl,
//             videoUrl: studyData.videoUrl,
//             status: "pending",
//             access: false,
//             startDate: "",
//             expiryDate: "",
//         };

//         // Update user document's events field
//         batch.update(userDocRef, {
//             study: admin.firestore.FieldValue.arrayUnion(accessJson)
//         });

//         // Update accessCollection to push the new event data
//         const accessDocRef = db.collection(process.env.accessCollection).doc(userId);
//         const accessDoc = await accessDocRef.get();
//         var arrJson = [accessJson];
//         if (!accessDoc.exists) {
//             batch.set(accessDocRef, {
//                 study: arrJson,
//             });
//         } else {
//             batch.update(accessDocRef, {
//                 study: admin.firestore.FieldValue.arrayUnion(accessJson)
//             });
//         }
//         // Commit batch
//         await batch.commit();

//         console.log('Batch successfully committed');
//         return res.status(201).send({
//             success: true,
//             message: 'User requested successfully',
//             access: accessJson
//         });
//     } catch (error) {
//         console.error('Error in requesting:', error);
//         return res.status(500).send({
//             success: false,
//             message: 'Error in requesting',
//             error: error.message,
//         });
//     }
// };