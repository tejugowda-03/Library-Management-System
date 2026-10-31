const mongoose = require('mongoose');

const FineSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    remainingAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'WAIVED'],
        default: 'PENDING'
    },
    dueDate: {
        type: Date,
        required: true
    },
    paidDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['ONLINE', 'CASH', 'CARD', 'UPI', 'WAIVED'],
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Fine', FineSchema);