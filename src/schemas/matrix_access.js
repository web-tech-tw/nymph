"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

module.exports = new Schema({
    username: {
        type: String,
        required: true,
    },
    accessToken: {
        type: String,
        required: true,
    },
});
