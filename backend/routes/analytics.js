const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('./auth');
const Book = require('../models/Book');
const Member = require('../models/Member');
const Transaction = require('../models/Transaction');

// Get dashboard summary stats
router.get('/summary', verifyToken, isAdmin, async (req, res) => {
    try {
        const totalBooks = await Book.countDocuments();
        const totalMembers = await Member.countDocuments();
        const totalIssued = await Transaction.countDocuments({ status: 'ISSUED' });
        
        // Calculate total fine
        const fineResult = await Transaction.aggregate([
            { $match: { fineAmount: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$fineAmount' } } }
        ]);
        const totalFine = fineResult[0]?.total || 0;
        
        // Get books by category
        const booksByCategory = await Book.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        // Get active vs inactive users
        const usersWithBooks = await Transaction.distinct('memberId');
        const activeUsers = usersWithBooks.length;
        const inactiveUsers = totalMembers - activeUsers;
        
        res.json({
            totalBooks,
            totalMembers,
            totalIssued,
            totalFine,
            booksByCategory,
            activeUsers,
            inactiveUsers
        });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get most borrowed books
router.get('/most-borrowed', verifyToken, isAdmin, async (req, res) => {
    try {
        const mostBorrowed = await Transaction.aggregate([
            { $group: { _id: '$bookId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
            { $unwind: '$book' },
            { $project: { title: '$book.title', author: '$book.author', count: 1 } }
        ]);
        res.json(mostBorrowed);
    } catch (error) {
        console.error('Most borrowed error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get monthly trends (last 6 months)
router.get('/monthly-trends', verifyToken, isAdmin, async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const trends = await Transaction.aggregate([
            { $match: { issueDate: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { 
                    year: { $year: '$issueDate' }, 
                    month: { $month: '$issueDate' } 
                },
                issued: { $sum: 1 },
                returned: { $sum: { $cond: [{ $ne: ['$returnDate', null] }, 1, 0] } }
            }},
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatted = trends.map(t => ({
            month: monthNames[t._id.month - 1],
            issued: t.issued,
            returned: t.returned
        }));
        
        res.json(formatted);
    } catch (error) {
        console.error('Monthly trends error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get top borrowers
router.get('/top-borrowers', verifyToken, isAdmin, async (req, res) => {
    try {
        const topBorrowers = await Transaction.aggregate([
            { $group: { _id: '$memberId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'members', localField: '_id', foreignField: '_id', as: 'member' } },
            { $unwind: '$member' },
            { $project: { name: '$member.name', email: '$member.email', count: 1 } }
        ]);
        res.json(topBorrowers);
    } catch (error) {
        console.error('Top borrowers error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get overdue statistics
router.get('/overdue-stats', verifyToken, isAdmin, async (req, res) => {
    try {
        const today = new Date();
        const overdueCount = await Transaction.countDocuments({
            status: 'ISSUED',
            dueDate: { $lt: today }
        });
        
        const overdueWithFine = await Transaction.aggregate([
            { $match: { status: 'ISSUED', dueDate: { $lt: today } } },
            { $project: {
                daysOverdue: { $ceil: { $divide: [{ $subtract: [today, '$dueDate'] }, 86400000] } }
            }},
            { $group: {
                _id: null,
                totalFine: { $sum: { $multiply: ['$daysOverdue', 5] } }
            }}
        ]);
        
        res.json({
            overdueCount,
            estimatedFine: overdueWithFine[0]?.totalFine || 0
        });
    } catch (error) {
        console.error('Overdue stats error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;