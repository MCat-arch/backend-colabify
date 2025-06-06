const express = require("express");
const dotenv = require("dotenv");
const connectionDB = require("./config/db");
const userRoutes = require("./routes/user.routes");
const chatRoutes = require("./routes/chat.routes");
const messageRoutes = require("./routes/message.routes");
const aiRoutes = require("./routes/ai.routes");
const cors = require('cors');
const axios = require('axios');
const shortid = require('shortid');
const Chat = require("./models/chat.model");
const Message = require("./models/message.model");

const app = express();
dotenv.config();
connectionDB();
app.use(cors({ origin: ["https://frontend-collabify.vercel.app","http://localhost:3000"] }));
app.use(express.json());

app.get("/", (req, res) => {
    console.log("welcome to chat app");
    res.send("Welcome to Chat App");
});

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/ai", aiRoutes);

const port = process.env.PORT || 8001;
const server = app.listen(port, console.log(`Server is running at port = ${port}`));

const io = require("socket.io")(server, {
    cors: {
        origin: ["https://frontend-collabify.vercel.app", "http://localhost:3000"]
    },
});


// const searchRepos = async (query) => {
//     try {
//         const response = await axios.get(`https://api.github.com/search/repositories?q=${query}`, {
//             headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
//         });
//         return response.data.items.map(repo => ({
//             name: repo.full_name,
//             description: repo.description || 'No description',
//             url: repo.html_url
//         }));
//     } catch (error) {
//         return [{ error: 'Failed to fetch repositories' }];
//     }
// };

io.on("connection", (socket) => {
    socket.on("setup", (userData) => {
        if (userData && userData._id) {
            socket.userId = userData._id; // Simpan ID untuk user login
            socket.join(userData._id);
            socket.emit("connected");
        } else {
            socket.userId = null; // Untuk anonym
        }
    });

    socket.on("join chat", async ({ chatId, anonymId, anonymName }) => {
        const chat = await Chat.findById(chatId)
            .populate("users", "-password")
            .populate("groupAdmin", "-password")

         const request = await AnonJoinRequest.findOne({ anonymId, chatId });
        if (!request || !request.approvedAt) {
            socket.emit("message", { error: "Access not approved yet" });
            return;
        }

        const now = Date.now();
        const expireTime = new Date(request.expiresAt).getTime();

        // Sudah expired
        if (now > expireTime) {
            socket.emit("message", { error: "Your session has expired" });
            return;
        }

        // Simpan ke socket & join room
        //socket.join(chatId);
        socket.anonymId = anonymId;
        socket.anonymName = anonymName;
        socket.chatId = chatId;

        socket.emit("message", {
            content: `Welcome, Anonym ${anonymName}`,
            sender: "Chatbot"
        });

        // AUTO-KICK: Set timer untuk disconnect setelah session expired
        const timeLeft = expireTime - now;
        setTimeout(() => {
            if (socket.connected) {
            socket.leave(chatId);
            socket.emit("message", { content: "Your session has expired. You've been removed from the group.", sender: "Chatbot" });
            socket.disconnect();
            }
        }, timeLeft);
        if (socket.anonymId) {
        const session = await AnonymousSession.findOne({ anonymId: socket.anonymId, chatId });

        if (!session || !session.approved || new Date() > session.expiresAt) {
            socket.emit("message", { content: "Access denied. You are not approved or session expired.", sender: "Chatbot" });
            return;
        }
        }

        if (!chat) {
            socket.emit("message", { error: "Chat not found" });
            return;
        }
        if (!anonymId && !socket.userId) {
            socket.emit("message", { error: "Authentication required"});
            return;
        }
        if (anonymId && !chat.isGroupChat) {
            socket.emit("message", { error: "Anonym users can only join group chats"});
            return;
        }
        //socket.join(chatId);
        socket.anonymId = anonymId || null;
        socket.anonymName = anonymName || null;
        socket.emit("message", {
            content: `Joined ${chat.isGroupChat ? 'group' : 'chat'} ${chat.chatName || 'with user'}`,
            sender: "Chatbot"
        });
    });

    socket.on("new message", async ({ chatId, content, sender }) => {
    console.log('New message:', { chatId, content, sender });
    const chat = await Chat.findById(chatId);
    if (!chat) {
        socket.emit("message", { content: "Chat not found", sender: "Chatbot" });
        return;
    }
    if (!chat.isGroupChat && socket.anonymId && chatId !== "AI_CHATBOT") {
        socket.emit("message", { content: "Anonym users cannot send messages in one-to-one chats", sender: "Chatbot" });
        return;
    }
    const message = new Message({
        message: content,
        sender: sender || (socket.anonymId ? `Anonym_${socket.anonymName}` : socket.userId || "Chatbot"),
        chat: chatId,
    });
    await message.save();
    chat.latestMessage = message._id;
    await chat.save();
    io.to(chatId).emit("message received", message);
    });

    socket.on("group action", async ({ chatId, action, data }) => {
        if (socket.anonymId) {
            socket.emit("message", { content: "Anonym users cannot perform group actions", sender: "Chatbot" });
            return;
        }
        socket.emit("message", { content: "Use API routes for group actions", sender: "Chatbot" });
    });
});