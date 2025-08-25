import { Note, Profile } from '../../types';

export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

export const mockProfile: Profile = {
  name: 'Test User',
  values: 'Honesty, Creativity, Growth, Connection',
  mission: 'To live authentically and help others discover their potential',
  profileImageUrl: '/profiles/test-user/profile_123.jpg'
};

export const mockNotes: Note[] = [
  {
    id: 'note-1',
    title: 'Morning Reflection',
    transcript: 'Today I felt grateful for the beautiful sunrise and the opportunity to start fresh.',
    type: 'audio',
    category: 'experience',
    date: '2024-01-20T08:00:00.000Z',
    audioUrl: '/audio/test-user/note-1.wav'
  },
  {
    id: 'note-2',
    title: 'Learning Moment',
    transcript: 'I discovered that taking breaks actually makes me more productive, not less.',
    type: 'audio',
    category: 'knowledge',
    date: '2024-01-20T14:30:00.000Z',
    audioUrl: '/audio/test-user/note-2.wav'
  },
  {
    id: 'note-3',
    title: 'Beach Walk',
    transcript: 'The peaceful sound of waves and warm sand beneath my feet created a perfect moment of mindfulness.',
    originalCaption: 'Beautiful sunset at the beach',
    type: 'photo',
    category: 'experience',
    date: '2024-01-19T18:45:00.000Z',
    imageUrl: '/images/test-user/note-3.jpg'
  },
  {
    id: 'note-4',
    title: 'Family Dinner',
    transcript: 'Sharing stories and laughter around the dinner table reminded me of what truly matters in life.',
    type: 'audio',
    category: 'experience',
    date: '2024-01-18T19:00:00.000Z',
    audioUrl: '/audio/test-user/note-4.wav'
  },
  {
    id: 'note-5',
    title: 'Book Insight',
    transcript: 'The author\'s perspective on resilience changed how I view challenges - they\'re not obstacles but opportunities for growth.',
    originalCaption: 'Reading this amazing book about resilience',
    type: 'photo',
    category: 'knowledge',
    date: '2024-01-17T21:15:00.000Z',
    imageUrl: '/images/test-user/note-5.jpg'
  }
];

export interface MockMeditation {
  id: string;
  title: string;
  createdAt: string;
  noteIds: string[];
  summary: string;
  timeOfReflection: 'Day' | 'Night';
  duration?: number;
  playlist?: Array<{
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
  }>;
}

export const mockMeditations: MockMeditation[] = [
  {
    id: 'meditation-1',
    title: '5-min Reflection - 01/20/2024',
    createdAt: '2024-01-20T09:00:00.000Z',
    noteIds: ['note-1', 'note-2'],
    summary: 'A morning reflection focusing on gratitude and personal growth, helping you start the day with clarity and purpose.',
    timeOfReflection: 'Day',
    duration: 5,
    playlist: [
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation-1-part1.wav'
      },
      {
        type: 'pause',
        duration: 15
      },
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation-1-part2.wav'
      }
    ]
  },
  {
    id: 'meditation-2',
    title: '10-min Reflection - 01/19/2024',
    createdAt: '2024-01-19T22:30:00.000Z',
    noteIds: ['note-3', 'note-4'],
    summary: 'An evening reflection on connection and mindfulness, drawing wisdom from your experiences with nature and family.',
    timeOfReflection: 'Night',
    duration: 10,
    playlist: [
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation-2-part1.wav'
      },
      {
        type: 'pause',
        duration: 30
      },
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation-2-part2.wav'
      },
      {
        type: 'pause',
        duration: 20
      },
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation-2-part3.wav'
      }
    ]
  }
];

export const mockStats = {
  streak: 7,
  monthlyCount: 15,
  calendarDates: [
    '2024-01-15',
    '2024-01-16',
    '2024-01-17',
    '2024-01-18',
    '2024-01-19',
    '2024-01-20',
    '2024-01-21'
  ]
};