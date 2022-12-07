import http from 'http';
import {
  DEFAULT_ERRORS,
  OPEN_API_VERSION,
  ValidMethod,
  NEXT_REST_FRAMEWORK_USER_AGENT
} from './constants';
import {
  DefineEndpointsParams,
  MethodHandler,
  NextRestFrameworkConfig
} from './types';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import * as yup from 'yup';
import { OpenAPIV3_1 } from 'openapi-types';
import chalk from 'chalk';
import merge from 'lodash.merge';
import { Modify } from './utility-types';
import isEqualWith from 'lodash.isequalwith';
import zodToJsonSchema from 'zod-to-json-schema';
import yupToJsonSchema from '@sodaru/yup-to-json-schema';

const logNextRestFrameworkError = ({ error }: { error: unknown }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(
      chalk.red(`Next REST Framework encountered an error:
${error}`)
    );
  } else {
    console.error(
      chalk.red(
        'Next REST Framework encountered an error - suppressed in production mode.'
      )
    );
  }
};

export const getDefaultConfig = ({
  config
}: {
  config?: NextRestFrameworkConfig;
} = {}): Modify<
  NextRestFrameworkConfig,
  {
    openApiSpec: OpenAPIV3_1.Document;
  }
> => ({
  openApiSpec: {
    openapi: OPEN_API_VERSION,
    info: {
      title: 'Next REST Framework',
      description:
        'This is an autogenerated OpenAPI spec by Next REST Framework.',
      // Ignore: We don't want to use promises here to avoid making this an async function.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      version: require('../package.json').version
    },
    components: {}
  },
  openApiJsonPath: '/api/openapi.json',
  openApiYamlPath: '/api/openapi.yaml',
  swaggerUiPath: '/api',
  exposeOpenApiSpec: true,
  errorHandler: logNextRestFrameworkError,
  suppressInfo: false
});

export const logInitInfo = ({
  config
}: {
  config: NextRestFrameworkConfig;
}) => {
  const configsEqual = isEqualWith(
    global.nextRestFrameworkConfig,
    config,
    (val1, val2) => {
      if (typeof val1 === 'function' && typeof val2 === 'function') {
        return val1.toString() === val2.toString();
      }
    }
  );

  if (!global.nextRestFrameworkConfig) {
    global.nextRestFrameworkConfig = config;
    console.info(chalk.green('Next REST Framework initialized! 🚀'));
  } else if (!configsEqual) {
    console.info(
      chalk.green('Next REST Framework config changed, re-initializing!')
    );

    global.nextRestFrameworkConfig = config;
    global.reservedPathsLogged = false;
  }
};

export const logReservedPaths = ({
  config,
  headers
}: {
  config: NextRestFrameworkConfig;
  headers: http.IncomingHttpHeaders;
}) => {
  const proto = headers['x-forwarded-proto'] ?? 'http';
  const host = headers.host;
  const baseUrl = `${proto}://${host}`;

  if (config.exposeOpenApiSpec) {
    console.info(
      chalk.yellowBright(`Swagger UI: ${baseUrl}${config.swaggerUiPath}
OpenAPI JSON: ${baseUrl}${config.openApiJsonPath}
OpenAPI YAML: ${baseUrl}${config.openApiYamlPath}`)
    );
  } else {
    console.info(
      chalk.yellowBright(
        `OpenAPI spec is not exposed. To expose it, set ${chalk.bold(
          'exposeOpenApiSpec'
        )} to ${chalk.bold('true')} in the Next REST Framework config.`
      )
    );
  }

  global.reservedPathsLogged = true;
};

export const warnAboutReservedPath = ({
  path,
  name,
  configName
}: {
  path?: string;
  name: string;
  configName: 'openApiJsonPath' | 'openApiYamlPath' | 'swaggerUiPath';
}) => {
  console.warn(
    chalk.yellowBright(
      `Warning: ${chalk.bold(
        path
      )} is reserved for ${name}. Update ${chalk.bold(
        configName
      )} in your Next REST Framework config to use this path for other purposes.`
    )
  );

  switch (configName) {
    case 'openApiJsonPath': {
      global.reservedOpenApiJsonPathWarningLogged = true;
      break;
    }
    case 'openApiYamlPath': {
      global.reservedOpenApiYamlPathWarningLogged = true;
      break;
    }
    case 'swaggerUiPath': {
      global.reservedSwaggerUiPathWarningLogged = true;
      break;
    }
  }
};

