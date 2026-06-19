# AI Academic Assistant Platform (StudySync Portal)

An interactive, full-stack, AI-powered study ecosystem. Students can register accounts, upload lecture PDFs/slides presentations, perform OCR on handwritten notes images, and leverage Google Gemini LLM reasoning to generate revision outlines, formulas glossaries, MCQ quizzes, study flashcards, and interact with a context-restricted doubts chatbot.

---

## 🚀 Quick Launch Guide (Windows)

Follow these simple terminal execution steps to run the application locally.

### Step 1: Install All Dependencies
Run from the root workspace directory:
```powershell
npm run install-all
```
This automatically installs node modules for both the Express backend and React frontend.

### Step 2: Start the Express Backend Server
From the root workspace directory, run:
```powershell
npm run start:backend
```
The backend server will run on `http://localhost:5000`.

### Step 3: Start the Vite React Frontend
Open another terminal panel and run:
```powershell
npm run start:frontend
```
The frontend dev environment will boot on `http://localhost:3000`. Open this address in your web browser.

---

## 🔑 API Key Configuration

To connect the application to the live **Google Gemini API**:
1. Get a free Gemini API Key from Google AI Studio.
2. Open the file `backend/.env` (created by copying `.env.example`).
3. Set your API key in the placeholder:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
4. Restart the backend server. The application will automatically detect the key, initialize the `@google/generative-ai` SDK, and route all AI chat queries, summaries, flashcards, and quizzes directly to the live `gemini-2.5-flash` model.

---

## 🛠 Tech Stack Details
- **Frontend Framework:** React + Vite + Tailwind CSS v3
- **Backend Framework:** Node.js + Express.js API Gateway
- **Database Engine:** MongoDB via Mongoose (with local JSON-file storage fallback inside `/backend/data/db.json`)
- **AI Integrations:** Gemini Pro SDK (`gemini-2.5-flash` model for outlines, doubts, MCQs)
- **Authentications:** JSON Web Tokens (JWT) + local bcrypt password salting
- **File Upload Parsing:** Multer buffers + Gemini OCR vision parsing fallbacks
