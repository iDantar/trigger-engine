import { IconObject } from "_zod";
import { BaseExtractorNode, BridgeSchemaInput, loopAfterSchemas } from "engine";
import { actorItems, getItemSlug, getItemSourceId, isSupressedFeat, ItemPF2e } from "foundry-helpers";
import { DoubleUuidInputs, doubleUuidSchemas, getDoubleUuidValue, PF2eInputEntry, PF2eOutputEntry } from "pf2e";

class FindItemExtractorNode extends BaseExtractorNode<Inputs, Outputs, never, never, State, "out" | "after"> {
    static get type(): "find-item" {
        return "find-item";
    }

    static get tags(): string[] {
        return ["item"];
    }

    static get states(): string[] {
        return ["uuid", "slug"];
    }

    static get defineOuts(): BridgeSchemaInput[] {
        return loopAfterSchemas();
    }

    static get defineInputs(): PF2eInputEntry[] {
        return [
            { key: "target", type: "target" },
            ...doubleUuidSchemas("uuid"),
            { key: "slug", type: "text", state: "slug" },
        ];
    }

    static get defineOutputs(): PF2eOutputEntry[] {
        return [{ key: "item", type: "item" }];
    }

    get icon(): IconObject {
        return { unicode: "\uf466" };
    }

    get isLoop(): boolean {
        return true;
    }

    async _execute(): Promise<boolean> {
        const actor = (await this.getInputValue("target"))?.actor;
        if (!actor) return true;

        const isMatchingItem = this.state === "slug" ? await this.#slugDelegate() : await this.#uuidDelegate();

        for (const item of actorItems(actor)) {
            if (isSupressedFeat(item) || !isMatchingItem(item)) continue;

            this.setOutputValue("item", item);

            const keepExecuting = await this.executeNext("out");
            if (!keepExecuting) break;
        }

        return this.executeNext("after");
    }

    async #slugDelegate(): Promise<(item: ItemPF2e) => boolean> {
        const slug = await this.getInputValue("slug");
        return (item: ItemPF2e): boolean => {
            return getItemSlug(item) === slug;
        };
    }

    async #uuidDelegate(): Promise<(item: ItemPF2e) => boolean> {
        const uuid = await getDoubleUuidValue.call(this);
        return (item: ItemPF2e): boolean => {
            return getItemSourceId(item) === uuid;
        };
    }
}

type Inputs = DoubleUuidInputs & {
    slug: string;
    target?: TargetDocuments;
};

type Outputs = {
    item: ItemPF2e;
};

type State = "uuid" | "slug";

export { FindItemExtractorNode };