export const handleReservedPathWarnings = ({
  url,
  config: { openApiJsonPath, openApiYamlPath, swaggerUiPath }
}: {
  url?: string;
  config: NextRestFrameworkConfig;
}) => {
  if (url === openApiJsonPath && !global.reservedOpenApiJsonPathWarningLogged) {
    warnAboutReservedPath({
      path: openApiJsonPath,
      name: 'OpenAPI JSON spec',
      configName: 'openApiJsonPath'
    });
  }

  if (url === openApiYamlPath && !global.reservedOpenApiYamlPathWarningLogged) {
    warnAboutReservedPath({
      path: openApiYamlPath,
      name: 'OpenAPI YAML spec',
      configName: 'openApiYamlPath'
    });
  }

  if (url === swaggerUiPath && !global.reservedSwaggerUiPathWarningLogged) {
    warnAboutReservedPath({
      path: swaggerUiPath,
      name: 'Swagger UI',
      configName: 'swaggerUiPath'
    });
  }
};

export const getHTMLForSwaggerUI = ({
  headers
}: {
  headers: http.IncomingHttpHeaders;
}) => {
  const proto = headers['x-forwarded-proto'] ?? 'http';
  const host = headers.host;
  const url = `${proto}://${host}/api/openapi.yaml`;

  const css = readFileSync(
    join(
      process.cwd(),
      'node_modules/next-rest-framework/dist/swagger-ui/swagger-ui.css'
    )
  );

  const swaggerUiBundle = readFileSync(
    join(
      process.cwd(),
      'node_modules/next-rest-framework/dist/swagger-ui/swagger-ui-bundle.js'
    )
  );

  const swaggerUiStandalonePreset = readFileSync(
    join(
      process.cwd(),
      'node_modules/next-rest-framework/dist/swagger-ui/swagger-ui-standalone-preset.js'
    )
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta
    name="description"
    content="SwaggerUI"
  />
  <title>Next REST Framework | SwaggerUI</title>
  <style>${css}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script>${swaggerUiBundle}</script>
<script>${swaggerUiStandalonePreset}</script>
<script>
  window.onload = () => {
    window.ui = SwaggerUIBundle({
        url: '${url}',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
    });
  };
</script>
</body>
</html>`;
};

export const isValidMethod = (x: unknown): x is ValidMethod =>
  Object.values(ValidMethod).includes(x as ValidMethod);

export const getOpenApiSpecWithPaths = async ({
  config
}: {
  config: NextRestFrameworkConfig;
}) => {
  const paths = await generatePaths({ config });

  const spec = {
    ...config.openApiSpec,
    openapi: OPEN_API_VERSION,
    paths: merge(config.openApiSpec?.paths, paths)
  };

  return spec;
};

export const isZodSchema = (obj: unknown): obj is z.ZodAny => {
  return !!obj && typeof obj === 'object' && '_def' in obj;
};

export const isYupSchema = (obj: unknown): obj is yup.AnySchema => {
  return !!obj && obj.constructor.name === 'ObjectSchema';
};

export const isYupValidationError = (e: unknown): e is yup.ValidationError => {
  return e instanceof Error && e.name === 'ValidationError';
};

export const convertSchemaToJsonSchema = (
  _schema: unknown
): OpenAPIV3_1.SchemaObject => {
  let schema: OpenAPIV3_1.SchemaObject = {};

  if (isZodSchema(_schema)) {
    schema = zodToJsonSchema(_schema) as OpenAPIV3_1.SchemaObject;
  } else if (isYupSchema(_schema)) {
    schema = yupToJsonSchema(_schema) as OpenAPIV3_1.SchemaObject;
  } else {
    console.warn(
      chalk.yellowBright(
        "Warning: Unsupported schema type. Can't convert to JSON Schema."
      )
    );
  }

  return schema;
};

export const defaultResponses: OpenAPIV3_1.ResponsesObject = {
  500: {
    description: DEFAULT_ERRORS.unexpectedError,
    content: {
      'application/json': {
        schema: convertSchemaToJsonSchema(z.object({ message: z.string() }))
      }
    }
  }
};

export const getPathsFromMethodHandlers = ({
  methodHandlers,
  route
}: {
  methodHandlers: DefineEndpointsParams;
  route: string;
}) => {
  const { $ref, summary, description, servers, parameters } = methodHandlers;
  const paths: OpenAPIV3_1.PathsObject = {};

  paths[route] = {
    $ref: $ref as string | undefined,
    summary,
    description,
    servers,
    parameters
  };

  Object.keys(methodHandlers)
    .filter(isValidMethod)
    .forEach((method) => {
      const {
        tags,
        summary,
        description,
        externalDocs,
        operationId,
        parameters,
        requestBody: _requestBody,
        responses: _responses,
        callbacks,
        deprecated,
        security,
        servers
      } = methodHandlers[method] as MethodHandler;

      let requestBody: OpenAPIV3_1.OperationObject['requestBody'];

      if (_requestBody) {
        const {
          description,
          required,
          contentType,
          schema: _schema,
          examples,
          example,
          encoding
        } = _requestBody;

        const schema = convertSchemaToJsonSchema(_schema);

        requestBody = {
          description,
          required,
          content: {
            [contentType]: {
              schema,
              examples,
              example,
              encoding
            }
          }
        };
      } else {
        requestBody = _requestBody;
      }

      const responses: OpenAPIV3_1.ResponsesObject = {
        ...defaultResponses
      };

      _responses.forEach(
        ({
          status,
          contentType,
          description = 'Auto-generated description by Next REST Framework.',
          headers,
          links,
          schema: _schema,
          example,
          examples,
          encoding
        }) => {
          if (status) {
            const schema = convertSchemaToJsonSchema(_schema);

            responses[status.toString()] = {
              description,
              headers,
              links,
              content: {
                [contentType]: {
                  schema,
                  example,
                  examples,
                  encoding
                }
              }
            };
          }
        }
      );

      paths[route] = {
        ...paths[route],
        [method.toLowerCase()]: {
          tags,
          summary,
          description,
          externalDocs,
          operationId,
          parameters,
          requestBody,
          responses,
          callbacks,
          deprecated,
          security,
          servers
        }
      };
    });

  return paths;
};

export const generatePaths = async <GlobalMiddlewareResponse>({
  config: { openApiJsonPath, openApiYamlPath, swaggerUiPath, errorHandler }
}: {
  config: NextRestFrameworkConfig<GlobalMiddlewareResponse>;
}): Promise<OpenAPIV3_1.PathsObject> => {
  const filterApiRoutes = (file: string) => {
    const isCatchAllRoute = file.includes('...');

    const isOpenApiJsonRoute = file.endsWith(
      `${openApiJsonPath?.split('/').at(-1)}.ts`
    );

    const isOpenApiYamlRoute = file.endsWith(
      `${openApiYamlPath?.split('/').at(-1)}.ts`
    );

    const isSwaggerUiRoute = file.endsWith(
      `${swaggerUiPath?.split('/').at(-1)}.ts`
    );

    if (
      isCatchAllRoute ||
      isOpenApiJsonRoute ||
      isOpenApiYamlRoute ||
      isSwaggerUiRoute
    ) {
      return false;
    } else {
      return true;
    }
  };

  const mapApiRoutes = readdirSync(join(process.cwd(), 'pages/api'))
    .filter(filterApiRoutes)
    .map((file) =>
      `/api/${file}`
        .replace('/index', '')
        .replace('[', '{')
        .replace(']', '}')
        .replace('.ts', '')
    );

  let paths: OpenAPIV3_1.PathsObject = {};

  await Promise.all(
    mapApiRoutes.map(async (route) => {
      try {
        const res = await fetch(`http://localhost:3000${route}`, {
          headers: {
            'User-Agent': NEXT_REST_FRAMEWORK_USER_AGENT
          }
        });

        const data: Record<string, OpenAPIV3_1.PathItemObject> =
          await res.json();

        paths = { ...paths, ...data };
      } catch (error) {
        logNextRestFrameworkError({ error });
      }
    })
  );

  return paths;
};
