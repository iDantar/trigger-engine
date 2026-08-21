import { ActorPF2e, DatabaseCreateOperation, ItemPF2e, ItemSourcePF2e, R } from "foundry-helpers";

async function createTargetsEmbeddedItem<T extends ItemPF2e>(
    targets: TargetDocuments[],
    source: PreCreate<ItemSourcePF2e>,
): Promise<boolean> {
    let i = 3;

    const operations = R.map(targets, ({ actor }): DatabaseCreateOperation<ActorPF2e> => {
        return {
            action: "create",
            data: [foundry.utils.deepClone(source)],
            documentName: "Item",
            parent: actor,
        };
    });

    while (i) {
        try {
            await foundry.documents.modifyBatch(operations);
            return true;
        } catch {
            i--;
        }
    }

    return false;
}

export { createTargetsEmbeddedItem };
