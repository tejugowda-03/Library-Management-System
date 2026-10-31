const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    bookTitle: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['UPI', 'Card', 'Wallet'], default: 'Card' },
    paymentId: { type: String },
    purchaseDate: { type: Date, default: Date.now },
    downloadUrl: { type: String },
    downloadCount: { type: Number, default: 0 },
    status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' }
});

module.exports = mongoose.model('Purchase', purchaseSchema);