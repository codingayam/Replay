# Replay Multi-User Cloud Deployment Plan

## Executive Summary

This document outlines the complete transformation of Replay from a local single-user journaling app into a secure, scalable multi-user cloud application. The plan leverages modern managed services for rapid deployment while ensuring proper security and tenant isolation.

## Target Architecture

### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite → Vercel/Netlify/Cloudflare Pages
- **Authentication**: Supabase Auth (magic links + Google/Apple OAuth)
- **Database**: Supabase Postgres with Row-Level Security (RLS)
- **Storage**: Supabase Storage buckets (private, signed URLs)
- **API**: Express.js server → Railway/Render/Fly.io
- **Background Jobs**: BullMQ + Upstash Redis (serverless Redis)
- **Monitoring**: Pino logs + Sentry error tracking

### Architecture Benefits
- **Cost-effective**: Managed services reduce operational overhead
- **Scalable**: Independent scaling of frontend, API, and workers
- **Secure**: RLS provides bulletproof tenant isolation
- **Fast**: CDN delivery for frontend, optimized for global users

## Current Code Analysis

### Files Requiring Updates
Based on codebase analysis, these files contain hardcoded `localhost:3001` URLs:
1. `/client/src/pages/ExperiencesPage.tsx`
2. `/client/src/pages/ReflectionsPage.tsx`
3. `/client/src/components/ExperienceSelectionModal.tsx`
4. `/client/src/components/ReflectionSummaryModal.tsx`
5. `/client/src/components/MeditationPlayer.tsx`
6. `/client/src/pages/ProfilePage.tsx`
7. `/client/src/components/NoteCard.tsx`

### Architecture Assessment
✅ **Strong Foundation**:
- Clean separation between frontend/backend
- Well-structured Express API routes
- Proper file handling patterns
- Good use of AI APIs (Gemini + OpenAI)

⚠️ **Areas Needing Updates**:
- Single-user file-based storage → Multi-tenant database
- Direct file serving → Signed URL storage
- Synchronous AI processing → Background jobs
- No authentication → JWT-based auth

## Implementation Plan

### Phase 1: Infrastructure Setup

#### 1.1 Supabase Setup
```bash
# Create new Supabase project
# Choose region closest to your target users (e.g., Singapore for APAC)
```

**Database Schema**:
```sql
-- Enable RLS
alter database postgres set row_security = on;

-- User profiles
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  values text,
  mission text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_own" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notes (supports both audio and photo)
create type note_type as enum ('audio','photo');
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  transcript text,
  original_caption text,
  type note_type not null,
  audio_path text,     -- Supabase storage path
  image_path text,     -- Supabase storage path
  created_at timestamptz default now()
);
create index on public.notes (user_id, created_at desc);
alter table public.notes enable row level security;
create policy "notes_own" on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Meditations
create table public.meditations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  playlist jsonb not null,  -- [{type:'speech'|'pause', audioPath?:string, duration?:number}]
  note_ids uuid[] not null,
  duration integer not null,
  created_at timestamptz default now()
);
create index on public.meditations (user_id, created_at desc);
alter table public.meditations enable row level security;
create policy "meditations_own" on public.meditations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**Storage Buckets** (create in Supabase Dashboard):
- `images` (private)
- `audio` (private) 
- `tts` (private)

#### 1.2 Environment Variables
**Server**:
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Service role key (server-only)

# AI APIs
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Background Jobs
REDIS_URL=redis://...  # Upstash Redis URL

# Security
PORT=3001
CORS_ALLOWED_ORIGIN=https://app.yourdomain.com
```

**Client**:
```env
# API
VITE_API_BASE_URL=https://api.yourdomain.com

# Supabase (public keys)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... # Anon key (safe for client)
```

### Phase 2: Authentication & Multi-Tenancy

#### 2.1 Frontend Authentication
**Install Dependencies**:
```bash
cd client
npm install @supabase/supabase-js
```

**Supabase Client** (`client/src/lib/supabase.ts`):
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  { 
    auth: { 
      persistSession: true, 
      autoRefreshToken: true 
    } 
  }
);
```

**API Client with Auth** (`client/src/lib/api.ts`):
```typescript
import axios from 'axios';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3001';

