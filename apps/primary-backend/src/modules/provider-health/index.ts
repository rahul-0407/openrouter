import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { ProviderHealthService } from "./service";

export const app = new Elysia({ prefix: "/admin/provider-health" })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET!
        })
    )
    .resolve(async ({ cookie: { auth }, status, jwt }) => {
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
    .get("/summary", async ({ status }: { status: any }) => {
        try {
            return await ProviderHealthService.getProviderHealthSummary();
        } catch (e) {
            console.error(e);
            return status(500, { message: "Failed to fetch health summary" });
        }
    })
    .get("/timeseries", async ({ query, status }: { query: { range?: string }, status: any }) => {
        try {
            const range = query.range || "24h";
            return await ProviderHealthService.getProviderHealthTimeSeries(range);
        } catch (e) {
            console.error(e);
            return status(500, { message: "Failed to fetch health timeseries" });
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String())
        })
    });
