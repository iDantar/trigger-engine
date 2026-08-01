import {
    ApplicationKey,
    EntryId,
    TriggerApplication,
    TriggerData,
    TriggerDataOutput,
    TriggerNode,
    instantiateNode,
    splitEntryId,
} from "engine";
import { R } from "foundry-helpers";

class Trigger<TNode extends TriggerNode = TriggerNode> {
    #context: Record<string, any> = {};
    #data: TriggerData;
    #invalid?: boolean;
    #nodes: Collection<string, TNode> = new Collection();
    #parent: TriggerApplication;
    #sceneId?: string;
    #userId: string;

    constructor(parent: TriggerApplication, data: TriggerData, userId: string = game.userId) {
        this.#data = data;
        this.#parent = parent;
        this.#userId = userId;
    }

    get nodes(): Collection<string, TNode> {
        return this.#nodes;
    }

    get application(): TriggerApplication {
        return this.#parent;
    }

    get path(): TriggerPath {
        return `${this.applicationKey}:${this.id}`;
    }

    get applicationKey(): ApplicationKey {
        return this.application.applicationKey;
    }

    get data(): TriggerData {
        return this.#data;
    }

    get id(): string {
        return this.data.id;
    }

    get name(): string {
        return this.data.name;
    }

    get invalid(): boolean {
        return (this.#invalid ??= (() => {
            if (this.data.invalid) return true;

            for (const nodeData of this.data.nodes) {
                const node = instantiateNode(this, nodeData, false);
                if (!node || node.invalid) return true;
            }

            return false;
        })());
    }

    get userContext(): User {
        return game.users.get(this.#userId) ?? game.user;
    }

    set userContext(user: User) {
        this.#userId = user.id;
    }

    get sceneContext(): Scene | undefined {
        return (this.#sceneId && game.scenes.get(this.#sceneId)) || game.scenes.active;
    }

    set sceneContext(sceneOrToken: Maybe<Scene | TokenDocument>) {
        const scene = sceneOrToken instanceof TokenDocument ? sceneOrToken.parent : sceneOrToken;

        if (scene) {
            this.#sceneId = scene.id;
        }
    }

    getNode(id: string): TNode | undefined {
        // we instantiate the node on the fly
        if (!this.#nodes.has(id)) {
            try {
                const nodeData = this.data.nodes.get(id);
                if (!nodeData) return;

                const node = instantiateNode<TNode>(this, nodeData, false);
                if (!node || node.invalid) return;

                this.#nodes.set(node.id, node);
                return node;
            } catch (error) {
                return;
            }
        }

        return this.#nodes.get(id);
    }

    getNodeFromEntryId(id: EntryId): TNode | undefined {
        const [nodeId] = splitEntryId(id);
        return this.getNode(nodeId);
    }

    getContext<T>(key: string): T | undefined {
        return this.#context[key];
    }

    setContext<T>(key: string, value: T): T {
        this.#context[key] = value;
        return value;
    }

    toObject(): TriggerDataOutput {
        return this.data.toObject();
    }
}

function getTriggerPathData(triggerPath: TriggerPath): TriggerPathData {
    const [moduleId, applicationId, triggerId] = R.split(triggerPath, ":");
    return {
        moduleId,
        applicationId,
        applicationKey: `${moduleId}:${applicationId}`,
        triggerId,
    };
}

type TriggerPath = `${ApplicationKey}:${string}`;

type TriggerPathData = {
    moduleId: string;
    applicationId: string;
    applicationKey: ApplicationKey;
    triggerId: string;
};

export { Trigger, getTriggerPathData };
export type { TriggerPath, TriggerPathData };
