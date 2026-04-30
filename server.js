require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lanka_trails';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Travel Planner Gateway is running!',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));        // NEW
app.use('/api/trips',       require('./routes/trips'));       // NEW
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/directions',  require('./routes/directions'));
app.use('/api/weather',     require('./routes/weather'));
app.use('/api/optimize',    require('./routes/optimize'));
app.use('/api/itinerary',   require('./routes/itinerary'));

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Lanka Trails running on port ${PORT}`);
});