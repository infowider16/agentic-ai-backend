require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEST_MODEL || 'gemini-2.0-flash';
  const prompt = process.argv.slice(2).join(' ').trim() || 'Explain how AI works in a few words';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  console.log('Model:', model);
  console.log('Prompt:', prompt);
  console.log('Response:');
  console.log(response.text || '[empty response]');
}

main().catch(function(error) {
  console.error('Gemini test failed:', error.message);

  if (error.stack) {
    console.error(error.stack);
  }

  process.exit(1);
});