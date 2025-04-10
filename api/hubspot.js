const hubspotAPI = require('./hubspotapi'); // Import the instance
const {insertLog,updateLog,insertExceptionLog}  = require('../db/dblogger');
const { response } = require('express');
const genderMapping = { 1: "male", 0: "female" };

async function createOrUpdateContactInHubSpot(golfClientId, golfClient, hubspotTags, clientName) {
    try {   
        const hubspotContact = await searchContactByIdMbudo(golfClientId);
        let hubspotContactEmail = null;

        if(golfClient.email){
            hubspotContactEmail = await searchContactByEmail(golfClient.email);
        }
        if (hubspotContactEmail) {
            console.log("Contact found with same email: "+golfClient.email);
            return await updateContactInHubSpot(hubspotContactEmail.id, golfClient, hubspotTags, clientName);
        } else if (hubspotContact){
            console.log("Contact found with Id: "+golfClientId);
            return await updateContactInHubSpot(hubspotContact.id, golfClient, hubspotTags, clientName);
        } else {
            console.log("New contact to be created with id: "+golfClientId);
            return await createContactInHubSpot(golfClient, hubspotTags, clientName);
        }
    } catch (error) {
        console.error('Unexpected error in createOrUpdateContactInHubSpot:', error.message);
        return null;
    }
}

async function createOrUpdateDealInHubSpot(deal) {
    try {
        const dealId = await searchDealByIdMbudo(deal.id);

        if (dealId) {
            console.log(`Deal found. Updating deal ID: ${dealId.id}`);
            return await updateDealInHubSpot(dealId.id,deal);
        } else {
            console.log(`No deal found. Creating a new deal for id_mbudo: ${deal.id}`);
            return await createDealInHubSpot(deal);
        }
    } catch (error) {
        console.error('Unexpected error in createOrUpdateDealInHubSpot:', error.message);
        await insertExceptionLog(error);
        return null;
    }
}

async function createOrUpdateCompanyInHubSpot(companyIds, companyData, domain) {
    try {
        console.log("searching companyID: ",companyIds)
        const companyId = await searchCompanyByIdMbudo(companyIds);

        if (companyId) {
            console.log("company found with id: "+companyIds);
            return await updateCompanyInHubSpot(companyId, companyData);
        } else {
            console.log("company not found with id: "+companyIds);
            return await createCompanyInHubSpot(companyData,domain);
        }
    } catch (error) {
        console.error('Unexpected error in createOrUpdateCompanyInHubSpot:', error.message);
        await insertExceptionLog(error);
        return null;
    }
}

//Support methods
async function searchContactByEmail(email,delay=1000) {
  try {
    const payload = {
        filterGroups: [
            {
                filters: [
                    {
                        propertyName: 'email', // Custom property used as unique identifier
                        operator: 'EQ',
                        value: email,
                    },
                ],
            },
        ],
        properties: ['firstname', 'email','phone', 'gm_id'], // Properties to fetch
    };
    const response = await hubspotAPI.post(`/crm/v3/objects/contacts/search`,payload);

    if (response.data.total > 0) {
            const contact = response.data.results[0];
            return contact; // Return the existing company ID
        } else {
            console.log('No contact found with email:', email);
            return null;
        }
  } catch (error) {
        const errorMessage = error.response?.data?.message || "";

        // **Check for rate limit error**
        if (errorMessage.includes("You have reached your secondly limit.")) {
            console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
                return searchContactByEmail(email, delay); // Recursively retry
            }
        }

        // **Handle 404 (not found) gracefully**
        if (error.response && error.response.status === 404) {
            console.log(`No contact found with email: ${email}`);
            return null;
        }

        // **For other errors, log and return null immediately**
        console.error(`Error searching contact by email:`, error.response ? error.response.data : error);
        await insertExceptionLog(error);
        return null;
    }
}

