import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { createSubData, matchData, readSingleData, readSingleSubData, updateData, updateMatchData, updateSubData } from '../DB/crumd.js';
import { admin, db } from '../DB/firestore.js';
import { comparePassword, hashPassword, sendOtpToEmail, verifyOtp } from '../helper/authHelper.js';
import JWT from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { response } from 'express';
import { uploadFile } from '../helper/mediaHelper.js';


/* 
// Summary: Function used for registering user/student
// Action: POST
// URL: "http://localhost:8080/api/v1/auth/register-user"
// Request:
// req.body: {
//   "fname": "Raj",
//   "lname": "Gamre",
//   "email": "raj.gamre@gmail.com",
//   "password": "123456",
//   "phone": "9889877860",
//   "dob": "2000-05-20",
//   "address": "Mumbai"  //optional
// }
// req.file (optional): An image file for the user's profile photo.

// Response:
// Success:
// {
//   "success": true,
//   "message": "Request for registration sent",
//   "user": {
//     "userId": "8e342bc7-aeec-4b18-a1f0-d8b8920d3a75",
//     "fname": "Raj",
//     "lname": "Gamre",
//     "photoUrl": "https://storage.example.com/student/8e342bc7-aeec-4b18-a1f0-d8b8920d3a75/image/profile.jpg",
//     "dob": "2000-05-20",
//     "email": "raj.gamre@gmail.com",
//     "password": "$2b$10$CY.0f4OXAc9yymmRp2BRfufzUvSQNxPljwozy3trcYcNiF7ZzGu1K",
//     "phone": "9889877860",
//     "address": "Mumbai",
//     "study": [],
//     "blocked": false,
//     "role": 0,
//     "alert": [
//       {
//         "type": 1,
//         "heading": "Request for Registration",
//         "text": "Your request for registration has been sent successfully",
//         "time": "2024-11-05T11:23:12.228Z"
//       }
//     ]
//   },
//   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjhlMzQyYmM3LWFlZWMtNGIxOC1hMWYwLWQ4Yjg5MjBkM2E3NSIsImlhdCI6MTczMDgwNTc5NCwiZXhwIjoxNzMxMDY0OTk0fQ.T-mLqZY5QFsLeY4fnqYGIeu8iF07D55Ff7H1vyNv1KM"
// }

// Failure:
// {
//   "success": false,
//   "message": "Error in registration request",
//   "error": "Detailed error message"
// }
// 
// Notes:
// - The `photoUrl` will only be included in the response if a file is uploaded.
// - The `address` field is optional in the request.
// - Passwords are hashed before storing in the database.
// - A JWT token is generated for the registered user and returned in the response.
*/
export const registerController = async (req, res) => {
  try {
    const { fname, lname, email, password, phone, dob, address } = req.body;
    console.log(req.file)
    const userId = uuidv4();
    var now = new Date();
    var time = now.toISOString();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+91|91)?[789]\d{9}$/;

    // Request Validation
    if (!fname) {
      return res.send({ message: 'First name is required' });
    }
    if (!lname) {
      return res.send({ message: 'Last name is required' });
    }
    if (!email || !emailRegex.test(email)) {
      return res.send({ message: 'Valid email is required' });
    }
    if (!password) {
      return res.send({ message: 'Password is required' });
    }
    if (!phone || !phoneRegex.test(phone)) {
      return res.send({ message: 'Valid phone number is required' });
    }

    // Check if the user is already registered
    const querySnapshot = await db
      .collection(process.env.userCollection)
      .where('email', '==', email)
      .get();

    let userData
    if (!querySnapshot.empty) {
      querySnapshot.docs[0].data()
      console.log(userData);
    }

    if (userData && userData.verified) {
      return res.status(200).send({
        success: false,
        message: 'User already registered. Please login.',
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);
    if (typeof hashedPassword !== 'string') {
      return res.status(500).send({
        success: false,
        message: 'Error in registration: Invalid password',
      });
    }

    // Handle optional image processing
    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadFile(req.file, 'images', `student/${userId}/image/${req.file.originalname}`);
    }

    // Prepare user object
    const userJson = {
      userId: userId,
      fname: fname,
      lname: lname,
      photoUrl: photoUrl,
      dob: dob,
      email: email,
      password: hashedPassword,
      phone: phone,
      address: address || null, // Address is optional
      study: [],
      verified: false,
      allowed: false,
      role: 0,
      // alert: admin.firestore.FieldValue.arrayUnion({
      //   type: 1,
      //   heading: 'Request for Registration',
      //   text: `Your request for registration has been sent successfully`,
      //   time: time,
      // }),
    };

    // Generate JWT token
    const token = await JWT.sign(
      { id: userJson.userId },
      process.env.JWT_token,
      {
        expiresIn: '3d',
      }
    );

    // Add user details to the database
    await db.collection(process.env.userCollection).doc(userId).set(userJson);

    return res.status(201).send({
      success: true,
      message: 'Request for registration sent',
      user: userJson,
      token,
    });
  } catch (error) {
    console.error('Error in registration request:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in registration request',
      error: error.message,
    });
  }
};

