const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    name: {type: String, required: function() { return this.role !== 'anonymous'; }},
    email: { type:String, required: function() {return this.role !== 'anonymous';} },
    password:{type: String, required: function() { return this.role !== 'anonymous'; }},
    role: { type: String, enum: ['user', 'anonymous'], default: 'user' },
    pic:{type:String,required: true, default: "https://www.google.com/url?sa=i&url=https%3A%2F%2Fpixabay.com%2Fvectors%2Fblank-profile-picture-mystery-man-973460%2F&psig=AOvVaw2QeCobo5aibROYjZFUy1Bn&ust=1748572037812000&source=images&cd=vfe&opi=89978449&ved=0CBEQjRxqFwoTCKjQvcvQx40DFQAAAAAdAAAAABAE"}
},{
    timestamps: true
});

const User = mongoose.model("User", userSchema)

module.exports = User;
