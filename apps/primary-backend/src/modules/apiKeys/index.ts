import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { ApiKeyModel } from "./models";
import { ApiKeyService } from "./service";

export const app = new Elysia({ prefix: "/api-keys" })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET!
        })
    )
    .resolve(async ({ cookie: { auth }, status, jwt}) => {
        if (!auth) {
            return status(401)
        } 
 
        const decoded = await jwt.verify(auth.value as string);

        if (!decoded || !decoded.userId) {
            return status(401)
        }

        return {
            userId: decoded.userId as string
        }
    })
    .post("/", async ({ userId, body }) => {
        const { apiKey, id } = await ApiKeyService.createApiKey(body.name, Number(userId))
        return {
            id,
            apiKey
        }
    }, {
        body: ApiKeyModel.createApiKeySchema,
        response: {
            200: ApiKeyModel.createApiKeyReponse
        }
    })
    .get("/", async ({ userId }) => {
        const apiKeys = await ApiKeyService.getApiKeys(Number(userId));
        return {
            apiKeys: apiKeys
        }
    }, {
        response: {
            200: ApiKeyModel.getApiKeysResponseSchema
        }
    })
    .put("/", ({ body, userId, status }) => {
        try {
            ApiKeyService.updateApiKeyDisabled(Number(body.id), Number(userId), body.disabled);
            return {
                message: "Updated api key successfully"
            }
        } catch(e) {
            return status(411, {
                message: "Updating api key unsuccessful"
            })
        }
    }, {
        body: ApiKeyModel.updateApiKeySchema,
        response: {
            200: ApiKeyModel.updateApiKeyResponseSchema,
            411: ApiKeyModel.disableApiKeyResponseFailedSchema
        }
    })
    .delete("/:id", async ({ params: { id }, userId, status }) => {
        try {
            await ApiKeyService.delete(Number(id), Number(userId))
            return {
                message: "Api key deleted successfully"
            }
        } catch(e) {
            return status(411,{
                message: "Api key deletetion failed"
            })
        }
    }, {
        response: {
            200: ApiKeyModel.deleteApiKeyResponseSchema,
            411: ApiKeyModel.deleteApiKeyResponseFailedSchema
        }
    })