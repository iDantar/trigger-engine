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

class TextValueNode extends BaseValueNode<string, DescriptionInputs, DescriptionState> {
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

    async _getValue(): Promise<string> {
        const descriptionData = await getDescriptionData.call(this);
        return localizeKeyOrDescription(descriptionData);
    }
}

export { TextValueNode };
