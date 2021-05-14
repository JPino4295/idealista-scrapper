const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const apartmentSchema = new Schema({
    title: String,
    price: String,
    zone: String,
    size: String,
    rooms: String,
    bathrooms: String,
    terrace: String,
    year: String,
    floor: String,
    ext: String,
    elevator: Boolean,
    url: String
});

module.exports = mongoose.model('apartment', apartmentSchema);

