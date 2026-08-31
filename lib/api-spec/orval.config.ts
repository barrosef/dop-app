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

// O FastAPI monta o `operationId` como `<função>_<caminho>_<verbo>`, com todo
// não-alfanumérico virando "_": `get_cockpit_api_v1_demands__demand_id__cockpit_get`.
// Usado cru, isso vira `useGetCockpitApiV1DemandsDemandIdCockpitGet` espalhado
// pela tela inteira — e, pior, MUDA quando o caminho muda, o que faz uma
// mudança de rota parecer uma mudança de API no diff do app.
//
// Aqui desfazemos exatamente a construção do FastAPI: tira-se o sufixo
// `<caminho>_<verbo>` e sobra o nome da função do BFF — a MESMA palavra que
// está em `app/routers/*.py`. `get_cockpit` → `getCockpit` → `useGetCockpit`.
// Nenhum nome é inventado aqui; se o sufixo não bater, o id cru passa intacto,
// e o nome feio aparecendo no código é o aviso de que esta suposição caducou.
const nomeDaOperacao = (operation: { operationId?: string }, route: string, verb: string) => {
  const bruto = operation.operationId ?? "";
  const sufixo = `${route}_${verb}`.replace(/\W/g, "_");
  const nome = bruto.toLowerCase().endsWith(sufixo.toLowerCase())
    ? bruto.slice(0, bruto.length - sufixo.length)
    : bruto.replace(/_(?:api_v1|healthz)_.*$/, "");
  return nome.replace(/_(\w)/g, (_todo, letra: string) => letra.toUpperCase());
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
        operationName: nomeDaOperacao,
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
        // De propósito SEM `operationName` aqui: o alvo zod emite um schema por
        // operação com o nome dela, e encurtar faria `me` colidir com o schema
        // de componente `MeResponse` — dois símbolos com o mesmo nome no mesmo
        // barril. O cliente react-query não emite esses schemas, então lá o
        // nome curto é seguro. Quem consome zod usa o id longo do FastAPI.
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
