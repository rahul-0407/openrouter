import {PrismaClient} from "./generated/prisma/client";
import type { Prisma } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL});

export const prisma = new PrismaClient({adapter});

/**
 * Fire-and-forget usage metric insertion.
 * Wraps prisma.usageMetric.create in try/catch — logs errors but never throws.
 * Safe for background invocation from any request handler.
 */
export async function insertUsageMetric(
  data: Omit<Prisma.UsageMetricUncheckedCreateInput, "id" | "createdAt">
): Promise<void> {
  try {
    await prisma.usageMetric.create({ data });
  } catch (err) {
    console.error("[metrics] Failed to insert usage metric:", err);
  }
}
