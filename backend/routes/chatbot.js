const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const Book = require('../models/Book');
const Member = require('../models/Member');
const Transaction = require('../models/Transaction');

// Pre-defined responses database
const responses = {
    // General Questions
    greeting: {
        keywords: ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good evening'],
        response: "👋 Hello! I'm your Library Assistant. How can I help you today? You can ask me about:\n• Book availability\n• Borrowing rules\n• Fine information\n• Account help\n• Library policies"
    },
    help: {
        keywords: ['help', 'what can you do', 'assist', 'support'],
        response: "📚 I can help you with:\n\n📖 FIND BOOKS - Search by title or author\n📋 BORROWING RULES - Limits and duration\n💰 FINE INFORMATION - Late fees and payment\n👤 ACCOUNT HELP - Password, profile updates\n🏛️ LIBRARY POLICIES - Rules and regulations\n\nJust type your question!"
    },
    thanks: {
        keywords: ['thank', 'thanks', 'appreciate', 'good job'],
        response: "You're welcome! 😊 Is there anything else I can help you with?"
    },
    goodbye: {
        keywords: ['bye', 'goodbye', 'see you', 'exit', 'close'],
        response: "Goodbye! 👋 Have a great day! Visit again soon!"
    },

    // Book Related Questions
    bookSearch: {
        keywords: ['search book', 'find book', 'looking for', 'book called'],
        response: async (query, userId) => {
            // Extract book name from query
            const bookMatch = query.match(/(?:book called|search for|find|looking for) ["']?([^"']+)["']?/i);
            if (bookMatch) {
                const bookTitle = bookMatch[1];
                const book = await Book.findOne({ title: { $regex: bookTitle, $options: 'i' } });
                if (book) {
                    return `📖 Found "${book.title}" by ${book.author}. ${book.availableCopies > 0 ? `Available copies: ${book.availableCopies}` : 'Currently not available. You can request more copies.'}`;
                }
                return `❌ Sorry, I couldn't find "${bookTitle}" in our library. Would you like to request it?`;
            }
            return "Please tell me the book title you're looking for.";
        }
    },
    availableBooks: {
        keywords: ['available books', 'list of books', 'show books', 'what books'],
        response: async () => {
            const totalBooks = await Book.countDocuments();
            const availableBooks = await Book.countDocuments({ availableCopies: { $gt: 0 } });
            return `📚 Our library has ${totalBooks} books in total. Currently ${availableBooks} books are available for borrowing. Use the 'Browse Books' section to see all books.`;
        }
    },
    mostPopular: {
        keywords: ['popular book', 'most borrowed', 'trending book', 'best book'],
        response: async () => {
            const popular = await Transaction.aggregate([
                { $group: { _id: '$bookId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 },
                { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
                { $unwind: '$book' }
            ]);
            if (popular[0]) {
                return `🏆 The most borrowed book is "${popular[0].book.title}" borrowed ${popular[0].count} times!`;
            }
            return "No borrowing data available yet.";
        }
    },

    // Borrowing Rules
    borrowLimit: {
        keywords: ['how many books', 'borrow limit', 'maximum books', 'how many can i borrow', 'borrow rules'],
        response: async (query, userId, role) => {
            if (role === 'admin') {
                return "👑 As an admin, you can set borrowing limits in Settings. Default is 3 books per user.";
            }
            const user = await Member.findById(userId);
            const maxBooks = user?.maxBooksAllowed || 3;
            const currentBorrowed = await Transaction.countDocuments({ memberId: userId, status: 'ISSUED' });
            return `📚 You can borrow up to ${maxBooks} books at a time. You currently have ${currentBorrowed} book(s) borrowed.`;
        }
    },
    borrowDuration: {
        keywords: ['how long', 'borrow period', 'return days', 'due date', 'borrow duration'],
        response: "📅 You can borrow books for 10 days, plus an additional 5 days grace period. Late fine is ₹5 per day after the grace period."
    },
    renewBook: {
        keywords: ['renew', 'extend', 'borrow longer', 'extend due date'],
        response: "🔄 Currently, renewals are not available online. Please visit the library or contact the librarian for renewal requests."
    },

    // Fine Related Questions
    fineInfo: {
        keywords: ['fine', 'late fee', 'penalty', 'how much fine', 'fine amount', 'overdue fine'],
        response: async (query, userId, role) => {
            if (role === 'admin') {
                return "💰 Fine is ₹5 per day after the 5-day grace period. You can view total fines in the dashboard.";
            }
            const user = await Member.findById(userId);
            const totalFine = user?.totalFine || 0;
            const overdueBooks = await Transaction.find({ memberId: userId, status: 'ISSUED', dueDate: { $lt: new Date() } });
            let additionalFine = 0;
            for (const book of overdueBooks) {
                const daysOverdue = Math.ceil((new Date() - new Date(book.dueDate)) / (1000 * 60 * 60 * 24));
                additionalFine += daysOverdue * 5;
            }
            const total = totalFine + additionalFine;
            if (total > 0) {
                return `💰 Your current total fine is ₹${total}. ${overdueBooks.length > 0 ? `You have ${overdueBooks.length} overdue book(s). Please return them soon to avoid additional fines.` : ''}`;
            }
            return "✅ You have no pending fines. Great job returning books on time!";
        }
    },
    payFine: {
        keywords: ['pay fine', 'pay penalty', 'how to pay fine', 'fine payment'],
        response: "💳 To pay your fine, go to your Dashboard and click on the 'My Fine' card. You can pay using UPI, Debit Card, or Credit Card."
    },

    // Account Related
    changePassword: {
        keywords: ['change password', 'update password', 'forgot password'],
        response: "🔐 To change your password, go to Settings → Change Password. Enter your current password and new password, then click 'Change Password'."
    },
    updateProfile: {
        keywords: ['update profile', 'change name', 'change email', 'update phone', 'profile settings'],
        response: "✏️ To update your profile, go to Settings → Profile Settings. You can update your name, phone number, and address."
    },
    accountBlocked: {
        keywords: ['account blocked', 'why blocked', 'unblock account', 'blocked'],
        response: "⚠️ Accounts are automatically blocked if books are overdue for more than 15 days beyond the due date. Please return all overdue books and pay fines, then contact admin to unblock."
    },

    // Library Information
    libraryHours: {
        keywords: ['library hours', 'open time', 'close time', 'timing', 'working hours'],
        response: "🏛️ Library Hours:\nMonday-Friday: 9:00 AM - 8:00 PM\nSaturday: 10:00 AM - 5:00 PM\nSunday: Closed"
    },
    contactInfo: {
        keywords: ['contact', 'phone', 'email', 'reach out', 'help desk', 'support'],
        response: "📞 Contact Information:\nEmail: support@library.com\nPhone: +91-XXXXXXXXXX\nVisit us: Library Admin Office"
    },
    location: {
        keywords: ['location', 'address', 'where', 'library address'],
        response: "📍 Our library is located at: Library Admin Office, Main Campus. You can find us near the Academic Block."
    },

    // Admin Specific Questions
    adminStats: {
        keywords: ['statistics', 'total books', 'total members', 'how many books', 'how many members'],
        response: async () => {
            const totalBooks = await Book.countDocuments();
            const totalMembers = await Member.countDocuments();
            const issuedBooks = await Transaction.countDocuments({ status: 'ISSUED' });
            return `📊 Library Statistics:\n• Total Books: ${totalBooks}\n• Total Members: ${totalMembers}\n• Books Currently Issued: ${issuedBooks}`;
        }
    },
    adminOverdue: {
        keywords: ['overdue books', 'overdue list', 'late books', 'overdue report'],
        response: async () => {
            const overdue = await Transaction.find({ status: 'ISSUED', dueDate: { $lt: new Date() } }).populate('bookId', 'title');
            if (overdue.length > 0) {
                let list = overdue.map(b => `• ${b.bookId?.title}`).join('\n');
                return `⚠️ There are ${overdue.length} overdue books:\n${list}`;
            }
            return "✅ No overdue books at the moment.";
        }
    },
    lowStock: {
        keywords: ['low stock', 'need copies', 'add copies', 'stock alert'],
        response: async () => {
            const lowStockBooks = await Book.find({ availableCopies: { $lte: 2 } });
            if (lowStockBooks.length > 0) {
                let list = lowStockBooks.map(b => `• ${b.title}: ${b.availableCopies} copies left`).join('\n');
                return `⚠️ Low stock alert for these books:\n${list}\nPlease consider adding more copies.`;
            }
            return "✅ All books have sufficient stock.";
        }
    }
};

// Helper function to find matching intent
async function findResponse(message, userId, userRole) {
    const lowerMsg = message.toLowerCase();
    
    // Check each intent
    for (const [intent, data] of Object.entries(responses)) {
        if (data.keywords && data.keywords.some(keyword => lowerMsg.includes(keyword))) {
            if (typeof data.response === 'function') {
                return await data.response(message, userId, userRole);
            }
            return data.response;
        }
    }
    
    // Default response for unknown queries
    return "🤔 I'm not sure about that. Could you rephrase your question? You can ask me about books, borrowing rules, fines, account help, or library policies. Type 'help' to see what I can do!";
}

// Process user message
router.post('/ask', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (!message) {
            return res.status(400).json({ response: "Please type a message." });
        }
        
        // Get bot response
        const botResponse = await findResponse(message, userId, userRole);
        
        res.json({
            userMessage: message,
            botResponse: botResponse,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ response: "Sorry, I'm having trouble processing your request. Please try again later." });
    }
});

// Get suggested questions based on role
router.get('/suggestions', verifyToken, async (req, res) => {
    try {
        const userRole = req.user.role;
        
        if (userRole === 'admin') {
            res.json({
                suggestions: [
                    "📊 Show library statistics",
                    "⚠️ List overdue books",
                    "📦 Low stock alerts",
                    "💰 Total fine collected",
                    "👥 Active members count"
                ]
            });
        } else {
            const user = await Member.findById(req.user.id);
            const currentFine = user?.totalFine || 0;
            
            let fineSuggestion = "💰 How to pay fine?";
            if (currentFine > 0) {
                fineSuggestion = `💰 I have ₹${currentFine} fine - how to pay?`;
            }
            
            res.json({
                suggestions: [
                    "📖 How many books can I borrow?",
                    "📅 How long can I keep books?",
                    fineSuggestion,
                    "🔐 How to change password?",
                    "📚 Find a book called"
                ]
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;