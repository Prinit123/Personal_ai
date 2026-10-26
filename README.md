# NILESH AI — MULTILINGUAL ENGLISH TEACHER, MESSAGE WRITER & VOICE ASSISTANT
> **Your Personal Language Teacher, Communication Assistant, Coding Mentor & Voice Partner**  
> Assistant Name: **Nilesh AI** | Application: **MyPersonalAI**  
> Multilingual Support: **English, Hindi (हिंदी), Gujarati (ગુજરાતી)**  
> USB Pendrive Portable · Ultra-low RAM Mode · Offline SQLite · Browser Web Speech Voice Engine

---

## 🌟 Identity & Mission

**Nilesh AI** is your all-in-one personal language teacher, communication assistant, grammar corrector, message writer, translator, voice conversation partner, and programming problem solver.

Nilesh helps you:
1. **Speak with AI naturally**: Hands-free live voice conversation in English, Hindi, and Gujarati with interrupt and repeat controls.
2. **Correct English Grammar**: Type or speak any broken sentence. Nilesh provides a patient explanation, grammar rule, and 6 communication styles (Conversational, Polite, Professional, Formal, Friendly, Short) plus Hindi and Gujarati translations.
3. **Write Ready-to-Send Messages**: Context-aware messages tailored for **Sir / Teacher, Madam, Student, Brother, Sister, Friend, Parents, Boss, Customer, and Colleague**.
4. **Compose Wishes & Greetings**: Heartwarming birthday wishes, festival greetings (Diwali, Eid, Holi, Christmas, Uttarayan), congratulations, and condolence messages.
5. **Education & Classroom Notices**: Fast templates for lecture schedule changes, class cancellations, homework reminders, sick leave notes, and requests for study material.
6. **Bidirectional Translation**: English ⇄ Hindi ⇄ Gujarati with native script and Romanized spelling (Hinglish / Gujlish).
7. **Spoken English Practice**: Interactive roleplay scenarios (Job Interviews, Speaking to Teacher, Daily Conversations, Workplace Meetings, Telephone Calls) with gentle feedback on mistakes.
8. **Saved Message Library**: Private offline template storage in SQLite (`data/nilesh.db`).
9. **Full-Stack Coding & AI/ML Tutor**: Retains full MERN stack builder, Python, NumPy, Pandas, Scikit-learn, and 100+ solved Q&A bank.

---

## 🚀 Quick Start (Running on Windows)

### Option 1: Double-Click Launcher (Recommended)
Double-click `launch.bat` in the root of your USB drive:
```bat
launch.bat
```
This automatically starts:
- **Backend API Server**: `http://localhost:3001`
- **Frontend Chat UI**: `http://localhost:5173`
- Opens your browser directly to the Nilesh chat interface!

### Option 2: Manual Terminal Startup

**Terminal 1 — Backend:**
```cmd
cd backend
node --experimental-strip-types src/index.ts
```

**Terminal 2 — Frontend:**
```cmd
cd frontend
node node_modules/vite/bin/vite.js --port 5173
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 AI Model Configuration

Nilesh supports both online cloud providers and offline local inference.

### 1. Google Gemini API (Recommended)
- **Why Gemini**: Extremely fast, low RAM footprint, large context window, and exceptional at generating full MERN stack applications.
- **Get a Free Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and generate a free API key.
- **Setup**:
  - Open the chat interface at `http://localhost:5173`, click **Settings**, paste your key, and click **Save & Apply**.
  - Or add it to your `.env` file:
    ```env
    AI_PROVIDER=gemini
    AI_MODEL=gemini-3.8-flash
    AI_API_KEY=your_gemini_api_key_here
    ```

### 2. Local Offline Models (Ollama)
- **Offline & Private**: Runs on your computer without internet access.
- **Requirement**: Requires 8GB+ of free system memory / paging file and [Ollama](https://ollama.ai) installed.
- **Setup**:
  ```cmd
  ollama serve
  ollama pull qwen2.5-coder:3b
  ```
  In `.env`:
  ```env
  AI_PROVIDER=ollama
  AI_MODEL=qwen2.5-coder:3b
  OLLAMA_BASE_URL=http://127.0.0.1:11434
  ```

---

## 🏗️ Generating Full-Stack MERN Websites

When you request a project such as:
> *"Create a complete website for KICT computer classes with course listings, course prices in INR, student registration, inquiry forms, pass-out student records, and nine Ahmedabad branches."*

Nilesh will:
1. Analyze your requirements and design the complete MERN architecture.
2. Generate all required files formatted with:
   ````markdown
   ```language:relative/path/to/file.ext
   // complete working code
   ```
   ````
3. The chat interface will automatically detect the generated code blocks and display a **"Project Files Generated"** review card.
4. Click **Review & Save Files**, verify the planned files in the interactive preview modal, choose a target directory (e.g., `projects/kict-website`), and click **Approve & Write**.
5. All approved files are safely written to your USB drive workspace with zero unauthorized command executions.

---

## 🔒 Security & Safe Workspace Rules

- **No Secrets in Frontend**: Secret API keys are stored only in the backend `.env` file and never bundled into frontend assets.
- **Safe File Writing**: All file writing operations are isolated strictly to the `projects/` directory with path traversal protection.
- **No Unapproved Shell Execution**: The system requires explicit user confirmation before writing files.

---

## 📁 Directory Structure

```
MyPersonalAI/
├── .env                  # Environment configuration (ignored in git)
├── .env.example          # Configuration template
├── launch.bat            # Windows one-click startup script
├── backend/              # Node.js + Express backend
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── db.ts         # Portable SQLite storage (data/nilesh.db)
│   │   ├── providers/    # Unified AI providers (Gemini, OpenAI, Ollama)
│   │   └── routes/       # API endpoints (/api/chat, /api/projects, etc.)
│   └── package.json
├── frontend/             # React + Vite chat interface
│   ├── src/
│   │   ├── App.tsx       # Main ChatGPT-style chat layout
│   │   ├── index.css     # Clean responsive styling & themes
│   │   ├── components/   # ChatPanel, Sidebar, SettingsModal, FileReviewModal
│   │   └── hooks/        # useChat hook with SSE streaming
│   └── package.json
├── data/                 # SQLite database & conversations
└── projects/             # Workspace where generated MERN projects are saved
```
