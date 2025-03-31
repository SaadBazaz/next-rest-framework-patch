import { type OpenAPIV3_1 } from 'openapi-types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { type AnyZodObject, type ZodSchema, type ZodObject } from 'zod';
import { type zfd } from 'zod-form-data';
import chalk from 'chalk';

const isZodSchema = (schema: unknown): schema is ZodSchema =>
  !!schema && typeof schema === 'object' && '_def' in schema;

const isZodObjectSchema = (schema: unknown): schema is AnyZodObject =>
  isZodSchema(schema) && 'shape' in schema;

const zodSchemaValidator = ({
  schema,
  obj
}: {
  schema: ZodSchema;
  obj: unknown;
}) => {
  const data = schema.safeParse(obj);
  const errors = !data.success ? data.error.issues : null;

  return {
    valid: data.success,
    errors,
    data: data.success ? data.data : null
  };
};

export const validateSchema = ({
  schema,
  obj
}: {
  schema: ZodSchema | typeof zfd.formData;
  obj: unknown;
}) => {
  if (isZodSchema(schema)) {
    return zodSchemaValidator({ schema, obj });
  }

  throw Error('Invalid schema.');
};

type SchemaType = 'input-params' | 'input-query' | 'input-body' | 'output-body';

const extractOpenAPIMetadata = (schema: ZodObject<any>): Record<string, any> => {
  const openapiMetadata: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema.shape)) {
    if (value && typeof value === 'object' && 'openapi' in value && typeof (value as any).openapi === "function") {
      const metadata = typeof value.openapi === 'function' ? value.openapi() : undefined;
      if (metadata) {
        openapiMetadata[key] = metadata;
      }
    }
  }

  return openapiMetadata;
};

export const getJsonSchema = ({
  schema,
  operationId,
  type
}: {
  schema: ZodSchema;
  operationId: string;
  type: SchemaType;
}): OpenAPIV3_1.SchemaObject => {
  if (isZodSchema(schema)) {
    try {
      // Convert Zod schema to JSON Schema
      const jsonSchema = zodToJsonSchema(schema, {
        $refStrategy: "none",
        target: "openApi3"
      });

      let openapiMetadata;
      // Extract OpenAPI metadata and merge with schema
      if (isZodObjectSchema(schema)) {
        openapiMetadata = extractOpenAPIMetadata(schema);
      } else {
        throw Error("Invalid schema: Expected a ZodObject.");
      }

      // Apply OpenAPI metadata to the correct properties in the JSON Schema
      if (jsonSchema && typeof jsonSchema === 'object' && 'properties' in jsonSchema) {
        for (const [key, meta] of Object.entries(openapiMetadata)) {
          const properties = jsonSchema.properties as Record<string, any>;
          const openapimeta = meta?._def?.openapi?.metadata ?? {}
          properties[key] = {
            ...properties[key],
            ...openapimeta
          };
        }
      }

      return jsonSchema;
    } catch (error) {
      console.warn(
        chalk.yellowBright(
          `Warning: ${type} schema for operation ${operationId} could not be converted correctly.`
        )
      );
      return {};
    }
  }

  throw Error("Invalid schema." + JSON.stringify(schema));
};


export const getSchemaKeys = ({ schema }: { schema: ZodSchema }) => {
  if (isZodObjectSchema(schema)) {
    return Object.keys(schema._def.shape());
  }

  throw Error('Invalid schema.');
};
