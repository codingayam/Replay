const { createClient } = require('@supabase/supabase-js');

// Test database configuration
const TEST_SUPABASE_URL = process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL;
const TEST_SUPABASE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let testSupabase;

const setupTestDatabase = async () => {
  if (!TEST_SUPABASE_URL || !TEST_SUPABASE_KEY) {
    console.warn('Test database not configured. Using mocked database operations.');
    return;
  }

  testSupabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY);
  
  // Ensure test database is clean
  await cleanupTestDatabase();
};

const cleanupTestDatabase = async () => {
  if (!testSupabase) return;

  try {
    // Clean up test data in reverse order of dependencies
    await testSupabase.from('meditations').delete().like('id', 'test-%');
    await testSupabase.from('notes').delete().like('id', 'test-%');
    await testSupabase.from('profiles').delete().like('user_id', 'test-%');
    
    // Clean up storage buckets
    const buckets = ['audio', 'images', 'profiles', 'meditations'];
    for (const bucket of buckets) {
      try {
        const { data: files } = await testSupabase.storage.from(bucket).list('test-user');
        if (files && files.length > 0) {
          const filePaths = files.map(file => `test-user/${file.name}`);
          await testSupabase.storage.from(bucket).remove(filePaths);
        }
      } catch (error) {
        // Ignore cleanup errors for storage
        console.debug(`Storage cleanup warning for ${bucket}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Database cleanup error:', error);
  }
};

const createTestUser = async (userId = 'test-user-id') => {
  if (!testSupabase) {
    return { id: userId, email: 'test@example.com' };
  }

  // In a real test environment, you might create an actual auth user
  // For now, we'll return a mock user object
  return {
    id: userId,
    email: 'test@example.com',
    created_at: new Date().toISOString()
  };
};

const createTestNote = async (userId, noteData) => {
  const note = {
    id: `test-note-${Date.now()}`,
    user_id: userId,
    title: 'Test Note',
    transcript: 'Test transcript',
    type: 'audio',
    category: 'experience',
    date: new Date().toISOString(),
    audio_url: '/audio/test-user/test-file.wav',
    duration: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...noteData
  };

  if (testSupabase) {
    const { data, error } = await testSupabase
      .from('notes')
      .insert(note)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  return note;
};

const createTestProfile = async (userId, profileData) => {
  const profile = {
    user_id: userId,
    name: 'Test User',
    values: 'Test values',
    mission: 'Test mission',
    profile_image_url: '/profiles/test-user/profile.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...profileData
  };

  if (testSupabase) {
    const { data, error } = await testSupabase
      .from('profiles')
      .upsert(profile)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  return profile;
};

const createTestMeditation = async (userId, meditationData) => {
  const meditation = {
    id: `test-meditation-${Date.now()}`,
    user_id: userId,
    title: '5-min Test Reflection',
    playlist: [
      { type: 'speech', audioUrl: '/meditations/test-user/test.wav' },
      { type: 'pause', duration: 10 }
    ],
    note_ids: ['test-note-1'],
    script: 'Test meditation script',
    duration: 5,
    summary: 'Test meditation summary',
    time_of_reflection: 'Day',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...meditationData
  };

  if (testSupabase) {
    const { data, error } = await testSupabase
      .from('meditations')
      .insert(meditation)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  return meditation;
};

const getTestData = async (table, userId) => {
  if (!testSupabase) {
    return [];
  }

  const { data, error } = await testSupabase
    .from(table)
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
};

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestUser,
  createTestNote,
  createTestProfile,
  createTestMeditation,
  getTestData,
  testSupabase
};