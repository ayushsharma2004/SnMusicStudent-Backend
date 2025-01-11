import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import JWT from 'jsonwebtoken';
import { createData, matchData, readSingleData, updateData, updateMatchData } from '../DB/crumd.js';
import { token } from 'morgan';
import { db } from '../DB/firestore.js';

// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use 'gmail' or other service provider
  auth: {
    user: process.env.nodemailer_email, // Your email address
    pass: process.env.nodemailer_pass, // Your email password or app password
  },
});

// Generate and send OTP to email
export const sendOtpToEmail = async (email) => {
  try {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    console.log(process.env.nodemailer_pass);

    if (!email || !emailRegex.test(email)) {
      return res.status(400).send({ message: 'Valid email is required' });
    }
    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Save OTP in Firestore with an expiration time (e.g., 10 minutes)
    var otpJson = {
      otp: otp,
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes
    }


    const otpRef = await updateMatchData(process.env.userCollection, 'email', email, otpJson)

    // Send OTP to the user's email
    const mailOptions = {
      from: process.env.nodemailer_email, // Your email address
      to: email,
      subject: 'Your OTP Code for Forget',
      text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
      html: `<p>Your OTP code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Error sending OTP');
  }
};

// Verify OTP
export const verifyOtp = async (email, otp) => {
  try {
    console.log(email)

    const querySnapshot = await db
      .collection(process.env.userCollection)
      .where("email", '==', email)
      .get();

    const otpData = querySnapshot.docs[0].data()

    console.log(otpData)
    if (!otpData) {
      throw new Error('OTP not found');
    }

    if (otpData.otp !== otp) {
      throw new Error('Invalid OTP');
    }

    if (Date.now() > otpData.expiresAt) {
      throw new Error('OTP has expired');
    }

    // OTP is valid
    if (otpData.otp === otp) {
      return true
    }
    return false;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
};

export const hashPassword = async (password) => {
  try {
    const saltRounds = 10;
    const hashedPassword = bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.log(error);
  }
};

export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

export const renewToken = async (refreshToken) => {
  try {
    const userId = JWT.verify(refreshToken, process.env.JWT_token).userId
    const docRef = db.collection(process.env.userCollection).doc(userId)
    const doc = await docRef.get()
    const userData = doc.data()

    const user = {
      userId: userData.userId,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      study: userData.study,
      blocked: userData.blocked,
      role: userData.role
    }

    const newAccessToken = JWT.sign(
      {
        user
      },
      process.env.JWT_token,
      {
        expiresIn: `${process.env.accessTokenExpiry}d`,
      }
    );

    const newRefreshToken = JWT.sign(
      {
        userId: userData.userId,
      },
      process.env.JWT_token,
      {
        expiresIn: `${process.env.refreshTokenExpiry}d`,
      }
    )

    await docRef.update({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    })

    return { newAccessToken, newRefreshToken }

  } catch (error) {
    console.error(error)
    throw new Error("error occured at renew token")
  }
}

export const renewAdminToken = async (refreshToken) => {
  try {
    const adminId = JWT.verify(refreshToken, process.env.JWT_token).adminId
    const docRef = db.collection(process.env.adminCollection).doc(adminId)
    const doc = await docRef.get()
    const adminData = doc.data()

    const admin = {
      username: adminData.username,
      password : adminData.password
    }

    const newAccessToken = JWT.sign(
      {
        admin
      },
      process.env.JWT_token,
      {
        expiresIn: `${process.env.accessTokenExpiry}d`,
      }
    );

    const newRefreshToken = JWT.sign(
      {
        adminId: adminData.username,
      },
      process.env.JWT_token,
      {
        expiresIn: `${process.env.refreshTokenExpiry}d`,
      }
    )

    await docRef.update({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    })

    return { newAccessToken, newRefreshToken }

  } catch (error) {
    console.error(error)
    throw new Error("error occured at renew token")
  }
}
