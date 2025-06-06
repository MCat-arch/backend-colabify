const asyncHandler = require("express-async-handler");
const Chat = require("../models/chat.model");
const User = require("../models/user.model")
const AnonJoinRequest = require("../models/anonym.model");
const shortid = require("shortid");
const { mongo, default: mongoose } = require("mongoose");

// access chat
const accessChat = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "userId not present in the request body." });
    }
    try {
        const existingChat = await Chat.findOne({
            isGroupChat: false,
            users: { $all: [req.user._id, userId] }
        }).populate("users", "-password").populate("latestMessage").populate("latestMessage.sender");

        if (existingChat) {
            return res.status(200).json(existingChat);
        }

        const newChat = new Chat({
            chatName: "sender",
            isGroupChat: false,
            users: [req.user._id, userId]
        });

        await newChat.save();

        const populatedChat = await Chat.findOne({ _id: newChat._id }).populate("users", "-password");

        res.status(201).json(populatedChat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// get chat
const getChats = async (req, res) => {
    try {
        const chats = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
            .populate('users', 'pic email name _id') // Populate the 'users' field with only the specified fields
            .populate('latestMessage') // Populate the 'latestMessage' field
            .populate('latestMessage.sender', '-password'); // Populate the sender of the latest message

        if (chats.length === 0) {
            return res.status(422).json({ message: "No chats found." });
        }

        res.status(200).json(chats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// create group chat 
const createGroupChat = asyncHandler(async (req, res) => {

    if (!req.body.users && !req.body.name) {
        return res.status(422).json({ error: "Please fill all the details." })
    }

    let users = JSON.parse(req.body.users);

    if (users.length < 2) {
        return res.status(422).json({ error: "Minimum two users are required to create a group." })
    }

    users.push(req.user._id);

    try {

        const existingChat = await Chat.findOne({
            users: { $all: users },
            isGroupChat: true
        }).populate("users", "-password").populate("groupAdmin", "-password");

        if (existingChat) {
            return res.status(200).json(existingChat);
        }

        const chatGroup = await Chat.create({
            chatName: req.body.name,
            users,
            isGroupChat: true,
            groupAdmin: req.user._id
        })

        const groupChatObj = await Chat.findOne({ _id: chatGroup._id }).populate("users", "-password").populate("groupAdmin", "-pasdsword")
        res.status(201).json(groupChatObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

// rename group chat
const renameGroup = asyncHandler(async (req, res) => {

    const { chatId, chatName } = req.body;

    if (!chatName || !chatId) {
        res.status(422).json({ error: "Please Enter New Name or provide chat id" })
    }
    const chat = await Chat.findById(chatId);
    if(!chat){
        return res.status(404).json({error: "Chat not found."});
    }
    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "Only group admin can rename the group." });
    }

    const newChatObj = await Chat.findByIdAndUpdate(
        chatId,
        { chatName, },
        { new: true }
    ).populate("users", "-password").populate("groupAdmin", "-password")

    if (!newChatObj) {
        res.status(404).json({ error: "Chat Not Found." })
    }
    else {
        res.status(200).json(newChatObj)
    }

})


// Remove user from chat group
const removeFromGroup = asyncHandler(async (req, res) => {
    const { chatId, userId } = req.body;
    if (!chatId || !userId || userId.length === 0) {
        return res.status(422).json({ error: "Please provide chatId and userId." });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
        return res.status(404).json({ error: "Chat not found." });
    }
    if( chat.groupAdmin.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "Only group admin can remove users from the group." });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        { $pull: { users: userId } },
        { new: true }
    )
        .populate("users", "-password")
        .populate("groupAdmin", "-password");

    if (!updatedChat) {
        return res.status(404).json({ error: "Chat not found." });
    } else {
        return res.status(200).json(updatedChat);
    }
});



// add other user to chat group
const addToGroup = asyncHandler(async (req, res) => {

    const { chatId, userId } = req.body;
    if (!chatId || !userId) {
        return res.status(422).json({ error: "Please provide chatId and userId." });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
        return res.status(404).json({ error: "Chat not found." });
    }

    if(chat.groupAdmin.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "Only group admin can add users to the group." });
    }
    
    const newChatObj = await Chat.findByIdAndUpdate(
        chatId,
        { $addToSet: { users: userId } },
        { new: true }
    ).populate("users", "-password").populate("groupAdmin", "-password")

    if (!newChatObj) {
        res.status(404).json({ error: "Chat Not Found." })
    }
    else {
        res.status(200).json({data:newChatObj, message:"Successfully added to group"})
    }

})

const exitGroup = asyncHandler(async (req, res) => {
  const { chatId, anonymId } = req.body;

  if (!chatId) {
    return res.status(422).json({ error: "Please provide chatId." });
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found." });
  }

  if (anonymId) {
    // Keluarkan anonym
    chat.anonymUsers = chat.anonymUsers.filter(user => user._id !== anonymId);
    await chat.save();
    return res.status(200).json({ message: "Anonym user exited the group.", chat });
  }

  if (chat.groupAdmin?.toString() === req.user._id.toString()) {
    return res.status(403).json({ error: "Group admin cannot exit the group." });
  }

  // Keluarkan user biasa
  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { users: req.user._id } },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  res.status(200).json(updatedChat);
});

const deleteChatForUser = asyncHandler(async (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: "chatId is required" });
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found." });
  }

  // Cek apakah chat milik dia (bukan groupAdmin yang harus stay)
  if (chat.isGroupChat && chat.groupAdmin.toString() === req.user._id.toString()) {
    return res.status(403).json({ error: "Group admin cannot delete the chat for themselves." });
  }

  // Keluarkan user dari chat
  chat.users = chat.users.filter(u => u.toString() !== req.user._id.toString());
  await chat.save();

  res.status(200).json({ message: "Chat removed for user." });
});

