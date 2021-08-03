'use strict';

const Apartment = require('./models/Apartment');

require('dotenv').config({ path: `${__dirname}/.env` })

const axios = require('axios'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    TelegramBot = require('node-telegram-bot-api'),
    SEARCH_URL = process.env.SEARCH_URL,
    BASE_URL = process.env.BASE_URL,
    USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
    globalOptions = {
        headers: {
            'Host': BASE_URL.replace('https://', '').replace('/', ''),
            'User-Agent': USER_AGENT
        }
    };


async function getHtml({src, options}) {
    console.log(`GETTING DATA FROM ${src}`);
    const {status, data} = await axios.get(`${src}`, options);

    if (status !== 200) {
        throw new Error(`[Request failed] - Status: ${status}`)
    }

    return data;
}

async function processHtml({html, apartments}) {
    const $ = cheerio.load(html);
    const dataCards = $('.item.item-multimedia-container');
    const apartmentsResponse = apartments || [];

    for (let data of dataCards) {
        const html = $(data).html();
        const dataCard = cheerio.load(html);
        const url = dataCard('.item-link').attr('href');
        const apartmentHtml = await getHtml({
            src: BASE_URL + url.replace('/', ''),
            options: globalOptions
        });
        const apartmentData = processApartment(apartmentHtml);
        apartmentData.url = BASE_URL + url.replace('/', '');
        
        apartmentsResponse.push(apartmentData);
    }

    if ($('.pagination').length > 0 && $('.pagination .icon-arrow-right-after').length > 0) {
        const url = $('.pagination .icon-arrow-right-after').attr('href'),
            nextPage = await axios.get(BASE_URL + url.replace('/', ''), globalOptions),
            nextHtml = nextPage.data;
        return await processHtml({html: nextHtml, apartments: apartmentsResponse})
    }
    
    return apartmentsResponse;
}

function processApartment(apartmentHtml) {
    const $ = cheerio.load(apartmentHtml);

    let apartment = {};

    apartment.title = $('.main-info__title-main').text();
    apartment.price = $('.info-data-price').text();
    apartment.zone = $('.main-info__title-minor').text();

    $('#details .details-property .details-property-feature-one .details-property_features > ul > li').each(function() {
        const data = $(this).text();

        if (data.match('m² construidos')) {
            apartment.size = data.split(' ').shift();
        }

        if (data.match('habitación') || data.match('habitaciones')) {
            apartment.rooms = data.split(' ').shift();
        }

        if (data.match('baño')) {
            apartment.bathrooms = data.split(' ').shift();
        }

        if (data.match('Terraza')) {
            apartment.terrace = true
        }

        if (data.match('Construido')) {
            apartment.year = data.split(' ').pop();
        }
    })

    $('#details .details-property .details-property-feature-two .details-property_features > ul > li').each(function() {
        const data = $(this).text();

        if (data.match('Planta')) {
            const [_, floor, ext] = data.split(' ');

            apartment.floor = floor;
            apartment.ext = ext;
        }

        if (data.match('scensor')) {
            apartment.elevator = true;
        }
    })
    
    return apartment;
}

function generateMessage(apartments) {
    let message = '';
    apartments.forEach((apartment) => {
        message += `${apartment.title} (${apartment.zone}) - ${apartment.size} m² (${apartment.price}) -> ${apartment.url}${apartment.updated ? ' (Actualizado)' : ''}\n\n\n`;
    })

    return message;
}

function startConnection() {
    if (!process.env.TESTING) {
        console.log(`process.env.DB_URL ${JSON.stringify(process.env.DB_URL)}`);
        mongoose.connect(process.env.DB_URL, {useNewUrlParser: true, useUnifiedTopology: true});
    }
}

function closeConnection() {
    if (!process.env.TESTING) {
        console.log(`Closing connection. 30 seconds left`);
        setTimeout(() => {
            mongoose.disconnect();
            console.log('Disconnected, exiting');
            process.exit(0);
        }, 30 * 1000);
    } else {
        process.exit(0);
    }
}

async function getNewApartments(apartments) {
    if (process.env.TESTING) {
        return apartments;
    }

    startConnection();
    let newApartments = []
    for (let apartment of apartments) {
        const apartmentModel = Apartment;
        const apartmentDb = await apartmentModel.findOne({
            title: apartment.title,
            size: apartment.size,
            rooms: apartment.rooms,
            url: apartment.url
        });

        if (!apartmentDb) {
            await apartmentModel.create(apartment);
            newApartments.push(apartment);
        } else {
            if (apartmentDb.price !== apartment.price) {
                apartment.updated = true;
                const updated = await apartmentModel.updateOne({
                    _id: apartmentDb._id
                }, {
                    price: apartment.price
                });
                newApartments.push(apartment);
            }
        }
    }
    return newApartments;
}

function checkVariables() {
    if (!process.env.BASE_URL){
        throw new Error('A base url must exist in the environment variables');
    }

    if (!process.env.SEARCH_URL){
        throw new Error('A search url must exist in the environment variables');
    }

    if (!process.env.TELEGRAM_TOKEN){
        throw new Error('A telegram token must exist in the environment variables');
    }

    if (!process.env.TELEGRAM_GROUP_ID){
        throw new Error('A telegram group id must exist in the environment variables');
    }

    if (!process.env.DB_URL){
        throw new Error('A db url must exist in the environment variables');
    }

    if (Boolean(process.env.TESTING)) {
        console.log(`process.env.TESTING ${JSON.stringify(process.env.TESTING)}`);
        console.log('TESTING MODE');
    }
}

(async () => {
    try {
        checkVariables();

        const data = await getHtml({
            src: `${BASE_URL + SEARCH_URL}`,
            options: globalOptions
        });
        const apartments = await processHtml({html: data});
        const newApartments = await getNewApartments(apartments);

        if (process.env.TESTING) {
            console.log(`Found ${newApartments.length} apartments`);
        } else {
            if (newApartments.length > 0) {
                const message = generateMessage(newApartments);
                const tBot =  new TelegramBot(process.env.TELEGRAM_TOKEN);
                console.log(`Sending message...`);
                const messageResponse = await tBot.sendMessage(process.env.TELEGRAM_GROUP_ID, message);
                console.log(`messageResponse ${JSON.stringify(messageResponse)}`);
            } else {
                console.log(`No new apartmens found...`);
            }    
        }

        closeConnection();
    } catch (e) {
        console.error(`APPLICATION ERROR: ${e.toString()}`);
        console.error(e);
        process.exit(1);
    }
    
})()