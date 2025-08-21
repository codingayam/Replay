# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Client (React + Vite + TypeScript)
Located in `client/` directory:
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript compilation then Vite build)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Server (Node.js + Express)
Located in `server/` directory:
- `node server.js` - Start production server
- `nodemon server.js` - Start development server with auto-restart (requires nodemon to be installed)
- Server runs on port 3001 by default

### Deployment Options

#### Local Development
1. Start server: `cd server && node server.js`
2. Start client: `cd client && npm run dev`
3. Access at `http://localhost:5173` (client dev server proxies API calls to localhost:3001)

#### Cloudflared Tunnel (External Access)
1. Start server: `cd server && node server.js`
2. Run tunnel: `cloudflared tunnel --url http://localhost:3001`
3. Access via the cloudflared URL provided (serves both frontend build and API)
4. Note: For cloudflared, build the client first: `cd client && npm run build`

## Architecture Overview

### Application Structure
This is a full-stack reflection and journaling application called "Replay" with:
- **Frontend**: React 19 + TypeScript + Vite client application with bottom tab navigation
- **Backend**: Node.js Express server with file-based JSON storage
- **AI Integration**: Uses Google Gemini for transcription/content generation and OpenAI for text-to-speech

### Core Features
1. **Audio & Photo Journaling**: Record daily voice notes or upload photos with captions, both transcribed and titled automatically
2. **Note Categorization**: Automatic categorization of notes into gratitude, experience, reflection, or insight based on content analysis
3. **Reflection Generation**: Creates personalized guided meditations from selected experiences using AI
4. **Profile Management**: User values and life mission stored to personalize reflections
5. **Experience Tracking**: Timeline view of both audio and photo-based experiences with category badges

### Key Components

#### Client Architecture (`client/src/`)
- **App.tsx**: Main router with bottom tab navigation between Experiences, Reflections, and Profile pages
- **pages/ExperiencesPage.tsx**: Main dashboard showing experiences timeline with both audio and photo notes
- **pages/ReflectionsPage.tsx**: Reflection generation workflow and saved meditations player
- **pages/ProfilePage.tsx**: User profile editing (name, values, mission)
- **components/AudioRecorder.tsx**: Handles microphone recording with MediaRecorder API
- **components/MeditationPlayer.tsx**: Plays generated meditation playlists (speech + pause segments)
- **components/NoteCard.tsx**: Displays individual notes with transcripts (supports both audio and photo)
- **components/BottomTabNavigation.tsx**: Bottom navigation between main app sections
- **components/FloatingUploadButton.tsx**: Floating action button for adding new experiences
- **components/PhotoUploadModal.tsx**: Modal for uploading photos with captions
- **components/DateSelectorModal.tsx**: Date range picker for reflection generation
- **components/DurationSelectorModal.tsx**: Duration selector for meditation length
- **components/ExperienceSelectionModal.tsx**: Experience selection interface for reflections
- **components/ReflectionSummaryModal.tsx**: Summary display before meditation generation
- **components/MeditationGenerationModal.tsx**: Progress indicator during meditation creation
- **components/CategoryBadge.tsx**: Display category badges with color-coded styling
- **types.ts**: TypeScript interfaces (Note interface supports both audio and photo types)
- **utils/dateUtils.ts**: Date formatting and grouping utilities
- **utils/categoryUtils.ts**: Note categorization logic and category definitions (gratitude, experience, reflection, insight)

#### Server Architecture (`server/`)
- **server.js**: Single Express server file handling all API routes
- **File Storage**: JSON files in `data/` directory (notes.json, profile.json, meditations.json)
- **Media Storage**: Audio files (WAV, MP3) in `data/audio/` and images in `data/images/`
- **API Routes**:
  - `GET /api/notes` - Get all notes
  - `GET /api/notes/date-range` - Get notes within date range for reflection
  - `POST /api/notes` - Create audio note (with file upload)
  - `POST /api/notes/photo` - Create photo note (with image upload)
  - `DELETE /api/notes/:id` - Delete note
  - `GET/POST /api/profile` - User profile management
  - `POST /api/reflect/suggest` - Get suggested experiences for reflection
  - `POST /api/reflect/summary` - Generate reflection summary
  - `POST /api/meditate` - Generate meditation from selected experiences
  - `GET/DELETE /api/meditations` - Manage saved meditations

### AI Workflow
1. **Audio Note Creation**: Audio upload → Gemini transcription → Gemini title generation
2. **Photo Note Creation**: Image upload + caption → Gemini enhanced description → Gemini title generation
3. **Reflection Generation**: Selected experiences + profile + date range → Gemini reflection summary → Gemini meditation script → OpenAI TTS → Audio playlist with speech/pause segments

### Environment Variables Required
- `GEMINI_API_KEY` - Google Generative AI API key for transcription and content generation
- `OPENAI_API_KEY` - OpenAI API key for text-to-speech meditation generation
- `PORT` - Server port (defaults to 3001)

### Data Flow
Notes support both audio and photo types with fields: id, title, transcript (transcription for audio, enhanced caption for photos), date, type ('audio'|'photo'), audioUrl (audio only), imageUrl (photo only), originalCaption (photo only). Meditations reference noteIds and contain playlists with speech segments (audio files) and pause segments (durations).

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, React Router DOM, Lucide React icons, Axios
- **Backend**: Express 4, Multer (file uploads), UUID, CORS, dotenv, WAV processing, Helmet (security), rate limiting
- **Infrastructure**: BullMQ (job queues), Redis (caching/queues), Pino (logging)
- **Database**: Supabase client integration, file system (JSON + media files)
- **AI**: Google Generative AI (Gemini models), OpenAI (TTS)
- **Storage**: File system (JSON + media files)
- remember that to initiate the supabase mcp, follow these steps:

Start Claude Code with your environment:
  # From your project root
run "source server/.env && claude"