const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    tripDate: {
        type: Date,
        required: true
    },
    startLocation: {
        type: String,
        required: true
    },
    selectedPlaces: [{
        type: String
    }],
    optimizedOrder: [{
        type: String
    }],
    startTime: {
        type: String,
        default: '06:00'
    },
    totalDistance: {
        type: String,
        default: 'N/A'
    },
    status: {
        type: String,
        enum: ['planned', 'active', 'completed'],
        default: 'planned'
    },
    currentStopIndex: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Trip', tripSchema);
