import {
    ConnectionId,
    EntryId,
    isGateEntryNode,
    isGateExitNode,
    isGateReturnNode,
    NodeDataOutput,
    OpenTriggerNode,
    OPPOSITE_CONNECTION_CATEGORY,
    splitEntryId,
} from "engine";
import { localize, R } from "foundry-helpers";
import { BaseBlueprintEntry, BlueprintNode } from ".";
import { Blueprint, BlueprintLayers } from "..";

class BlueprintNodesLayer extends PIXI.Container<BlueprintNode> {
    #nodes: Collection<string, BlueprintNode> = new Collection();

    get blueprint(): Blueprint {
        return this.parent.blueprint;
    }

    get stage(): PIXI.Container {
        return this.blueprint.stage;
    }

    get selected(): BlueprintNode[] {
        return this.#nodes.filter((node) => node.selected);
    }

    getGateEntries(exitId: string, skipReturn = false): BlueprintNode[] {
        const filter: (node: BlueprintNode) => boolean = skipReturn
            ? (node) => isGateEntryNode(node)
            : (node) => isGateEntryNode(node) || isGateReturnNode(node);
        return this.filter((node) => filter(node) && node.gateId === exitId);
    }

    getVariables(id: ConnectionId): BlueprintNode[] {
        return this.filter((node) => node.variableId === id);
    }

    filter(fn: (node: BlueprintNode) => boolean) {
        return this.#nodes.filter(fn);
    }

    some(fn: (node: BlueprintNode) => boolean) {
        return this.#nodes.some(fn);
    }

    clearSelected() {
        for (const node of this.#nodes) {
            node.selected = false;
        }
    }

    get(id: string): BlueprintNode | undefined {
        return this.#nodes.get(id);
    }

    getAtPosition({ x, y }: Point): BlueprintNode | undefined {
        const nodes = this.children;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];

            if (node.getBounds().contains(x, y)) {
                return node;
            }
        }
    }

    getNodeFromEntryId(id: EntryId): BlueprintNode | undefined {
        const [nodeId] = splitEntryId(id);
        return this.get(nodeId);
    }

    getEntryFromId(id: EntryId): BaseBlueprintEntry | undefined {
        const [nodeId, category, key] = splitEntryId(id);
        return (this.get(nodeId)?.[category] as Collection<string, BaseBlueprintEntry>).get(key);
    }

    selectNodes(ids: string[]) {
        for (const nodeId of ids) {
            const node = this.#nodes.get(nodeId);

            if (node) {
                node.selected = true;
            }
        }
    }

    selectIntersecting(selection: PIXI.Graphics) {
        const bounds = selection.getBounds();

        for (const node of this.#nodes) {
            node.selected = bounds.intersects(node.getBounds());
        }
    }

    add(node: OpenTriggerNode, select: boolean): BlueprintNode {
        const exist = this.#nodes.get(node.id);
        if (exist) return exist;

        const _node = new BlueprintNode(node);

        this.#nodes.set(node.id, _node);
        this.addChild(_node);

        _node.initialize();
        _node.draw();

        if (select) {
            this.clearSelected();
            _node.selected = true;
        }

        return _node;
    }

    delete(nodes: BlueprintNode[], redraw: boolean = true) {
        const trigger = this.blueprint.trigger;
        if (!trigger) return;

        const variablesKeys = R.keys(trigger.data.variables);

        // first pass to add extra nodes to delete
        for (const node of nodes.slice()) {
            // we add the gate entries
            if (isGateExitNode(node)) {
                nodes.push(...this.getGateEntries(node.id));
            }

            // we add variable getters
            const variables = variablesKeys.filter((id) => splitEntryId(id)[0] === node.id);
            for (const id of variables) {
                nodes.push(...this.getVariables(id));
            }

            // we update the variables data in bundle
            trigger.update({
                variables: R.fromKeys(variables, () => undefined),
            });
        }

        for (const node of R.unique(nodes)) {
            node.eventMode = "none";
            trigger.deleteNode(node.id);
        }

        if (redraw) {
            this.blueprint.draw({ forceComputeConnections: true, renderApplication: true });
        }
    }

    deleteById(ids: string[]) {
        const nodes = ids.map((id) => this.get(id)).filter(R.isTruthy);
        this.delete(nodes);
    }

    copySelected(nodes: BlueprintNode[]) {
        const sources = this.#duplicateSelectedSources(nodes);
        if (!sources.length) return;

        const str = JSON.stringify(sources);

        game.clipboard.copyPlainText(str);
        localize.info("blueprint.node.copy.copied");
    }

    duplicateSelected(nodes: BlueprintNode[]) {
        const sources = this.#duplicateSelectedSources(nodes);
        if (!sources.length) return;

        this.addFromSources(sources);
    }

    addFromSources(sources: NodeDataOutput[]) {
        const trigger = this.blueprint.trigger;
        if (!trigger) return;

        const addedNodes: string[] = [];
        const replacementIds = R.pipe(
            sources,
            R.map((source) => source.id),
            R.fromKeys(() => foundry.utils.randomID()),
        );

        for (const source of sources) {
            source.id = replacementIds[source.id];

            for (const category of OPPOSITE_CONNECTION_CATEGORY) {
                for (const entry of R.values(source[category])) {
                    if (!entry.connection) continue;

                    const [nodeId, category, key] = splitEntryId(entry.connection);
                    const newId = replacementIds[nodeId];

                    entry.connection = `${newId}:${category}:${key}`;
                }
            }

            const newNode = trigger.addNode(source);

            if (newNode) {
                addedNodes.push(newNode.id);
            }
        }

        this.blueprint.draw({
            forceComputeConnections: true,
            renderApplication: true,
            selectNodes: addedNodes,
        });
    }

    clear() {
        this.removeAllListeners();

        this.#nodes.clear();

        const removed = this.removeChildren();

        for (let i = 0; i < removed.length; ++i) {
            removed[i].destroy(true);
        }
    }

    #duplicateSelectedSources(nodes: BlueprintNode[]): NodeDataOutput[] {
        const trigger = this.blueprint.trigger;
        if (!trigger) return [];

        const sources: NodeDataOutput[] = [];
        const nodeIds = nodes.map((node) => node.id);

        for (const node of nodes) {
            if (!node.isDuplicable) continue;

            const source = node.toObject();

            source.position.x += 100;
            source.position.y += 50;

            for (const category of OPPOSITE_CONNECTION_CATEGORY) {
                for (const [key, entry] of R.entries(source[category])) {
                    if (!entry?.connection) continue;

                    const [nodeId] = splitEntryId(entry.connection);

                    if (!R.isIncludedIn(nodeId, nodeIds)) {
                        delete source[category][key];
                    }
                }
            }

            sources.push(source);
        }

        return sources;
    }
}

interface BlueprintNodesLayer {
    parent: BlueprintLayers;
}

export { BlueprintNodesLayer };