/* 
// Summary: Function used for login user/student
// Action: POST
// URL: "http://localhost:8080/api/v1/auth/login-user"

// Request:
// req.body: {
//   "email": "ayush.s.sharma04@gmail.com",
//   "password": "123456"
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Login successfully",
//   "user": {
//     "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//     "fname": "Ayush",
//     "lname": "Sharma",
//     "email": "ayush.s.sharma04@gmail.com",
//     "phone": "9326242640",
//     "address": "Mumbai",
//     "study": [],
//     "blocked": false,
//     "role": 1
//   },
//   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImYyYjA3N2VkLWUzNTAtNDc4My04NzM4LTIyYzU5NjkwMzZkZCIsImlhdCI6MTczMDgwNjA0NiwiZXhwIjoxNzMxMDY1MjQ2fQ.mAGJNgc0iZyzSaTrdKrJif1_73_sFyfrUw2v7UAGORw"
// }

// Failure:
// {
//   "success": false,
//   "message": "Invalid password"
// }
// OR
// {
//   "success": false,
//   "message": "User is not registered"
// }
// OR
// {
//   "success": false,
//   "message": "Email and password are required"
// }
// OR
// {
//   "success": false,
//   "message": "Error in login",
//   "error": "Detailed error message"
// }

// Notes:
// - Returns a JWT token with a 7-day expiration in the `token` field.
// - Sets the token as an `accessToken` cookie for client use.
// - Validates the email format and ensures the user exists in the database.
// - Compares provided password with the stored hashed password.
*/
export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).send({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send({
        success: false,
        message: 'Valid email is required'
      });
    }

    // Retrieve user data
    const querySnapshot = await db
      .collection(process.env.userCollection)
      .where('email', '==', email)
      .get();

    let userData = null;
    querySnapshot.forEach((doc) => {
      userData = doc.data();
    });

    // Validate if user exists
    if (!userData) {
      return res.status(404).send({
        success: false,
        message: 'User is not registered',
      });
    }

    // Compare user password with hashed password
    const isPasswordMatch = await comparePassword(password, userData.password);
    if (!isPasswordMatch || !userData.allowed) {
      return res.status(401).send({
        success: false,
        message: 'Invalid password or not allowed',
      });
    }

    //token
    const user = {
      userId: userData.userId,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      role: userData.role
    }

    const accessToken = JWT.sign(
      {
        user
      },
      process.env.JWT_token,
      {
        expiresIn: `${process.env.accessTokenExpiry}d`,
      }
    );

    const refreshToken = JWT.sign(
      {
        userId: userData.userId,
      },
      process.env.JWT_token,
      {
        expiresIn: `${process.env.refreshTokenExpiry}d`,
      }
    )
    console.log(refreshToken)

    await db.collection(process.env.userCollection).doc(user.userId).update({
      accessToken,
      refreshToken
    })

    res.cookie("accessToken", accessToken, {
      maxAge: Number(process.env.cookieExpiry) * 24 * 60 * 60 * 1000,
      httpOnly: true,
      // secure: false, // Set to true if using HTTPS
      // sameSite: "None"
    });

    res.cookie("refreshToken", refreshToken, {
      maxAge: Number(process.env.cookieExpiry) * 24 * 60 * 60 * 1000,
      httpOnly: true,
      // secure: false, // Set to true if using HTTPS
      // sameSite: "None"
    });

    res.status(200).send({
      success: true,
      message: "User login successful",
      user: {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
        study: userData.study,
        blocked: userData.blocked,
        role: userData.role
      }
    }
    );
    console.log("success")
  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).send({
      success: false,
      message: 'Error in login',
      error: error.message,
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

//verify token


// Send Mail
export const sendMail = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).send({ success: false, message: 'Email is required' });
    }

    // Send OTP
    const sendOtp = await sendOtpToEmail(email);

    if (sendOtp) {
      return res.status(200).send({
        success: true,
        message: 'OTP sent to email',
      });
    } else {
      return res.status(500).send({
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }
  } catch (error) {
    console.error('Error in sendMail:', error);
    res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
};


/*
Summary: Function used for verifying OTP for an email address
Action: POST
URL: "http://localhost:8080/api/v1/auth/verify-mail"

Request:
req.body: {
  "email": "ayush.s.sharma04@gmail.com",
  "otp": "123456"
}

Response:
Success:
{
  "success": true,
  "message": "OTP verified successfully",
  "isOtpValid": true
}
Failure:
{
  "success": false,
  "message": "Invalid OTP",
  "isOtpValid": false
}
OR
{
  "success": false,
  "message": "Email is required"
}
OR
{
  "success": false,
  "message": "OTP is required"
}
*/
export const verifyMail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email) {
      return res.status(400).send({ success: false, message: 'Email is required' });
    }
    if (!otp) {
      return res.status(400).send({ success: false, message: 'OTP is required' });
    }

    // Verify OTP
    const isOtpValid = await verifyOtp(email, otp);

    if (isOtpValid) {
      await updateMatchData(process.env.userCollection, "email", email, { verified: true })
      const userDataSnapshot = await matchData(process.env.userCollection, "email", email)
      const userData = userDataSnapshot.docs[0].data()
      const notification_id = Date.now()
      const notificationData = {
        userId: userData.userId,
        notification_id,
        date: new Date(),
        allowed: false,
        photoUrl: userData.photoUrl,
        fname: userData.fname,
        lname: userData.lname,
        type: "registration"
      }
      await createSubData(process.env.adminCollection, process.env.notificationCollection, "admin_profile", notification_id, notificationData)
      return res.status(200).send({
        success: true,
        message: 'OTP verified successfully',
        isOtpValid: true,
      });
    } else {
      return res.status(401).send({
        success: false,
        message: 'Invalid OTP',
        isOtpValid: false,
      });
    }
  } catch (error) {
    console.error('Error in verifyMail:', error);
    res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
};

