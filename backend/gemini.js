const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
require('dotenv').config();

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyzes an image using Google's Gemini 1.5 Vision model.
 * 
 * @param {string} imagePath - Path to the image file to analyze
 * @returns {Promise<object>} - Object containing metadata extracted from the image
 */
async function analyzeImageWithGemini(imagePath) {
  try {
    // Check if we're in mock mode
    if (process.env.MOCK_GEMINI === 'true') {
      console.log('Using mock Gemini response for', imagePath);
      return generateMockMetadata();
    }
    
    // Verify API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not found. Please add it to your .env file.');
    }
    
    // Read image file
    const imageData = fs.readFileSync(imagePath);
    
    // Convert to base64
    const base64Image = imageData.toString('base64');
    
    // Access Gemini Pro Vision model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-vision' });
    
    // Craft the prompt for detailed metadata extraction
    const prompt = `
      Analyze this image and extract the following metadata in JSON format only:
      
      {
        "medium": "Photography, Painting, Digital Art, etc.",
        "people": {
          "number": number of people detected (0 if none),
          "gender": "Males, Females, Mixed group, etc. (null if no people)"
        },
        "actions": "Running, dancing, sitting, etc. (null if not applicable)",
        "clothes": "Formal, casual, sportswear, etc. (null if not applicable)",
        "environment": "Indoor, outdoor, city, nature, etc.",
        "colors": ["Top 2 dominant colors"],
        "style": "Abstract, realistic, vintage, modern, etc.",
        "mood": "Happy, dramatic, nostalgic, etc.",
        "scene": "Detailed description of the scene (40-50 words max)"
      }
      
      Important instructions:
      - Return ONLY valid JSON, no other text.
      - Use null for fields that don't apply.
      - Keep values concise (1-2 words) except for the scene description.
      - The scene description should be factual and descriptive.
      - Do not include any commentary or introductory text.
    `;
    
    // Generate content with the model
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      }
    ]);
    
    const response = result.response;
    const responseText = response.text();
    
    // Parse the JSON response
    let metadata;
    try {
      // Find any JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.log('Raw response:', responseText);
      throw new Error('Failed to parse Gemini response');
    }
    
    return metadata;
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    
    // If in production, might want to return a default/fallback metadata
    // rather than throwing an error that might disrupt the upload flow
    if (process.env.NODE_ENV === 'production') {
      return {
        medium: "Unknown",
        people: { number: 0, gender: null },
        actions: null,
        clothes: null,
        environment: "Unknown",
        colors: ["Unknown"],
        style: "Unknown",
        mood: "Unknown",
        scene: "Could not analyze this image. The content might be unclear or the analysis service encountered an error."
      };
    }
    
    throw error;
  }
}

/**
 * Generates mock metadata for testing without the Gemini API
 * 
 * @returns {object} - Mock metadata object
 */
function generateMockMetadata() {
  const mediums = ['Photography', 'Painting', 'Digital Art', 'Illustration', 'Sketch'];
  const styles = ['Abstract', 'Realistic', 'Vintage', 'Modern', 'Minimalist', 'Surreal'];
  const moods = ['Happy', 'Sad', 'Dramatic', 'Nostalgic', 'Peaceful', 'Mysterious'];
  const environments = ['Indoor', 'Outdoor', 'Urban', 'Nature', 'Studio', 'Beach'];
  const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Black', 'White'];
  const actions = ['Standing', 'Running', 'Sitting', 'Dancing', 'Jumping', 'Sleeping'];
  const clothes = ['Formal', 'Casual', 'Sportswear', 'Traditional', 'Vintage', 'Elegant'];
  
  // Random number of people between 0 and 5
  const peopleCount = Math.floor(Math.random() * 6);
  let people = null;
  
  if (peopleCount > 0) {
    const genders = ['Male', 'Female', 'Mixed group'];
    people = {
      number: peopleCount,
      gender: genders[Math.floor(Math.random() * genders.length)]
    };
  }
  
  // Random scene description
  const sceneDescriptions = [
    'A serene landscape with mountains in the background and a calm lake reflecting the sky.',
    'A bustling city street with people walking and cars passing by.',
    'A cozy living room with a fireplace and comfortable furniture.',
    'A beautiful sunset over the ocean with waves crashing on the shore.',
    'A forest path with sunlight filtering through the trees.',
    'An abstract composition of shapes and colors creating a vibrant pattern.',
    'A portrait of a person with an expressive facial expression.',
    'A still life arrangement of fruits and flowers on a table.',
    'A macro shot of a flower with intricate details visible.',
    'A snowy winter scene with trees covered in white.'
  ];
  
  return {
    medium: mediums[Math.floor(Math.random() * mediums.length)],
    people: people,
    actions: peopleCount > 0 ? actions[Math.floor(Math.random() * actions.length)] : null,
    clothes: peopleCount > 0 ? clothes[Math.floor(Math.random() * clothes.length)] : null,
    environment: environments[Math.floor(Math.random() * environments.length)],
    colors: [
      colors[Math.floor(Math.random() * colors.length)],
      colors[Math.floor(Math.random() * colors.length)]
    ],
    style: styles[Math.floor(Math.random() * styles.length)],
    mood: moods[Math.floor(Math.random() * moods.length)],
    scene: sceneDescriptions[Math.floor(Math.random() * sceneDescriptions.length)]
  };
}

/**
 * Advanced natural language search of images using Gemini
 * This function takes a natural language query and returns search criteria
 * 
 * @param {string} query - Natural language query to analyze
 * @returns {Promise<object>} - Extracted search criteria
 */
async function extractSearchCriteriaFromQuery(query) {
  try {
    // Verify API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not found. Please add it to your .env file.');
    }
    
    // Access Gemini Pro model (text only is fine for this)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    // Craft the prompt for extracting search criteria
    const prompt = `
      Extract search criteria from this natural language query: "${query}"
      
      Return a JSON object with these possible fields:
      
      {
        "medium": extracted medium (e.g., "Photography"),
        "people": {
          "number": extracted number of people,
          "gender": extracted gender description
        },
        "actions": extracted actions (e.g., "Running"),
        "clothes": extracted clothes description,
        "environment": extracted environment (e.g., "Outdoor"),
        "colors": [extracted colors],
        "style": extracted style (e.g., "Vintage"),
        "mood": extracted mood (e.g., "Happy"),
        "keywords": [other significant keywords from the query]
      }
      
      Rules:
      - Include only fields that are explicitly mentioned in the query
      - Leave out fields that aren't mentioned (don't use null, just omit them)
      - Return valid JSON only, no additional text
      - Be precise and concise with extracted values
    `;
    
    // Generate content with the model
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();
    
    // Parse the JSON response
    let searchCriteria;
    try {
      // Find any JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        searchCriteria = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return {}; // Return empty criteria on error
    }
    
    return searchCriteria;
  } catch (error) {
    console.error('Error extracting search criteria:', error);
    return {}; // Return empty criteria on error
  }
}

module.exports = {
  analyzeImageWithGemini,
  extractSearchCriteriaFromQuery
};