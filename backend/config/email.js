const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendEmail(to, subject, htmlContent) {
    try {
        const info = await transporter.sendMail({
            from: `"Library Management System" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log('✅ Email sent to:', to);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return false;
    }
}

async function sendBookIssuedEmail(userEmail, userName, bookTitle, dueDate) {
    const html = `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #667eea; border-radius: 10px;">
            <h2 style="color: #667eea;">📚 Book Issued Successfully!</h2>
            <p>Dear <strong>${userName}</strong>,</p>
            <p>You have issued: <strong>${bookTitle}</strong></p>
            <p><strong>Issue Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
            <p><strong>Return Period:</strong> 10 days + 5 days grace period</p>
            <p><strong>Late Fine:</strong> ₹5 per day after grace period</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Thank you for using our library!</p>
        </div>
    `;
    return await sendEmail(userEmail, `📚 Book Issued: ${bookTitle}`, html);
}

async function sendDueDateReminder(userEmail, userName, bookTitle, dueDate, daysLeft) {
    const html = `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ff9800; border-radius: 10px;">
            <h2 style="color: #ff9800;">⏰ Due Date Reminder</h2>
            <p>Dear <strong>${userName}</strong>,</p>
            <p>Your book <strong>"${bookTitle}"</strong> is due in <strong style="color: #ff9800;">${daysLeft} days</strong>!</p>
            <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
            <p>Please return on time to avoid late fees of ₹5 per day.</p>
        </div>
    `;
    return await sendEmail(userEmail, `⏰ Reminder: Book due in ${daysLeft} days`, html);
}

async function sendOverdueEmail(userEmail, userName, bookTitle, dueDate, daysOverdue, fineAmount) {
    const html = `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e74c3c; border-radius: 10px; background: #fff3f3;">
            <h2 style="color: #e74c3c;">⚠️ OVERDUE BOOK ALERT</h2>
            <p>Dear <strong>${userName}</strong>,</p>
            <p>Your book <strong>"${bookTitle}"</strong> is <strong style="color: red;">OVERDUE</strong> by <strong>${daysOverdue} days</strong>.</p>
            <p><strong>Due Date was:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
            <p><strong>Current Fine:</strong> ₹${fineAmount}</p>
            <p>Please return immediately to avoid additional fines.</p>
        </div>
    `;
    return await sendEmail(userEmail, `⚠️ OVERDUE: ${bookTitle}`, html);
}

async function sendLowStockAlert(adminEmail, bookTitle, availableCopies) {
    const html = `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ff9800; border-radius: 10px;">
            <h2 style="color: #ff9800;">⚠️ Low Stock Alert</h2>
            <p>Dear Admin,</p>
            <p>Book <strong>"${bookTitle}"</strong> has only <strong style="color: red;">${availableCopies} copies</strong> left.</p>
            <p>Please add more copies to the library.</p>
            <hr>
            <p style="font-size: 12px;">This is an automated alert from Library Management System.</p>
        </div>
    `;
    return await sendEmail(adminEmail, `⚠️ Low Stock: ${bookTitle}`, html);
}

module.exports = {
    sendBookIssuedEmail,
    sendDueDateReminder,
    sendOverdueEmail,
    sendLowStockAlert
};