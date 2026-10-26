// src/routes/learning.ts — Dynamic Learning Challenge Generator for Nilesh
import { Router } from 'express';
import type { Request, Response } from 'express';
import { streamChatCompletion } from '../providers/index.ts';

const router = Router();

// ─── Topic catalogue ─────────────────────────────────────────────────────────

const TOPIC_MAP: Record<string, string> = {
  python:          'Python programming',
  javascript:      'JavaScript (ES6+) programming',
  java:            'Java programming',
  c:               'C programming',
  cpp:             'C++ programming',
  sql:             'SQL and relational databases',
  react:           'React.js frontend development',
  nodejs:          'Node.js and Express.js backend development',
  dsa:             'Data Structures and Algorithms',
  'machine-learning': 'Machine Learning and scikit-learn',
  'data-science':  'Data Science with NumPy, pandas, and Matplotlib',
  mern:            'Full-stack MERN (MongoDB, Express, React, Node.js)',
  'html-css':      'HTML and CSS web design',
  mongodb:         'MongoDB and NoSQL databases',
};

const DIFFICULTY_MAP: Record<string, string> = {
  medium:   'medium difficulty — requires thinking but achievable in ~15–30 min',
  hard:     'hard difficulty — multi-concept problem, ~30–60 min, needs careful design',
  advanced: 'advanced / competitive-programming level — may take 1–2 hours, involves complex algorithms or system design',
};

// ─── POST /api/learning/stream — Stream a challenge ───────────────────────────

router.post('/learning/stream', async (req: Request, res: Response) => {
  const { topic = 'python', difficulty = 'medium', language } = req.body as {
    topic?: string;
    difficulty?: 'medium' | 'hard' | 'advanced';
    language?: string;
  };

  const topicLabel = TOPIC_MAP[topic] ?? topic;
  const diffLabel  = DIFFICULTY_MAP[difficulty] ?? difficulty;
  const langNote   = language ? ` Use ${language} for all code examples.` : '';

  const prompt = `You are Nilesh, an expert programming mentor. Generate a ${diffLabel} coding challenge on the topic: **${topicLabel}**.${langNote}

Structure your response in this EXACT format with these section headers:

## 🎯 Problem Title
[A concise, catchy problem title]

## 📋 Problem Statement
[Clear, unambiguous problem description. Include context, input/output format, and what needs to be solved.]

## 📌 Examples
**Example 1:**
- Input: [input]
- Output: [output]
- Explanation: [why]

**Example 2:**
- Input: [input]
- Output: [output]

## ⚙️ Constraints
- [List 3-6 constraints: data size, value ranges, time limits, edge cases]

## 💡 Hints
**Hint 1 (Gentle nudge):** [Do not give away the approach, just hint]
**Hint 2 (Direction):** [Suggest the algorithmic pattern or data structure]
**Hint 3 (Detailed):** [Explain the key insight needed]

## ✅ Solution
\`\`\`${language || (topic === 'python' || topic === 'data-science' || topic === 'machine-learning' ? 'python' : topic === 'java' ? 'java' : topic === 'c' ? 'c' : topic === 'cpp' ? 'cpp' : 'javascript')}
[Complete, working, well-commented solution code]
\`\`\`

## 🧠 Explanation
[Step-by-step walkthrough of the solution logic]

## ⏱️ Complexity Analysis
- **Time Complexity:** O(...) — [explain why]
- **Space Complexity:** O(...) — [explain why]

## 🧪 Test Cases
| Input | Expected Output |
|-------|----------------|
| [input 1] | [output 1] |
| [input 2] | [output 2] |
| [edge case] | [output] |

## ⚠️ Common Mistakes
- [3-4 mistakes beginners make on this type of problem]

## 🚀 Follow-up Challenges
- [2-3 harder variations or related problems to explore next]`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    await streamChatCompletion(
      [
        { role: 'system', content: 'You are Nilesh, an expert programming mentor and educator.' },
        { role: 'user', content: prompt },
      ],
      {
        model: process.env.AI_MODEL || 'gemini-3.8-flash',
        temperature: 0.7,
        maxTokens: 4096,
      },
      {
        onChunk: (chunk: string) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
      }
    );
    res.write('data: [DONE]\n\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

// ─── GET /api/learning/topics — List available topics ────────────────────────

router.get('/learning/topics', (_req, res) => {
  res.json({
    topics: Object.entries(TOPIC_MAP).map(([id, label]) => ({ id, label })),
    difficulties: [
      { id: 'medium',   label: 'Medium',   desc: '~15–30 min, clear concepts' },
      { id: 'hard',     label: 'Hard',     desc: '~30–60 min, multi-concept' },
      { id: 'advanced', label: 'Advanced', desc: '1–2 hours, competitive-level' },
    ],
  });
});

export default router;
