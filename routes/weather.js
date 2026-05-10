const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// POST /api/weather
router.post('/', async (req, res) => {
    try {
        const { lat, lng, city, locationName, locationType } = req.body;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                error: 'Coordinates (lat, lng) are required'
            });
        }

        // ── Fetch current weather ──────────────────────────────
        const weatherUrl =
            `https://api.openweathermap.org/data/2.5/weather` +
            `?lat=${lat}&lon=${lng}` +
            `&appid=${process.env.WEATHER_API_KEY}` +
            `&units=metric`;

        const weatherRes = await axios.get(weatherUrl, { timeout: 8000 });

        const condition = weatherRes.data.weather[0].main;
        const temp      = weatherRes.data.main.temp;
        const humidity  = weatherRes.data.main.humidity;
        const windSpeed = weatherRes.data.wind.speed;

        const outdoorTypes   = ['park', 'zoo', 'natural_feature', 'campground', 'beach', 'tourist_attraction', 'shrine', 'place_of_worship'];

        const badWeather     = ['Rain', 'Thunderstorm', 'Drizzle', 'Snow']; 
        
        const isOutdoor      = outdoorTypes.includes(locationType) ; 
        const isRaining      = badWeather.includes(condition);
        
       
        const rerouteSuggested = isOutdoor && isRaining;

        let message      = `Weather is fine (${temp}°C). Enjoy your trip!`;
        let alternatives = [];

        if (rerouteSuggested) {
            message = `Warning! ${condition} detected near ${locationName}. We suggest visiting these indoor places instead.`;

            const placesUrl =
                `https://maps.googleapis.com/maps/api/place/textsearch/json` +
                `?query=museum+OR+shopping+mall+in+${encodeURIComponent(city)}+Sri+Lanka` +
                `&key=${process.env.GOOGLE_PLACES_API_KEY}`;

            const placesRes = await axios.get(placesUrl, { timeout: 8000 });

            alternatives = placesRes.data.results.slice(0, 3).map(p => ({
                name:   p.name,
                lat:    p.geometry.location.lat,
                lng:    p.geometry.location.lng,
                rating: p.rating || 'N/A',
                address: p.formatted_address || 'N/A'
            }));
        }

        res.status(200).json({
            success: true,
            weather: {
                condition,
                temperature: temp,
                humidity,
                windSpeed
            },
            rerouteSuggested, 
            message,
            alternatives
        });

    } catch (error) {
        console.error('Weather Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch weather' });
    }
});

module.exports = router;