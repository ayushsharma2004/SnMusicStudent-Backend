import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { matchData, readSingleData, updateData, updateMatchData } from '../DB/crumd.js';
import { admin, db } from '../DB/firestore.js';
import { comparePassword, hashPassword, sendOtpToEmail, verifyOtp } from '../helper/authHelper.js';
import JWT from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { response } from 'express';

// Summary: Function used for registering user/student
// Action: POST
// url: "http://localhost:8080/api/v1/auth/register-user"
// req.body: {
//   "name": "Ayush Sharma", 
//   "email": "ayush.s.sharma04@gmail.com",
//   "password": "123456", 
//   "phone": "9326242640", 
//   "address": "Mumbai"
// } 
// response: {
//   "success": true,
//   "message": "User registered successfully",
//   "user": {
//     "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//     "name": "Ayush Sharma",
//     "email": "ayush.s.sharma04@gmail.com",
//     "password": "$2b$10$BiKXnQsN8LKt7s02WScgneR88Cr.mVgNzrUIHGHb9QrbVgqVXXYWa",
//     "phone": "9326242640",
//     "address": "Mumbai",
//     "study": [],
//     "blocked": false,
//     "role": 1
//   },
//   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImYyYjA3N2VkLWUzNTAtNDc4My04NzM4LTIyYzU5NjkwMzZkZCIsImlhdCI6MTcyMzcwODg0NywiZXhwIjoxNzIzOTY4MDQ3fQ.6Fa_QiWEMYin8HCTDM9YmGixMIeWEEP1iaV2Wfo76kg"
// }
// Register User
export const registerController = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const userId = uuidv4();
    var now = new Date();
    var time = now.toISOString();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const otpRegex = /^\d{6}$/;
    const phoneRegex = /^(?:\+91|91)?[789]\d{9}$/;

    if (!name) {
      return res.send({ message: 'Name is required' });
    }
    if (!email || !emailRegex.test(email)) {
      return res.send({ message: 'Email is required' });
    }
    if (!password) {
      return res.send({ message: 'Password is required' });
    }
    if (!phone || !phoneRegex.test(phone)) {
      return res.send({ message: 'Phone is required' });
    }
    if (!address) {
      return res.send({ message: 'Address is required' });
    }

    //existing user
    const querySnapshot = await db
      .collection(process.env.userCollection)
      .where('email', '==', email)
      .get();
    if (!querySnapshot.empty) {
      return res.status(200).send({
        success: false,
        message: 'User already registered. Please login.',
      });
    }

    //register user
    const hashedPassword = await hashPassword(password);

    if (typeof hashedPassword !== 'string') {
      return res.status(500).send({
        success: false,
        message: 'Error in registration: Invalid password',
      });
    }

    const userJson = {
      userId: userId,
      name: name,
      email: email,
      password: hashedPassword,
      phone: phone,
      address: address,
      study: [],
      blocked: false,
      role: 1,
      alert: admin.firestore.FieldValue.arrayUnion({
        type: 1,
        heading: 'Welcome to SNMUSIC',
        text: `You have been successfully registered`,
        time: time
      })
    };

    //token
    const token = await JWT.sign(
      { id: userJson.userId },
      process.env.JWT_token,
      {
        expiresIn: '3d',
      }
    );

    await db.collection(process.env.userCollection).doc(userId).set(userJson);
    console.log('success');

    return res.status(201).send({
      success: true,
      message: 'User registered successfully',
      user: userJson,
      token
    });
  } catch (error) {
    console.error('Error in registration:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in registration',
      error: error.message,
    });
  }
};

// Summary: Function used for login user/student
// Action: POST
// url: "http://localhost:8080/api/v1/auth/login-user"
// req.body: {
//   "email": "ayush.s.sharma04@gmail.com",
//   "password": "123456"
// } 
// response: {
//   "success": true,
//   "message": "Login successfully",
//   "user": {
//     "userId": "27d38b26-f074-481b-bb81-41a404901cc7",
//     "name": "Ayush Sharma",
//     "email": "ayush.s.sharma04@gmail.com",
//     "phone": "9326242640",
//     "address": "922, Laxman Wadi, Siddharth Nagar ,Korba Mithagad, Wadala East, Mumbai-400037",
//     "study": [],
//     "blocked": false,
//     "role": 1
//   },
//   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjI3ZDM4YjI2LWYwNzQtNDgxYi1iYjgxLTQxYTQwNDkwMWNjNyIsImlhdCI6MTcyMzcwODQ1OSwiZXhwIjoxNzIzOTY3NjU5fQ.tOQC3rxIY-OQ2JEyEzbQHDmncoNSrcHYHNQ0L1T5Qp0"
// }

// Login User
export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    //Validtion
    if (!email || !password) {
      return res.status(404).send({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      return res.status(400).send({ message: 'Valid email is required' });
    }

    //Retrieve user data
    const querySnapshot = await db
      .collection(process.env.userCollection)
      .where('email', '==', email)
      .get();

    let userData = null;
    querySnapshot.forEach((doc) => {
      userData = doc.data();
    });

    //validating user
    if (!userData) {
      return res.status(404).send({
        success: false,
        message: 'User is not registered',
      });
    }

    //comparing user password with hashed/encrypted password
    const match = await comparePassword(password, userData.password);

    //verifying password
    if (!match) {
      return res.status(200).send({
        success: false,
        message: 'Invalid Password',
      });
    }

    //token
    const token = await JWT.sign(
      { id: userData.userId },
      process.env.JWT_token,
      {
        expiresIn: '3d',
      }
    );
    res.status(200).send({
      success: true,
      message: 'Login successfully',
      user: {
        userId: userData.userId,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
        study: userData.study,
        blocked: userData.blocked,
        role: userData.role,
      },
      token,
    });
    console.log('success');
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: 'Error in login',
      error: error,
    });
  }
};

