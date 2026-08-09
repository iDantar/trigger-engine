import { BuiltinsInputEntry, BuiltinsOutputEntry } from "engine";
import { BaseValueNode } from ".";

class NumberValueNode extends BaseValueNode<number, { entry: number }> {
    static get type(): "number-value" {
        return "number-value";
    }

    static get defineInputs(): [BuiltinsInputEntry] {
        return [{ key: "entry", type: "number" }];
    }

    static get defineOutputs(): [BuiltinsOutputEntry] {
        return [{ key: "value", type: "number" }];
    }

    async _getValue(): Promise<number> {
        return await this.getInputValue("entry");
    }
}

export { NumberValueNode };
