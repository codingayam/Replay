import Replicate from 'replicate';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env' });

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function testReplicate() {
  try {
    // First check if API token exists
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not found in environment');
      return;
    }
    
    console.log('🔑 API Token found');
    console.log('🎤 Testing Replicate TTS with Kokoro model...');
    console.log('📝 Text: "Hello"');
    console.log('🎵 Voice: af_heart');
    
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
    );
    
    const replicatePromise = replicate.run(
      "codingayam/kokoro-82m-complete:442855652d79f7c05ee98cb1630602c7eec38c5dbccef60fa80e9d2c903c107f",
      {
        input: {
          text: "Hello",
          voice: "af_heart",
          speed: 0.7
        }
      }
    );

    console.log('⏳ Waiting for Replicate response...');
    const output = await Promise.race([replicatePromise, timeoutPromise]);

    // To access the file URL:
    console.log('📥 Output URL:', output.url());

    // To write the file to disk:
    console.log('💾 Downloading and writing file to disk as test-output.wav...');
    
    // Download the audio file first
    const audioUrl = output.url().toString();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    fs.writeFileSync("test-output.wav", buffer);
    
    console.log('✅ Test completed successfully!');
    console.log('🎧 Audio file saved as test-output.wav');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('timeout')) {
      console.error('💡 The API call timed out - this might indicate API issues or slow model loading');
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.error('💡 Check your REPLICATE_API_TOKEN in server/.env');
    } else {
      console.error('💡 Full error:', error);
    }
  }
}

testReplicate();