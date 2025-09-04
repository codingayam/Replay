import type { Note } from '../../types';
import type { Category } from '../../utils/categoryUtils';

// Note test factories
export const noteFactory = {
  withIdeas: (overrides: Partial<Note> = {}): Note => ({
    id: 'test-id-ideas',
    title: 'New Business Concept',
    transcript: 'I have an innovative idea for a productivity app that uses AI to optimize workflows',
    type: 'audio',
    category: ['ideas'],
    date: '2025-01-01T10:00:00Z',
    audioUrl: 'http://example.com/audio.mp3',
    ...overrides,
  }),

  withFeelings: (overrides: Partial<Note> = {}): Note => ({
    id: 'test-id-feelings',
    title: 'Gratitude Reflection',
    transcript: 'I feel so grateful for my family and all the support they give me',
    type: 'audio', 
    category: ['feelings'],
    date: '2025-01-01T11:00:00Z',
    audioUrl: 'http://example.com/audio2.mp3',
    ...overrides,
  }),

  withBoth: (overrides: Partial<Note> = {}): Note => ({
    id: 'test-id-both',
    title: 'Inspired Business Vision',
    transcript: 'I am so excited about this new business idea! It makes me feel passionate about helping people',
    type: 'audio',
    category: ['ideas', 'feelings'],
    date: '2025-01-01T12:00:00Z',
    audioUrl: 'http://example.com/audio3.mp3',
    ...overrides,
  }),

  withNull: (overrides: Partial<Note> = {}): Note => ({
    id: 'test-id-null',
    title: 'Uncategorized Note',
    transcript: 'This is a note without any category',
    type: 'audio',
    category: undefined,
    date: '2025-01-01T13:00:00Z',
    audioUrl: 'http://example.com/audio4.mp3',
    ...overrides,
  }),

  withEmpty: (overrides: Partial<Note> = {}): Note => ({
    id: 'test-id-empty',
    title: 'Empty Category Note',
    transcript: 'This note has an empty category array',
    type: 'audio',
    category: [],
    date: '2025-01-01T14:00:00Z',
    audioUrl: 'http://example.com/audio5.mp3',
    ...overrides,
  }),

  photoWithCaption: (overrides: Partial<Note> = {}): Note => ({
    id: 'test-id-photo',
    title: 'Beautiful Sunset',
    transcript: 'Enhanced description: A breathtaking sunset over the ocean with warm colors',
    type: 'photo',
    category: ['feelings'],
    date: '2025-01-01T15:00:00Z',
    imageUrl: 'http://example.com/photo.jpg',
    originalCaption: 'Nice sunset photo',
    ...overrides,
  }),
};

// Category test cases
export const categoryTestCases = [
  { 
    input: 'ideas' as Category, 
    expected: 1, 
    color: '#7c3aed',
    backgroundColor: '#ede9fe',
    name: 'ideas'
  },
  { 
    input: ['ideas'] as Category[], 
    expected: 1, 
    colors: ['#7c3aed'],
    backgroundColors: ['#ede9fe'],
    names: ['ideas']
  },
  { 
    input: 'feelings' as Category,
    expected: 1,
    color: '#059669', 
    backgroundColor: '#d1fae5',
    name: 'feelings'
  },
  { 
    input: ['ideas', 'feelings'] as Category[], 
    expected: 2, 
    colors: ['#7c3aed', '#059669'],
    backgroundColors: ['#ede9fe', '#d1fae5'],
    names: ['ideas', 'feelings']
  },
  { input: null, expected: 0 },
  { input: [], expected: 0 },
  { input: undefined, expected: 0 }
];

// AI mock responses
export const mockGeminiResponses = {
  ideasOnly: {
    response: { 
      text: () => '["ideas"]' 
    }
  },
  feelingsOnly: {
    response: { 
      text: () => '["feelings"]' 
    }
  },
  both: {
    response: { 
      text: () => '["ideas", "feelings"]' 
    }
  },
  invalid: {
    response: { 
      text: () => 'invalid json response' 
    }
  },
  empty: {
    response: { 
      text: () => '[]' 
    }
  },
  networkError: () => {
    throw new Error('Network error: AI service unavailable');
  },
  malformed: {
    response: {
      text: () => '{"not": "an array"}'
    }
  }
};

// Test content samples for AI categorization
export const testContent = {
  pureIdeas: [
    "I have a new business idea for a productivity app that integrates AI",
    "Solution to the traffic problem: implement smart traffic lights with sensors",
    "Concept for improving team workflows using automated task distribution",
    "Revolutionary approach to renewable energy storage using compressed air",
  ],
  pureFeelings: [
    "I feel so grateful for my family and their unwavering support today",
    "Feeling anxious about the upcoming presentation but trying to stay calm",
    "Happy and content after my morning meditation session",
    "Overwhelmed with joy watching my daughter take her first steps",
  ],
  mixedContent: [
    "I'm so excited about my new business idea! It makes me passionate about helping others",
    "Feeling inspired by this creative solution to environmental problems",
    "My emotional breakthrough during therapy led to new insights about relationships",
    "This innovative teaching method fills me with hope for education reform",
  ],
  edgeCases: [
    "", // empty content
    "a", // minimal content
    "🎉🎊❤️🚀💡", // emoji only
    "https://example.com/article", // URL only
    "123 456 789", // numbers only
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50), // very long content
  ]
};

// Database test fixtures
export const databaseFixtures = {
  validInserts: [
    {
      user_id: 'test-user-1',
      title: 'Test Idea Note',
      transcript: 'This is a test idea',
      category: ['ideas'],
      type: 'audio'
    },
    {
      user_id: 'test-user-1', 
      title: 'Test Feeling Note',
      transcript: 'This is a test feeling',
      category: ['feelings'],
      type: 'photo'
    },
    {
      user_id: 'test-user-1',
      title: 'Test Mixed Note', 
      transcript: 'This has both ideas and feelings',
      category: ['ideas', 'feelings'],
      type: 'audio'
    }
  ],
  invalidInserts: [
    {
      user_id: 'test-user-1',
      title: 'Invalid Category',
      transcript: 'This should fail',
      category: ['invalid'],
      type: 'audio'
    },
    {
      user_id: 'test-user-1',
      title: 'Mixed Invalid',
      transcript: 'This should also fail', 
      category: ['ideas', 'invalid', 'feelings'],
      type: 'audio'
    }
  ]
};