import express from 'express';
import dotenv from 'dotenv';
// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { PassThrough } from 'stream';
import FormData from 'form-data';
import fs from 'fs/promises';
import os from 'os';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import multer from 'multer';
import path from 'path';
import Creatomate from 'creatomate';
import { createData, deleteData, matchData, readAllData, readSingleData, updateData } from "../DB/crumd.js";
import { storage } from "../DB/firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createCanvas, loadImage } from 'canvas';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync } from 'fs';

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// Helper to get __dirname when using ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

//rest object
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

export const uploadFile = (file, type, folderPath) => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `${process.env.storagePath}/${folderPath}`);
    const metadata = {
      contentType: type === 'images' || 'image' ? 'image/jpeg' : 'video/mp4',
    };
    const uploadTask = uploadBytesResumable(storageRef, file.buffer, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        console.log('Upload state:', snapshot.state);
        console.log('Bytes transferred:', snapshot.bytesTransferred);
        console.log('Total bytes:', snapshot.totalBytes);
      },
      (error) => {
        console.error('Upload error:', error);
        reject({ message: 'Upload error', error: error.message });
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          console.error('Error getting download URL:', error);
          reject({ message: 'Error getting download URL', error: error.message });
        }
      }
    );
  });
};

export const uploadWaterMarkFile = (buffer, type, folderPath) => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `${process.env.storagePath}/${folderPath}`);
    const metadata = {
      contentType: type === 'images' ? 'image/jpeg' : 'video/mp4',
    };
    const uploadTask = uploadBytesResumable(storageRef, buffer, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        console.log('Upload state:', snapshot.state);
        console.log('Bytes transferred:', snapshot.bytesTransferred);
        console.log('Total bytes:', snapshot.totalBytes);
      },
      (error) => {
        console.error('Upload error:', error);
        reject({ message: 'Upload error', error: error.message });
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          console.error('Error getting download URL:', error);
          reject({ message: 'Error getting download URL', error: error.message });
        }
      }
    );
  });
};


// export const extractFrameFromVideo = async (videoBuffer) => {
//   return await new Promise(async (resolve, reject) => {
//     // Write the video buffer to a temporary file
//     const tmpDir = os.tmpdir();
//     const tmpVideoPath = path.join(tmpDir, 'tmp-video.mp4');
//     await fs.writeFile(tmpVideoPath, videoBuffer);

//     const framePath = path.join(tmpDir, 'frame.jpg');
//     ffmpeg(tmpVideoPath)
//       .on('end', () => {
//         // Read the frame back into a buffer
//         fs.readFile(framePath, (err, data) => {
//           if (err) {
//             return reject(err);
//           }
//           resolve(data);
//         });
//       })
//       .on('error', (err) => {
//         reject(err);
//       })
//       .screenshots({
//         count: 1,
//         timemarks: ['0.5'], // Capture at the 0.5-second mark
//         filename: 'frame.jpg',
//         folder: tmpDir,
//       });
//   });
// };

