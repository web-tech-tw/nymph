"use strict";

// Routers
exports.routerFiles = [
    "./swagger.js",
    "./line.js",
];

// Load routes
exports.load = () => {
    const routerMappers = exports.routerFiles.map((n) => require(n));
    routerMappers.forEach((c) => c());
};
