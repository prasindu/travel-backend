const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// POST /api/directions
// Body: { origin: "Colombo", destination: "Kandy" }
// Returns transit info + polyline for a single segment
router.post('/', async (req, res) => {
    try {
        const { origin, destination } = req.body;

        if (!origin || !destination) {
            return res.status(400).json({
                success: false,
                error: 'Origin and destination are required'
            });
        }

        const url =
            `https://maps.googleapis.com/maps/api/directions/json` +
            `?origin=${encodeURIComponent(origin + ', Sri Lanka')}` +
            `&destination=${encodeURIComponent(destination + ', Sri Lanka')}` +
            `&mode=transit` +
            `&key=${process.env.GOOGLE_PLACES_API_KEY}`;

        const response = await axios.get(url, { timeout: 8000 });

        if (response.data.status !== 'OK') {
            return res.status(400).json({
                success: false,
                error: 'Route not found: ' + response.data.status
            });
        }

        const route = response.data.routes[0].legs[0];

        const transitSteps = route.steps
            .filter(s => s.travel_mode === 'TRANSIT')
            .map(s => {
                const t = s.transit_details;
                return {
                    vehicleType:   t.line.vehicle.type,
                    routeNumber:   t.line.short_name || t.line.name || 'N/A',
                    departureStop: t.departure_stop.name,
                    arrivalStop:   t.arrival_stop.name,
                    stopsCount:    t.num_stops,
                    departureTime: t.departure_time.text
                };
            });

        res.status(200).json({
            success: true,
            origin,
            destination,
            distance:    route.distance.text,
            duration:    route.duration.text,
            transitInfo: transitSteps,
            polyline:    response.data.routes[0].overview_polyline.points
        });

    } catch (error) {
        console.error('Directions Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch directions' });
    }
});

module.exports = router;
