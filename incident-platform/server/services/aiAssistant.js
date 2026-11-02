const { GoogleGenerativeAI } = require('@google/generative-ai');

// Candidate models in order of preference
const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
].filter(Boolean);

/**
 * Generate a summary, root‑cause hypotheses and next‑step recommendations for an incident.
 * @param {Object} incident - Incident document (plain JS object).
 * @returns {Promise<string>} Text response from Gemini.
 */
async function generateSuggestion(incident) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `You are an expert Incident Response Assistant.
Analyze the following security incident and provide:
1. Executive Summary
2. Probable Root-Cause Hypotheses
3. Immediate Containment & Mitigation Actions
4. Recommended Follow-up / Post-Incident Activities

Incident Details:
${JSON.stringify(incident, null, 2)}`;

  let lastError = null;

  for (const modelName of DEFAULT_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      console.warn(`[AI Assistant] Model ${modelName} attempt failed: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to generate suggestion with available Gemini models');
}

module.exports = { generateSuggestion };

