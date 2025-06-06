// server/controllers/ai.controller.js
const OpenAI = require('openai');
const dotenv = require("dotenv");
const AIMessage = require("../models/aiMessage.model");
const Message = require("../models/message.model");
dotenv.config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000", // Sesuaikan dengan URL frontend
    "X-Title": process.env.SITE_NAME || "Collabify", // Nama aplikasi
  },
});

// Konfigurasi model
const generationConfig = {
  temperature: 0.7, // Sedikit kreativitas, bisa disesuaikan
  max_tokens: 8192, // Maksimum token, sesuai Gemini sebelumnya
};

// In-memory session cache (untuk riwayat percakapan)
const userSessions = {};

const instruction = {
  role: "system",
  content: `You are a programming error-solving expert. Your goal is to provide accurate, beginner-friendly, and concise answers to programming errors based on verified knowledge.
  Follow these strict guidelines to avoid hallucination:
  1. Rely solely on verified programming knowledge. Do not invent solutions or details.
  2. If you lack sufficient information to answer accurately, say: "I don’t have enough information to answer accurately. Please provide more details or a code snippet."
  3. For each response, include:
     - A brief explanation of the error.
     - A corrected code example (if applicable).
     - A question asking if the user needs further clarification.
  4. For follow-up questions, reference the original error and prior responses in the conversation history to maintain context.
  5. Avoid jargon and ensure explanations are clear for beginners.
  6. Support all major programming languages (e.g., Python, JavaScript, Java, C++).
  7. If the query involves deprecated methods, note this and suggest modern alternatives only if certain.`,
};

const askAI = async (req, res) => {
  const { prompt, user_id, anonym_id, anonym_name } = req.body;

  if (!prompt) {
    console.log('Missing prompt in request');
    return res.status(400).json({ error: "Prompt is required" });
  }

  const identifier = user_id || anonym_id || `anonym_${Date.now()}`;
  console.log('AI Request:', { identifier, prompt });

  try {
    // Inisialisasi sesi jika belum ada
    if (!userSessions[identifier]) {
      console.log('Starting new session for:', identifier);
      userSessions[identifier] = [{ role: "system", content: instruction.content }];
    }

    // Tambahkan prompt ke riwayat
    userSessions[identifier].push({ role: "user", content: prompt });

    // Kirim ke OpenRouter
    console.log('Sending to OpenRouter:', userSessions[identifier]);
    const completion = await openai.chat.completions.create({
      model: "mistralai/devstral-small:free",
      messages: userSessions[identifier],
      ...generationConfig,
    });

    const aiReply = completion.choices[0].message.content;
    console.log('AI Reply:', aiReply);

    // Tambahkan respons AI ke riwayat
    userSessions[identifier].push({ role: "assistant", content: aiReply });

    // Simpan ke database
    const saved = await AIMessage.create({
      user: user_id || null,
      anonym_id: anonym_id || null,
      anonym_name: anonym_name || "Anonymous",
      prompt,
      reply: aiReply,
    });
    console.log('Saved AIMessage:', saved);

    if(req.body.chatId){
      const newMessage = await Message.create({
        sender:"Chatbot",
        chat: req.body.chatId,
        message: aiReply,
      });

      const fullMessage = await Message.findById(newMessage._id)
        .populate("chat")
        .populate("sender")

      const io = req.app.get("io");
      io.to(req.body.chatId).emit("message recieved", fullMessage);
    }

    //return res.json({ reply: aiReply });
  } catch (error) {
    console.error("AI error:", error.message || error);
    return res.status(500).json({ error: "Something went wrong with AI service" });
  }
};

module.exports = { askAI };


