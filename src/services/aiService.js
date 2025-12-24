// Basic AI Service (Dummy Implementation)
// This service mimics the behavior of an AI response system for support chat.

const getAIResponse = async (message) => {
  // Simple logic to determine response
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
    return {
      text: "Hello! How can I help you today? If you have a specific issue, please describe it.",
      handover: false
    }
  }

  if (lowerMsg.includes('payment') || lowerMsg.includes('money') || lowerMsg.includes('withdraw')) {
    return {
      text: "For payment or withdrawal issues, I'm connecting you to a human agent who can assist you better.",
      handover: true
    }
  }

  // Default response
  return {
    text: "I'm not sure how to help with that specifically. I've notified our support team, and an agent will join shortly if needed.",
    handover: true // Default to handover for unknown queries to be safe
  }
}

module.exports = { getAIResponse }
