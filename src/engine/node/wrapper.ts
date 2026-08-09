import {
    InputEntrySchema,
    isGateEntryNode,
    isGateReturnNode,
    isVariableGetterNode,
    NodeBridge,
    OpenNodeEntry,
    OpenTrigger,
    OutputEntrySchema,
    Trigger,
} from "engine";
import { getInputsSchemas, getOutputsSchemas, NodeData, TriggerNode } from ".";

/**  @returns false if we don't want the node to be invalid */
function instantiateNode(parent: OpenTrigger, data: NodeData, open: true): OpenTriggerNode | undefined | false;
function instantiateNode<TNode extends TriggerNode>(
    parent: Trigger,
    data: NodeData,
    open: boolean,
): TNode | undefined | false;
function instantiateNode(
    parent: Trigger,
    nodeData: NodeData,
    open: boolean,
): TriggerNode | OpenTriggerNode | undefined | false {
    const NodeCls = parent.application.nodes.get(nodeData.type) as typeof TriggerNode;
    if (!NodeCls) return;

    // we retrieve the exit-gate if we are an entry-gate
    const exitGate = getExitGate(parent, nodeData);
    if (exitGate === false) return false;

    // we construct the variable schema
    const variableSchemas = getVariableSchemas(parent, nodeData);
    if (variableSchemas === false) return false;

    return new NodeCls(parent, nodeData, variableSchemas, exitGate, open);
}

function getExitGate(parent: Trigger, nodeData: NodeData): ExitGateNodeData | undefined | false {
    if (!isGateEntryNode(nodeData) && !isGateReturnNode(nodeData)) return;

    const connection = nodeData.outs.out.connection;
    const nodeId = connection?.split(":").at(0) ?? "";
    const node = parent.getNode(nodeId);
    const data = foundry.utils.deepClone(parent.data.nodes.get(nodeId));
    if (!node || !data) return false;

    const ExitCls = node.constructor as typeof TriggerNode;
    const inputs = getInputsSchemas(ExitCls, { data });
    const outputs = getOutputsSchemas(ExitCls, { data });

    return { node, inputs, outputs };
}

function getVariableSchemas(parent: Trigger, nodeData: NodeData): OutputEntrySchema[] | undefined | false {
    const isVariableGetter = isVariableGetterNode(nodeData);
    if (!isVariableGetter) return;

    const connection = nodeData.inputs.entry?.connection;
    const data = connection && parent.data.variables[connection];
    if (!data) return false;

    const [nodeId, _, key] = connection.split(":");
    const node = parent.getNode(nodeId) as OpenTriggerNode | TriggerNode | undefined;
    if (!node || ("entries" in node && !node.entries.outputs.get(key))) return false;

    return [
        {
            isArray: data.isArray,
            key: "entry",
            label: data.label,
            spacing: 0,
            tooltip: true,
            type: data.type,
        },
    ];
}

interface OpenTriggerNode extends TriggerNode {
    data: NodeData;
    entries: NodeEntries;
    exitGate: OpenTriggerNode | undefined;
    parent: OpenTrigger;
    states: string[] | null;
    tags: string[];
}

type NodeEntries = {
    in: NodeBridge | null;
    inputs: Collection<string, OpenNodeEntry>;
    outputs: Collection<string, OpenNodeEntry>;
    outs: Collection<string, NodeBridge>;
};

type ExitGateNodeData = {
    node: TriggerNode;
    inputs: InputEntrySchema[];
    outputs: OutputEntrySchema[];
};

export { instantiateNode };
export type { ExitGateNodeData, OpenTriggerNode };
