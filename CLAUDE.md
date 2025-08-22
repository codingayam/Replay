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
- **Backend**: Node.js Express server with Supabase PostgreSQL database
- **Authentication**: Clerk-based JWT authentication with multi-user support
- **AI Integration**: Uses Google Gemini for transcription/content generation and Replicate API for text-to-speech

### Core Features
1. **Multi-User Authentication**: Secure user registration and login via Clerk with Google OAuth support
2. **User Onboarding**: 3-step onboarding flow for new users (name, values, mission)
3. **Audio & Photo Journaling**: Record daily voice notes or upload photos with captions, both transcribed and titled automatically
4. **Note Categorization**: Automatic categorization of notes into gratitude, experience, reflection, or insight based on content analysis
5. **Reflection Generation**: Creates personalized guided meditations from selected experiences using AI
6. **Profile Management**: User-specific profiles with values, mission, and profile picture upload
7. **Experience Tracking**: Timeline view of both audio and photo-based experiences with category badges
8. **User Data Isolation**: Complete data separation between users with Row Level Security

### Key Components

#### Client Architecture (`client/src/`)
- **App.tsx**: Main router with Clerk authentication wrapper and protected routes
- **pages/LoginPage.tsx**: Custom-branded login page with Clerk SignIn component
- **pages/SignUpPage.tsx**: Registration page with feature preview and Clerk SignUp component  
- **pages/OnboardingPage.tsx**: 3-step onboarding flow for new users (name, values, mission)
- **pages/ExperiencesPage.tsx**: Main dashboard showing experiences timeline with both audio and photo notes
- **pages/ReflectionsPage.tsx**: Reflection generation workflow and saved meditations player
- **pages/ProfilePage.tsx**: User profile editing with profile picture upload functionality
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
- **utils/api.ts**: Authenticated API utility with automatic JWT token handling
- **utils/dateUtils.ts**: Date formatting and grouping utilities
- **utils/categoryUtils.ts**: Note categorization logic and category definitions (gratitude, experience, reflection, insight)

#### Server Architecture (`server/`)
- **server.js**: Express server with Clerk middleware for authentication and Supabase database integration
- **Database**: Supabase PostgreSQL with user-specific tables (profiles, notes, meditations)
- **Media Storage**: User-specific audio files (WAV, MP3) in `data/audio/userId/` and images in `data/images/`
- **Authentication**: All API routes protected with Clerk `requireAuth()` middleware
- **API Routes** (all require authentication):
  - `GET /api/notes` - Get user's notes
  - `GET /api/notes/date-range` - Get user's notes within date range for reflection
  - `POST /api/notes` - Create user's audio note (with file upload)
  - `POST /api/notes/photo` - Create user's photo note (with image upload)
  - `DELETE /api/notes/:id` - Delete user's note
  - `GET/POST /api/profile` - User profile management with image upload
  - `POST /api/reflect/suggest` - Get suggested experiences for user's reflection
  - `POST /api/reflect/summary` - Generate reflection summary for user
  - `POST /api/meditate` - Generate meditation from user's selected experiences
  - `GET/DELETE /api/meditations` - Manage user's saved meditations

### AI Workflow
1. **Audio Note Creation**: Audio upload → Gemini transcription → Gemini title generation
2. **Photo Note Creation**: Image upload + caption → Gemini enhanced description → Gemini title generation
3. **Reflection Generation**: Selected experiences + profile + date range → Gemini reflection summary → Gemini meditation script → Replicate TTS → Audio playlist with speech/pause segments

### Environment Variables Required

#### Server Environment (`server/.env`)
- `GEMINI_API_KEY` - Google Generative AI API key for transcription and content generation
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (private)
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key for authentication
- `CLERK_SECRET_KEY` - Clerk secret key for server-side authentication
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret (optional)
- `PORT` - Server port (defaults to 3001)

#### Client Environment (`client/.env`)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key for client-side authentication

### Data Flow
All data is user-specific and isolated by `clerk_user_id`. Notes support both audio and photo types with fields: id, clerk_user_id, title, transcript (transcription for audio, enhanced caption for photos), date, type ('audio'|'photo'), audioUrl (audio only), imageUrl (photo only), originalCaption (photo only). User profiles contain id, clerk_user_id, name, values, mission, and profile_image_url. Meditations are linked to users and reference their noteIds with playlists containing speech segments (audio files) and pause segments (durations).

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, React Router DOM, Lucide React icons, Axios
- **Authentication**: Clerk (JWT tokens, OAuth providers, user management)
- **Backend**: Express 4, Multer (file uploads), UUID, CORS, dotenv, WAV processing, Helmet (security), rate limiting
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Infrastructure**: BullMQ (job queues), Redis (caching/queues), Pino (logging)
- **AI**: Google Generative AI (Gemini models), OpenAI (TTS)
- **Storage**: User-specific file system organization + Supabase database
### Database Schema
The application uses Supabase PostgreSQL with the following tables:
- **profiles**: User profiles (id, clerk_user_id, name, values, mission, profile_image_url, timestamps)
- **notes**: User notes (id, clerk_user_id, title, transcript, category, type, date, duration, audio_url, image_url, original_caption, timestamps)  
- **meditations**: User meditations (id, clerk_user_id, title, playlist, note_ids, script, duration, summary, time_of_reflection, timestamps)

All tables have Row Level Security (RLS) enabled for user data isolation.

### Development Setup
To initialize the Supabase MCP for database operations:
```bash
# From your project root
source server/.env && claude
```