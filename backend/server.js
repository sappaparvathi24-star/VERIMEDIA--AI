const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger payloads for images

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'VERIMEDIA Backend is running' });
});

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { content, type } = req.body;

    // Validate input
    if (!content) {
      return res.status(400).json({ 
        error: 'Content is required',
        success: false 
      });
    }

    if (!type || !['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ 
        error: 'Valid type is required (text, image, or video)',
        success: false 
      });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error: API key not found',
        success: false 
      });
    }

    // Create the prompt based on content type
    const prompt = createAnalysisPrompt(content, type);

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the structured response
    const analysis = parseGeminiResponse(text, type);

    // Return analysis
    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Handle specific errors
    if (error.message?.includes('API key')) {
      return res.status(500).json({ 
        error: 'Invalid API key configuration',
        success: false 
      });
    }

    res.status(500).json({ 
      error: 'Failed to analyze content. Please try again.',
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create analysis prompt based on content type
function createAnalysisPrompt(content, type) {
  const basePrompt = `You are an AI content authenticity analyzer for VERIMEDIA. Analyze the following ${type} content and provide a detailed assessment.

${type === 'text' ? `Text Content: "${content}"` : `Content Description: ${content}`}

Provide your analysis in the following EXACT JSON format (no markdown, no extra text):
{
  "summary": "A brief 2-3 sentence summary of the content",
  "authenticity": "REAL" or "AI-GENERATED" or "UNCERTAIN",
  "confidence": 85,
  "keyInsights": [
    "First key insight or red flag",
    "Second key insight or pattern",
    "Third key insight or observation"
  ],
  "explanation": "A clear 2-3 sentence explanation of WHY you reached this conclusion, mentioning specific indicators"
}

Analysis criteria:
- For TEXT: Check for AI patterns (repetitive phrases, perfect grammar, generic tone, lack of personal voice)
- For IMAGES: Look for artifacts, inconsistencies, unnatural elements, deepfake indicators
- For VIDEOS: Check for lip-sync issues, frame inconsistencies, unnatural movements

Be specific and educational in your explanation.`;

  return basePrompt;
}

// Parse Gemini's response into structured format
function parseGeminiResponse(text, type) {
  try {
    // Remove markdown code blocks if present
    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to parse as JSON
    const parsed = JSON.parse(cleanText);

    // Validate and normalize the response
    return {
      summary: parsed.summary || 'Analysis completed',
      authenticity: normalizeAuthenticity(parsed.authenticity),
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      keyInsights: Array.isArray(parsed.keyInsights) 
        ? parsed.keyInsights.slice(0, 5) 
        : ['Analysis completed'],
      explanation: parsed.explanation || 'Unable to provide detailed explanation',
      contentType: type
    };

  } catch (parseError) {
    console.error('Parse error:', parseError);
    
    // Fallback: extract insights from raw text
    return {
      summary: text.substring(0, 200) + '...',
      authenticity: 'UNCERTAIN',
      confidence: 50,
      keyInsights: [
        'Analysis completed but response format was unexpected',
        'Please review the raw analysis below'
      ],
      explanation: 'The AI provided an analysis but in an unexpected format.',
      contentType: type,
      rawResponse: text
    };
  }
}

// Normalize authenticity values
function normalizeAuthenticity(value) {
  if (!value) return 'UNCERTAIN';
  
  const normalized = value.toString().toUpperCase();
  
  if (normalized.includes('REAL') || normalized.includes('AUTHENTIC') || normalized.includes('GENUINE')) {
    return 'REAL';
  }
  if (normalized.includes('AI') || normalized.includes('GENERATED') || normalized.includes('FAKE') || normalized.includes('SYNTHETIC')) {
    return 'AI-GENERATED';
  }
  return 'UNCERTAIN';
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 VERIMEDIA Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Analysis endpoint: http://localhost:${PORT}/analyze`);
});
