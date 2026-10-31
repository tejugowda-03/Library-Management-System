const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const { verifyToken, isAdmin } = require('./auth');

// GET all members (Admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const members = await Member.find().select('-password').sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST add member (Admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;
        
        const existing = await Member.findOne({ $or: [{ email }, { phone }] });
        if (existing) {
            return res.status(400).json({ message: 'Email or phone already exists' });
        }
        
        const member = new Member({
            name,
            email,
            phone,
            address,
            role: 'user'
        });
        
        const saved = await member.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE member (Admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        if (member.booksIssued > 0) {
            return res.status(400).json({ message: 'Cannot delete: Member has books issued' });
        }
        await member.deleteOne();
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Block/Unblock member
router.put('/block/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { isBlocked } = req.body;
        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        
        member.isBlocked = isBlocked;
        await member.save();
        
        res.json({ message: `Member ${isBlocked ? 'blocked' : 'unblocked'} successfully` });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;