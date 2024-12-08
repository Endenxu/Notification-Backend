import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import fs from 'fs';
import { connectDB } from './config/database.js';
import notificationRoutes from './routes/notification.js';

dotenv.config();
const app = express();

// Create a write stream for the log file
const accessLogStream = fs.createWriteStream('./access.log', { flags: 'a' });

// Use morgan to log requests
app.use(morgan('combined', { stream: accessLogStream }));

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Connect and start server
connectDB().then(() => {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  });
});