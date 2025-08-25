const { v4: uuidv4 } = require('uuid');

/**
 * Factory functions for creating test data
 * These functions create realistic test data with sensible defaults
 * and allow for customization through the overrides parameter
 */

const createTestUser = (overrides = {}) => ({
  id: `test-user-${uuidv4()}`,
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  email_confirmed_at: new Date().toISOString(),
  ...overrides
});

const createTestProfile = (userId, overrides = {}) => ({
  user_id: userId,
  name: 'Test User',
  values: 'Honesty, Growth, Connection, Creativity',
  mission: 'To live authentically while helping others discover their potential through mindful reflection and genuine connection.',
  profile_image_url: `/profiles/${userId}/profile_${uuidv4()}.jpg`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

const createTestNote = (userId, overrides = {}) => {
  const noteId = uuidv4();
  const isPhoto = overrides.type === 'photo';
  
  return {
    id: noteId,
    user_id: userId,
    title: isPhoto ? 'Test Photo Note' : 'Test Audio Note',
    transcript: isPhoto 
      ? 'A beautiful moment captured in time, showing the essence of the experience'
      : 'This is a test transcription of an audio note about daily reflections',
    type: isPhoto ? 'photo' : 'audio',
    category: 'experience',
    date: new Date().toISOString(),
    duration: isPhoto ? null : Math.floor(Math.random() * 120) + 10, // 10-130 seconds
    audio_url: isPhoto ? null : `/audio/${userId}/${noteId}.wav`,
    image_url: isPhoto ? `/images/${userId}/${noteId}.jpg` : null,
    original_caption: isPhoto ? 'User provided caption for this image' : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
};

const createTestAudioNote = (userId, overrides = {}) => 
  createTestNote(userId, { type: 'audio', ...overrides });

const createTestPhotoNote = (userId, overrides = {}) => 
  createTestNote(userId, { type: 'photo', ...overrides });

const createTestMeditation = (userId, noteIds = [], overrides = {}) => {
  const meditationId = uuidv4();
  const duration = overrides.duration || 5;
  
  return {
    id: meditationId,
    user_id: userId,
    title: `${duration}-min Reflection - ${new Date().toLocaleDateString()}`,
    playlist: [
      {
        type: 'speech',
        audioUrl: `/meditations/${userId}/meditation_${meditationId}_part1.wav`
      },
      {
        type: 'pause',
        duration: Math.floor(duration * 60 * 0.2) // 20% of total time in pauses
      },
      {
        type: 'speech',
        audioUrl: `/meditations/${userId}/meditation_${meditationId}_part2.wav`
      },
      {
        type: 'pause',
        duration: Math.floor(duration * 60 * 0.1) // 10% of total time in pauses
      },
      {
        type: 'speech',
        audioUrl: `/meditations/${userId}/meditation_${meditationId}_part3.wav`
      }
    ],
    note_ids: noteIds.length > 0 ? noteIds : [`note-${uuidv4()}`, `note-${uuidv4()}`],
    script: `Welcome to your ${duration}-minute guided reflection. Take a moment to settle in and breathe deeply.

[PAUSE=15s]

Let's explore the experiences you've chosen to reflect upon today. Notice how they connect to your values and mission.

[PAUSE=30s]

As we conclude this reflection, take with you the insights and peace you've cultivated here.`,
    duration,
    summary: `A peaceful ${duration}-minute reflection drawing from your recent experiences. This session explores themes of growth, gratitude, and connection to your core values.`,
    time_of_reflection: Math.random() > 0.5 ? 'Day' : 'Night',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
};

/**
 * Create multiple test entities
 */
const createMultipleTestNotes = (userId, count = 3) => {
  return Array.from({ length: count }, (_, index) => 
    createTestNote(userId, {
      title: `Test Note ${index + 1}`,
      date: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString() // Spread over days
    })
  );
};

const createTestNotesWithCategories = (userId) => [
  createTestNote(userId, {
    title: 'Morning Gratitude',
    transcript: 'Feeling grateful for this beautiful sunrise and the opportunities ahead',
    category: 'experience',
    type: 'audio'
  }),
  createTestNote(userId, {
    title: 'Book Learning',
    transcript: 'Discovered an interesting concept about mindfulness and its impact on decision-making',
    category: 'knowledge',
    type: 'audio'
  }),
  createTestPhotoNote(userId, {
    title: 'Nature Walk',
    transcript: 'A peaceful moment in the forest, surrounded by towering trees and dappled sunlight',
    category: 'experience',
    original_caption: 'Beautiful forest path'
  }),
  createTestNote(userId, {
    title: 'Work Insight',
    transcript: 'Realized that taking breaks actually improves my productivity and creativity',
    category: 'knowledge',
    type: 'audio'
  })
];

/**
 * Create test data with relationships
 */
const createTestUserWithData = async (overrides = {}) => {
  const user = createTestUser(overrides);
  const profile = createTestProfile(user.id);
  const notes = createMultipleTestNotes(user.id, 5);
  const meditations = [
    createTestMeditation(user.id, [notes[0].id, notes[1].id]),
    createTestMeditation(user.id, [notes[2].id, notes[3].id], { duration: 10 })
  ];
  
  return {
    user,
    profile,
    notes,
    meditations
  };
};

/**
 * Create test data for specific scenarios
 */
const createTestScenarios = {
  newUser: () => {
    const user = createTestUser({ email: 'newuser@example.com' });
    return {
      user,
      profile: null, // New user hasn't completed onboarding
      notes: [],
      meditations: []
    };
  },
  
  activeUser: () => {
    const user = createTestUser({ email: 'active@example.com' });
    const profile = createTestProfile(user.id, {
      name: 'Active User',
      values: 'Mindfulness, Growth, Compassion'
    });
    const notes = createTestNotesWithCategories(user.id);
    const meditations = [createTestMeditation(user.id, notes.slice(0, 2).map(n => n.id))];
    
    return { user, profile, notes, meditations };
  },
  
  userWithManyNotes: () => {
    const user = createTestUser({ email: 'prolific@example.com' });
    const profile = createTestProfile(user.id);
    const notes = createMultipleTestNotes(user.id, 20); // Many notes for pagination testing
    const meditations = [];
    
    return { user, profile, notes, meditations };
  }
};

/**
 * Mock file data for testing uploads
 */
const createMockFiles = {
  audioFile: (filename = 'test-audio.wav', size = 2048) => ({
    fieldname: 'audio',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'audio/wav',
    buffer: Buffer.alloc(size, 'mock audio data'),
    size
  }),
  
  imageFile: (filename = 'test-image.jpg', size = 3072) => ({
    fieldname: 'image',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.alloc(size, 'mock image data'),
    size
  }),
  
  largeAudioFile: () => createMockFiles.audioFile('large-audio.wav', 55 * 1024 * 1024), // 55MB
  
  invalidFile: () => ({
    fieldname: 'file',
    originalname: 'invalid.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    buffer: Buffer.from('not an audio or image file'),
    size: 25
  })
};

/**
 * Create test API responses
 */
const createMockApiResponses = {
  geminiTranscription: (customData = {}) => ({
    response: {
      text: () => JSON.stringify({
        transcript: 'Mock AI transcription of the audio content',
        title: 'Mock AI Generated Title',
        category: 'experience',
        ...customData
      })
    }
  }),
  
  geminiSummary: (summary = 'Mock reflection summary') => ({
    response: {
      text: () => summary
    }
  }),
  
  openaiTTS: (audioData = Buffer.alloc(1024, 'mock tts audio')) => ({
    body: audioData,
    headers: { 'content-type': 'audio/wav' }
  }),
  
  replicateTTS: (audioData = Buffer.alloc(1024, 'mock replicate audio')) => audioData
};

/**
 * Date utilities for testing
 */
const createTestDates = {
  today: () => new Date().toISOString(),
  yesterday: () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  lastWeek: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  lastMonth: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  
  dateRange: (daysAgo = 7) => {
    const end = new Date();
    const start = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }
};

module.exports = {
  // Basic factories
  createTestUser,
  createTestProfile,
  createTestNote,
  createTestAudioNote,
  createTestPhotoNote,
  createTestMeditation,
  
  // Batch creation
  createMultipleTestNotes,
  createTestNotesWithCategories,
  createTestUserWithData,
  
  // Scenarios
  createTestScenarios,
  
  // Mock data
  createMockFiles,
  createMockApiResponses,
  
  // Utilities
  createTestDates,
  
  // Common test values
  TEST_VALUES: {
    VALID_EMAIL: 'test@example.com',
    VALID_PASSWORD: 'TestPassword123!',
    INVALID_EMAIL: 'invalid-email',
    WEAK_PASSWORD: '123',
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MIN_RECORDING_DURATION: 1000, // 1 second
    MAX_RECORDING_DURATION: 300000 // 5 minutes
  }
};