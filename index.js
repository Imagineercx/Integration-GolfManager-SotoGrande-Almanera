require('dotenv').config();
const axios = require('axios');

const {getReservationsByID,getClients,getClientsFull,getClientFullByID,getReservations,getTenants,getTags} = require('./api/golfmanager');
const {createCompanyInHubSpot,createOrUpdateContactInHubSpot,createOrUpdateDealInHubSpot,createOrUpdateCompanyInHubSpot,getAllContactsFromHubSpot,associateDealWithContact, associateDealWithCompany} = require('./api/hubspot');

const freeEmailDomains = [
    "gmail.com",
    "yahoo.com",
    "yahoo.es",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
    "zoho.com",
    "yandex.com",
    "protonmail.com",
    "mail.com",
    "gmx.com",
];

const hubspotTags = [
    { id: "12", name: "ABONADO 2019" },
    { id: "18", name: "ABONADO AF PREMIUM" },
    { id: "19", name: "ABONADO AF STANDARD" },
    { id: "15", name: "ABONADO AI PREMIUM" },
    { id: "5", name: "ABONADO AI STANDARD" },
    { id: "29", name: "ABONADO ALBATROS" },
    { id: "17", name: "ABONADO AM PREMIUM" },
    { id: "16", name: "ABONADO AM STANDARD" },
    { id: "20", name: "ABONADO CORPORATIVO 2T" },
    { id: "21", name: "ABONADO CORPORATIVO 4T" },
    { id: "31", name: "ABONADO EAGLE" },
    { id: "7", name: "ABONADO SEMESTRAL" },
    { id: "30", name: "ABONADO SUNSET" },
    { id: "6", name: "ABONADO TRIMESTRAL" },
    { id: "24", name: "ALDIANA" },
    { id: "8", name: "GOLF DESK" },
    { id: "14", name: "GOLF EXPERIENCE" },
    { id: "13", name: "GOLF SERVICE" },
    { id: "23", name: "GOLFBREAKS" },
    { id: "4", name: "HOTEL" },
    { id: "9", name: "HOTEL RESIDENTE SO" },
    { id: "26", name: "MARKETING" },
    { id: "32", name: "RCG VALDERRAMA" },
    { id: "22", name: "REAL CLUB GOLF SOTOGRANDE" },
    { id: "28", name: "SO" },
    { id: "27", name: "STAFF" },
    { id: "25", name: "So | Sotogrande" },
    { id: "2", name: "TTOO" },
    { id: "10", name: "TTOO RESIDENTE SO" },
    { id: "1", name: "VISITANTE" }
];


(async () => {
    try {
        //const clients = await getClients();

        var dates = getDates();
        /*
        var startFormatted = `${dates.firstDay}T00:00:00+01:00`;
        var endFormatted = `${dates.lastDay}T23:00:00+01:00`;
       */
        var startFormatted = `2022-01-01T01:00:00+01:00`;
        var endFormatted = `2023-12-31T23:00:00+01:00`;
        
        console.log('start:', startFormatted);
        console.log('end:', endFormatted);
        const deals = await getReservations(startFormatted,endFormatted);
        if (deals){
            for (const golfReservation of deals) {
                console.log(`Processing deal with id_mbudo: ${golfReservation.id}`);
                const hubspotDeal = await createOrUpdateDealInHubSpot(golfReservation);
                if (hubspotDeal) {
                    console.log(`Deal processed successfully: ${hubspotDeal.id}`);
                
                    const golfClient = await getClientFullByID(golfReservation.idClient);
                    if(golfClient){
                        const hubspotContact = await createOrUpdateContactInHubSpot(golfClient.id, golfClient, hubspotTags, golfReservation.clientName);
                        if (hubspotContact) {
                            console.log(`Associating deal ${hubspotDeal.id} with contact ${hubspotContact.id}`);
                            await associateDealWithContact(hubspotDeal.id, hubspotContact.id);
                        } else {
                            console.log(`No matching contact found for deal id_mbudo: ${golfReservation.idClient}`);
                        }

                        if (!golfClient.id) {
                            console.log(`No client data found for id_mbudo: ${golfReservation.idClient}`);
                            continue;
                        }

                        const selectedEmail = golfClient.email || golfReservation.email;

                        if (!selectedEmail) {
                            console.log(`No email found for deal id_mbudo: ${golfReservation.id}`);
                            continue; // Skip further processing if no email is available
                        }

                        console.log(`Using email: ${selectedEmail}`);
                        const domain = selectedEmail.split("@")[1]?.toLowerCase();

                        if (freeEmailDomains.includes(domain)) {
                            console.log(`Skipping company creation for free email domain: ${domain}`);
                        } else {
                            console.log(`Creating company for domain: ${domain}`);
                            const hubspotCompany = await createOrUpdateCompanyInHubSpot(golfClient.id, golfClient, domain);
                            if (hubspotCompany) {
                                console.log(`Associating deal ${hubspotDeal.id} with company ${hubspotCompany.id}`);
                                await associateDealWithCompany(hubspotDeal.id, hubspotCompany.id);
                            } else {
                                console.log(`No matching company found for deal id_mbudo: ${golfReservation.idClient}`);
                            }
                        }
                    } else {   
                        console.log(`No client data found for id_mbudo: ${golfReservation.idClient}`);
                    }   
                } else {
                    console.log('Failed to process deal. Check logs for details.');
                }
            }
            console.log('All deals processed');
        } else {
            console.log('No deals found');
        }
        } catch (error) {
                console.error('Error during client or reservation processing:', error.message);
        }
        
})();

function getDates() {
    const today = new Date();
    // First day of the current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    // Last day of the next month
    const lastDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    return {
        firstDay: firstDayOfMonth.toISOString().split('T')[0], // 'YYYY-MM-DD'
        lastDay: lastDayOfNextMonth.toISOString().split('T')[0] // 'YYYY-MM-DD'
    };
}