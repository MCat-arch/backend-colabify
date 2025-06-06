const mongoose = require("mongoose");

const aiMessageSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  prompt: {
    type: String,
    required: true,
  },
  anonym_id: { type: String, default: null },
  anonym_name: { type: String, default: "Anonymous" },
  reply: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("AIMessage", aiMessageSchema);
