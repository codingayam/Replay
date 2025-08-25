// Test user data for E2E tests
export const testUsers = {
  existingUser: {
    email: 'test.user@replay.com',
    password: 'TestPassword123!',
    profile: {
      name: 'Test User',
      values: 'Honesty, Growth, Connection, Creativity',
      mission: 'To live authentically while helping others discover their potential through mindful reflection and genuine connection.'
    }
  },
  newUser: {
    email: 'new.user@replay.com',
    password: 'NewUserPass123!',
    profile: {
      name: 'New Test User',
      values: 'Compassion, Learning, Adventure',
      mission: 'To embrace each day with curiosity and kindness.'
    }
  }
};

// Test content for notes and reflections
export const testContent = {
  audioNotes: [
    {
      transcript: "Today I went for a walk in the park and felt really grateful for the beautiful weather. The sun was shining and I could hear birds singing.",
      expectedTitle: "Grateful Park Walk",
      duration: 15
    },
    {
      transcript: "I had an interesting conversation with my colleague about work-life balance. It made me realize I need to set better boundaries.",
      expectedTitle: "Work Balance Insight",
      duration: 20
    },
    {
      transcript: "Meditation this morning was particularly peaceful. I felt a deep sense of calm and clarity about my priorities.",
      expectedTitle: "Morning Meditation",
      duration: 12
    }
  ],
  photoNotes: [
    {
      caption: "Beautiful sunset from my balcony tonight",
      imageName: "sunset-balcony.jpg",
      expectedEnhancedCaption: "A breathtaking sunset view captured from a peaceful balcony"
    },
    {
      caption: "Finished reading this amazing book about mindfulness",
      imageName: "mindfulness-book.jpg", 
      expectedEnhancedCaption: "A completed mindfulness book resting peacefully"
    }
  ],
  reflections: {
    shortReflection: {
      duration: 3,
      timeOfDay: 'Day',
      expectedThemes: ['gratitude', 'nature', 'awareness']
    },
    mediumReflection: {
      duration: 5,
      timeOfDay: 'Night',
      expectedThemes: ['growth', 'balance', 'insights']
    },
    longReflection: {
      duration: 10,
      timeOfDay: 'Day',
      expectedThemes: ['mindfulness', 'clarity', 'purpose']
    }
  }
};

// Mock files for testing uploads
export const createTestFile = (name: string, type: string, size: number = 1024) => {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
};

export const testFiles = {
  audio: {
    wav: createTestFile('test-audio.wav', 'audio/wav', 2048),
    mp3: createTestFile('test-audio.mp3', 'audio/mpeg', 1536)
  },
  images: {
    jpg: createTestFile('test-image.jpg', 'image/jpeg', 3072),
    png: createTestFile('test-image.png', 'image/png', 4096),
    largePng: createTestFile('large-image.png', 'image/png', 11 * 1024 * 1024) // 11MB
  },
  invalid: {
    txt: createTestFile('invalid.txt', 'text/plain', 512),
    pdf: createTestFile('document.pdf', 'application/pdf', 1024)
  }
};

// Common test data for API responses
export const mockApiResponses = {
  successfulLogin: {
    user: { id: 'test-user-123', email: testUsers.existingUser.email },
    session: { access_token: 'mock-access-token-123' }
  },
  profile: testUsers.existingUser.profile,
  notes: [
    {
      id: 'note-1',
      title: 'Morning Gratitude',
      transcript: 'Grateful for this beautiful day',
      type: 'audio',
      category: 'experience',
      date: new Date().toISOString(),
      audioUrl: '/audio/test-user/note-1.wav'
    },
    {
      id: 'note-2', 
      title: 'Sunset Photo',
      transcript: 'Beautiful colors in the evening sky',
      type: 'photo',
      category: 'experience',
      date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      imageUrl: '/images/test-user/note-2.jpg'
    }
  ],
  meditation: {
    id: 'meditation-1',
    title: '5-min Reflection',
    playlist: [
      { type: 'speech', audioUrl: '/meditations/test-user/segment-1.wav' },
      { type: 'pause', duration: 10 },
      { type: 'speech', audioUrl: '/meditations/test-user/segment-2.wav' }
    ],
    summary: 'A peaceful reflection on gratitude and awareness'
  }
};

// Date utilities for tests
export const testDates = {
  today: new Date().toISOString().split('T')[0],
  yesterday: new Date(Date.now() - 86400000).toISOString().split('T')[0],
  lastWeek: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
  lastMonth: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
};

// Selectors commonly used across tests
export const selectors = {
  // Auth pages
  loginEmailInput: '[data-testid="login-email"]',
  loginPasswordInput: '[data-testid="login-password"]',
  loginSubmitButton: '[data-testid="login-submit"]',
  signupEmailInput: '[data-testid="signup-email"]', 
  signupPasswordInput: '[data-testid="signup-password"]',
  signupSubmitButton: '[data-testid="signup-submit"]',
  
  // Navigation
  bottomTabExperiences: '[data-testid="tab-experiences"]',
  bottomTabReflections: '[data-testid="tab-reflections"]',
  bottomTabProfile: '[data-testid="tab-profile"]',
  
  // Experiences page
  floatingUploadButton: '[data-testid="floating-upload"]',
  audioRecordButton: '[data-testid="record-audio"]',
  photoUploadButton: '[data-testid="upload-photo"]',
  noteCard: '[data-testid="note-card"]',
  noteTitle: '[data-testid="note-title"]',
  noteTranscript: '[data-testid="note-transcript"]',
  
  // Modals
  modalOverlay: '[data-testid="modal-overlay"]',
  modalClose: '[data-testid="modal-close"]',
  audioRecorderModal: '[data-testid="audio-recorder-modal"]',
  photoUploadModal: '[data-testid="photo-upload-modal"]',
  
  // Profile page
  profileNameInput: '[data-testid="profile-name"]',
  profileValuesInput: '[data-testid="profile-values"]',
  profileMissionInput: '[data-testid="profile-mission"]',
  profileSaveButton: '[data-testid="profile-save"]',
  profileImageUpload: '[data-testid="profile-image-upload"]',
  
  // Reflections page
  createReflectionButton: '[data-testid="create-reflection"]',
  dateRangeSelector: '[data-testid="date-range-selector"]',
  durationSelector: '[data-testid="duration-selector"]',
  experienceSelector: '[data-testid="experience-selector"]',
  generateMeditationButton: '[data-testid="generate-meditation"]',
  meditationPlayer: '[data-testid="meditation-player"]',
  
  // Common elements
  loadingSpinner: '[data-testid="loading"]',
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
  confirmButton: '[data-testid="confirm"]',
  cancelButton: '[data-testid="cancel"]'
};