/*
Summary: Function used to update the user's password
Action: POST
URL: "http://localhost:8080/api/v1/auth/forgot-password"

Request:
req.body: {
  "email": "ayush.s.sharma04@gmail.com",
  "newPassword": "654321"
}

Response:
Success:
{
  "success": true,
  "message": "Password updated successfully",
  "updateData": {
    "study": [],
    "address": "Mumbai",
    "role": 1,
    "blocked": false,
    "phone": "9326242640",
    "name": "Ayush Sharma",
    "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
    "email": "ayush.s.sharma04@gmail.com",
    "otp": "519266",
    "expiresAt": 1723710253923,
    "password": "$2b$10$SIYw4ZHBRBZmPqUXa899tO4xdVjUlSXFR.0qMk8pPLSzCpm/B5Kxy"
  }
}
Failure:
{
  "success": false,
  "message": "OTP has expired"
}
OR
{
  "success": false,
  "message": "Email is required"
}
OR
{
  "success": false,
  "message": "New password is required"
}
OR
{
  "success": false,
  "message": "Something went wrong",
  "error": "Detailed error message"
}
*/
export const forgotPasswordController = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const currentTime = new Date().toISOString();

    // Validation
    if (!email) {
      return res.status(400).send({ success: false, message: 'Email is required' });
    }
    if (!newPassword) {
      return res.status(400).send({ success: false, message: 'New password is required' });
    }

    // Retrieve OTP data
    const otpData = await matchData(process.env.userCollection, 'email', email);

    // Check if OTP has expired
    if (Date.now() > otpData.expiresAt) {
      return res.status(400).send({ success: false, message: 'OTP has expired' });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user data
    const update = await updateMatchData(process.env.userCollection, 'email', email, {
      password: hashedPassword,
      alert: admin.firestore.FieldValue.arrayUnion({
        type: 2,
        heading: 'Password Updated Successfully',
        text: 'Your password has been changed successfully',
        time: currentTime,
      }),
    });

    const updateData = update.data();

    return res.status(200).send({
      success: true,
      message: 'Password updated successfully',
      updateData,
    });
  } catch (error) {
    console.error('Error in forgotPasswordController:', error);
    res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
};

