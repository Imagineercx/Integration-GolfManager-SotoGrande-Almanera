const axios = require('axios');


const getTenants = async () => {
    console.log()
    try {
        const response = await axios.get(`${process.env.BASE_URL}/clients`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT, // Tenant as query parameter
            },
        });

        // Log the response data
        console.log('Response:', response.data);
    } catch (error) {
        // Handle errors
        console.error('Error fetching tenants:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
    }
};

const getClients = async () => {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/clientsfull`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT, // Tenant as query parameter
            },
        });

        // Log the response data
        //console.log('Response:', response.data);
        return response.data;
    } catch (error) {
        // Handle errors
        console.error('Error fetching clients:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
    }
};

async function getClientsFull() {
    let offset = 0;
    let count = 1000;
    let hasMore = true;
    const allClients = []; // Store all retrieved clients

    try {
        while (hasMore) {
            console.log(`Fetching clients with offset: ${offset}`);

            const response = await axios.get(`${process.env.BASE_URL}/ClientsFull`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT,
                offset: offset,
                count: count
            },
        });
            const clients = response.data.results || response.data; // Adjust based on API response
            allClients.push(...clients);

            console.log(`Fetched ${clients.length} clients`);

            if (clients.length < count) {
                hasMore = false; // No more pages if fewer results than `count`
            } else {
                offset += count; // Increment offset for the next page
            }
        }
    } catch (error) {
        console.error('Error fetching clients:', error.response ? error.response.data : error.message);
        throw error;
    }
    //console.log(allClients);
    return allClients;
}

async function getClientFullByID(golfContactID) {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/clientsfull`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT, // Tenant as query parameter
                id: golfContactID,
            },
        });

        return response.data[0];
    } catch (error) {
        // Handle errors
        console.error('Error fetching client:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
        return null;
    }
}

const getTags = async () => {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/clientTags`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT, 
                count: 1000,
            },
        });

        // Log the response data
        //console.log('Response:', response.data);
        return response.data;
    } catch (error) {
        // Handle errors
        console.error('Error fetching reservations:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
    }
};

const getReservations = async (start,end) => {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/Reservations`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT, 
                start: start,
                end: end,
            },
        });

        // Log the response data
        //console.log('Response:', response.data);
        return response.data;
    } catch (error) {
        // Handle errors
        console.error('Error fetching reservations:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
        return null;
    }
};

const getReservationsByID = async (IdClient) => {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/Reservations`, {
            auth: {
                username: process.env.USER_GM,
                password: process.env.PASSWORD_GM,
            },
            params: {
                tenant: process.env.TENANT, 
                idClient: IdClient,
            },
        });

        // Log the response data
        //console.log('Response:', response.data);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        // Handle errors
        console.error('Error fetching reservations:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
        }
    }
};

module.exports = {getReservationsByID,getClients,getClientsFull,getClientFullByID,getReservations,getTenants,getTags};