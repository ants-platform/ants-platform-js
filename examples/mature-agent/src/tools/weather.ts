/**
 * A real third-party HTTP integration: Open-Meteo (no API key required).
 * Traced as a `tool` so the external service call appears in the trace with
 * its inputs, latency, and response.
 */
import { startActiveObservation } from "ants-platform";

export interface Weather {
  temperatureC: number;
  windKph: number;
  description: string;
}

const WEATHER_CODES: Record<number, string> = {
  0: "clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  61: "rain",
  63: "moderate rain",
  65: "heavy rain",
  80: "rain showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
};

/** Fetch current weather for a lat/lon, traced as an integration tool call. */
export function getWeather(
  place: string,
  lat: number,
  lon: number,
): Promise<Weather> {
  return startActiveObservation(
    "tool:weather",
    async (tool) => {
      tool.update({
        input: { place, lat, lon },
        metadata: { provider: "open-meteo", endpoint: "/v1/forecast" },
      });

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m,weather_code`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`weather API ${res.status}`);
      const json = (await res.json()) as {
        current: {
          temperature_2m: number;
          wind_speed_10m: number;
          weather_code: number;
        };
      };

      const weather: Weather = {
        temperatureC: json.current.temperature_2m,
        windKph: json.current.wind_speed_10m,
        description: WEATHER_CODES[json.current.weather_code] ?? "unknown",
      };
      tool.update({ output: weather });
      return weather;
    },
    { asType: "tool" },
  );
}
