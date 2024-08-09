import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createData, matchData, readSingleData, updateData, updateMatchData } from '../DB/crumd.js';

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
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    }


    const otpRef = updateMatchData(process.env.userCollection, 'email', email, otpJson)

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
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const otpRegex = /^\d{6}$/;

    if (!email || !emailRegex.test(email)) {
      return res.status(400).send({ message: 'Valid email is required' });
    }

    if (!otp || !otpRegex.test(otp)) {
      return res.status(400).send({ message: 'Valid otp is required' });
    }

    var otpData = await matchData(process.env.userCollection, 'email', email).docs[0].data();

    if (!otpData) {
      throw new Error('OTP not found');
    }
    console.log(otpData);
    console.log(otpData.otp);
    console.log(otp);

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
