const mongoose = require("mongoose");

const messageModel = mongoose.Schema({
    sender:{ type: String, ref:"User", required: true },
    chat:{ type: mongoose.Schema.Types.ObjectId, ref:"Chat" },
    message:{ type: String, trim: true, }
},{
    timestamps: true,
})
   
const Message = mongoose.model("Message", messageModel)

module.exports = Message;