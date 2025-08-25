// Mock responses for external APIs
const mockGeminiResponse = {
  response: {
    text: () => JSON.stringify({
      transcript: "This is a mock transcription from Gemini AI",
      title: "Mock Note Title",
      category: "experience"
    })
  }
};

const mockGeminiSummaryResponse = {
  response: {
    text: () => "Your reflection reveals themes of growth and mindfulness. The experiences you selected show a pattern of self-awareness that speaks to your journey of personal development."
  }
};

const mockGeminiMeditationScript = {
  response: {
    text: () => `Welcome to your guided reflection. Take a moment to settle in and breathe deeply.
    
    [PAUSE=10s]
    
    Let's explore the experiences you've chosen to reflect upon today. Notice how they connect to your values and mission.
    
    [PAUSE=15s]
    
    As we conclude this reflection, take with you the insights and peace you've cultivated here.`
  }
};

const mockOpenAITTSResponse = {
  body: Buffer.from('mock-audio-data'),
  headers: {
    'content-type': 'audio/wav'
  }
};

const mockReplicateOutput = Buffer.from('mock-replicate-audio-data');

// Mock functions
const mockExternalAPIs = () => {
  // Mock Google Generative AI
  jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn(() => ({
      getGenerativeModel: jest.fn(() => ({
        generateContent: jest.fn()
          .mockResolvedValueOnce(mockGeminiResponse) // First call - transcription
          .mockResolvedValueOnce(mockGeminiSummaryResponse) // Second call - summary
          .mockResolvedValue(mockGeminiMeditationScript) // Subsequent calls - meditation script
      }))
    }))
  }));

  // Mock OpenAI
  jest.mock('openai', () => {
    return jest.fn(() => ({
      audio: {
        speech: {
          create: jest.fn().mockResolvedValue(mockOpenAITTSResponse)
        }
      }
    }));
  });

  // Mock Replicate
  jest.mock('replicate', () => {
    return jest.fn(() => ({
      run: jest.fn().mockResolvedValue(mockReplicateOutput)
    }));
  });

  // Mock Supabase client
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null
        })
      },
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'mock-file-path' },
            error: null
          }),
          createSignedUrl: jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://mock-signed-url.com/file' },
            error: null
          }),
          remove: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        }))
      }
    }))
  }));
};

const restoreExternalAPIs = () => {
  jest.restoreAllMocks();
};

// Helper functions for customizing mock responses during tests
const setMockGeminiResponse = (response) => {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  GoogleGenerativeAI.mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => JSON.stringify(response) }
      })
    })
  }));
};

const setMockOpenAIResponse = (response) => {
  const OpenAI = require('openai');
  OpenAI.mockImplementation(() => ({
    audio: {
      speech: {
        create: jest.fn().mockResolvedValue(response)
      }
    }
  }));
};

const setMockReplicateResponse = (response) => {
  const Replicate = require('replicate');
  Replicate.mockImplementation(() => ({
    run: jest.fn().mockResolvedValue(response)
  }));
};

const setMockSupabaseError = (operation, error) => {
  const { createClient } = require('@supabase/supabase-js');
  createClient.mockImplementation(() => ({
    auth: {
      getUser: operation === 'auth' ? jest.fn().mockResolvedValue({ data: null, error }) : jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    },
    storage: {
      from: jest.fn(() => ({
        upload: operation === 'upload' ? jest.fn().mockResolvedValue({ data: null, error }) : jest.fn().mockResolvedValue({
          data: { path: 'mock-file-path' },
          error: null
        }),
        createSignedUrl: operation === 'signedUrl' ? jest.fn().mockResolvedValue({ data: null, error }) : jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://mock-signed-url.com/file' },
          error: null
        }),
        remove: operation === 'remove' ? jest.fn().mockResolvedValue({ data: null, error }) : jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }))
    }
  }));
};

module.exports = {
  mockExternalAPIs,
  restoreExternalAPIs,
  setMockGeminiResponse,
  setMockOpenAIResponse,
  setMockReplicateResponse,
  setMockSupabaseError,
  mockGeminiResponse,
  mockGeminiSummaryResponse,
  mockGeminiMeditationScript,
  mockOpenAITTSResponse,
  mockReplicateOutput
};