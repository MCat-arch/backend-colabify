const express = require("express");
const { authUserMiddleware } = require("../middlewares/auth.middleware");
const { accessChat, getChats, createGroupChat, renameGroup, addToGroup, removeFromGroup, joinGroupAnonymous, exitGroup, deleteChatForUser, joinGroup, joinAnonChat, aprroveAnonJoin, generateGroupToken } = require("../controller/chat.controller");

const router = express.Router()

router.route("/").post(authUserMiddleware, accessChat)
router.route("/").get(authUserMiddleware,getChats)
router.route("/group").post(authUserMiddleware, createGroupChat)
router.route("/rename").put(authUserMiddleware, renameGroup)
router.route("/group/user/add").put(authUserMiddleware, addToGroup)
router.route("/group/user/remove").put(authUserMiddleware, removeFromGroup)

router.route("/group/user/join").post(authUserMiddleware, joinGroup)
router.route("/group/exit").post(authUserMiddleware, exitGroup)
router.route("/delete").post(authUserMiddleware, deleteChatForUser) 

router.route("/group/join-anon/:token").post(authUserMiddleware, joinAnonChat)
router.route("/approve-anon").post(authUserMiddleware, aprroveAnonJoin)
router.route("/group/generate-anon-token").post(authUserMiddleware, generateGroupToken)

module.exports = router;