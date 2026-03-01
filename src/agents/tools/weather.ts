import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import { OpenWeatherAPI } from "openweather-api-node";

interface WeatherConfig {
    apiKey: string;
}

interface WeatherDescription {
    main?: string;
    description?: string;
    icon?: string;
}

interface WeatherObservation {
    dt: string;
    weather: WeatherDescription;
    wind: { speed?: number; deg?: number };
    humidity?: number;
    temp: { cur?: number; min?: number; max?: number };
    feelsLike: { cur?: number };
    rain?: number;
    clouds?: number;
}

function formatWeather(location: string, obs: WeatherObservation): string {
    return [
        `In ${location},`,
        "the latest report of weather is as follows:",
        `Datetime: ${obs.dt}`,
        `Description: ${obs.weather.description ?? "N/A"}`,
        `Wind speed: ${obs.wind.speed ?? "N/A"} m/s, direction: ${obs.wind.deg ?? "N/A"}°`,
        `Humidity: ${obs.humidity ?? "N/A"}%`,
        "Temperature:",
        `- Current: ${obs.temp.cur ?? "N/A"}°C`,
        `- Feels like: ${obs.feelsLike.cur ?? "N/A"}°C`,
        `Rain: ${obs.rain ?? "N/A"}`,
        `Cloud cover: ${obs.clouds ?? "N/A"}%`,
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
                return formatWeather(location, observation as unknown as WeatherObservation);
            } catch (error) {
                console.error("Error fetching weather data:", error);
                return "Error fetching weather data";
            }
        },
    });
}
