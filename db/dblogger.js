const db = require('./db'); // MySQL connection pool

async function insertLog(object, type, requestJson) {
    const sql = `
        INSERT INTO request_logs (object, type, state, request_json)
        VALUES (?, ?, 'failure', ?)
    `;
    const values = [object, type, JSON.stringify(requestJson)];

    try {
        const [result] = await db.query(sql, values); // Insert returns the result with the insert ID
        console.log(`Log inserted with ID: ${result.insertId}`);
        return result.insertId;
    } catch (error) {
        console.error('Error inserting log:', error.message);
        return null;
    }
}

async function updateLog(id, state, responseJson, idHubspot = 0) {
    const sql = `
        UPDATE request_logs
        SET state = ?, response_json = ?, id_hubspot = ?
        WHERE id = ?
    `;
    const values = [state, JSON.stringify(responseJson), idHubspot, id];

    try {
        await db.query(sql, values);
        console.log(`Log updated for ID: ${id}`);
    } catch (error) {
        console.error('Error updating log:', error.message);
    }
}

async function insertExceptionLog(stackTrace) {
    const sql = `
        INSERT INTO exceptions (stack_trace)
        VALUES (?)
    `;
    const values = [stackTrace];

    try {
        const [result] = await db.query(sql, values); // Insert into exceptions table
        console.log(`Exception logged with ID: ${result.insertId}`);
        return result.insertId; // Return the ID of the inserted log
    } catch (error) {
        console.error('Error logging exception:', error.message);
        return null;
    }
}


module.exports = {insertLog,updateLog,insertExceptionLog};