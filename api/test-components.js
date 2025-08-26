// Debug endpoint to test individual components that might be causing the 500 error
import { verifyAuth, supabase } from './_middleware.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  try {
    console.log('🧪 DEBUG TEST ENDPOINT - Testing components individually');
    
    // Test 1: Environment Variables
    console.log('📋 TEST 1: Environment Variables');
    const envTest = {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY ? 'Set' : 'Missing',
      SUPABASE_URL: !!process.env.SUPABASE_URL ? 'Set' : 'Missing',
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
    };
    console.log('✅ Environment variables:', envTest);

    // Test 2: Authentication
    console.log('🔐 TEST 2: Authentication');
    let user;
    try {
      user = await verifyAuth(req);
      console.log('✅ Authentication successful, user:', user.id);
    } catch (authError) {
      console.log('❌ Authentication failed:', authError.message);
      return res.status(200).json({
        test: 'component_test',
        results: {
          environment: envTest,
          auth: { success: false, error: authError.message },
          note: 'Authentication failed - remaining tests skipped'
        }
      });
    }

    // Test 3: Supabase Storage Test (simple upload)
    console.log('📁 TEST 3: Supabase Storage');
    let storageTest = { success: false, error: null };
    try {
      const testData = Buffer.from('test audio data', 'utf8');
      const testPath = `${user.id}/test-${Date.now()}.txt`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(testPath, testData, {
          contentType: 'text/plain',
        });

      if (uploadError) {
        storageTest.error = uploadError.message;
        console.log('❌ Storage test failed:', uploadError);
      } else {
        storageTest.success = true;
        console.log('✅ Storage test successful:', uploadData);
        
        // Clean up test file
        await supabase.storage.from('audio').remove([testPath]);
      }
    } catch (storageError) {
      storageTest.error = storageError.message;
      console.log('❌ Storage test exception:', storageError);
    }

    // Test 4: Database Test (simple select)
    console.log('🗄️ TEST 4: Database Connection');
    let dbTest = { success: false, error: null, tableExists: false };
    try {
      // Test if notes table exists and is accessible
      const { data: notes, error: selectError } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (selectError) {
        dbTest.error = selectError.message;
        console.log('❌ Database test failed:', selectError);
      } else {
        dbTest.success = true;
        dbTest.tableExists = true;
        console.log('✅ Database test successful, found', notes?.length || 0, 'notes');
      }
    } catch (dbError) {
      dbTest.error = dbError.message;
      console.log('❌ Database test exception:', dbError);
    }

    // Test 5: Gemini API Test (simple text generation)
    console.log('🤖 TEST 5: Gemini API');
    let geminiTest = { success: false, error: null };
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(['Say "test successful" and nothing else']);
      const response = result.response.text().trim();
      
      geminiTest.success = true;
      geminiTest.response = response;
      console.log('✅ Gemini test successful:', response);
    } catch (geminiError) {
      geminiTest.error = geminiError.message;
      console.log('❌ Gemini test failed:', geminiError);
    }

    // Return comprehensive test results
    const results = {
      environment: envTest,
      auth: { success: true, userId: user.id },
      storage: storageTest,
      database: dbTest,
      gemini: geminiTest,
      timestamp: new Date().toISOString()
    };

    console.log('🎯 COMPONENT TEST COMPLETE - All results:', results);
    
    return res.status(200).json({
      test: 'component_test',
      results,
      summary: {
        passing: [
          envTest.GEMINI_API_KEY === 'Set' && 'Environment',
          'Authentication',
          storageTest.success && 'Storage', 
          dbTest.success && 'Database',
          geminiTest.success && 'Gemini'
        ].filter(Boolean),
        failing: [
          envTest.GEMINI_API_KEY === 'Missing' && 'Environment',
          !storageTest.success && `Storage: ${storageTest.error}`,
          !dbTest.success && `Database: ${dbTest.error}`,
          !geminiTest.success && `Gemini: ${geminiTest.error}`
        ].filter(Boolean)
      }
    });

  } catch (error) {
    console.error('❌ COMPONENT TEST ENDPOINT ERROR:', error);
    return res.status(500).json({
      test: 'component_test',
      error: 'Test endpoint failed',
      details: error.message,
      stack: error.stack
    });
  }
}