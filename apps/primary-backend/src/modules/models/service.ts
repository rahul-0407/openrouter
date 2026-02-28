import { prisma } from "db"
import { cache } from "cache"

// Provider name → environment variable mapping for API key availability check
// Some providers may use multiple possible keys
const PROVIDER_API_KEY_MAP: Record<string, string[]> = {
    "OpenAI": ["OPENAI_API_KEY"],
    "Anthropic": ["ANTHROPIC_API_KEY"],
    "Google": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    "Meta": ["META_API_KEY"],
    "Mistral": ["MISTRAL_API_KEY"],
    "Cohere": ["COHERE_API_KEY"],
};

function isProviderAvailable(providerName: string): boolean {
    const envKeys = PROVIDER_API_KEY_MAP[providerName];
    if (!envKeys) return false;

    return envKeys.some(key => {
        const value = process.env[key];
        return !!value && value.trim().length > 0;
    });
}

export abstract class ModelsService {

    static async getModels() {
        const cacheKey = "models:list";
        const cached = cache.get<any[]>(cacheKey);
        if (cached) return cached;

        const models = await prisma.model.findMany({
            include: {
                company: true,
                modelProviderMappings: {
                    include: {
                        provider: true
                    }
                }
            }
        })

        const result = models.map(model => {
            // A model is available if:
            // 1. It has a provider mapping with 0 cost (free model)
            // 2. OR it has a provider mapping where the provider has a configured API key
            const isAvailable = model.modelProviderMappings.some(
                mapping => {
                    const isFree = mapping.inputTokenCost === 0 && mapping.outputTokenCost === 0;
                    const hasKey = isProviderAvailable(mapping.provider.name);
                    return isFree || hasKey;
                }
            );

            return {
                id: model.id.toString(),
                name: model.name,
                slug: model.slug,
                available: isAvailable,
                company: {
                    id: model.company.id.toString(),
                    name: model.company.name,
                    website: model.company.website
                }
            };
        })

        cache.set(cacheKey, result, 600); // 10 minutes
        return result;
    }

    static async getProviders() {
        const providers = await prisma.provider.findMany()

        return providers.map(provider => ({
            id: provider.id.toString(),
            name: provider.name,
            website: provider.website
        }))
    }

    static async getModelProviders(modelId: number) {
        const mappings = await prisma.modelProviderMapping.findMany({
            where: {
                modelId
            },
            include: {
                provider: true
            }
        })

        return mappings.map(mapping => ({
            id: mapping.id.toString(),
            providerId: mapping.provider.id.toString(),
            providerName: mapping.provider.name,
            providerWebsite: mapping.provider.website,
            inputTokenCost: mapping.inputTokenCost,
            outputTokenCost: mapping.outputTokenCost
        }))
    }
}