export const api = {
  url: API_BASE,
  path: (p: string) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`,
};

// Authenticated HTTP client
export const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Simple Auth Component** (`client/src/components/Auth.tsx`):
```typescript
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    
    if (error) alert(error.message);
    else alert('Check your email for the login link!');
    
    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin} style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Welcome to Replay</h2>
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
      />
      <button 
        type="submit" 
        disabled={loading}
        style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none' }}
      >
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
```

#### 2.2 Backend Authentication
**Install Dependencies**:
```bash
cd server
npm install @supabase/supabase-js pino cors helmet express-rate-limit bullmq ioredis
```

**Auth Middleware** (`server/auth.js`):
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireUser(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = { id: data.user.id };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = { requireUser, supabase };
```

### Phase 3: Storage Migration

#### 3.1 Storage Helper (`server/storage.js`):
```javascript
const { createClient } = require('@supabase/supabase-js');
const { v4: uuid } = require('uuid');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadBuffer(bucket, userId, buffer, contentType, ext) {
  const key = `${userId}/${uuid()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, buffer, { 
      contentType, 
      upsert: false 
    });
  
  if (error) throw error;
  return key;
}

async function signUrl(bucket, key, expiresInSec = 600) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, expiresInSec);
  
  if (error) throw error;
  return data.signedUrl;
}

async function deleteFile(bucket, key) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([key]);
  
  if (error) console.error('Failed to delete file:', error);
}

module.exports = { uploadBuffer, signUrl, deleteFile };
```

#### 3.2 Database Helper (`server/db.js`):
```javascript
const { supabase } = require('./auth');

class Database {
  // Notes
  async createNote(data) {
    const { data: result, error } = await supabase
      .from('notes')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  async getNotes(userId, noteIds = null) {
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (noteIds) {
      query = query.in('id', noteIds);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async updateNote(noteId, updates) {
    const { error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', noteId);
    
    if (error) throw error;
  }

  async deleteNote(noteId) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);
    
    if (error) throw error;
  }

  // Profile
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || { name: '', values: '', mission: '' };
  }

  async upsertProfile(userId, profile) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, ...profile });
    
    if (error) throw error;
  }

  // Meditations
  async createMeditation(data) {
    const { data: result, error } = await supabase
      .from('meditations')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  async getMeditations(userId) {
    const { data, error } = await supabase
      .from('meditations')
      .select('id, title, created_at, note_ids, summary, duration')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async getMeditation(meditationId) {
    const { data, error } = await supabase
      .from('meditations')
      .select('*')
      .eq('id', meditationId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteMeditation(meditationId) {
    const { error } = await supabase
      .from('meditations')
      .delete()
      .eq('id', meditationId);
    
    if (error) throw error;
  }
}

module.exports = new Database();
```

#### 3.3 Media Proxy Route (`server/routes/media.js`):
```javascript
const express = require('express');
const { requireUser } = require('../auth');
const { signUrl } = require('../storage');

const router = express.Router();

// GET /api/media/:bucket/* -> 302 redirect to signed URL
router.get('/:bucket/*', requireUser, async (req, res) => {
  try {
    const { bucket } = req.params;
    const key = req.params[0]; // rest of the path
    
    // Security: ensure the key starts with user's ID
    if (!key.startsWith(`${req.user.id}/`)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const signedUrl = await signUrl(bucket, key, 300); // 5 minutes
    res.redirect(signedUrl);
  } catch (error) {
    console.error('Media access error:', error);
    res.status(404).json({ error: 'Media not found' });
  }
});

module.exports = router;
```

### Phase 4: Background Job Processing

#### 4.1 Queue Setup (`server/queue.js`):
```javascript
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

const jobQueue = new Queue('replay-jobs', { connection });

async function enqueue(jobName, payload, options = {}) {
  await jobQueue.add(jobName, payload, {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    ...options
  });
}

module.exports = { jobQueue, enqueue, connection };
```

#### 4.2 AI Services (`server/ai.js`):
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const fs = require('fs/promises');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeAudio(audioUrl) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  // Download audio file
  const response = await fetch(audioUrl);
  const audioBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString('base64');
  
  const audioPart = {
    inlineData: {
      data: audioBase64,
      mimeType: 'audio/wav',
    },
  };
  
  const result = await model.generateContent([
    "Please transcribe this audio.", 
    audioPart
  ]);
  
  return result.response.text();
}

async function generateTitle(content) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const result = await model.generateContent(
    `Generate a single, short, concise title (4-5 words max) for the following journal entry. Do not provide a list of options. Just provide one title.\n\n"${content}"`
  );
  
  return result.response.text().replace(/"/g, '').trim();
}

async function enhancePhotoCaption(imageUrl, userCaption) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  // Download and encode image
  const response = await fetch(imageUrl);
  const imageBuffer = await response.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');
  
  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg', // Adjust based on actual type
    },
  };
  
  const result = await model.generateContent([
    "Describe this photo with the help of this caption.",
    `User's caption: "${userCaption}"`,
    imagePart
  ]);
  
  return result.response.text();
}

async function generateMeditationScript(notes, profile, duration) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const transcripts = notes.map(n => n.transcript).join('\n\n---\n\n');
  
  const prompt = `
You are an experienced meditation practitioner. Create a ${duration}-minute meditation session from these experiences. Use [PAUSE=Xs] for pauses where X is seconds.

Guidelines:
- Keep to exactly ${duration} minutes total
- Include appropriate pauses throughout
- Natural beginning and ending transitions
- Only mention values that naturally connect to experiences

User Context:
- Name: ${profile.name || 'User'}
- Core Values: ${profile.values || 'Not specified'}
- Life Mission: ${profile.mission || 'Not specified'}

Selected Experiences:
---
${transcripts}
---

Please begin the ${duration}-minute guided meditation script now.
  `;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateTextToSpeech(text) {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova", // Calm, soothing voice
    input: text,
    response_format: "wav",
    speed: 0.9, // Slightly slower for meditation
  });
  
  return Buffer.from(await response.arrayBuffer());
}

