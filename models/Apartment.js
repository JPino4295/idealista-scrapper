const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const apartmentSchema = new Schema({
    title: String,
    prize: String,
    zone: String,
    size: String,
    rooms: String,
    bathrooms: String,
    terrace: String,
    year: String,
    floor: String,
    ext: String,
    elevator: Boolean
});

module.exports = mongoose.model('apartment', apartmentSchema);

