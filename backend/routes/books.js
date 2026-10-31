const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Book = require('../models/Book');
const { verifyToken, isAdmin } = require('./auth');
const { upload } = require('../config/multer');

const JWT_SECRET = 'your_jwt_secret_key_2024';

// Helper function to get token from header or query parameter
function getToken(req) {
    // First check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    // Then check query parameter
    if (req.query.token) {
        return req.query.token;
    }
    return null;
}

// GET all books (for browsing - NO PDF paths)
router.get('/', verifyToken, async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        const safeBooks = books.map(book => {
            const bookObj = book.toObject();
            delete bookObj.pdfPath;
            delete bookObj.previewPath;
            return {
                _id: bookObj._id,
                title: bookObj.title,
                author: bookObj.author,
                isbn: bookObj.isbn,
                category: bookObj.category,
                totalCopies: bookObj.totalCopies,
                availableCopies: bookObj.availableCopies,
                price: bookObj.price || 99,
                description: bookObj.description || '',
                coverImage: bookObj.coverImage || '',
                publisher: bookObj.publisher,
                publishedYear: bookObj.publishedYear,
                pages: bookObj.pages,
                hasPreview: bookObj.hasPreview,
                hasFullPdf: bookObj.hasFullPdf
            };
        });
        res.json(safeBooks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single book
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        
        const bookObj = book.toObject();
        delete bookObj.pdfPath;
        delete bookObj.previewPath;
        
        res.json(bookObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST add new book (Admin only) - WITH PDF UPLOAD
router.post('/', verifyToken, isAdmin, upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Files:', req.files);
        
        const { title, author, isbn, category, totalCopies, description, price, publisher, publishedYear, pages } = req.body;

        if (!title || !author || !isbn) {
            return res.status(400).json({ message: 'Title, author, and ISBN are required' });
        }

        const existing = await Book.findOne({ isbn });
        if (existing) {
            return res.status(400).json({ message: 'ISBN already exists' });
        }

        const bookData = {
            title: title,
            author: author,
            isbn: isbn,
            category: category || 'Other',
            totalCopies: parseInt(totalCopies) || 1,
            availableCopies: parseInt(totalCopies) || 1,
            description: description || '',
            price: parseInt(price) || 99,
            publisher: publisher || '',
            publishedYear: publishedYear ? parseInt(publishedYear) : null,
            pages: pages ? parseInt(pages) : null,
            hasFullPdf: false,
            hasPreview: false
        };

        // Handle PDF file upload
        if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
            bookData.pdfPath = req.files.pdfFile[0].path;
            bookData.hasFullPdf = true;
            bookData.hasPreview = true;
            bookData.previewPath = req.files.pdfFile[0].path;
            console.log('PDF saved at:', bookData.pdfPath);
        }

        // Handle cover image upload
        if (req.files && req.files.coverImage && req.files.coverImage[0]) {
            bookData.coverImage = req.files.coverImage[0].path;
        }

        const book = new Book(bookData);
        const saved = await book.save();
        console.log('Book saved successfully:', saved.title);
        
        res.status(201).json(saved);
    } catch (error) {
        console.error('Error adding book:', error);
        res.status(400).json({ message: error.message });
    }
});

// DELETE book
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        await book.deleteOne();
        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ PREVIEW BOOK (Accepts token from header or query) ============
router.get('/preview/:id', async (req, res) => {
    try {
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }
        
        // Verify token
        let userId;
        let userRole;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
            userRole = decoded.role;
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        // Check if user has borrowed this book
        const Transaction = require('../models/Transaction');
        const hasBorrowed = await Transaction.findOne({
            bookId: req.params.id,
            memberId: userId,
            status: 'ISSUED'
        });

        // Admin can preview any book
        if (!hasBorrowed && userRole !== 'admin') {
            return res.status(403).json({ message: 'You need to borrow this book first to preview content' });
        }

        if (!book.hasPreview || !book.previewPath || !fs.existsSync(book.previewPath)) {
            return res.status(404).json({ message: 'Preview not available for this book' });
        }

        res.sendFile(path.resolve(book.previewPath));
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============ DOWNLOAD BOOK (Accepts token from header or query) ============
router.get('/download/:id', async (req, res) => {
    try {
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }
        
        // Verify token
        let userId;
        let userRole;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
            userRole = decoded.role;
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        // Check if user has purchased this book
        const Purchase = require('../models/Purchase');
        const hasPurchased = await Purchase.findOne({
            bookId: req.params.id,
            userId: userId,
            status: 'completed'
        });

        // Admin can download any book
        if (!hasPurchased && userRole !== 'admin') {
            return res.status(403).json({ message: 'You need to purchase this book first to download' });
        }

        if (!book.hasFullPdf || !book.pdfPath || !fs.existsSync(book.pdfPath)) {
            return res.status(404).json({ message: 'Download not available for this book' });
        }

        // Update download count
        book.downloadCount = (book.downloadCount || 0) + 1;
        await book.save();

        if (hasPurchased) {
            hasPurchased.downloadCount = (hasPurchased.downloadCount || 0) + 1;
            await hasPurchased.save();
        }

        res.download(book.pdfPath, `${book.title}.pdf`);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;