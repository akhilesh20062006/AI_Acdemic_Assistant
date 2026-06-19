require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./database');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static directories for file previews if needed
app.use('/static_uploads', express.static(path.join(__dirname, 'uploads')));

// Register API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Boot server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`AI Academic Assistant Server running on http://localhost:${PORT}`);
  });
}

startServer();
