const express = require('express');
const axios   = require('axios');
const router  = express.Router();

// POST /api/suggestions
// Body: { city: "Kandy", searchType: "city" | "specific" }
router.post('/', async (req, res) => {
    try {
        const { city, searchType } = req.body; // 'city' can be a city name OR a specific place name

        if (!city) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        // Search type එක අනුව Google එකට යවන query එක වෙනස් කරනවා
        const queryStr = searchType === 'specific' 
            ? `${encodeURIComponent(city)}+Sri+Lanka` 
            : `tourist+attractions+in+${encodeURIComponent(city)}+Sri+Lanka`;

        const url =
            `https://maps.googleapis.com/maps/api/place/textsearch/json` +
            `?query=${queryStr}` +
            `&key=${process.env.GOOGLE_PLACES_API_KEY}`;

        const response = await axios.get(url, { timeout: 8000 });
        
        const places = response.data.results.slice(0, 10).map(place => {
            let photoUrl = null;
            if (place.photos && place.photos.length > 0) {
                photoUrl =
                    `https://maps.googleapis.com/maps/api/place/photo` +
                    `?maxwidth=400` +
                    `&photoreference=${place.photos[0].photo_reference}` +
                    `&key=${process.env.GOOGLE_PLACES_API_KEY}`;
            }

            return {
                name:             place.name,
                place_id:         place.place_id,
                lat:              place.geometry.location.lat,
                lng:              place.geometry.location.lng,
                rating:           place.rating           || 'N/A',
                userRatingsTotal: place.user_ratings_total || 0,
                types:            place.types,
                address:          place.formatted_address || 'No address',
                isOpenNow:        place.opening_hours
                                    ? place.opening_hours.open_now
                                    : 'N/A',
                photoUrl
            };
        });

        res.status(200).json({ success: true, city, suggestions: places });

    } catch (error) {
        console.error('Suggestions Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch suggestions' });
    }
});

module.exports = router;