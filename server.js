const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection test
const db = require('./config/database');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/users', require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running' });
});

// Serve React build in production (if it exists)
const buildPath = path.join(__dirname, 'client/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  
  app.get('/', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
  
  app.get('*', (req, res) => {
    // Only serve React for non-API routes
    if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
} else {
  // Fallback when React build doesn't exist
  app.get('/', (req, res) => {
    res.json({ 
      status: 'Backend API running',
      message: 'React frontend not built yet. Run "npm run build" to build the client.',
      apiEndpoints: {
        auth: '/api/auth',
        videos: '/api/videos',
        users: '/api/users'
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
  if (fs.existsSync(buildPath)) {
    console.log('React frontend: READY');
  } else {
    console.log('React frontend: NOT BUILT (run: cd client && npm run build)');
  }
});
