// llm.js
import OpenAI from "openai";
import axios from 'axios';

// Only initialize OpenAI if API key is provided
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export async function generateReply(prompt) {
  // const resp = await openai.chat.completions.create({
  //   model: "gpt-4o-mini",
  //   messages: [
  //     { role: "system", content: "You are a helpful avatar assistant." },
  //     { role: "user",   content: prompt }
  //   ]
  // });
  // return resp.choices[0].message.content.trim();

  // ✅ new: call our internal Avatar Chat API
  const solrhost    = process.env.SOLR_HOST   || 'clavisds01.feeltiptop.com';
  const coll        = process.env.COLL        || '360calls-speaker';
  const whoseavatar = process.env.WHOSE_AVATAR || '';
  const numutter    = process.env.NUMUTTER    || 3;

  // build the GET-URL with proper escaping
  const apiUrl = `https://feeltiptop.com/demos/ent/Chat/chatapi.php` +
    `?solrhost=${solrhost}` +
    `&coll=${coll}` +
    `&queryconstraint=speaker_t:%22${encodeURIComponent(whoseavatar)}%22` +
    `&details=1` +
    `&numutter=${numutter}` +
    `&status=${encodeURIComponent(prompt)}`;

  try{
    const resp = await axios.get(apiUrl);
    // Return the full raw API JSON (pretty-printed) so the client sees everything
    return JSON.stringify(resp.data, null, 2);
  } catch (e) {
    // log the real error so you can inspect it in your Render logs
    console.error('[generateReply] Avatar API failed:', e.response?.data || e.message);
    // return a sensible fallback instead of throwing
    return `Avatar API error: ${e.message}`;
  }


}