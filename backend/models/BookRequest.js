const mongoose = require('mongoose');

const bookRequestSchema = new mongoose.Schema({
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    bookTitle: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    requestDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('BookRequest', bookRequestSchema);