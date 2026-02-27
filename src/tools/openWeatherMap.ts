import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import { OpenWeatherAPI } from "openweather-api-node";

function _formatWeatherInfo(locationName: string, observation: any): string {
    const { dt, weather } = observation;
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

function _newClient(apiKey: string, locationName: string) {
    return new OpenWeatherAPI({
        key: apiKey,
        units: "metric",
        locationName,
    });
}

async function _normalizeLocation(apiKey: string, locationName: string) {
    const client = new OpenWeatherAPI({
        key: apiKey,
    });
    const locationData = await client.getLocation({ locationName });
    return locationData.name;
}

export function createOpenWeatherMapQueryRun({ apiKey }: { apiKey: string }) {
    return new DynamicStructuredTool({
        name: "OpenWeatherMap",
        description:
            "Fetching current weather information " +
            "for a specified location.",
        schema: z.object({
            input: z.string().describe("location").default("Taipei"),
        }),
        func: async (query: any) => {
            const { input } = query || {};
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
