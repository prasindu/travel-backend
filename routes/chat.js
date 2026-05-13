const express = require('express');
const axios = require('axios');
const Groq = require('groq-sdk');
const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const PYTHON_API_URL = process.env.PYTHON_AI_URL || 'http://127.0.0.1:8000/api/recommend';

router.post('/', async (req, res) => {
    try {
        const userMessage = req.body.prompt;
        const cleanMessage = userMessage.toLowerCase().trim();
        const chatHistory = req.body.history || [];
        const limitedHistory = chatHistory.slice(-6);

        // 🔴 1. Greeting Detector (අලුතින් එකතු කරපු කොටස)
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'hello there', 'hi there'];
        
        // පණිවිඩය අකුරු 15කට වඩා අඩු නම් සහ greeting එකක් නම්, කෙළින්ම උත්තර දෙමු
        if (cleanMessage.length < 15 && greetings.some(g => cleanMessage.includes(g))) {
            return res.status(200).json({ 
                success: true, 
                reply: "Hello! 👋 I am your Lanka Trails Smart Guide. Where would you like to travel today? Tell me what kind of vibe you're looking for (e.g., 'A relaxing beach in the South' or 'Historical places in Kandy')." 
            });
        }

        // 🟢 2. Greeting එකක් නෙවෙයි නම්, සාමාන්‍ය විදිහට AI Process එකට යමු
        // Python AI එකෙන් අදාළ තැන් හොයාගැනීම
        const pythonResponse = await axios.post(PYTHON_API_URL, { text: userMessage, top_n: 3 });
        const recommendations = pythonResponse.data.recommendations; 

        let weatherContext = "";

        // 3. හැම Recommendation එකකටම Weather බලමු
        for (const place of recommendations) {
            try {
                const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(place.destination)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
                const geoRes = await axios.get(geoUrl);
                
                if (geoRes.data.results.length > 0) {
                    const { lat, lng } = geoRes.data.results[0].geometry.location;
                    
                    const weatherRes = await axios.post(`http://127.0.0.1:${process.env.PORT || 5000}/api/weather`, {
                        lat, lng, city: place.destination, locationName: place.destination, locationType: "tourist_attraction"
                    });

                    const w = weatherRes.data.weather;
                    weatherContext += `Location: ${place.destination}, Condition: ${w.condition}, Temp: ${w.temperature}°C, Message: ${weatherRes.data.message} | `;
                }
            } catch (err) {
                console.log(`Weather failed for ${place.destination}`);
            }
        }

        // 4. දැන් මේ ඔක්කොම Context එක Groq AI එකට දෙනවා
        const placesList = recommendations.map(p => p.destination).join(", ");
        const systemPrompt = `
You are the official 'Lanka Trails' Smart Travel Guide. Your goal is to provide a seamless, natural, and friendly experience for travelers.

DATA PROVIDED:
- Recommended Places: ${placesList}.
- Weather Context: ${weatherContext}.

WRITING RULES:
1. DO NOT copy-paste technical phrases like "(Weather is fine (25°C). Enjoy your trip!)" or brackets. 
2. INTEGRATE the weather data naturally into your descriptions. (e.g., instead of saying "Weather: Clouds", say "The sky is a bit cloudy in Galle, but with a pleasant 28°C, it's perfect for a stroll").
3. PRIORITY: If the weather is 'Rain', 'Thunderstorm', or 'Drizzle', you MUST warn the user proactively and suggest they check out indoor alternatives or be careful.
4. PERSONALITY: Be warm, enthusiastic, and knowledgeable about Sri Lanka. Use phrases like "I suggest," "You'll love," or "It's a great time to visit."
5. Always end by asking a helpful follow-up question to keep the conversation going.
`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...limitedHistory,
                { role: "user", content: userMessage }
            ],
            model: "llama-3.1-8b-instant",
        });

        res.status(200).json({ success: true, reply: chatCompletion.choices[0].message.content });

    } catch (error) {
        console.error("❌ Smart Recommender Error:", error.message);
        res.status(500).json({ success: false, error: "AI Processing failed." });
    }
});

module.exports = router;