import express from 'express';
import colors from 'colors';
import dotenv from 'dotenv';
import morgan from "morgan";

import authRoutes from './routes/authRoute.js';
// import accessRoutes from './routes/accessRoute.js';
import studyRoutes from './routes/studyRoute.js';
import userRoutes from './routes/userRoute.js';
import notificationRoutes from './routes/notificationRoute.js';

import cors from 'cors';
import bodyParser from 'body-parser';

//configure env
dotenv.config();

//express object
const app = express();

//middlewares
app.use(cors());
app.use(cors({ origin: '*' })); // Allow all origins for testing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('combined'));
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