const joinGroup = asyncHandler(async (req, res) => {
    const {chatId, username} = req.body;
    if(!chatId){
        return res.status(400).json({ error: "chatId is required" });
    }

    const chat = await Chat.findById(chatId);
    if(!chat){
        return res.status(404).json({ error: "Chat not found." });
    }
    if(!chat.isGroupChat){
        return res.status(400).json({ error: "This is not a group chat." });
    }

    let newMember;

    if(req.user){
        newMember = req.user._id;
    
    if(chat.users.includes(newMember)){
        return res.status(400).json({ error: "You are already a member of this group." });
    }

    chat.users.push(newMember);
    }else{
        if(!username){
            return res.status(400).json({ error: "Username is required for anonymous users." });
        }

        const anonymUser = {
            _id : `Anonym_${shortid.generate()}`,
            name: username,
        };

        const isDuplicate = chat.anonymUsers.some(user => user.name === username);
        if(isDuplicate){
            return res.status(400).json({ error: "Anonym user with this name already exists in the group." });
        }
        chat.anonymUsers.push(anonymUser);
    }
});

const joinAnonChat = asyncHandler(async (req, res) => {
    const {token} = req.params;
    const {anonymName, anonymId} = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    try{const requestToken = await AnonJoinRequest.findOne({token});
    if(!requestToken){
        return res.status(404).json({ error: "Invalid or expired token." });
    }

    const existing = await AnonJoinRequest.findOne({
        chatId: requestToken.chatId,
        anonymId,
    });

    if(existing){
        return res.status(400).json({ error: "Anonym user already exists in this chat or you already join before" });

    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours expiration
    const newRequest = new AnonJoinRequest({
       anonymId,
       anonymName,
       chatId: requestToken.chatId,
        ipAddress,
         userAgent,
         status: 'pending',
         token,
         expiresAt, 
    });
    await newRequest.save();
    res.status(200).json({ message: "Join request created successfully. Wait for approval." });
} catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const generateGroupToken = asyncHandler(async (req, res) => {
  const { chatId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroupChat) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Hanya admin grup yang bisa generate
    if (String(chat.groupAdmin) !== String(req.user._id)) {
      return res.status(403).json({ error: "Only admin can generate token" });
    }

    const token = shortid.generate();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    chat.groupAnonToken = token;
    chat.groupAnonTokenExpires = expires;
    await chat.save();

    res.status(200).json({
      token,
      expiresAt: expires,
      chatId: chat._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error." });
  }
});

const aprroveAnonJoin = asyncHandler(async (req, res) => {
     const { requestId } = req.body;

  try {
    const request = await AnonJoinRequest.findById(requestId).populate("chatId");

    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Request not found or already processed" });
    }

    const chat = request.chatId;
    if (!chat || !chat.isGroupChat) {
      return res.status(400).json({ error: "Invalid group" });
    }

    // Hanya admin grup yang bisa approve
    if (String(chat.groupAdmin) !== String(req.user._id)) {
      return res.status(403).json({ error: "Only admin can approve" });
    }

    request.status = "approved";
    request.approvedAt = new Date();
    await request.save();

    res.status(200).json({
      message: "Anon join request approved",
      anonymId: request.anonymId,
      chatId: chat._id,
    });

    io.to(chat._id).emit("anon approved", {
    anonymId: request.anonymId,
    anonymName: request.anonymName,
    chatId: chat._id,
  });

    // Optional: bisa pakai WebSocket emit notifikasi ke anonym

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error." });
  }
})





module.exports = { accessChat, getChats, createGroupChat, renameGroup, removeFromGroup, addToGroup, exitGroup, deleteChatForUser, joinGroup, joinAnonChat, generateGroupToken, aprroveAnonJoin };