async function searchContactByIdMbudo(idMbudo, maxRetries = 5, delay=1000) {
    if (idMbudo === null) {
        return null;
    }

    const payload = {
        filterGroups: [
            {
                filters: [
                    {
                        propertyName: 'gm_id', // Custom property used as unique identifier
                        operator: 'EQ',
                        value: idMbudo,
                    },
                ],
            },
        ],
        properties: ['firstname', 'email', 'phone', 'gm_id'], // Properties to fetch
    };

    let logId;

    try {
        logId = await insertLog('contact', 'search', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            console.log(`Attempt ${attempt + 1} of ${maxRetries} to search for contact with gm_id: ${idMbudo}`);
            try {
                const response = await hubspotAPI.post('/crm/v3/objects/contacts/search', payload);

                if (response.data.total > 0) {
                    const contact = response.data.results[0];
                    console.log(`Contact found`);
                    await updateLog(logId, 'success', response.data, contact.id);
                    return contact; // Return the found contact and exit early
                } else {
                    console.log('No contact found with gm_id:', idMbudo);
                }
            } catch (error) {
                const errorMessage = error.response?.data?.message || "";

                // **Check if it's a rate limit error**
                if (errorMessage.includes("You have reached your secondly limit.")) {
                    console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);

                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
                        return searchContactByIdMbudo(idMbudo, attempt + 1, maxRetries, delay); // Recursively retry
                    }
                }

                // **For other errors, log and return null immediately**
                console.error(`Error during attempt ${attempt} for contact search:`, errorMessage);
                await updateLog(logId, 'failure', error.response ? error.response.data : error);
                return null;
            }
        }
        console.log(`No contact found after ${maxRetries} attempts.`);
        await updateLog(logId, 'success', { message: 'No contact found after retries', idMbudo });
        return null; // Return null if contact is not found after all retries
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };
        console.error('Error searching contact by gm_id:', responseError);
        await updateLog(logId, 'failure', responseError);
        return null;
    }
}


async function updateContactInHubSpot(contactId, contact, hubspotTags, clientName) {
    let name = "";
    if (contact.customfields_firstname){
        name = contact.customfields_firstname;
    }else if(clientName){
        name = clientName;
    }else{
        name = contact.name;
    }
    const payload = {
        properties: {
           firstname: name || '',
            lastname: contact.customfields_lastname || '',
            gm_lastname2: contact.customfields_lastname2 || '',
            email: validateEmail(contact.email)  || '',
            gender: genderMapping[contact.gender] || '',
            gm_hasapp: contact.hasApp || '',
            gm_id: contact.id,
            gm_createuser: contact.idCreateUser || '',
            gm_groupid: contact.idGroup || '',
            gm_invoicesemail : contact.idInvoiceClient || '',
            gm_tags: validateAndFormatTags(contact.idTags, hubspotTags) || '',
            gm_invoicesemail: contact.invoicesEmail || '',
            gm_isagency: contact.isAgency || '',
            gm_iscompany: contact.isCompany || '',
            gm_ispublic: contact.isPublic || '',
            gm_istourop: contact.isTourOperator || '',
            company: contact.name || '',
            gm_nationalid: contact.nationalID ||  '',
            gm_nationality: contact.nationality  ||  '',
            phone: contact.phone,      
            gm_province: contact.province ||  '',
            //region modified
            country: contact.region ||  '',
            address: contact.street ||  '',
            //gm_?: contact.tag ||  '',
            city: contact.town,
            zip: contact.zipCode ||  ''
        },
    };

    let logId;

    try {
        logId = await insertLog('contact', 'update',payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }

        const response = await hubspotAPI.patch(`/crm/v3/objects/contacts/${contactId}`, payload);

        console.log(`Contact updated in HubSpot: ${contactId}`);

        await updateLog(logId, 'success', response.data, contactId);

        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };

        console.error(`Error updating contact in HubSpot (ID: ${contactId}):`, responseError);
        await updateLog(logId, 'failure', responseError, contactId);
        
        return null;
    }
}

