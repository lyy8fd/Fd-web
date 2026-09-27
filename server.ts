import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PASSCODE = 'lyyfhmw3';

// Increase payload limit for image & audio uploads (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const audioDir = path.join(publicDir, 'audio');

// Ensure directories exist
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// Serve static files from /public (for /audio/* and /uploads/*)
app.use(express.static(publicDir));

// In-memory / file-based persistent configuration
const dataFilePath = path.join(__dirname, 'site-data.json');

export interface RecentVisitor {
  id: string;
  device: string;
  time: number;
}

export interface SiteConfig {
  coverImage?: string;
  avatarImage?: string;
  audioUrl?: string;
  audioTitle?: string;
  visits: number;
  uniqueVisitors: string[];
  recentVisitors: RecentVisitor[];
}

let siteConfig: SiteConfig = {
  coverImage: '/cover.jpg',
  avatarImage: '/avatar.png',
  audioUrl: '/audio/chicago.mp3',
  audioTitle: 'Michael Jackson - Chicago',
  visits: 1,
  uniqueVisitors: [],
  recentVisitors: [],
};

// Helper: Parse friendly device name from User-Agent
function parseDevice(ua: string): string {
  if (/iPhone/i.test(ua)) return 'هاتف iPhone';
  if (/iPad/i.test(ua)) return 'جهاز iPad';
  if (/Android/i.test(ua)) return 'هاتف Android';
  if (/Macintosh|Mac OS/i.test(ua)) return 'جهاز Mac';
  if (/Windows/i.test(ua)) return 'كمبيوتر Windows';
  if (/Linux/i.test(ua)) return 'نظام Linux';
  return 'متصفح ويب';
}

// Load saved config if exists
try {
  if (fs.existsSync(dataFilePath)) {
    const raw = fs.readFileSync(dataFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    siteConfig = {
      ...siteConfig,
      ...parsed,
      // Ensure monotonic visits: visits never drop
      visits: Math.max(parsed.visits || 1, 1),
      uniqueVisitors: Array.isArray(parsed.uniqueVisitors) ? parsed.uniqueVisitors : [],
      recentVisitors: Array.isArray(parsed.recentVisitors) ? parsed.recentVisitors : [],
    };
  }
} catch {
  // Use default
}

const saveConfig = () => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(siteConfig, null, 2));
  } catch (err) {
    console.error('Error saving site-data.json:', err);
  }
};

// Helper: Save Base64 data to disk in /public/uploads/ and return public URL
function saveBase64File(base64Data: string, prefix: string): string {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Data;
    }

    const mimeType = matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');
    let ext = 'bin';

    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('audio/mpeg') || mimeType.includes('mp3')) ext = 'mp3';
    else if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else if (mimeType.includes('m4a') || mimeType.includes('mp4')) ext = 'm4a';

    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, dataBuffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Failed to save base64 file to disk:', err);
    return base64Data;
  }
}

// API: Get global site config
app.get('/api/config', (_req, res) => {
  res.json(siteConfig);
});

// API: Save global site config (Protected by PASSCODE, saved permanently)
app.post('/api/config', (req, res) => {
  const { passcode, coverImage, avatarImage, audioUrl, audioTitle } = req.body;

  if (passcode !== PASSCODE) {
    res.status(403).json({ error: 'Unauthorized passcode' });
    return;
  }

  if (coverImage !== undefined) {
    if (coverImage.startsWith('data:image/')) {
      siteConfig.coverImage = saveBase64File(coverImage, 'cover');
    } else {
      siteConfig.coverImage = coverImage;
    }
  }

  if (avatarImage !== undefined) {
    if (avatarImage.startsWith('data:image/')) {
      siteConfig.avatarImage = saveBase64File(avatarImage, 'avatar');
    } else {
      siteConfig.avatarImage = avatarImage;
    }
  }

  if (audioUrl !== undefined) {
    if (audioUrl.startsWith('data:audio/')) {
      siteConfig.audioUrl = saveBase64File(audioUrl, 'audio');
    } else {
      siteConfig.audioUrl = audioUrl;
    }
  }

  if (audioTitle !== undefined) {
    siteConfig.audioTitle = audioTitle;
  }

  saveConfig();
  res.json({ success: true, config: siteConfig });
});

