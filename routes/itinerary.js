const express = require('express');
const axios   = require('axios');
const router  = express.Router();

function normalizeTime(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return '00:00';
    const [h, m] = timeStr.split(':').map(s => s.padStart(2, '0'));
    return `${h}:${m}`;
}

router.post('/', async (req, res) => {
    try {
        const { optimizedPlaces, startTime } = req.body;

        if (!optimizedPlaces || optimizedPlaces.length < 2) {
            return res.status(400).json({ success: false, error: 'At least 2 places are required' });
        }

        let currentTime  = startTime || '06:00';
        const itinerary  = [];

        for (let i = 0; i < optimizedPlaces.length - 1; i++) {
            const startCity  = optimizedPlaces[i];
            const endCity    = optimizedPlaces[i + 1];
            const cleanStart = startCity.split(',')[0].trim();
            const cleanEnd   = endCity.split(',')[0].trim();

            // ═══════════════════════════════════════════════════
            // 1. BUS
            // ═══════════════════════════════════════════════════
            let busOptions = { available: false, options: [] };
            try {
                const googleBusUrl =
                    `https://maps.googleapis.com/maps/api/directions/json` +
                    `?origin=${encodeURIComponent(startCity + ', Sri Lanka')}` +
                    `&destination=${encodeURIComponent(endCity + ', Sri Lanka')}` +
                    `&mode=transit&transit_mode=bus` +
                    `&key=${process.env.GOOGLE_PLACES_API_KEY}`;

                const googleBusRes = await axios.get(googleBusUrl, { timeout: 8000 });
                let routeNumbers = [];
                let googleBusSteps = []; // Save Google Maps Steps for fallback

                if (googleBusRes.data.status === 'OK' && googleBusRes.data.routes.length > 0) {
                    const leg = googleBusRes.data.routes[0].legs[0];

                    googleBusSteps = leg.steps.filter(s =>
                        s.travel_mode === 'TRANSIT' &&
                        (s.transit_details?.line?.vehicle?.type === 'BUS' ||
                         s.transit_details?.line?.vehicle?.type === 'INTERCITY_BUS')
                    );

                    routeNumbers = [
                        ...new Set(googleBusSteps.map(s => s.transit_details?.line?.short_name || s.transit_details?.line?.name).filter(Boolean))
                    ];
                }

                const busResults = [];

                // METHOD 1: Try DB by Route Number
                for (const routeNo of routeNumbers) {
                    try {
                        const busApiUrl = `http://localhost:3000/api/buses?route=${encodeURIComponent(routeNo)}&timeAfter=${currentTime}`;
                        const busRes = await axios.get(busApiUrl, { timeout: 5000 });

                        if (busRes.data.success && busRes.data.count > 0) {
                            busRes.data.data.slice(0, 2).forEach(bus => {
                                if (!busResults.find(b => b.routeNo === bus['Bus Route'] && b.departureTime === bus['Departure Time'])) {
                                    busResults.push({
                                        routeNo:       bus['Bus Route'] || routeNo,
                                        operator:      bus['Operator'] || 'SLTB / Private',
                                        serviceType:   bus['Type of Service'] || 'Normal',
                                        departureTime: bus['Departure Time'],
                                        terminal:      bus['Terminal'] || 'Main Stand',
                                        ticketPrice:   bus['Type of Service'] === 'Luxury' ? 'Rs. 1200.00' : 'Rs. 500.00'
                                    });
                                }
                            });
                        }
                    } catch (e) { /* Ignore DB error */ }
                }

                // METHOD 2: Try DB by From/To
                if (busResults.length === 0) {
                    try {
                        const fallbackUrl = `http://localhost:3000/api/buses?from=${encodeURIComponent(cleanStart)}&to=${encodeURIComponent(cleanEnd)}&timeAfter=${currentTime}`;
                        const fallbackRes = await axios.get(fallbackUrl, { timeout: 5000 });

                        if (fallbackRes.data.success && fallbackRes.data.count > 0) {
                            fallbackRes.data.data.slice(0, 3).forEach(bus => {
                                busResults.push({
                                    routeNo:       bus['Bus Route'] || 'N/A',
                                    operator:      bus['Operator'] || 'SLTB / Private',
                                    serviceType:   bus['Type of Service'] || 'Normal',
                                    departureTime: bus['Departure Time'],
                                    terminal:      bus['Terminal'] || 'Main Stand',
                                    ticketPrice:   bus['Type of Service'] === 'Luxury' ? 'Rs. 1200.00' : 'Rs. 500.00'
                                });
                            });
                        }
                    } catch (e) { /* Ignore DB error */ }
                }

                // 🔴 METHOD 3 (NEW): If DB has no data, use Google Maps Instructions directly
                if (busResults.length === 0 && googleBusSteps.length > 0) {
                    console.log(`[Bus] DB Empty. Using Google Maps fallback for ${cleanStart}→${cleanEnd}`);
                    googleBusSteps.forEach((step, idx) => {
                        const td = step.transit_details;
                        if (td) {
                            busResults.push({
                                routeNo:       td.line?.short_name || 'Bus',
                                operator:      td.line?.agencies?.[0]?.name || td.line?.name || 'Local Transport',
                                serviceType:   'Google Route',
                                departureTime: td.departure_time?.text || 'N/A',
                                terminal:      td.departure_stop?.name || cleanStart,
                                arrivalStop:   td.arrival_stop?.name || cleanEnd,
                                instruction:   step.html_instructions ? step.html_instructions.replace(/<[^>]*>/g, '') : `Take bus ${td.line?.short_name || ''} towards ${td.arrival_stop?.name}`,
                                ticketPrice:   'Check at counter'
                            });
                        }
                    });
                }

                // Sort by departure time
                busResults.sort((a, b) => normalizeTime(a.departureTime).localeCompare(normalizeTime(b.departureTime)));

                busOptions = busResults.length > 0
                    ? { available: true, options: busResults }
                    : { available: false, options: [] };
                
            } catch (e) {
                console.log(`[Bus] Error: ${e.message}`);
            }

            // ═══════════════════════════════════════════════════
            // 2. TRAIN
            // ═══════════════════════════════════════════════════
            let trainOptions = { available: false };
            try {
                const trainUrl =
                    `https://maps.googleapis.com/maps/api/directions/json` +
                    `?origin=${encodeURIComponent(startCity + ', Sri Lanka')}` +
                    `&destination=${encodeURIComponent(endCity + ', Sri Lanka')}` +
                    `&mode=transit&transit_mode=rail` +
                    `&key=${process.env.GOOGLE_PLACES_API_KEY}`;

                const trainRes = await axios.get(trainUrl, { timeout: 8000 });

                if (trainRes.data.status === 'OK' && trainRes.data.routes.length > 0) {
                    const leg = trainRes.data.routes[0].legs[0];
                    const railTypes = ['HEAVY_RAIL', 'COMMUTER_TRAIN', 'RAIL', 'SUBWAY'];
                    const trainSteps = leg.steps.filter(s =>
                        s.travel_mode === 'TRANSIT' && railTypes.includes(s.transit_details?.line?.vehicle?.type)
                    );

                    if (trainSteps.length > 0) {
                        trainOptions = {
                            available:     true,
                            duration:      leg.duration.text,
                            distance:      leg.distance.text,
                            departureTime: leg.departure_time?.text || currentTime,
                            arrivalTime:   leg.arrival_time?.text   || 'N/A',
                            steps: trainSteps.map((s, idx) => ({
                                stepNo:        idx + 1,
                                trainName:     s.transit_details?.line?.name       || 'Sri Lanka Railways',
                                trainNumber:   s.transit_details?.line?.short_name || 'N/A',
                                fromStation:   s.transit_details?.departure_stop?.name,
                                toStation:     s.transit_details?.arrival_stop?.name,
                                departureTime: s.transit_details?.departure_time?.text,
                                arrivalTime:   s.transit_details?.arrival_time?.text,
                                stopsCount:    s.transit_details?.num_stops,
                                duration:      s.duration?.text
                            }))
                        };
                    }
                }
            } catch (e) { console.log(`[Train] Error`); }

            // ═══════════════════════════════════════════════════
            // 3. CAR
            // ═══════════════════════════════════════════════════
            let carOptions = { available: false };
            try {
                const carUrl =
                    `https://maps.googleapis.com/maps/api/directions/json` +
                    `?origin=${encodeURIComponent(startCity + ', Sri Lanka')}` +
                    `&destination=${encodeURIComponent(endCity + ', Sri Lanka')}` +
                    `&mode=driving&key=${process.env.GOOGLE_PLACES_API_KEY}`;

                const carRes = await axios.get(carUrl, { timeout: 8000 });

                if (carRes.data.status === 'OK' && carRes.data.routes.length > 0) {
                    const leg        = carRes.data.routes[0].legs[0];
                    const distanceKm = leg.distance.value / 1000;
                    const fuelCost = Math.round((distanceKm / 12) * 380);

                    carOptions = {
                        available:         true,
                        duration:          leg.duration.text,
                        distance:          leg.distance.text,
                        distanceKm:        distanceKm.toFixed(1),
                        estimatedFuelCost: `Rs. ${fuelCost}`,
                        polyline:          carRes.data.routes[0].overview_polyline.points,
                        steps: leg.steps.map((s, idx) => ({
                            stepNo:      idx + 1,
                            instruction: s.html_instructions.replace(/<[^>]*>/g, ''),
                            distance:    s.distance.text,
                            duration:    s.duration.text,
                            maneuver:    s.maneuver || 'straight'
                        }))
                    };
                }
            } catch (e) { console.log(`[Car] Error`); }

            let [h, m] = currentTime.split(':').map(Number);
            h = (h + 3) % 24;
            currentTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            itinerary.push({
                segment: i + 1,
                from:    cleanStart,
                to:      cleanEnd,
                transportOptions: { bus: busOptions, train: trainOptions, car: carOptions }
            });
        }

        const stepByStep = itinerary.map((seg, idx) => {
            const { bus, train, car } = seg.transportOptions;
            return {
                stepNo: idx + 1,
                title:  `${seg.from} → ${seg.to}`,
                options: {
                    bus: {
                        label:   'Bus',
                        summary: bus.available ? `${bus.options[0]?.routeNo} | ${bus.options[0]?.departureTime} | ${bus.options[0]?.ticketPrice}` : 'Not available',
                        details: bus.options
                    },
                    train: {
                        label:   'Train',
                        summary: train.available ? `${train.duration} | ${train.distance} | Departs ${train.departureTime}` : 'Not available',
                        details: train.available ? train.steps : []
                    },
                    car: {
                        label:   'Car',
                        summary: car.available ? `${car.duration} | ${car.distance} | Fuel: ${car.estimatedFuelCost}` : 'Not available',
                        details: car.available ? car.steps : []
                    }
                }
            };
        });

        res.status(200).json({
            success: true,
            journey: {
                totalStops:    optimizedPlaces.length,
                totalSegments: optimizedPlaces.length - 1,
                allStops:      optimizedPlaces,
                startTime:     startTime || '06:00'
            },
            stepByStep,
            detailedItinerary: itinerary
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to build trip plan' });
    }
});

module.exports = router;