/* 
// Summary: Function used for updating a user's/student's details. At least one field is required for the update.
// Action: POST
// URL: "http://localhost:8080/api/v1/auth/update-user"

// Request:
// req.body: { 
//   "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//   "fname": "Ayush", 
//   "lname": "Sharma",
//   "email": "ayush.s.sharma04@gmail.com",
//   "phone": "9326242640", 
//   "address": "Mumbai"
// }
// req.file: {
//   file: image file
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "Student updated successfully",
//   "user": {
//     "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//     "fname": "Ayush",
//     "lname": "Sharma",
//     "email": "ayush.s.sharma04@gmail.com",
//     "phone": "9326242640",
//     "address": "Mumbai",
//     "photoUrl": "image_url"
//   }
// }

// Failure:
// {
//   "success": false,
//   "message": "Error finding user"
// }
// OR
// {
//   "success": false,
//   "message": "At least one field (fname, lname, address, contact, email) or image is required"
// }
// OR
// {
//   "success": false,
//   "message": "User not found"
// }
// OR
// {
//   "success": false,
//   "message": "Error updating user",
//   "error": "Detailed error message"
// }

// Notes:
// - If an image file is provided, it will be uploaded and the photo URL will be updated.
// - At least one field (fname, lname, address, phone, email) must be provided for the update.
// - Returns the updated user information including the photo URL if available.
*/

export const updateUserController = async (req, res) => {
  try {
    const { userId, fname, lname, address, phone, email } = req.body;
    const file = req.file;
    var photoUrl;

    // Create the updates object only with provided fields
    const updates = {};
    if (fname) updates.fname = fname;
    if (lname) updates.lname = lname;
    if (address) updates.address = address;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;

    // Ensure userId is provided
    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    // Ensure at least one field is provided for the update
    if (!fname && !lname && !address && !phone && !email && !file) {
      return res.status(400).send({ message: 'At least one field (fname, lname, address, contact, email) or image is required' });
    }

    const userData = await readSingleData(process.env.userCollection, userId);

    if (!userData) {
      return res.status(404).send({ message: 'User not found' });
    }

    // If file exists, upload and get its URL
    if (file) {
      const imageFile = file;
      photoUrl = await uploadFile(imageFile, 'images', `user/${userId}/photoUrl/${imageFile.originalname}`);
      if (photoUrl) updates.photoUrl = photoUrl;
    }

    // Update user data in Firestore
    await updateData(process.env.userCollection, userId, updates);

    return res.status(200).send({
      success: true,
      message: 'Student updated successfully',
      user: { ...updates, userId: userData.userId }, // Return updated fields
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error updating user',
      error: error.message,
    });
  }
};


/* 
// Summary: Function used for blocking or unblocking a user for any action.
// Action: POST
// URL: "http://localhost:8080/api/v1/auth/block-user"

// Request:
// req.body: {
//   "userId": "f2b077ed-e350-4783-8738-22c5969036dd",
//   "block": true/false
// }

// Response:
// Success:
// {
//   "success": true,
//   "message": "User Blocked/Unblocked successfully",
//   "block": true/false
// }

// Failure:
// {
//   "success": false,
//   "message": "Error finding user"
// }
// OR
// {
//   "success": false,
//   "message": "Error blocking/unblocking user",
//   "error": "Detailed error message"
// }

// Notes:
// - The block field determines whether the user will be blocked (true) or unblocked (false).
*/

export const blockUser = async (req, res) => {
  try {
    const { userId, block } = req.body;
    let message;

    // Ensure userId is provided
    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    // Set appropriate message based on block status
    if (block) {
      message = 'User Blocked successfully';
    } else {
      message = 'User Unblocked successfully';
    }

    // Update user block status in Firestore
    await updateData(process.env.userCollection, userId, { blocked: block });

    return res.status(200).send({
      success: true,
      message: message,
      block: block
    });
  } catch (error) {
    console.error('Error blocking/unblocking user:', error);
    return res.status(500).send({
      success: false,
      message: 'Error blocking/unblocking user',
      error: error.message,
    });
  }
};

export const allowUser = async (req, res) => {
  const { notification_id } = req.body
  try {
    const notificationData = await readSingleSubData(process.env.adminCollection, process.env.notificationCollection, "admin_profile", notification_id)
    if (notificationData.allowed) {
      return res.status(400).send("User is already allowed")
    }
    const userId = notificationData.userId
    await updateSubData(process.env.adminCollection, process.env.notificationCollection, "admin_profile", notification_id, { allowed: true })
    await updateData(process.env.userCollection, userId, { allowed: true })
    return res.status(200).send("User is allowed to use the platform")
  } catch (error) {
    console.error(error)
    res.status(500).send("Internal server error")
  }
}

export const testController = (req, res) => {
  res.send('Protected Routes');
};
