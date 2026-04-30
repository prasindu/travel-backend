const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const Trip    = require('../models/Trip');

// ── Auth Middleware ───────────────────────────────────────────
const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lanka_trails_secret_2024');
        req.userId = decoded.id;
        next();
    } catch {
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// ── POST /api/trips — Save a new trip ────────────────────────
router.post('/', protect, async (req, res) => {
    try {
        const {
            title, tripDate, startLocation,
            selectedPlaces, optimizedOrder,
            startTime, totalDistance, notes
        } = req.body;

        if (!title || !tripDate || !optimizedOrder || optimizedOrder.length < 2) {
            return res.status(400).json({ success: false, error: 'Title, date and at least 2 places required' });
        }

        const trip = await Trip.create({
            user: req.userId,
            title,
            tripDate,
            startLocation: startLocation || optimizedOrder[0],
            selectedPlaces: selectedPlaces || optimizedOrder,
            optimizedOrder,
            startTime:     startTime     || '06:00',
            totalDistance: totalDistance || 'N/A',
            notes:         notes         || ''
        });

        res.status(201).json({ success: true, trip });

    } catch (error) {
        console.error('Save Trip Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to save trip' });
    }
});

// ── GET /api/trips — Get all trips for user ──────────────────
router.get('/', protect, async (req, res) => {
    try {
        const trips = await Trip.find({ user: req.userId })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, count: trips.length, trips });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch trips' });
    }
});

// ── GET /api/trips/:id — Get single trip ────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        const trip = await Trip.findOne({ _id: req.params.id, user: req.userId });
        if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

        res.status(200).json({ success: true, trip });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch trip' });
    }
});

// ── PATCH /api/trips/:id/status — Update trip status & current stop ──
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const { status, currentStopIndex } = req.body;

        const trip = await Trip.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { 
                ...(status           !== undefined && { status }),
                ...(currentStopIndex !== undefined && { currentStopIndex })
            },
            { new: true }
        );

        if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

        res.status(200).json({ success: true, trip });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update trip' });
    }
});

// ── DELETE /api/trips/:id ─────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
    try {
        const trip = await Trip.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

        res.status(200).json({ success: true, message: 'Trip deleted' });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete trip' });
    }
});

module.exports = router;
