# Replay - AI-Powered Journaling Application

A full-stack reflection and journaling application that combines audio recording, photo uploads, and AI-powered transcription with personalized meditation generation.

## Features

- **Audio & Photo Journaling**: Record voice notes or upload photos with captions
- **AI Transcription**: Automatic transcription and title generation using Google Gemini
- **Meditation Generation**: Create personalized guided meditations from selected experiences
- **Profile Management**: Store personal values and life mission for customized reflections
- **Timeline View**: Organized display of all experiences with date filtering

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Node.js, Express
- **AI Services**: Google Gemini (transcription), OpenAI (text-to-speech)
- **Storage**: File-based JSON storage

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Google Gemini API key
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/codingayam/Replay.git
   cd Replay
   ```

2. **Set up environment variables**
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit `server/.env` and add your API keys:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   OPENAI_API_KEY=your_actual_openai_api_key
   PORT=3001
   ```

3. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

4. **Start the application**
   ```bash
   # Terminal 1: Start the server
   cd server
   npm start
   
   # Terminal 2: Start the client
   cd client
   npm run dev
   ```

The application will be available at `http://localhost:5173` (client) with the API server running on `http://localhost:3001`.

## API Keys Setup

### Google Gemini API
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

### OpenAI API
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file as `OPENAI_API_KEY`

## Project Structure

```
Replay/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Main application pages
│   │   └── utils/       # Utility functions
├── server/          # Express backend
│   ├── server.js    # Main server file
│   ├── data/        # JSON storage (excluded from git)
│   └── .env         # Environment variables (excluded from git)
└── README.md
```

## Security Notes

- **Never commit API keys**: The `.env` file is excluded from git
- **Use environment variables**: All sensitive configuration is in `.env`
- **Data storage**: User data and media files are stored locally and excluded from git

## Development Commands

### Client
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

### Server
- `npm start` - Start production server
- `nodemon server.js` - Start with auto-restart (requires nodemon)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License.