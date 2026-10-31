const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Member = require('../models/Member');

const JWT_SECRET = 'your_jwt_secret_key_2024';

// ============ REGISTER ============
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        
        console.log('📝 Registration attempt:', email);
        
        // Check if user exists
        const existing = await Member.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        
        // Create user - password will be hashed by pre-save hook
        const user = new Member({
            name,
            email,
            password,
            phone,
            address,
            role: 'user',
            isActive: true,
            isBlocked: false
        });
        
        await user.save();
        
        console.log('✅ User registered:', email);
        
        // Generate token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(400).json({ message: error.message });
    }
});

// ============ LOGIN ============
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Login attempt:', email);
        
        // Find user
        const user = await Member.findOne({ email });
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        console.log('✅ User found:', user.email);
        
        // Check if user is blocked
        if (user.isBlocked) {
            return res.status(401).json({ message: 'Your account has been blocked by admin. Please contact support.' });
        }
        
        // Compare password using the model method
        const isValid = await user.comparePassword(password);
        
        console.log('Password valid:', isValid);
        
        if (!isValid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        console.log('✅ Login successful:', email);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(400).json({ message: error.message });
    }
});

// ============ CREATE ADMIN ============
router.post('/create-admin', async (req, res) => {
    try {
        // Check if admin already exists
        const existingAdmin = await Member.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin already exists' });
        }
        
        // Create admin
        const admin = new Member({
            name: 'Admin User',
            email: 'admin@library.com',
            password: 'admin123',
            phone: '9999999999',
            address: 'Library Admin Office',
            role: 'admin',
            maxBooksAllowed: 10,
            isActive: true,
            isBlocked: false
        });
        
        await admin.save();
        
        console.log('✅ Admin created successfully');
        
        res.json({ 
            message: 'Admin created successfully! Login with admin@library.com / admin123',
            admin: {
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        res.status(400).json({ message: error.message });
    }
});

// ============ RESET ADMIN PASSWORD ============
router.post('/reset-admin', async (req, res) => {
    try {
        const admin = await Member.findOne({ email: 'admin@library.com' });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }
        
        admin.password = 'admin123';
        await admin.save();
        
        res.json({ message: 'Admin password reset successfully! Try login with admin@library.com / admin123' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ============ VERIFY TOKEN ============
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token.' });
    }
};

// ============ IS ADMIN ============
const isAdmin = async (req, res, next) => {
    try {
        const user = await Member.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============ GET CURRENT USER ============
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await Member.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ CHANGE PASSWORD ============
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await Member.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        user.password = newPassword;
        await user.save();
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ============ SIMPLE GOOGLE SIGN-IN ============
router.post('/google-simple', async (req, res) => {
    try {
        const { email, name, googleId } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        
        let user = await Member.findOne({ email });
        
        if (!user) {
            const defaultPassword = await bcrypt.hash('google_' + Date.now(), 10);
            user = new Member({
                name: name || email.split('@')[0],
                email: email,
                password: defaultPassword,
                phone: '0000000000',
                address: 'Google Sign-In User',
                role: 'user',
                googleId: googleId || 'google_' + Date.now(),
                isActive: true,
                isBlocked: false
            });
            await user.save();
        }
        
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Google Sign-In successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        res.status(400).json({ message: error.message });
    }
});

// ============ UPDATE PROFILE ============
router.put('/update-profile', verifyToken, async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const user = await Member.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (address) user.address = address;
        
        await user.save();
        
        res.json({
            message: 'Profile updated successfully',
            user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address
            }
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
module.exports.isAdmin = isAdmin;