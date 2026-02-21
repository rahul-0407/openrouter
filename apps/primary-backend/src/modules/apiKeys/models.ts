import { t } from "elysia";

export namespace ApiKeyModel {
    export const createApiKeySchema = t.Object({
        name: t.String()
    });

    export type createApiKeySchema = typeof createApiKeySchema.static;

    export const createApiKeyReponse = t.Object({
        id: t.String(),
        apiKey: t.String()
    })

    export type createApiKeyReponse = typeof createApiKeyReponse.static;

    export const updateApiKeySchema = t.Object({
        id: t.String(),
        disabled: t.Boolean()
    })

    export type updateApiKeySchema = typeof updateApiKeySchema.static;

    export const updateApiKeyResponseSchema = t.Object({
        message: t.Literal("Updated api key successfully")
    })

    export type updateApiKeyResponseSchema = typeof updateApiKeyResponseSchema.static;

    export const disableApiKeyResponseFailedSchema = t.Object({
        message: t.Literal("Updating api key unsuccessful")
    })

    export type disableApiKeyResponseFailedSchema = typeof disableApiKeyResponseSchema.static;

    export const getApiKeysResponseSchema = t.Object({
        apiKeys: t.Array(t.Object({
            id: t.String(),
            apiKey: t.String(),
            name: t.String(),
            credisConsumed: t.Number(),
            lastUsed: t.Nullable(t.Date()),
            disabled: t.Boolean()
        }))
    })

    export type getApiKeysResponseSchema = typeof getApiKeysResponseSchema.static;

    export const deleteApiKeyResponseSchema = t.Object({
        message: t.Literal("Api key deleted successfully")
    })

    export type deleteApiKeyResponseSchema = typeof deleteApiKeyResponseSchema.static;

    export const deleteApiKeyResponseFailedSchema = t.Object({
        message: t.Literal("Api key deletetion failed")
    })

    export type deleteApiKeyResponseFailedSchema = typeof deleteApiKeyResponseFailedSchema.static;


}