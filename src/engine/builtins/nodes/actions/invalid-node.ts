import { BuiltinsInputEntry, BuiltinsOutputEntry } from "engine";
import { BaseActionNode } from ".";
import { IconObject } from "_zod";

class InvalidActionNode extends BaseActionNode {
    static get type(): "invalid-node" {
        return "invalid-node";
    }

    static get tags(): string[] {
        return ["debug"];
    }

    static get defineInputs(): BuiltinsInputEntry[] {
        return [{ key: "any", type: "any" }];
    }

    static get defineOutputs(): BuiltinsOutputEntry[] {
        return [{ key: "any", type: "any" }];
    }

    get title(): string {
        return "Invalid Node";
    }

    get icon(): IconObject {
        return { unicode: "\ue1fe" };
    }

    async _execute(): Promise<boolean> {
        return this.executeNext("out");
    }
}

export { InvalidActionNode };
