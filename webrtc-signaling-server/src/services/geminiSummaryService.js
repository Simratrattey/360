import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// --- Step 1: Split transcript into chunks ---
function chunkTranscript(transcript, maxWords = 1800) {
  const words = transcript.split(/\s+/);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
    i += maxWords;
  }

  return chunks;
}

// --- Step 2: Summarize each chunk ---
async function summarizeChunk(chunk, index, meetingTitle) {
  const prompt = `
You are an AI assistant that summarizes meeting transcripts.

Meeting Title: "${meetingTitle}"

Please summarize this portion of the meeting transcript. Focus on:
- Key discussion points
- Important decisions made
- Action items assigned
- Unresolved questions or concerns

Format your response as:
## Summary
[Main discussion points and context]

## Decisions Made
[Any decisions, agreements, or conclusions reached]

## Action Items
[Tasks assigned with responsible parties if mentioned]

## Unresolved Questions
[Open questions, concerns, or topics requiring follow-up]

[Chunk ${index}]
${chunk}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error(`Error summarizing chunk ${index}:`, error);
    throw error;
  }
}

// --- Step 3: Merge chunk summaries ---
async function mergeSummaries(summaries, meetingTitle) {
  const prompt = `
You are an AI assistant tasked with producing a clean, concise final summary 
of a meeting titled "${meetingTitle}".

You are given partial summaries of different segments of the same meeting. 
Please merge them into a single unified summary.

Rules:
- Remove duplicate points and merge similar items
- Consolidate repeated information into single entries
- Maintain the structure: Summary, Decisions Made, Action Items, Unresolved Questions
- Be concise but comprehensive
- Use bullet points for lists where appropriate

[Partial Summaries Start]
${summaries.join("\n\n---\n\n")}
[Partial Summaries End]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error merging summaries:', error);
    throw error;
  }
}

// --- Step 4: Full pipeline ---
export async function summarizeMeeting(transcriptEntries, meetingTitle = "Meeting") {
  try {
    console.log(`[Gemini] Starting AI summarization for: ${meetingTitle}`);
    
    // Convert transcript entries to plain text
    const transcript = transcriptEntries
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n');
    
    if (!transcript || transcript.trim().length === 0) {
      console.log('[Gemini] No transcript content to summarize');
      return null;
    }

    console.log(`[Gemini] Transcript length: ${transcript.length} characters`);
    
    // Split transcript into manageable chunks
    const chunks = chunkTranscript(transcript);
    console.log(`[Gemini] Split into ${chunks.length} chunks for processing`);

    if (chunks.length === 1) {
      // For short transcripts, summarize directly
      console.log('[Gemini] Short transcript - summarizing directly');
      const summary = await summarizeChunk(chunks[0], 1, meetingTitle);
      console.log('[Gemini] ✅ Summary generation complete');
      return summary;
    }

    // For longer transcripts, process chunks and merge
    console.log(`[Gemini] Processing ${chunks.length} chunks...`);
    const partialSummaries = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Gemini] Summarizing chunk ${i + 1} of ${chunks.length}...`);
      try {
        const summary = await summarizeChunk(chunks[i], i + 1, meetingTitle);
        partialSummaries.push(summary);
      } catch (error) {
        console.error(`[Gemini] Failed to summarize chunk ${i + 1}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    if (partialSummaries.length === 0) {
      console.error('[Gemini] No chunks were successfully summarized');
      return null;
    }

    console.log('[Gemini] Merging summaries...');
    const finalSummary = await mergeSummaries(partialSummaries, meetingTitle);
    console.log('[Gemini] ✅ AI summarization complete');
    
    return finalSummary;
  } catch (error) {
    console.error('[Gemini] Error in summarizeMeeting:', error);
    return null;
  }
}

// --- Helper function to validate API key ---
export function validateGeminiConfig() {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY not found in environment variables');
    return false;
  }
  return true;
}

// --- Test function for development ---
export async function testGeminiConnection() {
  try {
    if (!validateGeminiConfig()) {
      return false;
    }

    console.log('[Gemini] Testing API connection...');
    const testPrompt = "Say 'Hello, meeting summarization service is working!' in a professional tone.";
    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    
    console.log('[Gemini] Test response:', response.text());
    return true;
  } catch (error) {
    console.error('[Gemini] Connection test failed:', error);
    return false;
  }
}