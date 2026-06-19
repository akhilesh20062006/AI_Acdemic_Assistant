const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DB_FILE_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure data folder and db.json exist if we use the JSON fallback
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Initial structure for local database fallback
const initialDb = {
  users: [],
  notes: [],
  uploads: [],
  chatHistory: [],
  tasks: []
};

function readLocalDb() {
  ensureDirectoryExistence(DB_FILE_PATH);
  if (!fs.existsSync(DB_FILE_PATH)) {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
    return initialDb;
  }
  try {
    const rawData = fs.readFileSync(DB_FILE_PATH, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Error reading JSON fallback database:', err);
    return initialDb;
  }
}

function writeLocalDb(data) {
  ensureDirectoryExistence(DB_FILE_PATH);
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Initialize database connection
let useMongo = false;

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('No MONGODB_URI environment variable found. Falling back to local JSON database storage.');
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');
    useMongo = true;
    return true;
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.log('Falling back to local JSON database storage.');
    useMongo = false;
    return false;
  }
}

// Mongoose Schemas (used if MongoDB is connected)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  college: String,
  department: String,
  year: String,
  profileImage: String,
  resetToken: String,
  resetTokenExpiry: Date,
  studyStats: {
    studyHours: { type: Number, default: 0 },
    quizScores: [{ quizId: String, score: Number, total: Number, date: Date }],
    streak: { type: Number, default: 1 },
    lastActive: { type: Date, default: Date.now }
  },
  createdAt: { type: Date, default: Date.now }
});

const NoteSchema = new mongoose.Schema({
  title: String,
  subject: String,
  summary: String,
  notesContent: String,
  keyPoints: [String],
  formulas: [String],
  definitions: [{ term: String, definition: String }],
  flashcards: [{ question: String, answer: String }],
  mcqs: [{ question: String, options: [String], answerIndex: Number, explanation: String }],
  mindmap: String,
  uploadedBy: { type: String, required: true },
  uploadId: String,
  createdAt: { type: Date, default: Date.now }
});

const UploadSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  fileType: String,
  subject: String,
  url: String,
  extractedText: String,
  uploadedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ChatSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  uploadId: String,
  message: String,
  aiResponse: String,
  timestamp: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: String,
  subject: String,
  date: String,
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Models = {
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  Note: mongoose.models.Note || mongoose.model('Note', NoteSchema),
  Upload: mongoose.models.Upload || mongoose.model('Upload', UploadSchema),
  Chat: mongoose.models.Chat || mongoose.model('Chat', ChatSchema),
  Task: mongoose.models.Task || mongoose.model('Task', TaskSchema)
};

