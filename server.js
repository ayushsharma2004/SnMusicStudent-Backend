import express from 'express';
import colors from 'colors';
import dotenv from 'dotenv';
import morgan from "morgan";

import authRoutes from './routes/authRoute.js';
// import accessRoutes from './routes/accessRoute.js';
import studyRoutes from './routes/studyRoute.js';
import userRoutes from './routes/userRoute.js';
import categoryRoutes from './routes/categoryRoute.js';
import tagRoutes from './routes/tagRoute.js';
import notificationRoutes from './routes/notificationRoute.js';
import cookieParser from 'cookie-parser';

import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';

//configure env
dotenv.config();

//express object
const app = express();

//middlewares
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "https://sn-music-student-frontend.vercel.app", "https://sn-music-student-frontend-git-e441d8-ayushsharma2004s-projects.vercel.app/", "https://sn-music-admin-frontend.vercel.app"];

// CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // Allow request if origin is in the list or null (non-browser request)
    } else {
      callback(new Error("Not allowed by CORS")); // Block request otherwise
    }
  },
  credentials: true, // Allow credentials like cookies
}));




app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
// app.use(morgan('combined'));
app.use(cookieParser())
// Custom middleware to log request duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

//routes
app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/access', accessRoutes);
app.use('/api/v1/study', studyRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/category', categoryRoutes);
app.use('/api/v1/tag', tagRoutes);
app.use('/api/v1/notification', notificationRoutes);

//rest api
app.get('/', (req, res) => {
  try {
    res.send('<h1>Welcome to SNMUSIC</h1>');
  } catch (error) {
    console.log(error);
  }
});

//PORT
const PORT = process.env.PORT || 8080;

//Listens
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`.cyan);
});
