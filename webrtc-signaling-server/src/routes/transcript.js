import express from 'express';
import Transcript from '../models/transcript.js';
import authMiddleware from '../middleware/auth.js';
import Meeting from '../models/meeting.js';

const router = express.Router();

// Get transcript for a room
router.get('/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    let transcript = await Transcript.findOne({ roomId });
    
    if (!transcript) {
      // Create empty transcript if none exists
      transcript = new Transcript({
        roomId,
        entries: []
      });
      await transcript.save();
    }
    
    // Sort entries by createdAt timestamp for chronological order
    const sortedEntries = [...transcript.entries].sort((a, b) => a.createdAt - b.createdAt);
    
    res.json({
      success: true,
      transcript: sortedEntries,
      lastUpdated: transcript.lastUpdated
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transcript'
    });
  }
});

// Add transcript entry to a room (First-Writer-Wins)
router.post('/:roomId/entry', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { id, text, speaker, speakerId, timestamp, createdAt } = req.body;
    
    if (!id || !text || !speaker || !speakerId || !timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    let transcript = await Transcript.findOne({ roomId });
    
    if (!transcript) {
      transcript = new Transcript({
        roomId,
        entries: []
      });
    }
    
    // FIRST-WRITER-WINS: Check if entry already exists (prevent duplicates)
    const existingEntry = transcript.entries.find(entry => entry.id === id);
    if (existingEntry) {
      console.log(`[Transcript] Entry ${id} already exists, skipping (First-Writer-Wins)`);
      return res.json({
        success: true,
        message: 'Entry already exists (First-Writer-Wins)',
        duplicate: true
      });
    }
    
    // Add new entry
    transcript.entries.push({
      id,
      text,
      speaker,
      speakerId,
      timestamp,
      createdAt: createdAt || Date.now()
    });
    
    await transcript.save();
    
    console.log(`[Transcript] Added entry: [${speaker}] ${text.substring(0, 50)}...`);
    
    res.json({
      success: true,
      message: 'Transcript entry added',
      entryCount: transcript.entries.length
    });
  } catch (error) {
    console.error('Error adding transcript entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add transcript entry'
    });
  }
});

// Clear transcript for a room (admin/cleanup)
router.delete('/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    await Transcript.deleteOne({ roomId });
    
    res.json({
      success: true,
      message: 'Transcript cleared'
    });
  } catch (error) {
    console.error('Error clearing transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear transcript'
    });
  }
});

// Generate summary for late joiners
router.post('/:roomId/late-joiner-summary', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { joinedAt } = req.body; // When the user joined the meeting
    
    // Get the meeting to fetch its title
    const meeting = await Meeting.findOne({ roomId, status: 'active' });
    const meetingTitle = meeting?.title || 'Meeting';
    
    // Get transcript entries before the user joined
    const transcript = await Transcript.findOne({ roomId });
    
    if (!transcript || !transcript.entries || transcript.entries.length === 0) {
      return res.json({
        success: true,
        summary: null,
        message: 'No transcript available for summary'
      });
    }
    
    // Filter entries created before the user joined
    const preJoinEntries = transcript.entries.filter(entry => 
      entry.createdAt < new Date(joinedAt)
    );
    
    if (preJoinEntries.length === 0) {
      return res.json({
        success: true,
        summary: null,
        message: 'No pre-join discussion to summarize'
      });
    }
    
    console.log(`[Transcript] Generating late joiner summary for ${preJoinEntries.length} entries`);
    
    // Try to generate AI summary
    try {
      const { generateLateJoinerSummary, validateGeminiConfig } = await import('../services/geminiSummaryService.js');
      
      if (validateGeminiConfig()) {
        const summary = await generateLateJoinerSummary(preJoinEntries, meetingTitle);
        
        if (summary && summary.trim().length > 0) {
          console.log(`[Transcript] ✅ Late joiner summary generated (${summary.length} characters)`);
          return res.json({
            success: true,
            summary: summary.trim(),
            entriesCount: preJoinEntries.length
          });
        }
      }
    } catch (aiError) {
      console.error('[Transcript] Error generating AI summary for late joiner:', aiError);
    }
    
    // Fallback: No summary if AI fails (user will just see transcripts)
    res.json({
      success: true,
      summary: null,
      message: 'AI summary not available, showing transcripts only'
    });
    
  } catch (error) {
    console.error('Error generating late joiner summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary'
    });
  }
});

export default router;