// Unified DB Wrapper Methods
const db = {
  users: {
    async findOne(query) {
      if (useMongo) {
        return await Models.User.findOne(query).lean();
      } else {
        const local = readLocalDb();
        return local.users.find(u => Object.keys(query).every(k => {
          if (k === 'email' && typeof u[k] === 'string' && typeof query[k] === 'string') {
            return u[k].toLowerCase().trim() === query[k].toLowerCase().trim();
          }
          return u[k] === query[k];
        })) || null;
      }
    },
    async findById(id) {
      if (useMongo) {
        return await Models.User.findById(id).lean();
      } else {
        const local = readLocalDb();
        return local.users.find(u => u._id === id) || null;
      }
    },
    async create(data) {
      if (useMongo) {
        const user = new Models.User(data);
        return (await user.save()).toObject();
      } else {
        const local = readLocalDb();
        const newUser = {
          _id: Math.random().toString(36).substring(2, 9),
          studyStats: { studyHours: 0, quizScores: [], streak: 1, lastActive: new Date().toISOString() },
          createdAt: new Date().toISOString(),
          ...data
        };
        local.users.push(newUser);
        writeLocalDb(local);
        return newUser;
      }
    },
    async updateById(id, updateData) {
      if (useMongo) {
        return await Models.User.findByIdAndUpdate(id, updateData, { new: true }).lean();
      } else {
        const local = readLocalDb();
        const index = local.users.findIndex(u => u._id === id);
        if (index !== -1) {
          // deep merge helper for studyStats
          if (updateData.studyStats) {
            local.users[index].studyStats = {
              ...local.users[index].studyStats,
              ...updateData.studyStats
            };
            delete updateData.studyStats;
          }
          local.users[index] = { ...local.users[index], ...updateData };
          writeLocalDb(local);
          return local.users[index];
        }
        return null;
      }
    }
  },
  notes: {
    async find(query) {
      if (useMongo) {
        return await Models.Note.find(query).sort({ createdAt: -1 }).lean();
      } else {
        const local = readLocalDb();
        return local.notes
          .filter(n => Object.keys(query).every(k => n[k] === query[k]))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    },
    async findById(id) {
      if (useMongo) {
        return await Models.Note.findById(id).lean();
      } else {
        const local = readLocalDb();
        return local.notes.find(n => n._id === id) || null;
      }
    },
    async create(data) {
      if (useMongo) {
        const note = new Models.Note(data);
        return (await note.save()).toObject();
      } else {
        const local = readLocalDb();
        const newNote = {
          _id: Math.random().toString(36).substring(2, 9),
          createdAt: new Date().toISOString(),
          ...data
        };
        local.notes.push(newNote);
        writeLocalDb(local);
        return newNote;
      }
    },
    async deleteById(id) {
      if (useMongo) {
        return await Models.Note.findByIdAndDelete(id);
      } else {
        const local = readLocalDb();
        const index = local.notes.findIndex(n => n._id === id);
        if (index !== -1) {
          local.notes.splice(index, 1);
          writeLocalDb(local);
          return true;
        }
        return false;
      }
    }
  },
  uploads: {
    async find(query) {
      if (useMongo) {
        return await Models.Upload.find(query).sort({ createdAt: -1 }).lean();
      } else {
        const local = readLocalDb();
        return local.uploads
          .filter(up => Object.keys(query).every(k => up[k] === query[k]))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    },
    async findById(id) {
      if (useMongo) {
        return await Models.Upload.findById(id).lean();
      } else {
        const local = readLocalDb();
        return local.uploads.find(up => up._id === id) || null;
      }
    },
    async create(data) {
      if (useMongo) {
        const upload = new Models.Upload(data);
        return (await upload.save()).toObject();
      } else {
        const local = readLocalDb();
        const newUpload = {
          _id: Math.random().toString(36).substring(2, 9),
          createdAt: new Date().toISOString(),
          ...data
        };
        local.uploads.push(newUpload);
        writeLocalDb(local);
        return newUpload;
      }
    },
    async deleteById(id) {
      if (useMongo) {
        return await Models.Upload.findByIdAndDelete(id);
      } else {
        const local = readLocalDb();
        const index = local.uploads.findIndex(up => up._id === id);
        if (index !== -1) {
          local.uploads.splice(index, 1);
          writeLocalDb(local);
          return true;
        }
        return false;
      }
    }
  },
  chatHistory: {
    async find(query) {
      if (useMongo) {
        return await Models.Chat.find(query).sort({ timestamp: 1 }).lean();
      } else {
        const local = readLocalDb();
        return local.chatHistory
          .filter(ch => Object.keys(query).every(k => ch[k] === query[k]))
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
    },
    async create(data) {
      if (useMongo) {
        const chat = new Models.Chat(data);
        return (await chat.save()).toObject();
      } else {
        const local = readLocalDb();
        const newChat = {
          _id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          ...data
        };
        local.chatHistory.push(newChat);
        writeLocalDb(local);
        return newChat;
      }
    }
  },
  tasks: {
    async find(query) {
      if (useMongo) {
        return await Models.Task.find(query).sort({ createdAt: -1 }).lean();
      } else {
        const local = readLocalDb();
        return local.tasks
          .filter(t => Object.keys(query).every(k => t[k] === query[k]))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    },
    async create(data) {
      if (useMongo) {
        const task = new Models.Task(data);
        return (await task.save()).toObject();
      } else {
        const local = readLocalDb();
        const newTask = {
          _id: Math.random().toString(36).substring(2, 9),
          completed: false,
          createdAt: new Date().toISOString(),
          ...data
        };
        local.tasks.push(newTask);
        writeLocalDb(local);
        return newTask;
      }
    },
    async updateById(id, updateData) {
      if (useMongo) {
        return await Models.Task.findByIdAndUpdate(id, updateData, { new: true }).lean();
      } else {
        const local = readLocalDb();
        const index = local.tasks.findIndex(t => t._id === id);
        if (index !== -1) {
          local.tasks[index] = { ...local.tasks[index], ...updateData };
          writeLocalDb(local);
          return local.tasks[index];
        }
        return null;
      }
    },
    async deleteById(id) {
      if (useMongo) {
        return await Models.Task.findByIdAndDelete(id);
      } else {
        const local = readLocalDb();
        const index = local.tasks.findIndex(t => t._id === id);
        if (index !== -1) {
          local.tasks.splice(index, 1);
          writeLocalDb(local);
          return true;
        }
        return false;
      }
    }
  },
  raw: {
    read: readLocalDb,
    write: writeLocalDb
  }
};

module.exports = { connectDB, db };
