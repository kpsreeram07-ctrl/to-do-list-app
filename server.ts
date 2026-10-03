import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Endpoint to check if Gemini API key is configured
app.get('/api/gemini/status', (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isAvailable = Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY');
  res.json({ available: isAvailable });
});

// Endpoint for Gemini Task Assistant chat
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(503).json({
      error: 'Gemini Assistant is unavailable. Please configure your Gemini API key in the environment or Settings > Secrets panel.',
    });
  }

  try {
    const { prompt, tasks, history } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format tasks cleanly for the AI assistant without exposing private user info
    let tasksContext = 'The user currently has no tasks on their to-do list.';
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasksContext = tasks
        .map((t: any, index: number) => {
          const status = t.completed ? 'COMPLETED' : 'INCOMPLETE';
          const priority = t.priority ? t.priority.toUpperCase() : 'MEDIUM';
          const dueDate = t.dueDate ? t.dueDate : 'No due date';
          return `${index + 1}. [${status}] "${t.text}" | Priority: ${priority} | Due Date: ${dueDate}`;
        })
        .join('\n');
    }

    const systemInstruction = `You are "✨ Gemini Task Assistant", a supportive, productivity-focused AI assistant built directly into the TaskFlow To-Do List application.
Your role is to help students and professionals organize, prioritize, schedule, and break down their tasks effectively.

Current Task List of the user:
${tasksContext}

Guidelines:
1. Always be practical, concise, and structured. Use clear formatting, bullet points, and bold text for readability.
2. If asked to prioritize, analyze due dates, deadlines, and urgency (High vs Medium vs Low) and give actionable advice.
3. If asked to break down a task or create a study/work plan, provide step-by-step milestones.
4. If asked about overdue tasks, identify any incomplete tasks with past due dates.
5. If the task list is empty and the user asks for suggestions, suggest a few practical student/work tasks to get them started.
6. Keep answers focused on productivity, time management, and task execution.`;

    const contents: any[] = [];

    // Add prior dialogue history if provided (max 6 recent messages to keep context lean)
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role && msg.text) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'I analyzed your tasks, but could not produce a response.';
    return res.json({ text: reply });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const message = error.message || 'An error occurred while generating a response.';
    return res.status(500).json({ error: message });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TaskFlow server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
