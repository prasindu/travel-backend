const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// POST /api/optimize
// Body: { places: ["Start", "Place A", "Place B"], endLocation: "Place B" (Optional) }
router.post('/', async (req, res) => {
    try {
        const { places, endLocation } = req.body;

        if (!places || places.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'At least 3 places are required for optimization'
            });
        }

        const origin = places[0];
        let destination;
        let waypoints = [];
        let isRoundTrip = false;

        // 🟢 Case A: User "අවසාන ස්ථානයක්" තෝරලා තියෙනවා නම්
        if (endLocation && places.includes(endLocation)) {
            destination = endLocation;
            // Start සහ End ඇරෙන්න ඉතුරු ටික Waypoints විදිහට ගන්නවා
            waypoints = places.filter(p => p !== origin && p !== destination);
        } 
        // 🔴 Case B (Default): "අවසාන ස්ථානයක්" දීලා නැත්තම්
        else {
            isRoundTrip = true;
            destination = origin; // Round trip trick
            waypoints = places.slice(1); // Start එක ඇර ඉතුරු ඔක්කොම
        }

        const waypointsString = `optimize:true|${waypoints.join('|')}`;

        const url =
            `https://maps.googleapis.com/maps/api/directions/json` +
            `?origin=${encodeURIComponent(origin + ', Sri Lanka')}` +
            `&destination=${encodeURIComponent(destination + ', Sri Lanka')}` +
            `&waypoints=${encodeURIComponent(waypointsString)}` +
            `&key=${process.env.GOOGLE_PLACES_API_KEY}`;

        const response = await axios.get(url, { timeout: 10000 });

        if (response.data.status !== 'OK') {
            return res.status(400).json({
                success: false,
                error: 'Route optimization failed: ' + response.data.status
            });
        }

        const optimizedIndices = response.data.routes[0].waypoint_order;
        let optimizedPlaces = [origin];
        
        // Waypoints ටික optimize වෙච්ච පිළිවෙලට එකතු කරනවා
        optimizedIndices.forEach(i => optimizedPlaces.push(waypoints[i]));

        // End location එකක් දුන්නා නම්, ඒක අන්තිමටම එකතු කරනවා
        if (!isRoundTrip) {
            optimizedPlaces.push(destination);
        }

        // මුළු දුර ගණනය කිරීම
        const legs = response.data.routes[0].legs;
        let totalMeters = 0;
        
        // Round trip එකක් නම්, අන්තිම leg එක (ආපහු ගෙදර එන කෑල්ල) එකතු කරන්නේ නෑ
        const limit = isRoundTrip ? legs.length - 1 : legs.length;
        for (let i = 0; i < limit; i++) {
            totalMeters += legs[i].distance.value;
        }

        res.status(200).json({
            success: true,
            originalOrder:  places,
            optimizedOrder: optimizedPlaces,
            totalDistance:  (totalMeters / 1000).toFixed(2) + ' km'
        });

    } catch (error) {
        console.error('Optimize Error:', error.message);
        res.status(500).json({ success: false, error: 'Optimization failed' });
    }
});

module.exports = router;