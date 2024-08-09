import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { matchData, readSingleData, updateData } from '../DB/crumd.js';
import { db } from '../DB/firestore.js';
import { comparePassword, hashPassword, sendOtpToEmail, verifyOtp } from '../helper/authHelper.js';
import JWT from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export const registerController = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const userId = uuidv4();

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

//Login User
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
        sendOtp // Remove this line in production
      });
    }
    return;
  } catch (error) {
    console.log(error);
  }
}

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
        isOtpValid // Remove this line in production
      });
    }
  } catch (error) {
    console.log(error);
  }
}

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

    const update = await updateData(process.env.userCollection, email, { password: hashed });

    res.status(200).send({
      success: true,
      message: 'Password updated successfully',
      update
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

// Update student details excluding image
export const userUpdateController = async (req, res) => {
  try {
    const { userId, name, address, phone, email, role } = req.body;

    // Create the updates object only with provided fields
    const updates = {};
    if (name) updates.name = name;
    if (address) updates.address = address;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding student' });
    }

    if (!name && !address && !contact && !email && !instagram && !facebook && !whatsapp && !role && !file) {
      return res.status(400).send({ message: 'At least one field (name, address, contact, email, social media, role) or image is required' });
    }

    const userData = await readSingleData(process.env.userCollection, userId);

    if (!userData) {
      return res.status(404).send({ message: 'Student not found' });
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

export const changeProfile = async (req, res) => {
  if (req.file) {
    const { userId } = req.body
    const file = req.file
    console.log(file)
    if (userId) {
      const storageRef = ref(storage, `${process.env.storagePath}/user/${userId}/${file.originalname}`);

      const metadata = {
        contentType: file.mimetype,
      };

      // Upload the file and metadata
      const uploadTask = uploadBytesResumable(storageRef, file.buffer, metadata);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Observe state change events such as progress, pause, and resume
          // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
          switch (snapshot.state) {
            case 'paused':
              console.log('Upload is paused');
              break;
            case 'running':
              console.log('Upload is running');
              break;
          }
        },
        (error) => {
          // Handle unsuccessful uploads
        },
        async () => {
          // Handle successful uploads on complete
          // For instance, get the download URL: https://firebasestorage.googleapis.com/...
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
          console.log("new image", downloadUrl)
          const updates = {
            photoUrl: downloadUrl
          }
          await updateData(process.env.userCollection, userId, updates);
          res.status(200).send({
            success: true,
            photoUrl: downloadUrl,
            message: "Profile changed successfully"
          })
        }
      );
    }
    else {
      return res.status(401).send("Authorization error")
    }
  }
  else {
    return res.status(400).send("image is not provided")
  }
}

export const blockUser = async (req, res) => {
  try {
    const { userId, block } = req.body;

    if (!userId) {
      return res.status(400).send({ message: 'Error finding user' });
    }

    var approvedStudies = await updateData(process.env.userCollection, userId, {blocked: block});
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


export const testController = (req, res) => {
  res.send('Protected Routes');
};
