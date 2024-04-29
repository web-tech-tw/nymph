"use strict";
// Matrix is an opensource instant messaging platform.

const {createClient} = require("matrix-js-sdk");

const client = createClient({baseUrl: "https://matrix.org"});

exports.useClient = () => client;
