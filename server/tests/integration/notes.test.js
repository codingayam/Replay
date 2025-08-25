const request = require('supertest');
const express = require('express');
const { createTestUser, createTestNote, cleanupTestDatabase } = require('../utils/testDatabase');
const { setMockGeminiResponse } = require('../mocks/externalAPIs');

// Mock the main server app
const app = express();
require('../../server'); // This would need to be refactored to export the app

describe('Notes API Integration Tests', () => {
  let testUser;
  let authToken;

  beforeEach(async () => {
    await cleanupTestDatabase();
    testUser = await createTestUser('test-user-notes');
    authToken = 'mock-jwt-token'; // In real tests, this would be a valid JWT
    
    // Mock successful auth validation
    jest.spyOn(require('../utils/testDatabase'), 'testSupabase')
      .mockImplementation(() => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        }
      }));
  });

  describe('GET /api/notes', () => {
    it('should return empty array when user has no notes', async () => {
      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return user notes ordered by date', async () => {
      const note1 = await createTestNote(testUser.id, {
        title: 'First Note',
        date: '2024-01-01T10:00:00.000Z'
      });
      
      const note2 = await createTestNote(testUser.id, {
        title: 'Second Note',
        date: '2024-01-02T10:00:00.000Z'
      });

      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Second Note'); // More recent first
      expect(response.body[1].title).toBe('First Note');
    });

    it('should not return notes from other users', async () => {
      const otherUser = await createTestUser('other-user');
      
      await createTestNote(testUser.id, { title: 'My Note' });
      await createTestNote(otherUser.id, { title: 'Other User Note' });

      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('My Note');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/notes')
        .expect(401);
    });

    it('should handle invalid auth token', async () => {
      await request(app)
        .get('/api/notes')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /api/notes/date-range', () => {
    beforeEach(async () => {
      await createTestNote(testUser.id, {
        title: 'Old Note',
        date: '2023-12-01T10:00:00.000Z'
      });
      
      await createTestNote(testUser.id, {
        title: 'In Range Note',
        date: '2024-01-15T10:00:00.000Z'
      });
      
      await createTestNote(testUser.id, {
        title: 'Future Note',
        date: '2024-02-15T10:00:00.000Z'
      });
    });

    it('should return notes within specified date range', async () => {
      const response = await request(app)
        .get('/api/notes/date-range')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('In Range Note');
    });

    it('should require both startDate and endDate parameters', async () => {
      await request(app)
        .get('/api/notes/date-range')
        .query({ startDate: '2024-01-01' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get('/api/notes/date-range')
        .query({ endDate: '2024-01-31' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle invalid date formats', async () => {
      await request(app)
        .get('/api/notes/date-range')
        .query({
          startDate: 'invalid-date',
          endDate: '2024-01-31'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/notes', () => {
    it('should create audio note with file upload', async () => {
      setMockGeminiResponse({
        transcript: 'This is a test transcription',
        title: 'Test Audio Note',
        category: 'experience'
      });

      const audioBuffer = Buffer.from('mock audio data');
      
      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', audioBuffer, 'test-audio.wav')
        .field('localTimestamp', new Date().toISOString())
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Test Audio Note',
        transcript: 'This is a test transcription',
        type: 'audio',
        category: 'experience'
      });
      
      expect(response.body.audioUrl).toMatch(/\/audio\/.*\.wav/);
    });

    it('should handle missing audio file', async () => {
      await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .field('localTimestamp', new Date().toISOString())
        .expect(400);
    });

    it('should create note even when AI service fails', async () => {
      // Mock Gemini failure
      setMockGeminiResponse(null);
      
      const audioBuffer = Buffer.from('mock audio data');
      
      const response = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', audioBuffer, 'test-audio.wav')
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Audio Note',
        transcript: 'Transcription not available (AI service not configured)',
        type: 'audio'
      });
    });

    it('should handle file upload errors', async () => {
      // Mock Supabase storage error
      const { setMockSupabaseError } = require('../mocks/externalAPIs');
      setMockSupabaseError('upload', new Error('Upload failed'));

      const audioBuffer = Buffer.from('mock audio data');
      
      await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', audioBuffer, 'test-audio.wav')
        .expect(500);
    });
  });

  describe('POST /api/notes/photo', () => {
    it('should create photo note with image and caption', async () => {
      setMockGeminiResponse({
        enhancedCaption: 'AI enhanced description of the photo',
        title: 'Beautiful Sunset'
      });

      const imageBuffer = Buffer.from('mock image data');
      
      const response = await request(app)
        .post('/api/notes/photo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', imageBuffer, 'test-photo.jpg')
        .field('caption', 'User provided caption')
        .field('localTimestamp', new Date().toISOString())
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Beautiful Sunset',
        transcript: 'AI enhanced description of the photo',
        originalCaption: 'User provided caption',
        type: 'photo'
      });
      
      expect(response.body.imageUrl).toMatch(/\/images\/.*\.(jpg|jpeg|png)/);
    });

    it('should require image file and caption', async () => {
      await request(app)
        .post('/api/notes/photo')
        .set('Authorization', `Bearer ${authToken}`)
        .field('caption', 'Caption without image')
        .expect(400);

      const imageBuffer = Buffer.from('mock image data');
      
      await request(app)
        .post('/api/notes/photo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', imageBuffer, 'test-photo.jpg')
        .expect(400);
    });

    it('should validate image file types', async () => {
      const textBuffer = Buffer.from('not an image');
      
      await request(app)
        .post('/api/notes/photo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', textBuffer, 'test.txt')
        .field('caption', 'Test caption')
        .expect(400);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await createTestNote(testUser.id, {
        title: 'Note to Delete',
        audio_url: '/audio/test-user/test-file.wav'
      });
    });

    it('should delete user own note', async () => {
      await request(app)
        .delete(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify note was deleted
      const response = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should not delete notes from other users', async () => {
      const otherUser = await createTestUser('other-user-delete');
      const otherNote = await createTestNote(otherUser.id, {
        title: 'Other User Note'
      });

      await request(app)
        .delete(`/api/notes/${otherNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle non-existent note ID', async () => {
      await request(app)
        .delete('/api/notes/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should delete associated files from storage', async () => {
      const { testSupabase } = require('../utils/testDatabase');
      const mockStorageRemove = jest.fn().mockResolvedValue({ data: null, error: null });
      
      testSupabase.storage = {
        from: jest.fn(() => ({
          remove: mockStorageRemove
        }))
      };

      await request(app)
        .delete(`/api/notes/${testNote.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      expect(mockStorageRemove).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('test-file.wav')])
      );
    });
  });

  describe('PUT /api/notes/:id/transcript', () => {
    let testNote;

    beforeEach(async () => {
      testNote = await createTestNote(testUser.id, {
        title: 'Note to Update',
        transcript: 'Original transcript'
      });
    });

    it('should update note transcript', async () => {
      const newTranscript = 'Updated transcript content';
      
      const response = await request(app)
        .put(`/api/notes/${testNote.id}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: newTranscript })
        .expect(200);

      expect(response.body.transcript).toBe(newTranscript);
    });

    it('should require transcript field', async () => {
      await request(app)
        .put(`/api/notes/${testNote.id}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should validate transcript is a string', async () => {
      await request(app)
        .put(`/api/notes/${testNote.id}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: 123 })
        .expect(400);
    });

    it('should not update notes from other users', async () => {
      const otherUser = await createTestUser('other-user-update');
      const otherNote = await createTestNote(otherUser.id, {
        title: 'Other User Note'
      });

      await request(app)
        .put(`/api/notes/${otherNote.id}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: 'Attempted update' })
        .expect(404);
    });

    it('should trim whitespace from transcript', async () => {
      const transcriptWithWhitespace = '  Transcript with whitespace  ';
      
      const response = await request(app)
        .put(`/api/notes/${testNote.id}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: transcriptWithWhitespace })
        .expect(200);

      expect(response.body.transcript).toBe('Transcript with whitespace');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      jest.spyOn(require('../../database'), 'db').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });

    it('should handle malformed JSON in request body', async () => {
      const testNote = await createTestNote(testUser.id);
      
      await request(app)
        .put(`/api/notes/${testNote.id}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should respect file size limits', async () => {
      // Create a large buffer (exceeding 50MB limit)
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
      
      await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', largeBuffer, 'large-audio.wav')
        .expect(413); // Payload too large
    });

    it('should handle concurrent requests', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      
      const requests = Array(5).fill(null).map((_, index) => 
        request(app)
          .post('/api/notes')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', audioBuffer, `test-audio-${index}.wav`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all notes were created
      const notesResponse = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(notesResponse.body).toHaveLength(5);
    });
  });
});