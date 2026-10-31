const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const Member = require('../models/Member');
const BookRequest = require('../models/BookRequest');
const Notification = require('../models/Notification');
const { verifyToken, isAdmin } = require('./auth');
const { sendBookIssuedEmail, sendDueDateReminder, sendOverdueEmail, sendLowStockAlert } = require('../config/email');

const BORROW_DAYS = 2;
const GRACE_DAYS = 1;
const FINE_PER_DAY = 5;

// ============ HELPER FUNCTIONS ============

// Create notification for a specific user
async function createNotification(userId, userEmail, type, title, message) {
    try {
        const notification = new Notification({ userId, userEmail, type, title, message, read: false });
        await notification.save();
        console.log(`📢 Notification created for ${userEmail}: ${title}`);
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// Create notification for ALL ADMINS
async function createAdminNotification(title, message, type = 'system') {
    try {
        const admins = await Member.find({ role: 'admin' });
        const notifications = [];
        for (const admin of admins) {
            const notification = new Notification({
                userId: admin._id,
                userEmail: admin.email,
                type: type,
                title: title,
                message: message,
                read: false
            });
            await notification.save();
            notifications.push(notification);
            console.log(`📢 Admin notification sent to ${admin.email}: ${title}`);
        }
        return notifications;
    } catch (error) {
        console.error('Error creating admin notification:', error);
    }
}

async function canUserBorrow(memberId) {
    const user = await Member.findById(memberId);
    if (!user) return { canBorrow: false, reason: 'User not found' };
    if (user.isBlocked) return { canBorrow: false, reason: 'Your account is blocked due to overdue books. Please contact admin.' };
    
    const activeIssues = await Transaction.countDocuments({ memberId, status: 'ISSUED' });
    if (activeIssues >= user.maxBooksAllowed) {
        return { canBorrow: false, reason: `Maximum ${user.maxBooksAllowed} books limit reached` };
    }
    
    const overdueBooks = await Transaction.find({ memberId, status: 'ISSUED', dueDate: { $lt: new Date() } });
    if (overdueBooks.length > 0) {
        return { canBorrow: false, reason: `Return ${overdueBooks.length} overdue book(s) first` };
    }
    
    return { canBorrow: true, user };
}

// ============ ADMIN ROUTES ============

router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate('bookId', 'title author')
            .populate('memberId', 'name email')
            .sort({ issueDate: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/issue', verifyToken, isAdmin, async (req, res) => {
    try {
        const { bookId, memberId, dueDays = BORROW_DAYS + GRACE_DAYS } = req.body;
        
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        if (book.availableCopies <= 0) return res.status(400).json({ message: 'Book not available' });
        
        const member = await Member.findById(memberId);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        
        const borrowCheck = await canUserBorrow(memberId);
        if (!borrowCheck.canBorrow) return res.status(400).json({ message: borrowCheck.reason });
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);
        
        const transaction = new Transaction({ bookId, memberId, dueDate });
        await transaction.save();
        
        book.availableCopies -= 1;
        await book.save();
        
        member.booksIssued += 1;
        await member.save();
        
        // Send email
        await sendBookIssuedEmail(member.email, member.name, book.title, dueDate);
        
        // User notification
        await createNotification(memberId, member.email, 'borrow', '📚 Book Borrowed', 
            `You borrowed "${book.title}". Please return by ${dueDate.toLocaleDateString()}`);
        
        // ADMIN NOTIFICATION - Book Issued
        await createAdminNotification(
            '📚 Book Issued',
            `${member.name} borrowed "${book.title}"`,
            'borrow'
        );
        
        // Low stock alert
        if (book.availableCopies <= 2) {
            await sendLowStockAlert(process.env.ADMIN_EMAIL || 'admin@library.com', book.title, book.availableCopies);
            
            // ADMIN NOTIFICATION - Low Stock
            await createAdminNotification(
                '⚠️ Low Stock Alert',
                `Book "${book.title}" has only ${book.availableCopies} copies left. Please add more copies.`,
                'low_stock'
            );
        }
        
        const populated = await Transaction.findById(transaction._id).populate('bookId', 'title author').populate('memberId', 'name email');
        res.status(201).json(populated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/return/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        if (transaction.status === 'RETURNED') return res.status(400).json({ message: 'Already returned' });
        
        const book = await Book.findById(transaction.bookId);
        const member = await Member.findById(transaction.memberId);
        
        transaction.returnDate = new Date();
        const due = new Date(transaction.dueDate);
        const returned = new Date(transaction.returnDate);
        
        const graceEnd = new Date(due);
        graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);
        
        let fineAmount = 0;
        let message = '';
        
        if (returned > graceEnd) {
            const daysLate = Math.ceil((returned - graceEnd) / (1000 * 60 * 60 * 24));
            fineAmount = daysLate * FINE_PER_DAY;
            transaction.fineAmount = fineAmount;
            transaction.status = 'RETURNED';
            member.totalFine = (member.totalFine || 0) + fineAmount;
            await member.save();
            message = ` Book was overdue. Fine: ₹${fineAmount}`;
        } else {
            transaction.fineAmount = 0;
            transaction.status = 'RETURNED';
            message = ' Book returned on time. No fine.';
        }
        
        await transaction.save();
        
        book.availableCopies += 1;
        await book.save();
        
        member.booksIssued -= 1;
        await member.save();
        
        // User notification
        await createNotification(member._id, member.email, 'return', '📚 Book Returned',
            `You returned "${book.title}".${message}`);
        
        // ADMIN NOTIFICATION - Book Returned
        await createAdminNotification(
            '📚 Book Returned',
            `${member.name} returned "${book.title}".${fineAmount > 0 ? ` Fine collected: ₹${fineAmount}` : ''}`,
            'return'
        );
        
        const overdueBooks = await Transaction.countDocuments({ memberId: member._id, status: 'ISSUED', dueDate: { $lt: new Date() } });
        if (overdueBooks === 0 && member.isBlocked) {
            member.isBlocked = false;
            await member.save();
            await createNotification(member._id, member.email, 'return', '✅ Account Unblocked',
                'Your account has been unblocked. You can now borrow books again.');
        }
        
        res.json(transaction);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ============ USER SELF-SERVICE ROUTES ============

router.get('/my-books', verifyToken, async (req, res) => {
    try {
        const transactions = await Transaction.find({ memberId: req.user.id, status: 'ISSUED' })
            .populate('bookId', 'title author isbn');
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/user-borrow', verifyToken, async (req, res) => {
    try {
        const { bookId } = req.body;
        const memberId = req.user.id;
        
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        if (book.availableCopies <= 0) return res.status(400).json({ message: 'Book not available' });
        
        const borrowCheck = await canUserBorrow(memberId);
        if (!borrowCheck.canBorrow) return res.status(400).json({ message: borrowCheck.reason });
        
        const member = await Member.findById(memberId);
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + BORROW_DAYS + GRACE_DAYS);
        
        const transaction = new Transaction({ bookId, memberId, dueDate });
        await transaction.save();
        
        book.availableCopies -= 1;
        await book.save();
        
        member.booksIssued += 1;
        await member.save();
        
        // Send email
        await sendBookIssuedEmail(member.email, member.name, book.title, dueDate);
        
        // User notification
        await createNotification(memberId, member.email, 'borrow', '📚 Book Borrowed', 
            `You borrowed "${book.title}". Please return by ${dueDate.toLocaleDateString()}`);
        
        // ADMIN NOTIFICATION - User Borrowed Book
        await createAdminNotification(
            '📚 Book Issued',
            `${member.name} borrowed "${book.title}"`,
            'borrow'
        );
        
        // Low stock alert
        if (book.availableCopies <= 2) {
            await sendLowStockAlert(process.env.ADMIN_EMAIL, book.title, book.availableCopies);
            
            // ADMIN NOTIFICATION - Low Stock
            await createAdminNotification(
                '⚠️ Low Stock Alert',
                `Book "${book.title}" has only ${book.availableCopies} copies left. Please add more copies.`,
                'low_stock'
            );
        }
        
        res.status(201).json(transaction);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/user-return/:id', verifyToken, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        
        if (transaction.memberId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'You can only return your own books' });
        }
        if (transaction.status === 'RETURNED') return res.status(400).json({ message: 'Book already returned' });
        
        const book = await Book.findById(transaction.bookId);
        const member = await Member.findById(transaction.memberId);
        
        transaction.returnDate = new Date();
        const due = new Date(transaction.dueDate);
        const returned = new Date(transaction.returnDate);
        
        const graceEnd = new Date(due);
        graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);
        
        let fineAmount = 0;
        let message = '';
        
        if (returned > graceEnd) {
            const daysLate = Math.ceil((returned - graceEnd) / (1000 * 60 * 60 * 24));
            fineAmount = daysLate * FINE_PER_DAY;
            transaction.fineAmount = fineAmount;
            transaction.status = 'RETURNED';
            member.totalFine = (member.totalFine || 0) + fineAmount;
            await member.save();
            message = ` Fine: ₹${fineAmount}`;
        } else {
            transaction.fineAmount = 0;
            transaction.status = 'RETURNED';
            message = ' No fine.';
        }
        
        await transaction.save();
        
        book.availableCopies += 1;
        await book.save();
        
        member.booksIssued -= 1;
        await member.save();
        
        // User notification
        await createNotification(member._id, member.email, 'return', '📚 Book Returned',
            `You returned "${book.title}".${message}`);
        
        // ADMIN NOTIFICATION - User Returned Book
        await createAdminNotification(
            '📚 Book Returned',
            `${member.name} returned "${book.title}".${fineAmount > 0 ? ` Fine collected: ₹${fineAmount}` : ''}`,
            'return'
        );
        
        const overdueBooks = await Transaction.countDocuments({ memberId: member._id, status: 'ISSUED', dueDate: { $lt: new Date() } });
        if (overdueBooks === 0 && member.isBlocked) {
            member.isBlocked = false;
            await member.save();
        }
        
        res.json({ message: 'Book returned successfully', fineAmount });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ============ BOOK REQUEST SYSTEM ============

router.post('/request-book', verifyToken, async (req, res) => {
    try {
        const { bookId, bookTitle } = req.body;
        const user = await Member.findById(req.user.id);
        
        const existing = await BookRequest.findOne({ bookId, userId: req.user.id, status: 'pending' });
        if (existing) return res.status(400).json({ message: 'You already requested this book' });
        
        const request = new BookRequest({
            bookId, bookTitle, userId: req.user.id,
            userName: user.name, userEmail: user.email
        });
        await request.save();
        
        // User notification
        await createNotification(req.user.id, user.email, 'request_approved', '📢 Book Request Sent',
            `Your request for "${bookTitle}" has been sent to admin.`);
        
        // ADMIN NOTIFICATION - New Book Request
        await createAdminNotification(
            '📢 New Book Request',
            `${user.name} requested more copies of "${bookTitle}"`,
            'request'
        );
        
        res.json({ message: 'Book request sent to admin' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/requests', verifyToken, isAdmin, async (req, res) => {
    try {
        const requests = await BookRequest.find().sort({ requestDate: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/requests/approve/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const request = await BookRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        
        const book = await Book.findById(request.bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        
        book.totalCopies += 2;
        book.availableCopies += 2;
        await book.save();
        
        request.status = 'approved';
        await request.save();
        
        // User notification
        await createNotification(request.userId, request.userEmail, 'request_approved', '✅ Book Request Approved',
            `Admin added 2 more copies of "${book.title}". You can now borrow it.`);
        
        res.json({ message: `Added 2 more copies of "${book.title}"` });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ============ NOTIFICATIONS ============

// Get user notifications
router.get('/notifications', verifyToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get admin notifications
router.get('/admin-notifications', verifyToken, isAdmin, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark notification as read
router.put('/notifications/read/:id', verifyToken, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET user's borrowed books
router.get('/my-books', verifyToken, async (req, res) => {
    let books = await Transaction.find({ memberId: req.user.id, status: 'ISSUED' }).populate('bookId', 'title author price isbn');
    res.json(books);
});

// ============ BORROW STATUS ============

router.get('/borrow-status', verifyToken, async (req, res) => {
    res.json(await canUserBorrow(req.user.id));
});

module.exports = router;