# MyPersonalAI — Complete User Guide

## 1. Where Is Your Project Path?

Everything is located on your **USB Pen Drive (Drive `E:`)**:

| Item | Location on USB Drive | Description |
|---|---|---|
| **Main App Root** | `E:\MyPersonalAI\` | Root directory of your AI coding assistant |
| **Generated Projects** | `E:\MyPersonalAI\projects\` | **Every website/app the AI generates lives here** |
| **Local AI Models** | `E:\MyPersonalAI\ai\models\` | Downloaded quantized model files (~2 GB) |
| **AI Prompts & Rules** | `E:\MyPersonalAI\ai\prompts\` | System prompts and engineer behavior guidelines |
| **Knowledge Base (RAG)** | `E:\MyPersonalAI\knowledge\` | Saved docs and code examples for offline lookup |
| **Backups** | `E:\MyPersonalAI\backups\` | Automated project zip snapshots |
| **Scripts** | `E:\MyPersonalAI\scripts\` | `launch.ps1`, `setup.ps1`, `backup.ps1` |

---

## 2. How to Start the AI

Whenever you want to use the AI:

### One-Click Launcher:
Open PowerShell and run:
```powershell
powershell -ExecutionPolicy Bypass -File E:\MyPersonalAI\scripts\launch.ps1
```

This will automatically:
1. Start the **Ollama local AI engine** in the background.
2. Start the **Backend API** (`http://localhost:3001`).
3. Start the **Frontend Dashboard** (`http://localhost:5173`).
4. Automatically open your browser to **`http://localhost:5173`**.

---

## 3. How to Use the AI to Build Websites

### Step 1: Open the Dashboard
Open your browser to:
```
http://localhost:5173
```

### Step 2: Create a New Project
1. In the left sidebar, click **"+ New Project"**.
2. Type a project name (e.g. `restaurant-app` or `my-portfolio`).
3. Your new project folder is automatically created inside:
   ```
   E:\MyPersonalAI\projects\restaurant-app\
   ```

### Step 3: Enter Your Prompt
In the chat box at the bottom, type what you want the AI to build in plain English. For example:

> *"Create a complete restaurant website with a food menu, shopping cart, customer order form, admin order dashboard, and MongoDB database backend."*

### Step 4: The AI Builds the Real Application
The AI doesn't just print code into chat; it:
1. **Creates a structured plan** outlining the frontend, backend, and database schema.
2. **Generates real files** inside `E:\MyPersonalAI\projects\restaurant-app\` (e.g., `package.json`, `server.js`, `models/Order.js`, `src/App.jsx`).
3. **Explains dependencies** it needs to install (e.g., `express`, `mongoose`, `cors`).
4. **Asks for your Category B permission** before running `npm install`.
5. **Starts the server** and gives you the live local URL (`http://localhost:3000` or `5174`).
6. **Monitors logs and fixes errors** if any occur.

---

## 4. Permission System & Safety

Your AI adheres to strict 3-tier permission security:

- **Category A (Automatic):** Reading project files, searching local docs, writing project code, checking error logs.
- **Category B (Asks You First):** Installing npm packages, running build scripts, uploading to online APIs.
- **Category C (Explicit Confirmation):** Deleting files, wiping databases, changing system settings.

---

## 5. Taking Your USB to Another Computer

Because the system is designed to be fully portable:
1. Plug the USB into any Windows 10/11 computer.
2. Run `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` to ensure Node and Ollama are detected.
3. Run `launch.ps1` to start coding immediately!
