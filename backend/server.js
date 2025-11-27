require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',           // Local development
    'http://localhost:3000',           // Alternative local port
    'http://192.168.1.100:5173',       // Local machine on network
    'http://192.168.1.100:5000',       // Backend on network
    'https://neuronic-brain-nonmobile.ngrok-free.dev',  // Your ngrok domain
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/av-project-manager';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const manufacturerRoutes = require('./routes/manufacturers');
const deviceTemplateRoutes = require('./routes/deviceTemplates');
const deviceRoutes = require('./routes/devices');
const reportRoutes = require('./routes/reports');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AV Project Manager API is running',
    timestamp: new Date().toISOString(),
  });
});

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/device-templates', deviceTemplateRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});