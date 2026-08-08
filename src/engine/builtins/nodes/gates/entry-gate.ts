import { IconObject } from "_zod";
import { BridgeSchemaInput, ENTRY_GATE_TYPE, GATE_CATEGORY, TriggerNode } from "engine";

class TriggerGateEntry extends TriggerNode<"out" | "return", never, never, "entry"> {
    static get category(): string {
        return GATE_CATEGORY;
    }

    static get type(): string {
        return ENTRY_GATE_TYPE;
    }

    static get defineOuts(): BridgeSchemaInput[] | null {
        return [{ key: "out" }, { key: "return" }];
    }

    get headerColor(): ColorSource {
        return "#C40000";
    }

    get icon(): IconObject {
        return {
            unicode: "\uf1e6",
            fontWeight: "900",
        };
    }

    async _execute(): Promise<boolean> {
        const values = await this.getCustomInputsValues("entry");
        const keepExecuting = await this.executeNext("out", values);
        return keepExecuting ? this.executeNext("return") : true;
    }
}

function isGateEntryNode(node: { type: string }): boolean {
    return node.type === ENTRY_GATE_TYPE;
}

export { isGateEntryNode, TriggerGateEntry };
