CREATE TABLE exceptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stack_trace TEXT,                              -- Stack trace for debugging
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp of the exception
);