// API: Increment and record real visitor
app.post('/api/visit', (req, res) => {
  const body = req.body || {};
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || '';
  
  // Deterministic or client-provided unique visitor ID
  const visitorId: string = body.visitorId || Buffer.from(`${ip}_${ua}`).toString('base64').substring(0, 16);
  const deviceName: string = body.device || parseDevice(ua);

  if (!Array.isArray(siteConfig.uniqueVisitors)) {
    siteConfig.uniqueVisitors = [];
  }
  if (!Array.isArray(siteConfig.recentVisitors)) {
    siteConfig.recentVisitors = [];
  }

  const isNew = !siteConfig.uniqueVisitors.includes(visitorId);
  if (isNew) {
    siteConfig.uniqueVisitors.push(visitorId);
  }

  // Monotonic rule: visits MUST always be >= previous visits, and increases permanently
  const prevVisits = typeof siteConfig.visits === 'number' ? siteConfig.visits : 1;
  const newVisits = isNew ? Math.max(prevVisits + 1, siteConfig.uniqueVisitors.length) : prevVisits;
  siteConfig.visits = Math.max(newVisits, 1);

  // Update recent visitors log
  const existingIndex = siteConfig.recentVisitors.findIndex((v) => v.id === visitorId.substring(0, 8));
  if (existingIndex !== -1) {
    siteConfig.recentVisitors.splice(existingIndex, 1);
  }

  siteConfig.recentVisitors.unshift({
    id: visitorId.substring(0, 8),
    device: deviceName,
    time: Date.now(),
  });

  // Keep last 25 recent visitors
  if (siteConfig.recentVisitors.length > 25) {
    siteConfig.recentVisitors = siteConfig.recentVisitors.slice(0, 25);
  }

  saveConfig();

  res.json({
    visits: siteConfig.visits,
    uniqueCount: siteConfig.uniqueVisitors.length,
    recentVisitors: siteConfig.recentVisitors,
  });
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// 1. Chat endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history, modelName } = req.body;
    const model = modelName || 'gemini-3.5-flash';
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: 'You are DIVO AI Assistant, the official bilingual (Arabic & English) intelligent assistant for DIVO (@lyy8f) official platform. Be helpful, concise, and professional.',
      },
      history: history || [],
    });
    const result = await chat.sendMessage({ message });
    res.json({ response: result.text });
  } catch (err: any) {
    console.error('Chat AI error:', err);
    res.status(500).json({ error: err.message || 'AI chat failed' });
  }
});

// 2. Search Grounding endpoint
app.post('/api/ai/search', async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    res.json({
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    });
  } catch (err: any) {
    console.error('Search grounding error:', err);
    res.status(500).json({ error: err.message || 'Search grounding failed' });
  }
});

// 3. Maps Grounding endpoint
app.post('/api/ai/maps', async (req, res) => {
  try {
    const { prompt, userLocation } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: userLocation ? {
          retrievalConfig: {
            latLng: userLocation
          }
        } : undefined
      },
    });
    res.json({
      text: response.text,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata || {},
    });
  } catch (err: any) {
    console.error('Maps grounding error:', err);
    res.status(500).json({ error: err.message || 'Maps grounding failed' });
  }
});

// 4. Image Generation endpoint
app.post('/api/ai/image', async (req, res) => {
  try {
    const { prompt, referenceImageBase64 } = req.body;
    const parts: any[] = [{ text: prompt }];
    if (referenceImageBase64) {
      const match = referenceImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: { parts },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error('No image generated by model');
    }

    res.json({ imageUrl });
  } catch (err: any) {
    console.error('Image generation error:', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// 5. Video Generation endpoint (Veo)
app.post('/api/ai/video', async (req, res) => {
  try {
    const { prompt, imageBase64, aspectRatio = '16:9' } = req.body;
    let operation: any = null;

    if (imageBase64) {
      const match = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (match) {
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: prompt || 'Animate this image into a cinematic video',
          image: {
            imageBytes: match[2],
            mimeType: match[1],
          },
          config: {
            aspectRatio: aspectRatio,
            durationSeconds: 5,
          }
        });
      }
    } else {
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          aspectRatio: aspectRatio,
          durationSeconds: 5,
        }
      });
    }

    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    res.json({ videoUri });
  } catch (err: any) {
    console.error('Video generation error:', err);
    res.status(500).json({ error: err.message || 'Video generation failed' });
  }
});

// 6. Music Generation endpoint (Lyria)
app.post('/api/ai/music', async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await ai.models.generateContent({
      model: 'lyria-3-clip-preview',
      contents: prompt,
    });
    let audioBase64 = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        audioBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }
    res.json({ audioBase64, text: response.text });
  } catch (err: any) {
    console.error('Music generation error:', err);
    res.status(500).json({ error: err.message || 'Music generation failed' });
  }
});

// 7. Audio Transcription endpoint
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    const match = audioBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid audio data');

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          }
        },
        { text: 'Transcribe this audio accurately word for word.' }
      ]
    });

    res.json({ transcription: response.text });
  } catch (err: any) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
