import { IconObject } from "_zod";
import {
    InputEntrySchema,
    NodeData,
    NodeDataInput,
    OutputEntrySchema,
    PERSISTENT_COLLECTION_TYPE,
    TriggerApplication,
} from "engine";
import { R, waitDialog } from "foundry-helpers";
import { BaseSpecialNode } from ".";

class PersistentCollection extends BaseSpecialNode<"out", { entry: unknown }, { collection: unknown[] }> {
    #collection: unknown[] = [];

    static get type(): string {
        return PERSISTENT_COLLECTION_TYPE;
    }

    static async createNodeSource(application: TriggerApplication): Promise<NodeDataInput | undefined> {
        const types = R.pipe(
            application.availableEntryTypes,
            R.map((type) => {
                return {
                    value: type,
                    label: application.localize("entry", type, "title") ?? type,
                };
            }),
            R.sortBy(R.prop("label")),
        );

        const result = await waitDialog<{ type: string }>({
            content: "edit-entry",
            data: { types },
            i18n: "blueprint.special.collection.add",
        });

        if (!result) return;

        return {
            type: PERSISTENT_COLLECTION_TYPE,
            custom: {
                inputs: {
                    entry: {
                        label: "entry",
                        slug: "entry",
                        type: result.type,
                    },
                },
            },
        };
    }

    static buildInputsSchemas(data: NodeData): InputEntrySchema[] {
        return [
            {
                key: "entry",
                isArray: false,
                spacing: 0,
                tooltip: "",
                type: data.custom.inputs.entry?.type ?? "any",
            },
        ];
    }

    static buildOutputsSchemas(data: NodeData): OutputEntrySchema[] {
        return [
            {
                key: "collection",
                isArray: true,
                spacing: 0,
                tooltip: "",
                type: data.custom.inputs.entry?.type ?? "any",
            },
        ];
    }

    get icon(): IconObject {
        return { unicode: "\ue197" };
    }

    async _execute(): Promise<boolean> {
        const entry = await this.getInputValue("entry");

        if (R.isNonNullish(entry)) {
            this.#collection.push(entry);
            this.setOutputValue("collection", this.#collection);
        }

        return this.executeNext("out");
    }
}

export { PersistentCollection };