async function createContactInHubSpot(contact, hubspotTags, clientName, retries = 300, delay = 1000) {
    let name = "";
    if (contact.customfields_firstname){
        name = contact.customfields_firstname;
    }else if(clientName){
        name = clientName;
    }else{
        name = contact.name;
    }
    const payload = {
        properties: {
            firstname: name || '',
            lastname: contact.customfields_lastname || '',
            gm_lastname2: contact.customfields_lastname2 || '',
            email: validateEmail(contact.email) || '',
            gender: genderMapping[contact.gender] || '',
            gm_hasapp: contact.hasApp || '',
            gm_id: contact.id,
            gm_createuser: contact.idCreateUser || '',
            gm_groupid: contact.idGroup || '',
            gm_invoicesemail : contact.invoicesEmail || '',
            gm_tags: validateAndFormatTags(contact.idTags, hubspotTags)  || '',
            gm_invoicesemail: contact.invoicesEmail || '',
            gm_isagency: contact.isAgency || '',
            gm_iscompany: contact.isCompany || '',
            gm_ispublic: contact.isPublic || '',
            gm_istourop: contact.isTourOperator || '',
            company: contact.name || '',
            gm_nationalid: contact.nationalID ||  '',
            gm_nationality: contact.nationality  ||  '',
            phone: contact.phone ||  '',           
            gm_province: contact.province ||  '',
            //region modified
            country: contact.region ||  '',
            address: contact.street ||  '',
            //gm_tags: contact.idTags ||  '',
            city: contact.town,
            zip: contact.zipCode ||  ''
        },
    };

    let logId;
    try {
        logId = await insertLog('contact', 'create', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }
        const response = await hubspotAPI.post('/crm/v3/objects/contacts', payload);

        console.log(`Contact created in HubSpot: ${response.data.id}`);

        await updateLog(logId, 'success', response.data, response.data.id);

        let found = false;

        // Retry searching for the created contact
        for (let attempt = 0; attempt < retries; attempt++) {
            console.log(`Searching for contact. Attempt ${attempt + 1} of ${retries}`);
            const searchResponse = await searchContactByIdMbudo(contact.id);

            if (searchResponse) {
                console.log('Contact confirmed');
                found = true;
                break; // Exit the loop early if the contact is found
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (!found) {
            console.log('Contact creation confirmed but not found in subsequent searches.');
        }

        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };

        console.error('Error creating contact in HubSpot:', responseError);

        await updateLog(logId, 'failure', responseError);

        return null;
    }
}

async function searchDealByIdMbudo(idMbudo,delay=1000) {
    try {
        const response = await hubspotAPI.post('/crm/v3/objects/deals/search', {
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'gm_id_reserva',
                            operator: 'EQ',
                            value: idMbudo,
                        },
                    ],
                },
            ],
            properties: ['id', 'dealname', 'gm_beneficiarygroupname', 
                'gm_beneficiarynationality', 'gm_canceldate', 'gm_canceled', 
                'gm_checkin', 'gm_clientgroupname', 'gm_clientname', 
                'gm_confirmdate', 'gm_createdate', 'gm_end', 'gm_familyname', 
                'gm_id_reserva', 'gm_idbeneficiary', 'gm_idbeneficiarygroup', 
                'gm_idclient', 'gm_idclientgroup', 'gm_idfamily', 'gm_idgroup', 
                'gm_idproduct', 'gm_idresource', 'gm_idsale', 'gm_idsaleline', 
                'gm_idsubfamily', 'gm_idtype', 'gm_name', 'gm_nationality', 
                'gm_noshow', 'gm_online', 'gm_paid', 'gm_productname', 
                'gm_reference', 'gm_start', 'gm_subfamilyname', 'amount'], // Specify properties to retrieve
        });

        if (response.data.total > 0) {
            console.log(`Deal found for id_mbudo ${idMbudo}`);
            return response.data.results[0]; // Return the first matching deal
        }
        console.log(`No deal found for id_mbudo ${idMbudo}`);
        return null;
    } catch (error) {
        const errorMessage = error.response?.data?.message || "";

        // **Check for rate limit error**
        if (errorMessage.includes("You have reached your secondly limit.")) {
            console.warn(`Rate limit hit. Retrying in ${delay}ms...)`);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
                return searchDealByIdMbudo(idMbudo, delay); // Recursively retry
            }
        }

        // **For other errors, log and return null immediately**
        console.error(`Error searching deal by id_mbudo ${idMbudo}:`, errorMessage);
        await insertExceptionLog(error);
        return null;
    }
}

