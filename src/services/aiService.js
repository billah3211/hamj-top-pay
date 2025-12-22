const { GoogleGenerativeAI } = require("@google/generative-ai");
const { prisma } = require('../db/prisma');

const SYSTEM_INSTRUCTION = `You are the 'Hamj Top Pay Assistant'. You work for the website 'Hamj Top Pay'.
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
`;

/**
 * Get response from Gemini AI
 * @param {string} message - User's message
 * @param {Array} history - Chat history (optional) [{role: 'user'|'model', parts: [{text: '...'}]}]
 * @returns {Promise<{text: string, handover: boolean}>}
 */
async function getAIResponse(message, history = []) {
  try {
    // Fetch API Key from DB or Env
    const config = await prisma.appConfig.findUnique({ where: { key: 'GEMINI_API_KEY' } });
    const apiKey = config ? config.value : process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing in DB and environment variables");
      return {
        text: "System Configuration Error: AI Service is currently unavailable.",
        handover: true
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_INSTRUCTION
    });

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
    // Fallback response if AI fails - Auto Handover
    return {
      text: "দুঃখিত, আমি বর্তমানে উত্তর দিতে পারছি না। আমি আপনাকে একজন এডমিনের সাথে সংযুক্ত করছি।",
      handover: true 
    };
  }
}

module.exports = { getAIResponse };
