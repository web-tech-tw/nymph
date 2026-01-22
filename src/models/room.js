"use strict";

const {useDatabase} = require("../clients/database");
const database = useDatabase();

const schemaRoom = require("../schemas/room");
module.exports = database.model("Room", schemaRoom);