async function createDealInHubSpot(dealData) {
    const payload = {
        properties: {
            dealname: `RESERVA ${dealData.reference || ""} - ${dealData.id || ""}`, // Required: The name of the deal
            description: `ProductName: ${dealData.productName || ""} \nreference: ${dealData.reference || ""} \nidResource: ${dealData.idResource || ""} \nstart: ${dealData.start || ""}`,
            gm_beneficiarygroupname: dealData.beneficiaryGroupName || "",
            gm_beneficiarynationality: dealData.beneficiaryNationality || "",
            
            gm_canceldate: convertToMidnightUTC(dealData.cancelDate) || "",
            gm_canceled: dealData.canceled ,
            gm_checkin: dealData.checkin ,
            gm_clientgroupname: dealData.clientGroupName || "",
            gm_clientname: dealData.clientName || "",
            gm_confirmdate: convertToMidnightUTC(dealData.confirmDate) || "",
            gm_createdate: convertToMidnightUTC(dealData.createDate) || "",
            gm_end: convertToMidnightUTC(dealData.end) || "",
            gm_familyname: dealData.familyName || "",
            gm_id_reserva: dealData.id || "",
            gm_idbeneficiary: dealData.idBeneficiary || "",
            gm_idbeneficiarygroup: dealData.idBeneficiaryGroup || "",
            gm_idclient: dealData.idClient || "",
            gm_idclientgroup: dealData.idClientGroup || "",
            gm_idfamily: dealData.idFamily || "",
            gm_idgroup: dealData.idGroup || "",
            gm_idproduct: dealData.idProduct || "",
            gm_idresource: dealData.idResource || "",
            gm_idsale: dealData.idSale || "",
            gm_idsaleline: dealData.idSaleLine || "",
            gm_idsubfamily: dealData.idSubFamily || "",
            gm_idtype: dealData.idType || "",
            gm_name: dealData.name || "",
            gm_nationality: dealData.nationality || "",
            gm_noshow: dealData.noshow ,
            gm_online: dealData.online ,
            gm_paid: dealData.paid ,
            gm_productname: dealData.productName || "",
            gm_reference: dealData.reference || "",
            gm_start: convertToMidnightUTC(dealData.start) || "",
            gm_subfamilyname: dealData.subfamilyName || "", 
            amount: dealData.total || 0,
            createdate: convertToMidnightUTC(dealData.createDate) || "",
            closedate: dealData.checkin ? convertToMidnightUTC(dealData.end) : "", // Optional: Close date
            dealstage: getDealStage(dealData) || '995617343', // Required: Deal stage
            pipeline: '678993738', // Required: Pipeline
        },
    };

    let logId;

    try {
        logId = await insertLog('deal', 'create', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }

        const response = await hubspotAPI.post('/crm/v3/objects/deals', payload);

        console.log(`Deal created in HubSpot: ${response.data.id}`);

        await updateLog(logId, 'success', response.data, response.data.id);

        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };

        console.error('Error creating deal in HubSpot:', responseError);

        if (logId) {
            await updateLog(logId, 'failure', responseError);
        }

        return null;
    }
}

