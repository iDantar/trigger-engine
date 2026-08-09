import { BuiltinsInputEntry, BuiltinsOutputEntry } from "engine";
import { BaseValueNode } from ".";
import { splitListString } from "foundry-helpers";

class ListValueNode extends BaseValueNode<{ entry: string }> {
    #cached?: string[];

    static get type(): "list-value" {
        return "list-value";
    }

    static get defineInputs(): [BuiltinsInputEntry] {
        return [{ key: "entry", type: "text" }];
    }

    static get defineOutputs(): [BuiltinsOutputEntry] {
        return [{ key: "list", type: "text", isArray: true }];
    }

    async _query(): Promise<string[]> {
        return (this.#cached ??= splitListString(await this.getInputValue("entry")));
    }
}

export { ListValueNode };
