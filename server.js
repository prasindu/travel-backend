require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();


const allowedOrigins = [
    'http://localhost:5173', 
    'https://travel-planner-frontend-m23t86oe5-prasindus-projects-8a9c175b.vercel.app'
];

// ආරක්ෂිත CORS රීති
app.use(cors({
    origin: function (origin, callback) {
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS Policy: This origin is not allowed'));
        }
    },
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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
app.use('/api/auth',        require('./routes/auth'));        
app.use('/api/trips',       require('./routes/trips'));       
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/directions',  require('./routes/directions'));
app.use('/api/weather',     require('./routes/weather'));
app.use('/api/optimize',    require('./routes/optimize'));
app.use('/api/itinerary',   require('./routes/itinerary'));
app.use('/api/chat',        require('./routes/chat'));

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Lanka Trails running on port ${PORT}`);
});