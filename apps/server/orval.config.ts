import { defineConfig } from "orval";

// TMDB publishes an OpenAPI spec of its whole API. We generate a typed client,
// and typed fake responses for tests, for the routes Spotarr uses only.
const TMDB_ROUTES = ["/3/find/{external_id}", "/3/movie/{movie_id}", "/3/tv/{series_id}"];

export default defineConfig({
  tmdb: {
    input: {
      target: "https://developer.themoviedb.org/openapi/tmdb-api.json",
      override: {
        transformer: (spec) => ({
          ...spec,
          paths: Object.fromEntries(
            Object.entries(spec.paths ?? {}).filter(([route]) => TMDB_ROUTES.includes(route)),
          ),
        }),
      },
    },
    output: {
      target: "src/integrations/tmdb/gen/tmdb.ts",
      client: "fetch",
      baseUrl: "https://api.themoviedb.org",
      mock: { generators: [{ type: "faker" }] },
    },
  },
});
