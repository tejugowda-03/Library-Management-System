const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { verifyToken } = require('./auth');

// Get user's pending fine
router.get('/my-fine', verifyToken, async (req, res) => {
    try {
        const user = await Member.findById(req.user.id);
        const overdueTransactions = await Transaction.find({
            memberId: req.user.id,
            status: 'ISSUED',
            dueDate: { $lt: new Date() }
        });
        
        let totalFine = user.totalFine || 0;
        const today = new Date();
        
        for (const trans of overdueTransactions) {
            const dueDate = new Date(trans.dueDate);
            if (dueDate < today) {
                const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
                const fine = daysOverdue * 5;
                totalFine += fine;
            }
        }
        
        res.json({ totalFine, overdueCount: overdueTransactions.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Process payment
router.post('/pay-fine', verifyToken, async (req, res) => {
    try {
        const { paymentMethod, paymentId, amount } = req.body;
        
        if (!paymentMethod || !amount) {
            return res.status(400).json({ message: 'Invalid payment details' });
        }
        
        const user = await Member.findById(req.user.id);
        
        // Mark overdue transactions
        const overdueTransactions = await Transaction.find({
            memberId: req.user.id,
            status: 'ISSUED',
            dueDate: { $lt: new Date() }
        });
        
        let totalFine = 0;
        for (const trans of overdueTransactions) {
            const dueDate = new Date(trans.dueDate);
            const daysOverdue = Math.ceil((new Date() - dueDate) / (1000 * 60 * 60 * 24));
            totalFine += daysOverdue * 5;
        }
        
        user.totalFine = 0;
        await user.save();
        
        // Create notification
        const notification = new Notification({
            userId: req.user.id,
            userEmail: user.email,
            type: 'fine',
            title: '💰 Fine Paid Successfully',
            message: `You have successfully paid ₹${amount} via ${paymentMethod}. Payment ID: ${paymentId || 'N/A'}`
        });
        await notification.save();
        
        res.json({ message: `Payment of ₹${amount} successful via ${paymentMethod}` });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;