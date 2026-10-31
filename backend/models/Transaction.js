const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    fineAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['ISSUED', 'RETURNED', 'OVERDUE'], default: 'ISSUED' },
    lastOverdueNotif: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);