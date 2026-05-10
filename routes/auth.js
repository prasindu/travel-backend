const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const User    = require('../models/User');

// ── Generate JWT ──────────────────────────────────────────────
const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET , {
        expiresIn: '30d'
    });

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }

        const user = await User.create({ name, email, password });
        const token = signToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id:    user._id,
                name:  user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Register Error:', error.message);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const token = signToken(user._id);

        res.status(200).json({
            success: true,
            token,
            user: {
                id:    user._id,
                name:  user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login Error:', error.message);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// ── PUT /api/auth/password (Change Password) ──────────────────
router.put('/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Please provide both passwords' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
        }

        
        const user = await User.findById(req.userId).select('+password');

      
        if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Password Change Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});


// ── GET /api/auth/me (Protected) ──────────────────────────────
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lanka_trails_secret_2024');

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            user: {
                id:    user._id,
                name:  user.name,
                email: user.email
            }
        });

    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
});

module.exports = router;
