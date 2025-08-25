import { http, HttpResponse } from 'msw';
import { mockNotes, mockProfile, mockMeditations, mockUser } from '../fixtures/data';

export const handlers = [
  // Auth endpoints
  http.get('/api/debug', () => {
    return HttpResponse.json({
      message: 'Test API is working',
      timestamp: new Date().toISOString(),
      environment: 'test'
    });
  }),

  // Notes endpoints
  http.get('/api/notes', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let filteredNotes = mockNotes;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredNotes = mockNotes.filter(note => {
        const noteDate = new Date(note.date);
        return noteDate >= start && noteDate <= end;
      });
    }

    return HttpResponse.json(filteredNotes);
  }),

  http.get('/api/notes/date-range', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return HttpResponse.json(
        { error: 'Both startDate and endDate are required.' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const filteredNotes = mockNotes.filter(note => {
      const noteDate = new Date(note.date);
      return noteDate >= start && noteDate <= end;
    });

    return HttpResponse.json(filteredNotes);
  }),

  http.post('/api/notes', () => {
    return HttpResponse.json(
      {
        id: 'new-note-id',
        title: 'Test Audio Note',
        transcript: 'Test transcription',
        type: 'audio',
        category: 'experience',
        date: new Date().toISOString(),
        audioUrl: '/audio/test-user/test-file.wav',
        duration: 30
      },
      { status: 201 }
    );
  }),

  http.post('/api/notes/photo', () => {
    return HttpResponse.json(
      {
        id: 'new-photo-note-id',
        title: 'Test Photo Note',
        transcript: 'Enhanced AI description of the photo',
        originalCaption: 'User provided caption',
        type: 'photo',
        category: 'experience',
        date: new Date().toISOString(),
        imageUrl: '/images/test-user/test-image.jpg'
      },
      { status: 201 }
    );
  }),

  http.delete('/api/notes/:id', ({ params }) => {
    const noteExists = mockNotes.some(note => note.id === params.id);
    
    if (!noteExists) {
      return HttpResponse.json(
        { error: 'Note not found.' },
        { status: 404 }
      );
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.put('/api/notes/:id/transcript', ({ params }) => {
    const note = mockNotes.find(note => note.id === params.id);
    
    if (!note) {
      return HttpResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      ...note,
      transcript: 'Updated transcript'
    });
  }),

  // Profile endpoints
  http.get('/api/profile', () => {
    return HttpResponse.json(mockProfile);
  }),

  http.post('/api/profile', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ...mockProfile,
      ...body
    });
  }),

  http.post('/api/profile/image', () => {
    return HttpResponse.json({
      profileImageUrl: '/profiles/test-user/profile_test.jpg',
      message: 'Profile picture uploaded successfully'
    });
  }),

  // Meditation endpoints
  http.post('/api/meditate', async ({ request }) => {
    const body = await request.json() as any;
    const { noteIds, duration = 5, timeOfReflection = 'Day' } = body;

    if (!noteIds || noteIds.length === 0) {
      return HttpResponse.json(
        { error: 'Note IDs are required.' },
        { status: 400 }
      );
    }

    const playlist = [
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation_segment_1.wav'
      },
      {
        type: 'pause',
        duration: 10
      },
      {
        type: 'speech',
        audioUrl: '/meditations/test-user/meditation_segment_2.wav'
      }
    ];

    return HttpResponse.json({
      playlist,
      meditationId: 'new-meditation-id',
      summary: 'A peaceful reflection on your recent experiences, helping you find clarity and connection to your values.'
    });
  }),

  http.get('/api/meditations', () => {
    return HttpResponse.json(mockMeditations);
  }),

  http.get('/api/meditations/:id', ({ params }) => {
    const meditation = mockMeditations.find(m => m.id === params.id);
    
    if (!meditation) {
      return HttpResponse.json(
        { error: 'Meditation not found.' },
        { status: 404 }
      );
    }

    return HttpResponse.json(meditation);
  }),

  http.delete('/api/meditations/:id', ({ params }) => {
    const meditationExists = mockMeditations.some(m => m.id === params.id);
    
    if (!meditationExists) {
      return HttpResponse.json(
        { error: 'Meditation not found.' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Meditation deleted successfully.' });
  }),

  // Reflection endpoints
  http.post('/api/reflect/summary', async ({ request }) => {
    const body = await request.json() as any;
    const { noteIds, duration = 5 } = body;

    if (!noteIds || noteIds.length === 0) {
      return HttpResponse.json(
        { error: 'Note IDs are required for summary generation.' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      summary: 'Your reflection reveals themes of growth and gratitude. The experiences you selected show a pattern of mindful observation and emotional awareness that speaks to your evolving journey of self-discovery.',
      reflectedOn: noteIds.length,
      duration
    });
  }),

  // Stats endpoints
  http.get('/api/stats/streak', () => {
    return HttpResponse.json({ streak: 5 });
  }),

  http.get('/api/stats/monthly', () => {
    return HttpResponse.json({ count: 12 });
  }),

  http.get('/api/stats/calendar', () => {
    return HttpResponse.json({
      dates: [
        '2024-01-15',
        '2024-01-16',
        '2024-01-18',
        '2024-01-20',
        '2024-01-22'
      ]
    });
  }),

  // File serving endpoints
  http.get('/audio/:userId/:filename', () => {
    return HttpResponse.text('mock-audio-content', {
      headers: {
        'Content-Type': 'audio/wav'
      }
    });
  }),

  http.get('/images/:userId/:filename', () => {
    return HttpResponse.text('mock-image-content', {
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });
  }),

  http.get('/profiles/:userId/:filename', () => {
    return HttpResponse.text('mock-profile-image-content', {
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });
  }),

  http.get('/meditations/:userId/:filename', () => {
    return HttpResponse.text('mock-meditation-audio-content', {
      headers: {
        'Content-Type': 'audio/wav'
      }
    });
  }),

  http.post('/api/meditations/signed-url', async ({ request }) => {
    const body = await request.json() as any;
    const { filePath } = body;

    if (!filePath) {
      return HttpResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      signedUrl: `https://mock-signed-url.com${filePath}?expires=3600`
    });
  })
];

export { handlers };