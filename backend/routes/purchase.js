const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Book = require('../models/Book');
const { verifyToken, isAdmin } = require('./auth');

// Get user's purchased books
router.get('/my-purchases', verifyToken, async (req, res) => {
    try {
        const purchases = await Purchase.find({ userId: req.user.id })
            .populate('bookId', 'title author coverImage price')
            .sort({ purchaseDate: -1 });
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Purchase a book
router.post('/buy/:bookId', verifyToken, async (req, res) => {
    try {
        const { paymentMethod, paymentId } = req.body;
        const book = await Book.findById(req.params.bookId);
        
        if (!book) return res.status(404).json({ message: 'Book not found' });
        
        // Check if already purchased
        const existing = await Purchase.findOne({
            userId: req.user.id,
            bookId: req.params.bookId,
            status: 'completed'
        });
        
        if (existing) {
            return res.status(400).json({ message: 'You already purchased this book' });
        }
        
        const purchase = new Purchase({
            userId: req.user.id,
            bookId: req.params.bookId,
            bookTitle: book.title,
            amount: book.price || 99,
            paymentMethod: paymentMethod || 'Card',
            paymentId: paymentId || 'DEMO_' + Date.now(),
            status: 'completed'
        });
        
        await purchase.save();
        
        res.json({
            message: `Successfully purchased "${book.title}" for ₹${book.price || 99}`,
            purchase: purchase
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;