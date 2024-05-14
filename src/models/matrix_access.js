"use strict";

const {useDatabase} = require("../clients/database");
const database = useDatabase();

const schemaMatrixData = require("../schemas/matrix_access");
module.exports = database.model("MatrixAccess", schemaMatrixData);
