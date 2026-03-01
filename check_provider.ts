import { prisma } from './packages/db';

async function main() {
    const model = await prisma.model.findFirst({
        where: { slug: 'google/gemini-3-flash-preview' },
        include: {
            modelProviderMappings: {
                include: { provider: true }
            }
        }
    });

    if (model) {
        console.log(`Model: ${model.name}`);
        for (const mapping of model.modelProviderMappings) {
            console.log(`- Provider: ${mapping.provider.name}`);
            // The providerModelName is usually kept in a separate field if it differs, 
            // but in our schema, we only have modelId and providerId.
            // So the slug IS the provider model name? 
            // No, handleChatCompletion does: 
            // const [_companyName, providerModelName] = model.split("/");
        }
    }
}

main().finally(() => prisma.$disconnect());
