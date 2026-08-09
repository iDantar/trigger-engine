import { IconObject } from "_zod";
import { BuiltinsCustomEntry, GATE_CATEGORY, GateEntryReturn, RETURN_GATE_TYPE, TriggerNode } from "engine";

class TriggerGateReturn extends TriggerNode<"out", never, never, "return"> {
    static get category(): string {
        return GATE_CATEGORY;
    }

    static get type(): string {
        return RETURN_GATE_TYPE;
    }

    static get defineCustomInputs(): BuiltinsCustomEntry[] {
        return [{ array: true, slug: "return" }];
    }

    get headerColor(): ColorSource {
        return "#C40000";
    }

    get icon(): IconObject {
        return {
            fontWeight: "400",
            unicode: "\ue560",
        };
    }

    async _execute(): Promise<boolean> {
        const values = await this.getCustomInputsValues("return");
        throw new GateEntryReturn(values);
    }
}

function isGateReturnNode(node: { type: string }): boolean {
    return node.type === RETURN_GATE_TYPE;
}

export { isGateReturnNode, TriggerGateReturn };
