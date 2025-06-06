const e = require('express');
const mongoose = require('mongoose');

const anonJoinRequestSchema = new mongoose.Schema({
    anonymId: {type: String, required: true},
    anonymName: {type: String, default: 'Anonymous'},
    chatId: {type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true},
    ipAddress: {type: String},
    userAgent: {type: String},
    token: {type: String, unique: true},
    status: {type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending'},
    createdAt: {type: Date, default: Date.now}, 
    approvedAt: {type: Date},
    expireAt: {type: Date, default: () => new Date(Date.now() + 5 * 60 * 60 * 1000)}, // 1 day expiration
});

const AnonJoinRequest = mongoose.model('AnonJoinRequest', anonJoinRequestSchema);
module.exports = AnonJoinRequest;