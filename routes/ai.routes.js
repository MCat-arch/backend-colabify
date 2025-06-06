const express = require("express");
const { askAI } = require("../controller/ai.controller");

const router = express.Router();

router.post("/ask", askAI);

module.exports = router;
