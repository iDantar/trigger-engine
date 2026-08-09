import {
    BuiltinsInputEntry,
    BuiltinsOutputEntry,
    DescriptionInputs,
    descriptionSchemas,
    DescriptionState,
    descriptionStates,
    getDescriptionData,
    localizeKeyOrDescription,
} from "engine";
import { BaseValueNode } from ".";

class TextValueNode extends BaseValueNode<DescriptionInputs, DescriptionState> {
    #cached?: string;

    static get type(): "text-value" {
        return "text-value";
    }

    static get states(): string[] {
        return descriptionStates;
    }

    static get defineInputs(): BuiltinsInputEntry[] {
        return descriptionSchemas();
    }

    static get defineOutputs(): [BuiltinsOutputEntry] {
        return [{ key: "value", type: "text" }];
    }

    async _query(): Promise<string> {
        return (this.#cached ??= await localizeKeyOrDescription(await getDescriptionData.call(this)));
    }
}

export { TextValueNode };
