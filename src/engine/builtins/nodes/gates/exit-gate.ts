import { IconObject } from "_zod";
import { BuiltinsCustomEntry, EXIT_GATE_TYPE, GATE_CATEGORY, TriggerNode } from "engine";
import { R } from "foundry-helpers";

class TriggerGateExit extends TriggerNode<"out", never, never, never, "entry"> {
    static get category(): string {
        return GATE_CATEGORY;
    }

    static get type(): string {
        return EXIT_GATE_TYPE;
    }

    static get defineCustomInputs(): BuiltinsCustomEntry[] {
        return [{ array: true, slug: "return" }];
    }

    static get defineCustomOutputs(): BuiltinsCustomEntry[] {
        return [{ array: true, slug: "entry" }];
    }

    get headerColor(): ColorSource {
        return "#C40000";
    }

    get icon(): IconObject {
        return {
            fontMult: 1.2,
            fontWeight: "400",
            unicode: "\ue01c",
        };
    }

    _execute(values?: any[]): Promise<boolean> {
        const cloned = foundry.utils.deepClone(R.isArray(values) ? values : []);
        this.setCustomOutputValues("entry", cloned);
        return this.executeNext("out");
    }
}

function isGateExitNode(node: { type: string }): boolean {
    return node.type === EXIT_GATE_TYPE;
}

export { isGateExitNode, TriggerGateExit };
