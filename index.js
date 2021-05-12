'use strict';

const Apartment = require('./models/Apartment');

require('dotenv').config()

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

async function processHtml(html) {
    const $ = cheerio.load(html);
    
    const dataCards = $('.item.item-multimedia-container');
    const apartments = [];

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
        
        apartments.push(apartmentData);
    }

    return apartments;
}

function processApartment(apartmentHtml) {
    const $ = cheerio.load(apartmentHtml);

    let apartment = {};

    apartment.title = $('.main-info__title-main').text();
    apartment.prize = $('.info-data-price').text();
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
        message += `${apartment.title} (${apartment.zone}) - ${apartment.size} m² (${apartment.prize}) -> ${apartment.url}${apartment.updated ? ' (Actualizado)' : ''}\n\n\n`;
    })

    return message;
}

async function getNewApartments(apartments) {
    console.log(`process.env.DB_URL ${JSON.stringify(process.env.DB_URL)}`);
    mongoose.connect(process.env.DB_URL, {useNewUrlParser: true, useUnifiedTopology: true});
    let newApartments = []
    for (let apartment of apartments) {
        const apartmentModel = Apartment;
        const apartmentDb = await apartmentModel.findOne({
            title: apartment.title,
            size: apartment.size,
            rooms: apartment.rooms
        });

        if (!apartmentDb) {
            await apartmentModel.create(apartment);
            newApartments.push(apartment);
        } else {
            if (apartmentDb.prize !== apartment.prize) {
                apartment.updated = true;
                const updated = await apartmentModel.updateOne({
                    _id: apartmentDb._id
                }, {
                    prize: apartment.prize
                });

                console.log(`updated ${JSON.stringify(updated)}`);
                newApartments.push(apartment);
            }
        }
    }
    return newApartments;
}

(async () => {
    try {
        const data = await getHtml({
            src: `${BASE_URL + SEARCH_URL}`,
            options: globalOptions
        });
        const apartments = await processHtml(data);
        const newApartments = await getNewApartments(apartments);
        if (newApartments.length > 0) {
            const message = generateMessage(newApartments);
            const tBot =  new TelegramBot(process.env.TELEGRAM_TOKEN);
            console.log(`Sending message...`);
            tBot.sendMessage(process.env.TELEGRAM_GROUP_ID, message);
        }

        setTimeout(() => {
            mongoose.disconnect();
        }, 1 * 60 * 1000);
        
    } catch (e) {
        console.error(`APPLICATION ERROR: ${e.toString()}`);
        process.exit(1);
    }
    
})()
