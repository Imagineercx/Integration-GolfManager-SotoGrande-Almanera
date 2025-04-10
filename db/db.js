const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST, // Database host, e.g., localhost
    user: process.env.DB_USER, // Database user, e.g., root
    password: process.env.DB_PASSWORD, // Database password
    database: process.env.DB_NAME, // Database name
    waitForConnections: true, // Queue queries when no connections are available
    connectionLimit: 10, // Maximum number of connections
    queueLimit: 0, // Unlimited queue length
});

module.exports = pool;