async function generateSummary(notes, duration) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const transcripts = notes.map(n => n.transcript).join('\n\n---\n\n');
  
  const prompt = `
You have just completed a ${duration}-minute guided reflection session based on these personal experiences:

---
${transcripts}
---

Generate a short, concise summary (2-3 sentences) that captures:
1. The main themes or feelings explored during the reflection
2. Key insights or emotional patterns that emerged  
3. A gentle acknowledgment of the person's inner journey

The summary should be warm, supportive, and provide closure to the reflection experience.
  `;
  
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = {
  transcribeAudio,
  generateTitle,
  enhancePhotoCaption,
  generateMeditationScript,
  generateTextToSpeech,
  generateSummary
};
```

#### 4.3 Worker Process (`server/worker.js`):
```javascript
const { Worker } = require('bullmq');
const { connection } = require('./queue');
const db = require('./db');
const { signUrl, uploadBuffer } = require('./storage');
const {
  transcribeAudio,
  generateTitle,
  enhancePhotoCaption,
  generateMeditationScript,
  generateTextToSpeech,
  generateSummary
} = require('./ai');

const worker = new Worker('replay-jobs', async (job) => {
  console.log(`Processing job: ${job.name}`);
  
  try {
    switch (job.name) {
      case 'transcribe-audio':
        await handleAudioTranscription(job.data);
        break;
        
      case 'enhance-photo':
        await handlePhotoEnhancement(job.data);
        break;
        
      case 'generate-meditation':
        await handleMeditationGeneration(job.data);
        break;
        
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  } catch (error) {
    console.error(`Job ${job.name} failed:`, error);
    throw error;
  }
}, { connection });

async function handleAudioTranscription({ userId, noteId, audioPath }) {
  // Get signed URL for audio file
  const audioUrl = await signUrl('audio', audioPath, 300);
  
  // Transcribe audio
  const transcript = await transcribeAudio(audioUrl);
  
  // Generate title
  const title = await generateTitle(transcript);
  
  // Update note
  await db.updateNote(noteId, { 
    transcript, 
    title: title || 'Untitled Note'
  });
}

async function handlePhotoEnhancement({ userId, noteId, imagePath, originalCaption }) {
  // Get signed URL for image
  const imageUrl = await signUrl('images', imagePath, 300);
  
  // Enhance caption
  const enhancedCaption = await enhancePhotoCaption(imageUrl, originalCaption);
  
  // Generate title
  const title = await generateTitle(enhancedCaption);
  
  // Update note
  await db.updateNote(noteId, {
    transcript: enhancedCaption,
    title: title || 'Untitled Photo'
  });
}

async function handleMeditationGeneration({ userId, noteIds, duration }) {
  // Get notes and profile
  const notes = await db.getNotes(userId, noteIds);
  const profile = await db.getProfile(userId);
  
  // Generate meditation script
  const script = await generateMeditationScript(notes, profile, duration);
  
  // Parse script and create audio segments
  const segments = script.split(/(\[PAUSE=\d+s\])/g).filter(s => s.trim() !== '');
  const playlist = [];
  
  for (const segment of segments) {
    if (segment.startsWith('[PAUSE=')) {
      const duration = parseInt(segment.match(/\d+/)[0], 10);
      playlist.push({ type: 'pause', duration });
    } else {
      const cleanText = segment.replace(/\n/g, ' ').trim();
      if (cleanText) {
        // Generate TTS
        const audioBuffer = await generateTextToSpeech(cleanText);
        
        // Upload to storage
        const audioPath = await uploadBuffer('tts', userId, audioBuffer, 'audio/wav', 'wav');
        
        playlist.push({ 
          type: 'speech', 
          audioPath,
          audioUrl: `/api/media/tts/${audioPath}` // Proxy URL
        });
      }
    }
  }
  
  // Generate summary
  const summary = await generateSummary(notes, duration);
  
  // Save meditation
  await db.createMeditation({
    user_id: userId,
    title: `${duration}-min Reflection - ${new Date().toLocaleDateString()}`,
    summary,
    playlist,
    note_ids: noteIds,
    duration
  });
}

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
});