async function updateDealInHubSpot(dealId, dealData) {
    const payload = {
        properties: {
            dealname: `RESERVA ${dealData.reference || ""} - ${dealData.id || ""}`, // Required: The name of the deal
            description: `ProductName: ${dealData.productName || ""} \nreference: ${dealData.reference || ""} \nidResource: ${dealData.idResource || ""} \nstart: ${dealData.start || ""}`,
            gm_beneficiarygroupname: dealData.beneficiaryGroupName || "",
            gm_beneficiarynationality: dealData.beneficiaryNationality || "",
            gm_canceldate: convertToMidnightUTC(dealData.cancelDate) || "",
            gm_canceled: dealData.canceled ,
            gm_checkin: dealData.checkin ,
            gm_clientgroupname: dealData.clientGroupName || "",
            gm_clientname: dealData.clientName || "",
            gm_confirmdate: convertToMidnightUTC(dealData.confirmDate) || "",
            gm_createdate: convertToMidnightUTC(dealData.createDate) || "",
            gm_end: convertToMidnightUTC(dealData.end) || "",
            gm_familyname: dealData.familyName || "",
            gm_id_reserva: dealData.id || "",
            gm_idbeneficiary: dealData.idBeneficiary || "",
            gm_idbeneficiarygroup: dealData.idBeneficiaryGroup || "",
            gm_idclient: dealData.idClient || "",
            gm_idclientgroup: dealData.idClientGroup || "",
            gm_idfamily: dealData.idFamily || "",
            gm_idgroup: dealData.idGroup || "",
            gm_idproduct: dealData.idProduct || "",
            gm_idresource: dealData.idResource || "",
            gm_idsale: dealData.idSale || "",
            gm_idsaleline: dealData.idSaleLine || "",
            gm_idsubfamily: dealData.idSubFamily || "",
            gm_idtype: dealData.idType || "",
            gm_name: dealData.name || "",
            gm_nationality: dealData.nationality || "",
            gm_noshow: dealData.noshow,
            gm_online: dealData.online,
            gm_paid: dealData.paid,
            gm_productname: dealData.productName || "",
            gm_reference: dealData.reference || "",
            gm_start: convertToMidnightUTC(dealData.start) || "",
            gm_subfamilyname: dealData.subfamilyName || "", 
            amount: dealData.total ,
            closedate: dealData.checkin ? convertToMidnightUTC(dealData.end) : "", // Optional: Close date
            dealstage: getDealStage(dealData), // Required: Deal stage
            pipeline: '678993738', // Required: Pipeline
        },
    };

    let logId;

    try {
        logId = await insertLog('deal', 'update', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }

        const response = await hubspotAPI.patch(`/crm/v3/objects/deals/${dealId}`, payload);

        console.log(`Deal updated in HubSpot: ${dealId}`);

        await updateLog(logId, 'success', response.data, dealData.id);

        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };

        console.error(`Error updating deal in HubSpot (ID: ${dealData.id}):`, responseError);
        await updateLog(logId, 'failure', responseError, dealData.id || "");
        return null;
    }
}

async function searchCompanyByIdMbudo(idMbudo, maxRetries = 5, delay=1000) {
    if (idMbudo === null) {
        console.log("null id for company");
        return null;
    }

    const payload = {
        filterGroups: [
            {
                filters: [
                    {
                        propertyName: 'gm_id', // Custom property used as unique identifier
                        operator: 'EQ',
                        value: idMbudo,
                    },
                ],
            },
        ],
        properties: ['name', 'gm_email', 'gm_id'], // Properties to fetch
    };

    let logId;

    try {
        logId = await insertLog('company', 'search', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            console.log(`Attempt ${attempt + 1} of ${maxRetries} to search for company with gm_id: ${idMbudo}`);
            try {
                const response = await hubspotAPI.post('/crm/v3/objects/companies/search', payload);

                if (response.data.results.length > 0) {
                    const company = response.data.results[0];
                    console.log(`Company found`);
                    await updateLog(logId, 'success', response.data, company.id); // Log the successful search
                    return company.id; // Return the found company ID and exit early
                } else {
                    console.log('No company found with id_mbudo:', idMbudo);
                }
            } catch (error) {
                const errorMessage = error.response?.data?.message || "";

                // **Check if it's a rate limit error**
                if (errorMessage.includes("You have reached your secondly limit.")) {
                    console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);

                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
                        return searchCompanyByIdMbudo(idMbudo, attempt + 1, maxRetries, delay); // Recursively retry
                    }
                }
                // **For other errors, log and return null immediately**
                console.error(`Error during attempt ${attempt} for company search:`, errorMessage);
                await updateLog(logId, 'failure', error.response ? error.response.data : error);
                return null;
            }
        }
        console.log(`No company found after ${maxRetries} attempts.`);
        await updateLog(logId, 'success', { message: 'No company found after retries', idMbudo });
        return null; // Return null if no company is found after all retries
    } catch (error) {
        console.error('Error searching company by gm_id:', error.response ? error.response.data : error);
        await updateLog(logId, 'failure', error); // Log the error
        return null;
    }
}


