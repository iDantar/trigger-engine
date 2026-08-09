import { BuiltinsInputEntry, BuiltinsOutputEntry } from "engine";
import { BaseValueNode } from ".";
import { splitListString } from "foundry-helpers";

class ListValueNode extends BaseValueNode<{ entry: string }> {
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
        const entry = await this.getInputValue("entry");
        return splitListString(entry);
    }
}

export { ListValueNode };
