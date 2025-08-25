// Real-time translation service using Google Translate API (converted from Python deep_translator)
import axios from 'axios';

/**
 * Translate text using Google Translate API (equivalent to Python deep_translator.GoogleTranslator)
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code ('auto' for auto-detection)
 * @param {string} targetLanguage - Target language code (e.g., 'en', 'es', 'fr')
 * @returns {Promise<string>} - Translated text
 */
export async function translateText(text, sourceLanguage = 'auto', targetLanguage = 'es') {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for translation');
    }

    // Skip translation if source and target are the same
    if (sourceLanguage === targetLanguage) {
      return text;
    }

    console.log(`Translating "${text}" from ${sourceLanguage} to ${targetLanguage}`);
    
    // Use Google Translate API (free tier through googletrans endpoint)
    const translatedText = await googleTranslateAPI(text, sourceLanguage, targetLanguage);
    
    return translatedText;

  } catch (error) {
    console.error('[ERROR] Translation failed:', error.message);
    // Return original text as fallback (matching Python behavior)
    return text;
  }
}

/**
 * Google Translate API implementation (equivalent to deep_translator.GoogleTranslator)
 * Uses the same free Google Translate API that deep_translator uses
 */
async function googleTranslateAPI(text, sourceLanguage, targetLanguage) {
  try {
    // Google Translate API endpoint (same as used by deep_translator)
    const url = 'https://translate.googleapis.com/translate_a/single';
    
    const params = {
      client: 'gtx',
      sl: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
      tl: targetLanguage,
      dt: 't',
      q: text
    };

    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Parse Google Translate response format
    if (response.data && Array.isArray(response.data) && response.data[0]) {
      const translations = response.data[0];
      let translatedText = '';
      
      for (const translation of translations) {
        if (Array.isArray(translation) && translation[0]) {
          translatedText += translation[0];
        }
      }
      
      return translatedText || text;
    }
    
    throw new Error('Invalid response format from Google Translate');

  } catch (error) {
    console.error('[ERROR] Google Translate API failed:', error.message);
    
    // Fallback to alternative Google Translate endpoint
    try {
      return await alternativeGoogleTranslate(text, sourceLanguage, targetLanguage);
    } catch (fallbackError) {
      console.error('[ERROR] Fallback translation failed:', fallbackError.message);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }
}

/**
 * Alternative Google Translate implementation (backup method)
 */
async function alternativeGoogleTranslate(text, sourceLanguage, targetLanguage) {
  const url = 'https://translate.googleapis.com/translate_a/t';
  
  const params = {
    client: 'dict-chrome-ex',
    sl: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
    tl: targetLanguage,
    q: text
  };

  const response = await axios.get(url, {
    params,
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (response.data && Array.isArray(response.data) && response.data[0]) {
    return response.data[0] || text;
  }
  
  throw new Error('Alternative translation method failed');
}

/**
 * Detect the language of the given text using Google Translate
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} - Detected language code
 */
export async function detectLanguage(text) {
  try {
    if (!text || text.trim().length === 0) {
      return 'en'; // Default to English
    }

    console.log(`Detecting language for: "${text}"`);
    
    const url = 'https://translate.googleapis.com/translate_a/single';
    const params = {
      client: 'gtx',
      sl: 'auto',
      tl: 'en',
      dt: 't',
      q: text
    };

    const response = await axios.get(url, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Google Translate returns detected language in response[2]
    if (response.data && Array.isArray(response.data) && response.data[2]) {
      return response.data[2] || 'en';
    }
    
    return 'en'; // Fallback to English

  } catch (error) {
    console.error('Language Detection Error:', error.message);
    return 'en'; // Fallback to English
  }
}

/**
 * Get list of supported languages for translation
 * @returns {Array} - Array of supported language objects
 */
export function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
    { code: 'auto', name: 'Auto-detect', flag: '🌐' }
  ];
}