async function createCompanyInHubSpot(companyData, domain, retries = 10, delay = 1000) {
    let payload = {
        properties: {
            name: companyData.name || '',
            gm_email: companyData.email || '', // Optional email property
            gm_id: companyData.id, // Custom property for unique ID
            domain: domain || '', // Domain property
        },
    };

    let logId;

    try {
        logId = await insertLog('company', 'create', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }

        // Attempt to create the company
        try {
            const response = await hubspotAPI.post('/crm/v3/objects/companies', payload);
            console.log(`Company created in HubSpot: ${response.data.id}`);
            await updateLog(logId, 'success', response.data, response.data.id);
        } catch (error) {
            const responseError = error.response ? error.response.data : { message: error.message };

            // Handle invalid domain error
            if (responseError.message && responseError.message.includes("INVALID_DOMAIN")) {
                console.warn(`Invalid domain detected: ${payload.properties.domain}. Retrying without domain.`);
                delete payload.properties.domain; // Remove domain property

                // Retry without the domain
                const response = await hubspotAPI.post('/crm/v3/objects/companies', payload);
                console.log(`Company created in HubSpot (without domain): ${response.data.id}`);
                await updateLog(logId, 'success', response.data, response.data.id);
            } else {
                console.error('Error creating company in HubSpot:', responseError);
                await updateLog(logId, 'failure', responseError);
                return null; // Stop on non-domain-related errors
            }
        }

        // Search for the company by gm_id to confirm creation
        for (let attempt = 0; attempt < retries; attempt++) {
            console.log(`Searching for company by gm_id. Attempt ${attempt + 1} of ${retries}`);
            const searchResponse = await searchCompanyByIdMbudo(companyData.id);

            if (searchResponse) {
                console.log(`Company confirmed: ${searchResponse}`);
                return response.data; // Return the company ID if found
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.error('Failed to confirm company creation after retries.');
        await updateLog(logId, 'failure', { message: 'Failed to confirm company creation after retries' });
        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };
        console.error('Error during company creation process:', responseError);
        await updateLog(logId, 'failure', responseError);
        return null;
    }
}


async function updateCompanyInHubSpot(companyId, companyData) {
    const payload = {
        properties: {
            name: companyData.name || '',
            gm_email: companyData.email || '',
            gm_id: companyData.id || '',
        },
    };
    let logId;
    try {
        logId = await insertLog('company', 'update', payload);
        if (!logId) {
            console.error('Failed to insert log. Aborting request.');
            await insertExceptionLog('Failed to insert log. Aborting request.');
            return null;
        }
        const response = await hubspotAPI.patch(`/crm/v3/objects/companies/${companyId}`, payload);
        console.log(`Company updated in HubSpot: ${companyId}`);
        await updateLog(logId, 'success', response.data, response.data.id);
        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };
        console.error(`Error updating company in HubSpot (ID: ${companyId}):`, responseError);
        await updateLog(logId, 'failure', responseError);
        return null;
    }
}

async function getAllContactsFromHubSpot() {
    const contacts = [];
    let after = null;

    try {
        do {
            const body = {
                filterGroups: [
                    {
                        filters: [
                            {
                                propertyName: 'id_mbudo',
                                operator: 'HAS_PROPERTY', // Ensure id_mbudo exists
                            },
                        ],
                    },
                ],
                properties: ['email', 'firstname', 'lastname', 'id_mbudo'], // Properties to fetch
                limit: 100, // Max contacts per request
                after: after, // Pagination cursor
            };

            const response = await hubspotAPI.post('/crm/v3/objects/contacts/search', body);

            console.log(`Fetched ${response.data.results.length} contacts in this batch.`);
            contacts.push(...response.data.results);

            // Update the pagination cursor
            if (response.data.paging && response.data.paging.next) {
                console.log(`Pagination: Next 'after' is ${response.data.paging.next.after}`);
                after = response.data.paging.next.after;
            } else {
                console.log('No more pages to fetch.');
                after = null;
            }
        } while (after);

        console.log(`Fetched a total of ${contacts.length} contacts with id_mbudo.`);
        return contacts;
    } catch (error) {
        console.error('Error fetching contacts from HubSpot:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(error.message);
        }
        return [];
    }
}

