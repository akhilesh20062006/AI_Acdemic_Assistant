const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const aiService = require('./services/aiService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'academic-assistant-super-secret-key-2026';

// Multer storage configuration for uploads (stored locally in backend/uploads/)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware: Authenticate student via JWT token
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'No authorization token or user ID provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// ==========================================
// HEALTH & AUTHENTICATION APIs
// ==========================================

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: "ok"
  });
});

// Register student
router.post('/auth/register', async (req, res) => {
  const { name, email, password, college, department, year } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await db.users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'A student with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.users.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      college: college || '',
      department: department || '',
      year: year || '',
      profileImage: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`
    });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { _id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, studyStats: user.studyStats } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login student
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await db.users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { _id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, college: user.college, department: user.department, year: user.year, studyStats: user.studyStats } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Forgot password request
router.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await db.users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: 'Student with this email does not exist.' });
    }

    // Generate a random 6-character reset token
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiry = new Date(Date.now() + 3600000); // 1 hour from now

    await db.users.updateById(user._id, {
      resetToken: token,
      resetTokenExpiry: expiry.toISOString()
    });

    console.log(`[PASSWORD RESET] Generated reset token for ${normalizedEmail}: ${token}`);

    res.json({
      success: true,
      message: 'Password reset code has been logged to backend console.',
      token: token
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error initiating password reset.' });
  }
});

// Reset password request
router.post('/auth/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await db.users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: 'Student not found.' });
    }

    if (!user.resetToken || user.resetToken !== token) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }

    const expiryTime = new Date(user.resetTokenExpiry);
    if (expiryTime < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.users.updateById(user._id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    });

    res.json({
      success: true,
      message: 'Password updated successfully. You can now login with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// Get/Update student profile
router.get('/auth/profile', authMiddleware, async (req, res) => {
  try {
    const user = await db.users.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Student profile not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/auth/profile', authMiddleware, async (req, res) => {
  try {
    const update = await db.users.updateById(req.userId, req.body);
    res.json(update);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ==========================================
// FILE UPLOAD & OCR APIs
// ==========================================

router.post('/uploads', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { subject } = req.body;
  const filename = req.file.originalname;
  const mimeType = req.file.mimetype;
  let extractedText = '';

  try {
    const clientApiKey = req.headers['x-gemini-api-key'];
    if (mimeType.startsWith('image/')) {
      extractedText = await aiService.performOCR(req.file.buffer, mimeType, clientApiKey);
    } else if (mimeType === 'application/pdf') {
      try {
        extractedText = await aiService.extractTextFromPDF(req.file.buffer, clientApiKey);
      } catch (pdfErr) {
        console.error('PDF parsing error:', pdfErr);
        return res.status(400).json({ error: 'Failed to process PDF. The document might be corrupted, password protected, or empty.' });
      }
    } else {
      const bufferStr = req.file.buffer.toString('utf8');
      if (mimeType === 'text/plain') {
        extractedText = bufferStr;
      } else {
        extractedText = `[File: ${filename}]\nExtracted content from document package.\nThis study guide represents topics in the ${subject || 'general'} curriculum.`;
      }
    }

    const uploadRecord = await db.uploads.create({
      filename: filename,
      originalName: filename,
      fileType: mimeType,
      subject: subject || 'General',
      url: `data:${mimeType};base64,${req.file.buffer.toString('base64')}`,
      extractedText: extractedText,
      uploadedBy: req.userId
    });

    res.status(201).json(uploadRecord);
  } catch (err) {
    console.error('File processing error:', err);
    res.status(500).json({ error: err.message || 'Error processing file with Gemini.' });
  }
});

router.get('/uploads', authMiddleware, async (req, res) => {
  try {
    const list = await db.uploads.find({ uploadedBy: req.userId });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch uploads.' });
  }
});

router.delete('/uploads/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await db.uploads.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Upload not found.' });
    res.json({ success: true, message: 'File deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file.' });
  }
});

// ==========================================
// AI NOTES GENERATOR APIs
// ==========================================

router.post('/ai/generate', authMiddleware, async (req, res) => {
  const { uploadId, mode } = req.body;
  if (!uploadId) {
    return res.status(400).json({ error: 'Upload ID is required.' });
  }

  try {
    const upload = await db.uploads.findById(uploadId);
    if (!upload) return res.status(404).json({ error: 'Uploaded file reference not found.' });

    const clientApiKey = req.headers['x-gemini-api-key'];
    const studyBundle = await aiService.generateNotes(upload.extractedText, mode || 'detailed', upload.subject, clientApiKey);
    
    const savedNotes = await db.notes.create({
      title: studyBundle.title || upload.filename + ' AI Notes',
      subject: upload.subject,
      summary: studyBundle.summary || '',
      notesContent: studyBundle.notesContent || '',
      keyPoints: studyBundle.keyPoints || [],
      formulas: studyBundle.formulas || [],
      definitions: studyBundle.definitions || [],
      flashcards: studyBundle.flashcards || [],
      mcqs: studyBundle.mcqs || [],
      mindmap: studyBundle.mindmap || '',
      uploadedBy: req.userId,
      uploadId: uploadId
    });

    res.json(savedNotes);
  } catch (err) {
    console.error('Note generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate study guide.' });
  }
});

router.get('/notes', authMiddleware, async (req, res) => {
  try {
    const list = await db.notes.find({ uploadedBy: req.userId });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes.' });
  }
});

router.get('/notes/:id', authMiddleware, async (req, res) => {
  try {
    const note = await db.notes.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Notes guide not found.' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load note detail.' });
  }
});

router.delete('/notes/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await db.notes.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Notes not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note.' });
  }
});

// ==========================================
// AI CHATBOT APIs
// ==========================================

router.post('/chat', authMiddleware, async (req, res) => {
  const { uploadId, message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  try {
    let contextText = '';
    let sourceNoteName = null;
    if (uploadId) {
      const upload = await db.uploads.findById(uploadId);
      if (upload) {
        contextText = upload.extractedText;
        sourceNoteName = upload.filename;
      }
    }

    const clientApiKey = req.headers['x-gemini-api-key'];
    const aiResponse = await aiService.chatWithDocument(contextText, message, history || [], sourceNoteName, clientApiKey);
    
    await db.chatHistory.create({
      userId: req.userId,
      uploadId: uploadId || null,
      message,
      aiResponse
    });

    res.json({ message, aiResponse });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({ error: err.message || 'Failed to process chat query with Google Gemini API.' });
  }
});

router.get('/ai/chat/history', authMiddleware, async (req, res) => {
  const { uploadId } = req.query;
  try {
    const query = { userId: req.userId };
    if (uploadId) query.uploadId = uploadId;
    const history = await db.chatHistory.find(query);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load chat logs.' });
  }
});

// ==========================================
// STUDY TOOLS & ANALYTICS APIs
// ==========================================

router.get('/study/tasks', authMiddleware, async (req, res) => {
  try {
    const list = await db.tasks.find({ userId: req.userId });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load task planner.' });
  }
});

router.post('/study/tasks', authMiddleware, async (req, res) => {
  const { title, subject, date } = req.body;
  try {
    const task = await db.tasks.create({
      userId: req.userId,
      title,
      subject: subject || 'General',
      date: date || new Date().toISOString().split('T')[0]
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create planner task.' });
  }
});

router.put('/study/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await db.tasks.updateById(req.params.id, req.body);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

router.delete('/study/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await db.tasks.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// Update streak/active metrics
router.post('/study/streak/update', authMiddleware, async (req, res) => {
  try {
    const user = await db.users.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Student not found.' });

    const now = new Date();
    const lastActive = user.studyStats.lastActive ? new Date(user.studyStats.lastActive) : null;
    let currentStreak = user.studyStats.streak || 1;

    if (lastActive) {
      const diffTime = Math.abs(now - lastActive);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak += 1;
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }

    const updatedUser = await db.users.updateById(req.userId, {
      studyStats: {
        ...user.studyStats,
        streak: currentStreak,
        lastActive: now.toISOString()
      }
    });

    res.json({ streak: updatedUser.studyStats.streak });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update study metrics.' });
  }
});

// Track study score
router.post('/study/score', authMiddleware, async (req, res) => {
  const { quizId, score, total } = req.body;
  try {
    const user = await db.users.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Student not found.' });

    const currentScores = user.studyStats.quizScores || [];
    currentScores.push({ quizId, score, total, date: new Date().toISOString() });

    const studyHours = (user.studyStats.studyHours || 0) + 0.25;

    const updatedUser = await db.users.updateById(req.userId, {
      studyStats: {
        ...user.studyStats,
        quizScores: currentScores,
        studyHours: studyHours
      }
    });

    res.json(updatedUser.studyStats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record quiz score.' });
  }
});

// Log study time
router.post('/study/time', authMiddleware, async (req, res) => {
  const { hours } = req.body;
  try {
    const user = await db.users.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Student not found.' });

    const updatedUser = await db.users.updateById(req.userId, {
      studyStats: {
        ...user.studyStats,
        studyHours: (user.studyStats.studyHours || 0) + (parseFloat(hours) || 0)
      }
    });

    res.json(updatedUser.studyStats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to log study hours.' });
  }
});

module.exports = router;
