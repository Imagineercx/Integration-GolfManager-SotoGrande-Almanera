CREATE TABLE request_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_hubspot BIGINT,
    object ENUM('contact', 'deal','company') NOT NULL, -- Type of the request
    type ENUM('create', 'update','search') NOT NULL, -- Type of the request
    state ENUM('success', 'failure') NOT NULL,
    request_json JSON NOT NULL,               -- JSON of the request payload
    response_json JSON,                       -- JSON of the response (nullable for errors without responses)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);