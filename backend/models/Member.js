const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const memberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    googleId: { type: String },
    membershipDate: { type: Date, default: Date.now },
    booksIssued: { type: Number, default: 0 },
    maxBooksAllowed: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    totalFine: { type: Number, default: 0 }  // ← ADD THIS LINE
}, { timestamps: true });

// Hash password before saving - ONLY HERE, not in register function
memberSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
memberSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('Member', memberSchema);