console.log('Worker started');
```

### Phase 5: Frontend Updates

#### 5.1 Update All API Calls
Replace all instances of `http://localhost:3001/api` with the new authenticated client:

**Example - ExperiencesPage.tsx**:
```typescript
// OLD
const res = await axios.get(`${API_URL}/notes`);

// NEW  
const res = await http.get('/api/notes');
```

#### 5.2 Protected App Component (`client/src/App.tsx`):
```typescript
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import BottomTabNavigation from './components/BottomTabNavigation';
import Auth from './components/Auth';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <Router>
      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<ExperiencesPage />} />
          <Route path="/reflections" element={<ReflectionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
      <BottomTabNavigation />
    </Router>
  );
}

const styles = {
  main: {
    padding: '1rem',
    maxWidth: '800px',
    margin: '0 auto',
    minHeight: '100vh',
    paddingBottom: '100px',
  }
};

export default App;
```

### Phase 6: Production Deployment

#### 6.1 Server Hardening (`server/server.js`):
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino-http');

const { requireUser } = require('./auth');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ 
  origin: process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true 
}));

// Logging
app.use(pino());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
  message: 'Too many requests from this IP'
}));

// Body parsing
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/healthz', (req, res) => res.send('ok'));

// Routes
app.use('/api/notes', requireUser, require('./routes/notes'));
app.use('/api/profile', requireUser, require('./routes/profile'));
app.use('/api/reflect', requireUser, require('./routes/reflect'));
app.use('/api/meditate', requireUser, require('./routes/meditate'));
app.use('/api/meditations', requireUser, require('./routes/meditations'));
app.use('/api/media', require('./routes/media'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

#### 6.2 Deployment Configuration

**Railway** (`railway.toml`):
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/healthz"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"

[[services]]
name = "api"
source = "server"

[[services]]
name = "worker"
source = "server"
startCommand = "node worker.js"
```

**Vercel** (`vercel.json`):
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/dist",
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Phase 7: Data Migration & Operations

#### 7.1 Migration Script (`tools/migrate.js`):
```javascript
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_USER_ID = 'YOUR_USER_ID_HERE'; // Get this after creating account

async function uploadFile(bucket, userId, filePath, contentType, ext) {
  const buffer = await fs.readFile(filePath);
  const key = `${userId}/${require('uuid').v4()}.${ext}`;
  
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, buffer, { contentType });
  
  if (error) throw error;
  return key;
}

async function migrateData() {
  try {
    // Read local data files
    const notesData = JSON.parse(
      await fs.readFile('./server/data/notes.json', 'utf8')
    );
    const profileData = JSON.parse(
      await fs.readFile('./server/data/profile.json', 'utf8')
    );
    const meditationsData = JSON.parse(
      await fs.readFile('./server/data/meditations.json', 'utf8')
    );

    // Migrate profile
    await supabase.from('profiles').upsert({
      user_id: TARGET_USER_ID,
      ...profileData
    });
    console.log('✅ Profile migrated');

    // Migrate notes
    for (const note of notesData) {
      let audio_path = null;
      let image_path = null;

      // Upload media files
      if (note.audioUrl) {
        const localPath = `./server/data${note.audioUrl}`;
        audio_path = await uploadFile('audio', TARGET_USER_ID, localPath, 'audio/wav', 'wav');
      }
      
      if (note.imageUrl) {
        const localPath = `./server/data${note.imageUrl}`;
        const ext = path.extname(localPath).slice(1);
        image_path = await uploadFile('images', TARGET_USER_ID, localPath, `image/${ext}`, ext);
      }

      // Insert note record
      await supabase.from('notes').insert({
        id: note.id,
        user_id: TARGET_USER_ID,
        type: note.type,
        title: note.title,
        transcript: note.transcript,
        original_caption: note.originalCaption || null,
        audio_path,
        image_path,
        created_at: note.date
      });
    }
    console.log(`✅ ${notesData.length} notes migrated`);

    // Migrate meditations (simplified - you may need to recreate TTS files)
    for (const meditation of meditationsData) {
      await supabase.from('meditations').insert({
        id: meditation.id,
        user_id: TARGET_USER_ID,
        title: meditation.title,
        summary: meditation.summary || '',
        playlist: meditation.playlist || [],
        note_ids: meditation.noteIds || [],
        duration: meditation.duration || 5,
        created_at: meditation.createdAt
      });
    }
    console.log(`✅ ${meditationsData.length} meditations migrated`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateData();
```

#### 7.2 Monitoring Setup

**Error Tracking** (Sentry):
```javascript
// server/sentry.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
});

module.exports = Sentry;
```

**Health Monitoring**:
```javascript
// server/health.js
const { supabase } = require('./auth');
const { connection } = require('./queue');

async function healthCheck() {
  const checks = {
    database: false,
    redis: false,
    storage: false
  };

  try {
    // Test database
    await supabase.from('profiles').select('user_id').limit(1);
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  try {
    // Test Redis
    await connection.ping();
    checks.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  try {
    // Test storage
    await supabase.storage.listBuckets();
    checks.storage = true;
  } catch (error) {
    console.error('Storage health check failed:', error);
  }

  return checks;
}

module.exports = { healthCheck };
```

## Additional Recommendations

### Cost Optimization

1. **Storage Lifecycle Rules**:
   - Delete raw audio files after TTS generation (30 days)
   - Compress images before storage
   - Set reasonable file size limits

2. **Rate Limiting**:
   ```javascript
   // Per-user rate limiting
   const userRateLimit = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 10, // 10 requests per minute per user
     keyGenerator: (req) => req.user?.id || req.ip,
   });
   ```

### UX Enhancements

1. **Job Status Tracking**:
   ```typescript
   // Add to types.ts
   interface JobStatus {
     id: string;
     status: 'pending' | 'processing' | 'completed' | 'failed';
     progress?: number;
     error?: string;
   }
   ```

2. **Offline Support**:
   ```typescript
   // Service worker for offline note creation
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js');
   }
   ```

3. **Progressive Loading**:
   ```typescript
   // Lazy load meditation player
   const MeditationPlayer = lazy(() => import('./MeditationPlayer'));
   ```

### Security Hardening

1. **Input Validation**:
   ```javascript
   const { body, validationResult } = require('express-validator');
   
   const validateNote = [
     body('title').trim().isLength({ min: 1, max: 100 }),
     body('transcript').optional().isLength({ max: 5000 }),
   ];
   ```

2. **File Type Validation**:
   ```javascript
   const fileFilter = (req, file, cb) => {
     const allowedTypes = ['audio/wav', 'audio/mp3', 'image/jpeg', 'image/png'];
     if (allowedTypes.includes(file.mimetype)) {
       cb(null, true);
     } else {
       cb(new Error('Invalid file type'), false);
     }
   };
   ```

### Staging Environment

1. **Supabase Branching**:
   - Create `staging` branch for development
   - Use separate environment variables
   - Test migrations before production

2. **Feature Flags**:
   ```javascript
   const FEATURES = {
     NEW_MEDITATION_UI: process.env.FEATURE_NEW_MEDITATION_UI === 'true',
     ENHANCED_TTS: process.env.FEATURE_ENHANCED_TTS === 'true',
   };
   ```

## Timeline Estimate

- **Phase 1-2**: Infrastructure & Auth (3-5 days)
- **Phase 3**: Storage Migration (2-3 days)  
- **Phase 4**: Background Jobs (3-4 days)
- **Phase 5**: Frontend Updates (2-3 days)
- **Phase 6**: Deployment (1-2 days)
- **Phase 7**: Migration & Testing (2-3 days)

**Total**: 2-3 weeks for full transformation

## Success Metrics

- ✅ Multi-user tenant isolation with RLS
- ✅ All media served via signed URLs
- ✅ Background processing for AI operations
- ✅ Sub-200ms API response times
- ✅ Zero downtime deployments
- ✅ Proper error handling and monitoring
- ✅ Cost under $50/month for 100 active users

This plan transforms Replay from a local prototype into a production-ready SaaS application while maintaining all existing functionality and adding robust security, scalability, and monitoring capabilities.