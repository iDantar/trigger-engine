import {
    InputEntrySchema,
    NodeData,
    NodeDataInput,
    OutputEntrySchema,
    SPECIAL_CATEGORY,
    TriggerApplication,
    TriggerNode,
} from "engine";
import { MODULE } from "foundry-helpers";
import { BaseBlueprintEntry } from "triggers-menu";

class BaseSpecialNode<
    TOuts extends string | never = string,
    TInputs extends Record<string, any> | never = Record<string, any>,
    TOutputs extends Record<string, any> | never = Record<string, any>,
    TCustomInputs extends string | never = string,
    TCustomOutputs extends string | never = string,
    TState extends string | never = string,
> extends TriggerNode<TOuts, TInputs, TOutputs, TCustomInputs, TCustomOutputs, TState> {
    static get category(): string {
        return SPECIAL_CATEGORY;
    }

    static canMatchEntry(entry: BaseBlueprintEntry): boolean {
        return false;
    }

    static createNodeSource(application: TriggerApplication): Promise<NodeDataInput | undefined> {
        throw MODULE.error("'createNodeData' not implemented.");
    }

    static buildInputsSchemas(data: NodeData): InputEntrySchema[] {
        throw MODULE.error("'buildInputsSchemas' not implemented.");
    }

    static buildOutputsSchemas(data: NodeData): OutputEntrySchema[] {
        throw MODULE.error("'buildOutputsSchemas' not implemented.");
    }

    get headerColor(): ColorSource {
        return "#b07528";
    }
}

function isSpecialTriggerNode(Node: typeof TriggerNode): Node is typeof BaseSpecialNode {
    return Node.category === SPECIAL_CATEGORY;
}

export { BaseSpecialNode, isSpecialTriggerNode };
