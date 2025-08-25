import { Note, Profile } from '../../types';

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

export const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: `note-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Note',
  transcript: 'This is a test transcript',
  type: 'audio',
  category: 'experience',
  date: new Date().toISOString(),
  audioUrl: '/audio/test-user/test-file.wav',
  ...overrides
});

export const createMockProfile = (overrides: Partial<Profile> = {}): Profile => ({
  name: 'Test User',
  values: 'Honesty, Growth, Connection',
  mission: 'To live authentically and help others',
  profileImageUrl: '/profiles/test-user/profile.jpg',
  ...overrides
});

export const createMockMeditation = (overrides = {}) => ({
  id: `meditation-${Math.random().toString(36).substr(2, 9)}`,
  title: '5-min Reflection',
  createdAt: new Date().toISOString(),
  noteIds: ['note-1', 'note-2'],
  summary: 'A peaceful reflection on your experiences',
  timeOfReflection: 'Day' as const,
  duration: 5,
  playlist: [
    {
      type: 'speech' as const,
      audioUrl: '/meditations/test-user/segment1.wav'
    },
    {
      type: 'pause' as const,
      duration: 10
    }
  ],
  ...overrides
});

export const createMockAudioNote = (overrides: Partial<Note> = {}): Note => 
  createMockNote({
    type: 'audio',
    audioUrl: '/audio/test-user/audio-note.wav',
    ...overrides
  });

export const createMockPhotoNote = (overrides: Partial<Note> = {}): Note => 
  createMockNote({
    type: 'photo',
    imageUrl: '/images/test-user/photo-note.jpg',
    originalCaption: 'User provided caption',
    audioUrl: undefined,
    ...overrides
  });

export const createMockFile = (name: string, type: string, content: string = 'mock content') => {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  return file;
};

export const createMockAudioFile = (name = 'test-audio.wav') => 
  createMockFile(name, 'audio/wav', 'mock audio content');

export const createMockImageFile = (name = 'test-image.jpg') => 
  createMockFile(name, 'image/jpeg', 'mock image content');