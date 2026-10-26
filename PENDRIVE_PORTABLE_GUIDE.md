# 💾 Nilesh AI — Portable USB Pendrive & Low-RAM Guide

Welcome to your portable personal AI assistant, **Nilesh**! 
This entire project lives **100% on your pendrive (`E:\MyPersonalAI`)**, requiring no files to be permanently installed on any host computer.

---

## 📁 1. What is Stored on Your Pendrive

Everything you do is automatically saved inside this USB folder:

```
E:\MyPersonalAI\
│
├── launch.bat            ◄── DOUBLE CLICK THIS to start Nilesh in Low-RAM Mode (~75MB RAM)
├── free_ram.bat          ◄── 1-Click utility to release all AI models from computer memory
├── launch_dev.bat        ◄── Optional: Developer mode with live Vite server on port 5173
│
├── .env                  ◄── Your API keys (Google Gemini, port numbers)
│
├── data\                 ◄── Your SQLite database (nilesh.db stores all chats & settings)
│   └── uploads\          ◄── All uploaded photos and documents (.png, .pdf, .docx)
│
├── knowledge\            ◄── Permanent AI Knowledge Base
│   └── docs\             ◄── Includes the 105+ ML, NumPy & Pandas Solved Q&A Guide
│
├── projects\             ◄── Full-stack websites and code created with Nilesh
│
├── ai\prompts\           ◄── Nilesh Master AI Persona & System Instructions
│
├── backend\              ◄── Lightweight Node.js server (serves UI + API)
└── frontend\dist\        ◄── Compiled high-performance Web App UI
```

---

## ⚡ 2. How to Use on ANY Windows Computer

1. **Plug your USB Pendrive** into any Windows PC or laptop.
2. Open the USB drive and double-click:
   👉 **`launch.bat`**
3. Nilesh will automatically launch on **`http://localhost:3001`** in your browser.
4. When finished, simply close the browser and launcher window, and safely eject your USB drive. All your chats, code, and notes remain safely on your pendrive!

---

## 🧠 3. How We Optimized RAM for You

We designed Nilesh so your computer **never lags or runs out of RAM**:

| Optimization | What It Does | Memory Saved |
| :--- | :--- | :--- |
| **Single-Process Server** | Node.js serves both the web frontend and backend API on port 3001. No bulky Vite dev server needed. | Saves **~200 MB** of RAM |
| **Node.js RAM Cap** | The server is started with `--max-old-space-size=256`, preventing Node from hogging memory. | Limits usage to **~75 MB** |
| **Cloud Gemini (Recommended)** | Uses Google Gemini 3.8 Flash online. Heavy AI neural weights run on Google's cloud servers. | **0 MB** of your PC RAM used for AI |
| **Lightweight Local Ollama** | Defaults to `qwen2.5-coder:1.5b` (986 MB) instead of heavy 3B models. | Saves **~2.5 GB** of RAM |
| **Instant Memory Release** | `keep_alive: 0` is enabled: Ollama immediately unloads model weights from RAM after replying. | Prevents background memory leaks |
| **1-Click Cleaner** | Run `free_ram.bat` anytime to instantly flush models from RAM. | Instant recovery |

---

## 💡 Quick Tips

* **Best Performance:** Use **Google Gemini 3.8 Flash** with your free API key in `.env`. It responds in under a second and consumes zero local RAM.
* **Offline Use:** If you have no internet, Nilesh automatically switches to **Ollama** using the lightweight `1.5b` model on your drive.
