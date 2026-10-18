import { defineConfig, type InputTransformerFn } from "orval";

// TMDB and Seerr publish an OpenAPI spec of their whole API; we generate a
// typed client for the routes Spotarr uses only.
const SEERR_ROUTES = [
  "/movie/{movieId}",
  "/tv/{tvId}",
  "/request",
  "/watchlist",
  "/watchlist/{tmdbId}",
];
const TMDB_ROUTES = [
  "/3/find/{external_id}",
  "/3/movie/{movie_id}",
  "/3/tv/{series_id}",
  "/3/search/movie",
  "/3/search/tv",
  "/3/genre/movie/list",
  "/3/genre/tv/list",
  "/3/movie/{movie_id}/watch/providers",
  "/3/tv/{series_id}/watch/providers",
  "/3/watch/providers/movie",
  "/3/watch/providers/tv",
  "/3/watch/providers/regions",
];

function onlyRoutes(routes: string[]): InputTransformerFn {
  return (spec) => ({
    ...spec,
    paths: Object.fromEntries(
      Object.entries(spec.paths ?? {}).filter(([route]) => routes.includes(route)),
    ),
  });
}

// Seerr's spec names a watchlist entry's media type `type`; its server reads
// `mediaType` ("movie" or "tv") and refuses the request without it. The spec
// is corrected here, so the generated client sends what the server reads.
function seerrSpec(routes: string[]): InputTransformerFn {
  return (spec) => {
    const paths = Object.fromEntries(
      Object.entries(spec.paths ?? {}).filter(([route]) => routes.includes(route)),
    );
    const schemas = spec.components?.schemas ?? {};
    const watchlist = schemas.Watchlist as { properties?: Record<string, unknown> };
    const { type: _type, ...properties } = watchlist.properties ?? {};
    const mediaType = { type: "string" as const, enum: ["movie", "tv"] };
    return {
      ...spec,
      paths,
      components: {
        ...spec.components,
        schemas: {
          ...schemas,
          Watchlist: { ...watchlist, properties: { ...properties, mediaType } },
        },
      },
    };
  };
}

export default defineConfig({
  // A typed client, and typed fake answers for tests.
  tmdb: {
    input: {
      target: "https://developer.themoviedb.org/openapi/tmdb-api.json",
      override: { transformer: onlyRoutes(TMDB_ROUTES) },
    },
    output: {
      target: "src/integrations/tmdb/gen/tmdb.ts",
      client: "fetch",
      baseUrl: "https://api.themoviedb.org",
      mock: { generators: [{ type: "faker" }] },
    },
  },

  // Seerr's spec, pinned to the version on the Umbrel (v3.5.0). It is known to
  // differ from real answers in places (watchProviders, nullable fields), so
  // answers are typed but not validated. Its address being a setting, every
  // call goes through seerr-fetch.ts.
  seerr: {
    input: {
      target: "https://raw.githubusercontent.com/seerr-team/seerr/v3.5.0/seerr-api.yml",
      override: { transformer: seerrSpec(SEERR_ROUTES) },
    },
    output: {
      target: "src/integrations/seerr/gen/seerr.ts",
      client: "fetch",
      baseUrl: "",
      mock: { generators: [{ type: "faker" }] },
      override: {
        mutator: { path: "src/integrations/seerr/seerr-fetch.ts", name: "seerrFetch" },
      },
    },
  },
});
