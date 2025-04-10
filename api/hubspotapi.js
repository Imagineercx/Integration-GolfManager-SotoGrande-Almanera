const axios = require('axios');
require('dotenv').config();

// Create the HubSpot API instance
const hubspotAPI = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}` // Use your API Key from .env
  },
});

module.exports = hubspotAPI;