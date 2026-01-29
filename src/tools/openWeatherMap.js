"use strict";

const {
    DynamicStructuredTool,
} = require("@langchain/community/tools/dynamic");
const {
    z,
} = require("zod");

const {
    OpenWeatherAPI,
} = require("openweather-api-node");

/**
 * Extract data to prompt.
 * @param {string} locationName - The location.
 * @param {object} observation - The data.
 * @return {string} - The prompt.
 */
function _formatWeatherInfo(locationName, observation) {
    const {dt, weather} = observation;
    const {
        description,
        wind,
        humidity,
        temp,
        feelsLike,
        rain,
        clouds,
    } = weather;
    return [
        `In ${locationName},`,
        "the latest report of weather is as follows:",
        `Datetime: ${dt}`,
        `Description: ${description}`,
        `Wind speed: ${wind?.speed ?? "N/A"} m/s,`,
        `direction: ${wind?.deg ?? "N/A"}°`,
        `Humidity: ${humidity ?? "N/A"}%`,
        "Temperature:",
        `- Current: ${temp?.cur ?? "N/A"}°C`,
        `- Feels like: ${feelsLike?.cur ?? "N/A"}°C`,
        `Rain: ${rain ?? "N/A"}`,
        `Cloud cover: ${clouds ?? "N/A"}%`,
    ].join("\n");
}

/**
 * Create a client.
 * @param {string} apiKey - The API Key.
 * @param {string} locationName - The location.
 * @return {OpenWeatherAPI} - The client.
 */
function _newClient(apiKey, locationName) {
    return new OpenWeatherAPI({
        key: apiKey,
        units: "metric",
        locationName,
    });
}

/**
 * Normalizes a given string to be used as
 * an OpenWeatherMap API request's parameter (i.e., Taipei).
 * @param {string} apiKey - The API Key.
 * @param {string} locationName - The location.
 * @return {Promise<string>} - The normalized location.
 */
async function _normalizeLocation(apiKey, locationName) {
    const client = new OpenWeatherAPI({
        key: apiKey,
    });
    const locationData = await client.getLocation({
        locationName,
    });
    return locationData.name;
}

/**
 * createOpenWeatherMapQueryRun is a wrapper for OpenWeatherMap API to
 * provide a simple way to query weather data from OpenWeatherMap API in NodeJS
 * with Langchain's Tool interface for extensibility purposes.
 * @param {string} apiKey - The API Key.
 * @return {DynamicStructuredTool} - The wrapper.
 */
function createOpenWeatherMapQueryRun({apiKey}) {
    return new DynamicStructuredTool({
        name: "OpenWeatherMap",
        description: "Fetching current weather information " +
            "for a specified location.",
        schema: z.object({
            input: z.string().describe("location").default("Taipei"),
        }),
        func: async (query) => {
            const {input} = query || {};
            let locationName = input ?? "Taipei";

            try {
                locationName = await _normalizeLocation(apiKey, locationName);
                const client = _newClient(apiKey, locationName);
                const observation = await client.getCurrent();
                return _formatWeatherInfo(locationName, observation);
            } catch (error) {
                console.error("Error fetching weather data:", error);
                return "Error fetching weather data";
            }
        },
    });
}

module.exports = {
    createOpenWeatherMapQueryRun,
};