export const extractFrameFromVideo = async (videoBuffer) => {
  const tmpDir = os.tmpdir();
  const tmpVideoPath = path.join(tmpDir, `tmp-video-${Date.now()}.mp4`);
  const framePath = path.join(tmpDir, `frame-${Date.now()}.jpg`);

  try {
    // Write the video buffer to a temporary file
    await fs.writeFile(tmpVideoPath, videoBuffer);
    console.log(`Temporary video file created at: ${tmpVideoPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(tmpVideoPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg process started with command:', commandLine);
        })
        .on('end', async () => {
          console.log('FFmpeg process finished.');
          try {
            // Read the frame back into a buffer
            const data = await fs.readFile(framePath);
            console.log(`Frame extracted to: ${framePath}`);
            resolve(data);
          } catch (err) {
            console.error('Error reading frame file:', err);
            reject(new Error('Failed to read frame file.'));
          } finally {
            // Clean up temporary files
            await fs.unlink(tmpVideoPath).catch((unlinkErr) => {
              console.error('Error deleting temporary video file:', unlinkErr);
            });
            await fs.unlink(framePath).catch((unlinkErr) => {
              console.error('Error deleting frame file:', unlinkErr);
            });
          }
        })
        .on('error', async (err) => {
          console.error('FFmpeg error:', err);
          reject(new Error('An error occurred during frame extraction.'));
          // Clean up temporary files
          await fs.unlink(tmpVideoPath).catch((unlinkErr) => {
            console.error('Error deleting temporary video file:', unlinkErr);
          });
        })
        .screenshots({
          count: 1,
          timemarks: ['0.5'], // Capture at the 0.5-second mark
          filename: path.basename(framePath),
          folder: tmpDir,
        });
    });
  } catch (err) {
    console.error('Error writing temporary video file:', err);
    throw new Error('Failed to write temporary video file.');
  }
};

export const addImageWatermark = async (imageBuffer) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const watermarkPath = path.resolve(__dirname, '../../SNmusicAdmin/admin/src/images/watermark2.png');
  const watermark = await sharp(watermarkPath).resize(100, 100).toBuffer();
  const watermarkedImage = await sharp(imageBuffer)
    .composite([{ input: watermark, gravity: 'southeast' }])
    .toBuffer();
  return watermarkedImage;
};

export const addTextWatermarkToImage = async (imageBuffer, text) => {
  // Load the image using sharp to get its dimensions
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Resize the image while maintaining its aspect ratio
  const resizedImage = await image.resize(800).toBuffer();
  const resizedMetadata = await sharp(resizedImage).metadata();

  const canvasWidth = resizedMetadata.width;
  const canvasHeight = resizedMetadata.height;

  // Create a canvas with the resized image dimensions
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Load the resized image into the canvas
  const img = await loadImage(resizedImage);
  ctx.drawImage(img, 0, 0);

  // Set the font and style for the watermark text
  ctx.font = '48px poppins';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';

  // Calculate the position for the watermark text at the bottom right
  const textWidth = ctx.measureText(text).width;
  const textHeight = 48; // This can be adjusted based on the font size
  const xPosition = canvasWidth - textWidth - 20; // 20 pixels padding from the right edge
  const yPosition = canvasHeight - textHeight + 20; // 20 pixels padding from the bottom edge

  ctx.fillText(text, xPosition, yPosition);

  // Convert the canvas back to a buffer
  const watermarkedBuffer = canvas.toBuffer('image/png');
  return watermarkedBuffer;
};


// Function to add watermark to video
export const addTextWatermarkToVideo = async (fileBuffer, text) => {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${Date.now()}.mp4`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}.mp4`);

  // Path to a font file (ensure this path is correct)
  const fontPath = path.join(__dirname, '../images/PoppinsMedium.ttf');

  // Write the uploaded file buffer to a temporary file
  await fs.writeFile(inputPath, fileBuffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters({
        filter: 'drawtext',
        options: {
          text: text,
          fontfile: fontPath,
          fontcolor: 'silver',
          fontsize: 28,
          x: '(w-text_w-10)',  // 10 pixels from the right
          y: '(h-text_h-10)',
        }
      })
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('An error occurred: ' + err.message);
        console.error('ffmpeg stderr: ' + stderr);
        reject(err);
      })
      .on('end', () => {
        console.log('Processing finished!');
        resolve();
      })
      .save(outputPath);
  });

  // Read the processed video buffer
  const watermarkedBuffer = await fs.readFile(outputPath);

  // Clean up the temporary files
  await fs.unlink(inputPath);
  await fs.unlink(outputPath);

  return watermarkedBuffer;
};





// export const addTextWatermarkToVideo = async (videoFile, text) => {
//   const form = new FormData();
//   form.append('video', videoFile.buffer, {
//     filename: videoFile.originalname,
//     contentType: videoFile.mimetype
//   });
//   form.append('watermark_text', text);
//   console.log(videoFile);

//   try {
//     const response = await axios.post(
//       'https://api.apyhub.com/generate/video/watermark/file',
//       form,
//       {
//         params: {
//           'output': 'test-sample.mp4'
//         },
//         headers: {
//           ...form.getHeaders(),
//           'apy-token': 'APY0jFfImOpGXMQyHFSyZSQgYAgza6Ea212aKa9wwgKCigLiD4PiZjOlwvWP7roqu7pWsdH',
//           'content-type': 'multipart/form-data'
//         }
//       }
//     );
//     // Convert response to desired format
//     const result = {
//       fieldname: 'video',
//       originalname: 'test-sample.mp4',
//       encoding: '7bit',
//       mimetype: 'video/mp4',
//       buffer: Buffer.from(response.data),
//       size: response.headers['content-length'] // Assuming the header provides the size
//     };
//     // Write buffer to file (optional, for testing purposes)
//     fs.writeFileSync(result.originalname, result.buffer);

//     console.log('Watermark added successfully. Result:', result);
//     return result;
//     // console.log('Watermark added successfully:', response.data);
//   } catch (error) {
//     console.error('Error adding watermark:', error.response ? error.response.data : error.message);
//     throw error; // Rethrow error to be caught by caller
//   }
// };