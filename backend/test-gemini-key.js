/**
 * Quick test script to verify Gemini API key works
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Test with the provided key
const testKey = process.env.GEMINI_API_KEY || 'AIzaSyC_Xm3TNCSDPQ6FawlG5Sz040sg_e8t128';

console.log('🧪 Testing Gemini API Key...');
console.log(`Key (first 10 chars): ${testKey.substring(0, 10)}...`);

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(testKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    console.log('📤 Sending test request...');
    const result = await model.generateContent('Say "Hello, Gemini API is working!" in one sentence.');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS! Gemini API is working!');
    console.log(`Response: ${text}`);
    return true;
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('   The API key is invalid. Please check your key.');
    } else if (error.message.includes('429')) {
      console.error('   Rate limit exceeded. Wait a moment and try again.');
    } else if (error.message.includes('quota')) {
      console.error('   Quota exceeded. Check your billing/usage limits.');
    }
    return false;
  }
}

testGemini().then(success => {
  process.exit(success ? 0 : 1);
});
