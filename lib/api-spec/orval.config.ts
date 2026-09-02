import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

// FastAPI assembles the `operationId` as `<function>_<path>_<verb>`, with every
// non-alphanumeric turning into "_": `get_cockpit_api_v1_demands__demand_id__cockpit_get`.
// Used raw, that becomes `useGetCockpitApiV1DemandsDemandIdCockpitGet` spread
// over the whole screen — and, worse, it CHANGES when the path changes, which
// makes a route change look like an API change in the app's diff.
//
// Here we undo exactly what FastAPI built: the `<path>_<verb>` suffix is taken
// off and what is left is the BFF's function name — the SAME word that is in
// `app/routers/*.py`. `get_cockpit` → `getCockpit` → `useGetCockpit`. No name is
// invented here; if the suffix does not match, the raw id passes through
// intact, and the ugly name showing up in the code is the warning that this
// assumption has expired.
const operationName = (operation: { operationId?: string }, route: string, verb: string) => {
  const raw = operation.operationId ?? "";
  const suffix = `${route}_${verb}`.replace(/\W/g, "_");
  const name = raw.toLowerCase().endsWith(suffix.toLowerCase())
    ? raw.slice(0, raw.length - suffix.length)
    : raw.replace(/_(?:api_v1|healthz)_.*$/, "");
  return name.replace(/_(\w)/g, (_all, letter: string) => letter.toUpperCase());
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.json",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        operationName,
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.json",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        // Deliberately WITHOUT `operationName` here: the zod target emits one
        // schema per operation under the operation's name, and shortening would
        // make `me` collide with the `MeResponse` component schema — two symbols
        // with the same name in the same barrel. The react-query client does not
        // emit those schemas, so the short name is safe there. Whoever consumes
        // zod uses FastAPI's long id.
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
