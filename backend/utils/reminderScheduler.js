const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const Member = require('../models/Member');
const { sendDueDateReminder, sendOverdueEmail } = require('../config/email');

const GRACE_DAYS = 5;
const FINE_PER_DAY = 5;

async function checkDueDatesAndOverdue() {
    console.log('🕐 Running due date checker...', new Date().toLocaleString());
    
    const today = new Date();
    
    // Check for due date reminders (7, 3, 1 days before)
    const upcomingTransactions = await Transaction.find({
        status: 'ISSUED',
        dueDate: { $gt: today }
    }).populate('bookId', 'title').populate('memberId', 'name email');
    
    for (const trans of upcomingTransactions) {
        const daysLeft = Math.ceil((new Date(trans.dueDate) - today) / (1000 * 60 * 60 * 24));
        if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
            await sendDueDateReminder(
                trans.memberId.email,
                trans.memberId.name,
                trans.bookId.title,
                trans.dueDate,
                daysLeft
            );
            console.log(`📧 Sent reminder for ${trans.bookId.title} to ${trans.memberId.email}`);
        }
    }
    
    // Check for overdue books
    const overdueTransactions = await Transaction.find({
        status: 'ISSUED',
        dueDate: { $lt: today }
    }).populate('bookId', 'title').populate('memberId', 'name email');
    
    for (const trans of overdueTransactions) {
        const daysOverdue = Math.ceil((today - new Date(trans.dueDate)) / (1000 * 60 * 60 * 24));
        const fineAmount = Math.max(0, daysOverdue - GRACE_DAYS) * FINE_PER_DAY;
        
        // Send email if not sent in last 3 days
        const lastNotif = trans.lastOverdueNotif ? new Date(trans.lastOverdueNotif) : new Date(0);
        const daysSinceLastNotif = Math.ceil((today - lastNotif) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastNotif >= 3 && daysOverdue > GRACE_DAYS) {
            await sendOverdueEmail(
                trans.memberId.email,
                trans.memberId.name,
                trans.bookId.title,
                trans.dueDate,
                daysOverdue,
                fineAmount
            );
            trans.lastOverdueNotif = today;
            await trans.save();
            console.log(`📧 Sent overdue notification for ${trans.bookId.title}`);
        }
        
        // Block user if overdue more than 15 days beyond due date
        if (daysOverdue > GRACE_DAYS + 15) {
            await Member.findByIdAndUpdate(trans.memberId._id, { isBlocked: true });
            console.log(`🔒 Blocked user: ${trans.memberId.email}`);
        }
    }
    
    console.log('✅ Due date check completed');
}

// Run every hour
cron.schedule('0 * * * *', checkDueDatesAndOverdue);

// Also run on server start
setTimeout(checkDueDatesAndOverdue, 5000);

module.exports = { startScheduler: () => console.log('✅ Reminder scheduler started') };