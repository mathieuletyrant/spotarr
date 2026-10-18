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
// Jellyfin's routes carry several methods each (DELETE /Items deletes media):
// only the operations Spotarr calls are kept, as "<method> <route>".
const JELLYFIN_OPERATIONS = [
  "get /System/Info",
  "get /Users",
  "get /Items",
  "post /Collections",
  "post /Collections/{collectionId}/Items",
  "delete /Collections/{collectionId}/Items",
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

function onlyOperations(operations: string[]): InputTransformerFn {
  return (spec) => {
    const paths = Object.fromEntries(
      Object.entries(spec.paths ?? {})
        .map(([route, item]) => [
          route,
          Object.fromEntries(
            Object.entries(item ?? {}).filter(([method]) =>
              operations.includes(`${method} ${route}`),
            ),
          ),
        ])
        .filter(([, item]) => Object.keys(item as object).length > 0),
    );
    // Jellyfin describes hundreds of types: only those the kept operations
    // reach are generated.
    const all = spec.components?.schemas ?? {};
    const used = new Set<string>();
    collectRefs(paths, all, used);
    const schemas = Object.fromEntries(Object.entries(all).filter(([name]) => used.has(name)));
    return { ...spec, paths, components: { ...spec.components, schemas } };
  };
}

// Adds to `used` the name of every schema `value` refers to ("$ref":
// "#/components/schemas/BaseItemDto"), and of every schema those refer to.
function collectRefs(value: unknown, all: Record<string, unknown>, used: Set<string>): void {
  if (typeof value !== "object" || value === null) return;
  for (const [key, inner] of Object.entries(value)) {
    if (key === "$ref" && typeof inner === "string") {
      const name = inner.replace("#/components/schemas/", "");
      if (!used.has(name)) {
        used.add(name);
        collectRefs(all[name], all, used);
      }
    }
    collectRefs(inner, all, used);
  }
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

  // Jellyfin's spec, pinned to the version on the Umbrel (12.2). Its address
  // being a setting, every call goes through jellyfin-fetch.ts, like Seerr's.
  jellyfin: {
    input: {
      target: "https://api.jellyfin.org/openapi/stable/jellyfin-openapi-12.2.json",
      override: { transformer: onlyOperations(JELLYFIN_OPERATIONS) },
    },
    output: {
      target: "src/integrations/jellyfin/gen/jellyfin.ts",
      client: "fetch",
      baseUrl: "",
      mock: { generators: [{ type: "faker" }] },
      override: {
        mutator: { path: "src/integrations/jellyfin/jellyfin-fetch.ts", name: "jellyfinFetch" },
      },
    },
  },
});
