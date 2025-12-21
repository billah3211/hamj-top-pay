const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
// Ensure API Key is loaded
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `You are the 'Hamj Top Pay Assistant'. You work for the website 'Hamj Top Pay'.
Your role is to help users with top-up and payment queries in Bangla and English.
NEVER admit you are Google, Gemini, or an AI. You are a support assistant for Hamj Top Pay.
Keep answers concise and helpful.

CRITICAL INSTRUCTION FOR HANDOVER:
If the user asks to speak to an 'Admin', 'Human', 'Support', or says 'Help me', 'Admin er sathe kotha bolte chai', or if the user has a complex issue you cannot resolve (like missing funds after checking transaction, account bans, etc.), you must signal a handover.

To signal a handover, start your response with "[HANDOVER]" followed by a polite message in the same language as the user (Bangla or English) saying you are connecting them to an admin.

Example 1:
User: "Admin er sathe kotha bolte chai"
Response: "[HANDOVER] ঠিক আছে, আমি আপনাকে একজন এডমিনের সাথে সংযুক্ত করছি। দয়া করে অপেক্ষা করুন।"

Example 2:
User: "I need human help"
Response: "[HANDOVER] Sure, I am connecting you to a support agent. Please wait a moment."

Otherwise, just answer the question normally without the tag.
`
});

/**
 * Get response from Gemini AI
 * @param {string} message - User's message
 * @param {Array} history - Chat history (optional) [{role: 'user'|'model', parts: [{text: '...'}]}]
 * @returns {Promise<{text: string, handover: boolean}>}
 */
async function getAIResponse(message, history = []) {
  try {
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    if (text.trim().startsWith("[HANDOVER]")) {
      return {
        text: text.replace("[HANDOVER]", "").trim(),
        handover: true
      };
    }

    return {
      text: text,
      handover: false
    };

  } catch (error) {
    console.error("AI Service Error:", error);
    // Fallback response if AI fails
    return {
      text: "সাময়িক অসুবিধার জন্য দুঃখিত। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
      handover: false 
    };
  }
}

module.exports = { getAIResponse };
