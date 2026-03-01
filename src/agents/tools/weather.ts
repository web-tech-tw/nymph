import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import { OpenWeatherAPI, type CurrentWeather } from "openweather-api-node";

interface WeatherConfig {
    apiKey: string;
}

function formatWeather(location: string, obs: CurrentWeather): string {
    const { weather, dt } = obs;
    return [
        `In ${location},`,
        "the latest report of weather is as follows:",
        `Datetime: ${dt.toISOString()}`,
        `Description: ${weather.description ?? "N/A"}`,
        `Wind speed: ${weather.wind.speed ?? "N/A"} m/s, direction: ${weather.wind.deg ?? "N/A"}°`,
        `Humidity: ${weather.humidity ?? "N/A"}%`,
        "Temperature:",
        `- Current: ${weather.temp.cur ?? "N/A"}°C`,
        `- Feels like: ${weather.feelsLike.cur ?? "N/A"}°C`,
        `Rain: ${weather.rain ?? "N/A"}`,
        `Cloud cover: ${weather.clouds ?? "N/A"}%`,
    ].join("\n");
}

export function createOpenWeatherMap(config: WeatherConfig): DynamicStructuredTool {
    const { apiKey } = config;

    return new DynamicStructuredTool({
        name: "OpenWeatherMap",
        description: "Fetches current weather information for a specified location.",
        schema: z.object({
            input: z.string().describe("location").default("Taipei"),
        }),
        func: async ({ input }) => {
            let location = input || "Taipei";
            try {
                const geo = new OpenWeatherAPI({ key: apiKey });
                const loc = await geo.getLocation({ locationName: location });
                location = loc?.name ?? location;

                const client = new OpenWeatherAPI({ key: apiKey, units: "metric", locationName: location });
                const observation = await client.getCurrent();
                return formatWeather(location, observation);
            } catch (error) {
                console.error("Error fetching weather data:", error);
                return "Error fetching weather data";
            }
        },
    });
}
