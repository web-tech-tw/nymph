"use strict";

const mongoose = require("mongoose");
const {Schema} = mongoose;

const schema = new Schema({
    platform: {
        type: String,
        required: true,
    },
    roomId: {
        type: String,
        required: true,
    },
    mode: {
        type: String,
        enum: ["normal", "translator"],
        default: "normal",
    },
    languages: {
        type: [String],
        validate: {
            validator: function(v) {
                // either empty or exactly two language codes
                return !v || v.length === 0 || v.length === 2;
            },
            message:
                "languages must be an array with two language codes when set",
        },
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

schema.index(
    {
        platform: 1,
        roomId: 1,
    },
    {unique: true},
);

module.exports = schema;
