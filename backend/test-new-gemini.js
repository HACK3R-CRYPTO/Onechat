const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = 'AIzaSyC_Xm3TNCSDPQ6FawlG5Sz040sg_e8t128';

console.log('🧪 Testing new Gemini API key...');
console.log(`Key (first 15 chars): ${apiKey.substring(0, 15)}...`);

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    console.log('📤 Sending test request...');
    const result = await model.generateContent('Say "Hello, API is working!" in one sentence.');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS! Gemini API is working!');
    console.log(`Response: ${text}`);
    return true;
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('   The API key is invalid.');
    } else if (error.message.includes('429') || error.message.includes('quota')) {
      console.error('   Rate limit or quota exceeded.');
    }
    return false;
  }
}

test().then(success => {
  process.exit(success ? 0 : 1);
});