// Summary: Function used for sending otp to email address
// Action: POST
// url: "http://localhost:8080/api/v1/auth/send-mail"
// req.body: {
//   "email": "ayush.s.sharma04@gmail.com"
// } 
// response: {
//   "success": true,
//   "message": "OTP sent to email"
// }

// Send Mail
export const sendMail = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }
    if (email) {
      const sendOtp = await sendOtpToEmail(email);
      return res.status(200).send({
        success: true,
        message: 'OTP sent to email',
      });
    }
    return;
  } catch (error) {
    console.log(error);
  }
}

// Summary: Function used for verifying otp for email address
// Action: POST
// url: "http://localhost:8080/api/v1/auth/verify-mail"
// req.body: {
//   "email": "ayush.s.sharma04@gmail.com"
// } 
// response: {
//   "success": true,
//   "message": "OTP verified to email successfully",
//   "isOtpValid": true
// }
// Verify Mail
export const verifyMail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }
    if (!otp) {
      return res.status(400).send({ message: 'Otp is required' });
    }

    // Verify OTP
    const isOtpValid = await verifyOtp(email, otp);
    
    if (!isOtpValid) {
      return res.status(401).send({
        success: false,
        message: 'Invalid OTP',
      });
    }
    if (isOtpValid) {
      return res.status(200).send({
        success: true,
        message: 'OTP verified to email successfully',
        isOtpValid 
      });
    }
  } catch (error) {
    console.log(error);
  }
}

// Summary: Function used for update password of user
// Action: POST
// url: "http://localhost:8080/api/v1/auth/forgot-password"
// req.body: {
//   "email": "ayush.s.sharma04@gmail.com",
//   "newPassword": "654321"
// }
// response: {
//   "success": true,
//   "message": "Password updated successfully",
//   "updateData": {
//     "study": [],
//     "address": "Mumbai",
//     "role": 1,
//     "blocked": false,
//     "phone": "9326242640",
//     "name": "Ayush Sharma",
//     "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//     "email": "ayush.s.sharma04@gmail.com",
//     "otp": "519266",
//     "expiresAt": 1723710253923,
//     "password": "$2b$10$SIYw4ZHBRBZmPqUXa899tO4xdVjUlSXFR.0qMk8pPLSzCpm/B5Kxy"
//   }
// }
// Forgot Password
export const forgotPasswordController = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Validation
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }
    if (!newPassword) {
      return res.status(400).send({ message: 'New password is required' });
    }

    var otpData = await matchData(process.env.userCollection, 'email', email);

    if (Date.now() > otpData.expiresAt) {
      throw new Error('OTP has expired');
    }

    // Hash the new password
    const hashed = await hashPassword(newPassword);

    const update = await updateMatchData(process.env.userCollection, 'email', email, { password: hashed });
    const updateData = update.data();

    res.status(200).send({
      success: true,
      message: 'Password updated successfully',
      updateData
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
};

// Summary: Function used for updating user/student, Atleast one field is Required!
// Action: POST
// url: "http://localhost:8080/api/v1/auth/update-user"
// FormData: { 
//   "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//   "name": "Ayush Sharma", 
//   "email": "ayush.s.sharma04@gmail.com",
//   "phone": "9326242640", 
//   "address": "Mumbai"
// } 
// req.file: {
//   file: image file
// }
// Update User
export const updateUserController = async (req, res) => {
  try {
    const { userId, name, address, phone, email } = req.body;
    const file = req.file;
    var photoUrl;

    // Create the updates object only with provided fields
    const updates = {};
    if (name) updates.name = name;
    if (address) updates.address = address;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding student' });
    }

    if (!name && !address && !phone && !email && !instagram && !facebook && !whatsapp) {
      return res.status(400).send({ message: 'At least one field (name, address, contact, email, social media, role) or image is required' });
    }

    const userData = await readSingleData(process.env.userCollection, userId);

    if (!userData) {
      return res.status(404).send({ message: 'Student not found' });
    }

    // if file exists then get its downloaded url
    if (file) {
      const imageFile = file;
      console.log(imageFile);
      photoUrl = await uploadFile(imageFile, 'images', `user/${userId}/${'photoUrl'}/${imageFile.originalname}`);
      if (photoUrl) updates.photoUrl = photoUrl;
  }

    // Update student data in Firestore
    await updateData(process.env.userCollection, userId, updates);

    console.log('Student updated successfully');
    res.status(200).send({
      success: true,
      message: 'Student updated successfully',
      user: { ...updates, userId: userData.userId }, // Return updated fields
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).send({
      success: false,
      message: 'Error updating student',
      error: error.message,
    });
  }
};

// Summary: Function used for blocking/unblocking user for any action
// Action: POST
// url: "http://localhost:8080/api/v1/auth/verify-mail"
// req.body: {
//   "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//   "block": true/false
// } 
// response: {
//   "success": true,
//   "message": "User Blocked/Unblocked successfully",
//   "block": true/false
// }
// Block/Unblock User
export const blockUser = async (req, res) => {
  try {
    const { userId, block } = req.body;
    var message;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }
    if (block) {
      message = 'User Blocked successfully'
    } else {
      message = 'User Unblocked successfully'
    }

    var blockUser = await updateData(process.env.userCollection, userId, {blocked: block});
    console.log('success');

    return res.status(201).send({
      success: true,
      message: message,
      block: block
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

export const testController = (req, res) => {
  res.send('Protected Routes');
};
