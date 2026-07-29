import {
    instantiateEntry,
    isGateEntryNode,
    isVariableGetterNode,
    NodeBridge,
    NodeEntry,
    OpenNodeEntry,
    OpenTrigger,
    OutputEntrySchema,
    ResolvedNodeEntry,
    ResolvedTriggerNode,
    splitEntryId,
    Trigger,
} from "engine";
import {
    FirstActiveTokenOptions,
    getTargetsTokens,
    getTargetToken,
    LocalizeArgs,
    MODULE,
    R,
    ScenePF2e,
} from "foundry-helpers";
import {
    getInputsSchemas,
    getNodeStates,
    getOutputsSchemas,
    getOutsSchemas,
    NodeData,
    TriggerNode,
    TriggerNodeCustomOutput,
} from ".";

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
    const isGateEntry = isGateEntryNode(nodeData);
    const exitGate: { node: TriggerNode; schemas: OutputEntrySchema[] } | undefined = (() => {
        if (!isGateEntry) return;

        const connection = nodeData.outs.out.connection;
        const nodeId = connection?.split(":").at(0) ?? "";
        const node = parent.getNode(nodeId);
        const data = foundry.utils.deepClone(parent.data.nodes.get(nodeId));
        if (!node || !data) return;

        const ExitCls = node.constructor as typeof TriggerNode;
        const schemas = getOutputsSchemas(ExitCls, { data });

        return { node, schemas };
    })();
    if (isGateEntry && !exitGate) return false;

    // we construct the variable schema
    const isVariableGetter = isVariableGetterNode(nodeData);
    const variableSchemas = ((): OutputEntrySchema[] | undefined => {
        if (!isVariableGetter) return;

        const connection = nodeData.inputs.entry?.connection;
        const data = connection && parent.data.variables[connection];
        if (!data) return;

        const [nodeId, _, key] = connection.split(":");
        const node = parent.getNode(nodeId) as OpenTriggerNode | TriggerNode | undefined;
        if (!node || ("entries" in node && !node.entries.outputs.get(key))) return;

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
    })();
    if (isVariableGetter && !variableSchemas) return false;

    function rootLocalize(...args: LocalizeArgs): string | undefined {
        return parent.application.localize(...args);
    }

    function localize(...args: LocalizeArgs): string | undefined {
        return rootLocalize("node", NodeCls.category, NodeCls.type, ...args);
    }

    const isEvent = NodeCls.isEvent;

    //states
    const nodeStates = getNodeStates(NodeCls);
    const nodeState = !nodeStates
        ? null
        : R.isString(nodeData.state) && R.isIncludedIn(nodeData.state, nodeStates)
          ? nodeData.state
          : nodeStates[0];

    class TriggerNodeWrapper extends NodeCls {
        #in: NodeBridge | null;
        #inputs: Collection<string, NodeEntry>;
        #nextCalled: boolean = false;
        #outputs: Collection<string, NodeEntry>;
        #outputValues: Record<string, any> = {};
        #outs: Collection<string, NodeBridge>;
        #sceneId?: string;
        #userId?: string;

        constructor() {
            super();

            const self = this;

            // scene context
            Object.defineProperty(this, "sceneContext", {
                get(): Scene | undefined {
                    return (self.#sceneId && game.scenes.get(self.#sceneId)) || parent.sceneContext;
                },
                set(sceneOrToken: Maybe<Scene | TokenDocument>) {
                    const scene = sceneOrToken instanceof TokenDocument ? sceneOrToken.parent : sceneOrToken;

                    if (scene) {
                        self.#sceneId = scene.id;
                        parent.sceneContext = scene as ScenePF2e;
                    }
                },
                configurable: false,
                enumerable: true,
            });

            // user context
            Object.defineProperty(this, "userContext", {
                get(): User {
                    return (self.#userId && game.users.get(self.#userId)) || parent.userContext;
                },
                set(user: User) {
                    self.#userId = user.id;
                    parent.userContext = user;
                },
                configurable: false,
                enumerable: true,
            });

            // from data accessors
            Object.defineProperties(
                this,
                R.fromKeys(["id", "invalid"] as const, (property) => {
                    return {
                        value: nodeData[property],
                        configurable: false,
                        enumerable: true,
                        writable: false,
                    };
                }),
            );

            // from private methods
            Object.defineProperties(
                this,
                R.pipe(
                    [
                        ["executeNext", this.#executeNext],
                        ["getCustomInputs", this.#getCustomInputs],
                        ["getCustomInputsValues", this.#getCustomInputsValues],
                        ["getInputValue", this.#getInputValue],
                        ["getLocalValue", this.#getLocalValue],
                        ["getCustomOutKey", this.#getCustomOutKey],
                        ["getCustomOutputs", this.#getCustomOutputs],
                        ["getOutputValue", this.#getOutputValue],
                        ["getTargetToken", this.#getTargetToken],
                        ["getTargetsTokens", this.#getTargetsTokens],
                        ["localize", localize],
                        ["rootLocalize", rootLocalize],
                        ["setCustomOutputValues", this.#setCustomOutputValues],
                        ["setOutputValue", this.#setOutputValue],
                    ] as const,
                    R.fromEntries(),
                    R.mapValues((method) => {
                        return {
                            value: method.bind(this),
                            configurable: false,
                            enumerable: false,
                            writable: false,
                        };
                    }),
                ),
            );

            // from static accessors
            Object.defineProperties(
                this,
                R.fromKeys(["isEvent", "type", "category"] as const, (property) => {
                    return {
                        value: NodeCls[property],
                        configurable: false,
                        enumerable: true,
                        writable: false,
                    };
                }),
            );

            // from trigger
            Object.defineProperties(
                this,
                R.fromKeys(["getContext", "setContext"] as const, (property) => {
                    return {
                        value: parent[property].bind(parent),
                        configurable: false,
                        enumerable: false,
                        writable: false,
                    };
                }),
            );

            // from application
            Object.defineProperties(
                this,
                R.fromKeys(
                    [
                        "convertFromEmitable",
                        "convertObjectFromEmitable",
                        "convertObjectToEmitable",
                        "convertToEmitable",
                        "convertValueFromEmitable",
                        "convertValuesFomEmitable",
                        "convertValuesToEmitable",
                        "convertValueToEmitable",
                        "parseUserValue",
                        "parseUserValues",
                    ] as const,
                    (property) => {
                        return {
                            value: parent.application[property].bind(parent.application),
                            configurable: false,
                            enumerable: false,
                            writable: false,
                        };
                    },
                ),
            );

            // bridges
            const [ins, outs] = R.map(
                [
                    [
                        "inputs",
                        !isEvent && NodeCls.hasIn ? [{ key: "in", spacing: 0, state: undefined, tooltip: false }] : [],
                    ],
                    ["outputs", getOutsSchemas(NodeCls, { data: nodeData, state: nodeState })],
                ] as const,
                ([category, schemas]) => {
                    return R.pipe(
                        schemas,
                        R.map((schema) => {
                            try {
                                const bridge = new NodeBridge(this, category, nodeData, schema);
                                return [bridge.key, bridge] as const;
                            } catch (error) {}
                        }),
                        R.filter(R.isTruthy),
                    );
                },
            );

            // entries
            const [inputs, outputs] = R.map(
                [
                    [
                        "inputs",
                        variableSchemas ?? // unique schema for variables
                            exitGate?.schemas ?? // we use the exit output schemas
                            getInputsSchemas(NodeCls, { data: nodeData, state: nodeState }),
                    ],
                    [
                        "outputs",
                        variableSchemas ?? // unique schema for variables
                            getOutputsSchemas(NodeCls, { data: nodeData, state: nodeState }),
                    ],
                ] as const,
                ([category, schemas]) => {
                    const entries = R.pipe(
                        schemas,
                        R.map((schema) => {
                            try {
                                const entry = instantiateEntry(parent, this, category, schema, nodeData, open);

                                return entry ? ([entry.key, entry] as const) : undefined;
                            } catch (error: any) {
                                MODULE.error("an error occurred while instantiating a node entry", error);
                            }
                        }),
                        R.filter(R.isTruthy),
                    );

                    return new Collection(entries);
                },
            );

            // some properties
            Object.defineProperties(
                this,
                R.pipe(
                    [
                        ["nodePath", `${parent.path}:${this.id}`],
                        ["state", nodeState],
                        ["triggerName", parent.name || parent.id],
                        ["triggerPath", parent.path],
                    ] as const,
                    R.fromEntries(),
                    R.mapValues((value) => {
                        return {
                            value,
                            configurable: false,
                            enumerable: true,
                            writable: false,
                        };
                    }),
                ),
            );

            this.#in = ins.at(0)?.[1] || null;
            this.#outs = new Collection(outs);
            this.#inputs = inputs;
            this.#outputs = outputs;

            if (open) {
                Object.defineProperties(this, {
                    data: {
                        value: nodeData,
                    },
                    entries: {
                        value: {
                            in: this.#in,
                            outs: this.#outs,
                            inputs: inputs as Collection<string, OpenNodeEntry>,
                            outputs: outputs as Collection<string, OpenNodeEntry>,
                        } satisfies NodeEntries,
                    },
                    exitGate: {
                        value: exitGate?.node,
                    },
                    parent: {
                        value: parent,
                    },
                    states: {
                        value: nodeStates,
                    },
                    tags: {
                        value: NodeCls.tags,
                    },
                });
            }

            if (parent.application.isFreeApplication) {
                const _execute = this._execute.bind(this);

                this._execute = async (...args: any[]): Promise<boolean> => {
                    const result = await _execute(...args);

                    if (!this.#nextCalled) {
                        await this.#resolve();
                    }

                    return result;
                };
            }
        }

        get #isExecutable(): boolean {
            return !!this.#in || this.#outs.size > 0;
        }

        async #resolve() {
            const trigger = parent as OpenTrigger;

            const inputs: ResolvedNodeEntry[] = await Promise.all(
                this.#inputs.map(async ({ key, slug, type }): Promise<ResolvedNodeEntry> => {
                    return {
                        key: slug ?? key,
                        type,
                        value: await this.getInputValue(key),
                    };
                }),
            );

            const outputs = await Promise.all(
                this.#outputs.map(async ({ key, slug, type }): Promise<ResolvedNodeEntry> => {
                    return {
                        key: slug ?? key,
                        type,
                        value: await this.#outputValues[key],
                    };
                }),
            );

            trigger.addResolvedNode({ inputs, outputs, type: this.type } satisfies ResolvedTriggerNode);
        }

        async #executeNext(out: string, ...args: any[]): Promise<boolean> {
            if (!this.#isExecutable) return true;

            if (parent.application.isFreeApplication) {
                this.#nextCalled = true;
                await this.#resolve();
            }

            try {
                const connection = this.#outs.get(out)?.connection;
                if (!connection) return true;

                const node = parent.getNodeFromEntryId(connection);
                if (!node) return true;

                // we set the trigger context to the node's whenever it is executed
                parent.userContext = node.userContext;
                return node._execute(...args);
            } catch (error: any) {
                MODULE.error(`an error occurred while executing the node: ${this.nodePath}`, error);
                return true;
            }
        }

        #getCustomOutKey(slug: string, input: string | number): string | undefined {
            return this.#outs.find((out) => out.slug === slug && out.input === input)?.key;
        }

        #getCustomOutputs(slug: string): TriggerNodeCustomOutput[] {
            return this.#outputs
                .filter((output) => output.slug === slug)
                .map(({ input, key, type }): TriggerNodeCustomOutput => {
                    return { input, key, type };
                });
        }

        #getLocalValue(key: string): any {
            const input = this.#inputs.get(key);
            if (!input) return;

            const value = input?.value;
            return R.isNonNullish(value) && input.isValidType(value) ? input.processValue(value) : input.default;
        }

        async #getInputValue(key: string): Promise<any> {
            const input = this.#inputs.get(key);
            if (!input) return;

            const returnValue = (rawValue: any): any => {
                if (input.isArray) {
                    return R.pipe(
                        R.isArray(rawValue) ? rawValue : [rawValue],
                        R.filter(input.isValidType.bind(input)),
                        R.map(input.processValue.bind(input)),
                    );
                } else {
                    const value = R.isArray(rawValue) ? rawValue[0] : rawValue;
                    return input.isValidType(value) ? input.processValue(value) : input.default;
                }
            };

            if (input.connection) {
                const [nodeId, _, otherKey] = splitEntryId(input.connection);
                const otherNode = parent.getNode(nodeId) as TriggerNodeWrapper | undefined;

                if (!otherNode) {
                    return input.default;
                }

                const value = await otherNode.getOutputValue(otherKey, input);
                return returnValue(value);
            } else {
                return returnValue(input.value);
            }
        }

        #getCustomInputs(slug: string): Promise<{ label: string; value: any }[]> {
            const results = this.#inputs
                .filter((input) => input.slug === slug)
                .map(async ({ key, label, type }): Promise<{ label: string; value: any; type: string }> => {
                    return {
                        label: label ?? "",
                        value: await this.getInputValue(key),
                        type,
                    };
                });

            return Promise.all(results);
        }

        #getCustomInputsValues(slug: string): Promise<any[]> {
            const results = this.#inputs
                .filter((input) => input.slug === slug)
                .map(async ({ key }) => this.getInputValue(key));

            return Promise.all(results);
        }

        async #getOutputValue(key: string, input: NodeEntry): Promise<any> {
            const output = this.#outputs.get(key);
            if (!output) return;

            const value = await (this.#isExecutable ? this.#outputValues[key] : this._query(key));

            if (output.type === input.type) {
                return value;
            }

            const convertor = parent.application.getConvertor(output.type, input.type);
            if (!convertor) return;

            const userContext = this.userContext;
            const convertToInput = (value: any) => convertor.convertToInput(value, userContext);

            return R.isArray(value)
                ? await Promise.all(value.filter((x) => output.isValidType(x)).map(convertToInput))
                : output.isValidType(value)
                  ? await convertToInput(value)
                  : undefined;
        }

        #setOutputValue(key: string, value: any) {
            const output = this.#outputs.get(key);
            if (output) {
                this.#castAndSetOutputValue(output, value);
            }
        }

        #setCustomOutputValues(slug: string, values: any[]) {
            const outputs = this.#outputs.filter((output) => output.slug === slug);

            for (let i = 0; i < outputs.length; i++) {
                const output = outputs[i];
                this.#castAndSetOutputValue(output, values[i]);
            }
        }

        #castAndSetOutputValue(output: NodeEntry, value: any) {
            if (output.isArray) {
                this.#outputValues[output.key] = R.pipe(
                    R.isArray(value) ? value : [value],
                    R.map(output.castValue.bind(output)),
                );
            } else {
                value = R.isArray(value) ? value[0] : value;
                this.#outputValues[output.key] = output.castValue(value);
            }
        }

        #getTargetToken(target: Maybe<TargetDocuments>, options?: FirstActiveTokenOptions): TokenDocument | undefined {
            return getTargetToken(target, options);
        }

        #getTargetsTokens(
            targets: TargetDocuments[],
            uuid?: boolean,
            options?: FirstActiveTokenOptions,
        ): TokenDocument[] {
            return getTargetsTokens(targets, uuid, options);
        }
    }

    interface TriggerNodeWrapper {
        getOutputValue(key: string, input: NodeEntry): Promise<any>;
    }

    return new TriggerNodeWrapper();
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

export { instantiateNode };
export type { OpenTriggerNode };