async function associateDealWithContact(dealId, contactId) {
    try {
        const response = await hubspotAPI.put(`/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/3`);
        console.log(`Associated deal ${dealId} with contact ${contactId}`);
        return response.data;
    } catch (error) {
        console.error(`Error associating deal ${dealId} with contact ${contactId}:`, error.response ? error.response.data : error.message);
        await insertExceptionLog(error);     
        return null;
    }
}

async function associateDealWithCompany(dealId, companyId) {
    try {
        // Construct the URL for the association endpoint
        const response = await hubspotAPI.put(`/crm/v3/objects/deals/${dealId}/associations/companies/${companyId}/341`);
        console.log(`Successfully associated deal ${dealId} with company ${companyId}`);
        return response.data;
    } catch (error) {
        const responseError = error.response ? error.response.data : { message: error.message };
        console.error(`Error associating deal ${dealId} with company ${companyId}:`, responseError);
        await insertExceptionLog(error);  
        return null;
    }
}

function convertToMidnightUTC(dateString) {

    if (!dateString || dateString === "") {
        return "";
    }
    const date = new Date(dateString);
    // Calculate the UTC-5 offset in milliseconds
    const offset = 0 * 60 * 60 * 1000; // 6 hours in milliseconds

    // Adjust the date to UTC-6
    const utcMinus6Date = new Date(date.getTime() - offset);
    return utcMinus6Date;
}

function getDealStage(dealData) {
    if (dealData.canceled || dealData.noshow) {
        return "995617347";
    } else if (dealData.checkin) {
        return "995617346";
    } else if(dealData.confirmDate){
        return "995617343"
    }
    // Fallback to a default stage if none match
    return "995617341"; // Change this if there’s a different fallback stage
}

function getCompanyDomainFromEmail(email) {
    if (!email) return null;

    // List of common free email domains
    const freeEmailDomains = [
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "aol.com",
        "live.com",
        "icloud.com",
        "mail.com"
    ];

    // Extract domain from email
    const domain = email.split("@")[1];

    // Check if the domain is not in the free email domains list
    if (domain && !freeEmailDomains.includes(domain.toLowerCase())) {
        return domain; // Return the domain if it's valid
    }

    return null; // Return null if it's a free email domain
}

function findById(dataArray, searchId) {
    return dataArray.find(item => item.id === searchId);
}

function validateAndFormatTags(tagListString, hubspotTags) {

    if(!tagListString){
        return "";
    }
    const tagIds = tagListString.split(','); // Split the string into an array of tag IDs

    for (const tagId of tagIds) {
        const tag = hubspotTags.find(item => item.id === tagId);
        if (!tag) {
            console.log(`Invalid tag found: ${tagId}`);
            return ""; // Return empty string if any tag is invalid
        }
    }

    // If all tags are valid, return them as a semicolon-separated string
    return tagIds.join(';');
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return ""; // Invalid format
    }

    // Extract domain and TLD
    const domain = email.split('@')[1];
    const tld = domain.split('.').pop().toLowerCase();

    // Known valid TLDs (expandable)
    const validTLDs = [
        "com", "net", "org", "edu", "gov", "mil", "io", "co", "us", "uk", "de", "fr", "es", "it",
        "au", "ca", "jp", "cn", "in", "br", "mx", "za", "nl", "ru", "info", "biz", "me", "tv"
    ];

    return validTLDs.includes(tld) ? email : "";
}

module.exports = {createCompanyInHubSpot,createOrUpdateContactInHubSpot,createOrUpdateDealInHubSpot,createOrUpdateCompanyInHubSpot,getAllContactsFromHubSpot,associateDealWithContact, associateDealWithCompany};