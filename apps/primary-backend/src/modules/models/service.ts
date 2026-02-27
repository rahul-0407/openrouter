import { prisma } from "db"

// Provider name → environment variable mapping for API key availability check
const PROVIDER_API_KEY_MAP: Record<string, string> = {
    "OpenAI": "OPENAI_API_KEY",
    "Anthropic": "ANTHROPIC_API_KEY",
    "Google": "GEMINI_API_KEY",
    "Meta": "META_API_KEY",
    "Mistral": "MISTRAL_API_KEY",
    "Cohere": "COHERE_API_KEY",
};

function isProviderAvailable(providerName: string): boolean {
    const envKey = PROVIDER_API_KEY_MAP[providerName];
    if (!envKey) return false;
    const value = process.env[envKey];
    return !!value && value.trim().length > 0;
}

export abstract class ModelsService {

    static async getModels() {
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

        return models.map(model => {
            // A model is available if it has at least one provider mapping
            // AND that provider has a configured API key
            const hasAvailableProvider = model.modelProviderMappings.some(
                mapping => isProviderAvailable(mapping.provider.name)
            );

            return {
                id: model.id.toString(),
                name: model.name,
                slug: model.slug,
                available: hasAvailableProvider,
                company: {
                    id: model.company.id.toString(),
                    name: model.company.name,
                    website: model.company.website
                }
            };
        })
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