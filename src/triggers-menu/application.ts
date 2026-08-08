import {
    ConnectionId,
    isGateEntryNode,
    isGateExitNode,
    OpenTrigger,
    TriggerApplication,
    TriggerData,
    TriggerDataOutput,
    TriggerFullId,
    TriggersSetting,
    TriggerVariable,
    UpdateTriggerData,
} from "engine";
import {
    addEnterKeyListeners,
    addListener,
    addListenerAll,
    confirmDialog,
    ContextMenuEntry,
    createHTMLElement,
    getSetting,
    htmlClosest,
    htmlQuery,
    htmlQueryAll,
    includesAll,
    includesAny,
    localize,
    MODULE,
    purgeObject,
    R,
    registerCustomElement,
    render,
    setSetting,
    waitDialog,
} from "foundry-helpers";
import {
    Blueprint,
    BlueprintEntry,
    BlueprintNode,
    ExtendedMultiSelectElement,
    ExtendedTextInputElement,
    MaybeTrigger,
    MultiSelectTagsMode,
    PointInputElement,
    SearchSelectInputElement,
} from ".";
import apps = foundry.applications.api;

class BlueprintApplication extends apps.ApplicationV2<fa.ApplicationConfiguration, BlueprintRenderOptions> {
    #blueprint: Blueprint = new Blueprint(this);
    #folders: Set<string> = new Set();
    #search: string = "";
    #tags: string[] = [];
    #tagsMode: MultiSelectTagsMode = "and";

    static APPLICATION_ID = "trigger-engine-blueprint";

    static DEFAULT_OPTIONS: DeepPartial<fa.ApplicationConfiguration> = {
        classes: ["app", "themed", "theme-dark", "window-app"],
        id: BlueprintApplication.APPLICATION_ID,
        window: {
            resizable: false,
            minimizable: false,
            frame: false,
            positioned: false,
        },
    };

    #resizeObserver = new ResizeObserver((entries) => {
        const appEvent = entries.find((entry) => entry.target === this.element);
        if (!appEvent) return;

        this.blueprint.resizeAll();
    });

    get blueprint(): Blueprint {
        return this.#blueprint;
    }

    get search(): string {
        return this.#search;
    }

    set search(value) {
        const search = value.trim();
        if (search === this.#search) return;

        this.#search = search;
        this.#filterTriggers();
    }

    get tagsMode(): MultiSelectTagsMode {
        return this.#tagsMode;
    }

    set tagsMode(value) {
        this.#tagsMode = value;
        this.#filterTriggers();
    }

    get tags(): string[] {
        return this.#tags;
    }

    set tags(value) {
        this.#tags = value;
        this.#filterTriggers();
    }

    async close(options: fa.ApplicationClosingOptions = {}) {
        options.animate = false;
        this.#resizeObserver.disconnect();

        return super.close(options);
    }

    toggleUIEnabled(inert: boolean) {
        htmlQuery(this.element, ".ui")?.toggleAttribute("inert", inert);
    }

    collapseWindow(): this {
        this.element.classList.add("collapsed");
        return this;
    }

    expandWindow(): this {
        this.element.classList.remove("collapsed");
        this.bringToFront();
        return this;
    }

    getTriggerFromElement(el: HTMLElement): OpenTrigger | null {
        const target = htmlClosest(el, "[data-full-id]");
        if (!target) return null;

        const { fullId, invalid } = target.dataset as { fullId?: TriggerFullId; invalid?: "true" | "false" };
        return !fullId ? null : this.blueprint[invalid === "true" ? "getInvalidTrigger" : "getTrigger"](fullId);
    }

    async _onFirstRender() {
        this.bringToFront();

        // we wait one frame before initializing the canvas
        requestAnimationFrame(() => {
            const element = this.element;

            this.blueprint.resizeTo = element;
            element.prepend(this.blueprint.view);
        });

        this.#createContextMenus();
        this.#resizeObserver.observe(this.element);
    }

    protected _onClose() {
        this.blueprint.destroy();
    }

    protected _configureRenderOptions(options: BlueprintRenderOptions): void {
        super._configureRenderOptions(options);

        options.trigger = this.blueprint.trigger;
    }

    async _prepareContext(options: BlueprintRenderOptions): Promise<BlueprintContext> {
        return options.trigger ? this.#prepareTriggerContext(options.trigger) : this.#prepareTriggersContext(options);
    }

    async _preFirstRender(): Promise<void> {
        registerCustomElement(PointInputElement.tagName, PointInputElement);
        registerCustomElement(ExtendedMultiSelectElement.tagName, ExtendedMultiSelectElement);
        registerCustomElement(ExtendedTextInputElement.tagName, ExtendedTextInputElement);
        registerCustomElement(SearchSelectInputElement.tagName, SearchSelectInputElement);
    }

    protected _renderHTML(context: BlueprintContext, options: BlueprintRenderOptions): Promise<string> {
        const key = options.trigger ? "trigger" : "triggers";
        return render(`blueprint/${key}`, context);
    }

    protected _replaceHTML(result: string, content: HTMLElement, options: BlueprintRenderOptions): void {
        const ui = htmlQuery(content, ":scope > .ui");

        const description = `<div class="description actor sheet">
            <section class="window-content">
                <div class="item-summary"></div>
            </section>
        </div>`;

        const stretch = `<div class="window-stretch" data-action="toggle-stretch"></div>`;

        if (ui) {
            const scrolls = R.map(htmlQueryAll(ui, ".scroll"), (el) => el.scrollTop);

            ui.innerHTML = result + description + stretch;

            const newElements = htmlQueryAll(ui, ".scroll");

            if (scrolls.length === newElements.length) {
                R.forEach(htmlQueryAll(ui, ".scroll"), (el, i) => {
                    el.scrollTop = scrolls[i];
                });
            }
        } else {
            const wrapper = createHTMLElement("div", {
                classes: ["ui"],
                content: result + description + stretch,
                dataset: { tooltipClass: "trigger-engine-field-tooltip", tooltipDirection: "UP" },
            });

            content.appendChild(wrapper);
        }

        if (!options.trigger) {
            this.#activateTriggersListeners(content);
        }

        const stretched = getSetting("stretched");
        content.classList.toggle("stretched", stretched);
    }

    async _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0) return;

        const action = target.dataset.action as EventAction;

        switch (action) {
            case "back-menu": {
                return (this.blueprint.trigger = null);
            }

            case "close-window": {
                if (this.blueprint.hasUpdatedTriggers) {
                    const result = await confirmDialog("close-window");
                    if (result === null) return;

                    if (result) {
                        this.blueprint.saveTriggers();
                    }
                }

                return this.close();
            }

            case "collapse-window": {
                return this.collapseWindow();
            }

            case "copy-path": {
                return this.#copyTriggerPath(event, target);
            }

            case "create-trigger": {
                const folder = htmlClosest(target, "[data-folder]")?.dataset.folder;
                return this.#editTrigger(folder);
            }

            case "expand-window": {
                return this.expandWindow();
            }

            case "edit-trigger": {
                const trigger = this.blueprint.trigger;
                return trigger && this.#editTrigger(trigger.folder, trigger);
            }

            case "export-triggers": {
                return this.#exportTriggers();
            }

            case "import-triggers": {
                return this.#importTriggers();
            }

            case "refresh-application": {
                const save = await confirmDialog("refresh-application");
                if (save === null) return;

                if (save) {
                    await this.blueprint.saveTriggers();
                }

                const triggerFullId = this.blueprint.trigger?.fullId;

                await this.close();

                const app = (await this.application.openMenu()) as BlueprintApplication | null;

                if (app && triggerFullId) {
                    app.blueprint.trigger = triggerFullId;
                }

                return;
            }

            case "resolve-data": {
                this.resolve?.();
                return this.close();
            }

            case "save-triggers": {
                const confirm = await confirmDialog("save-triggers");
                return confirm && this.blueprint.saveTriggers();
            }

            case "select-node": {
                const nodeId = htmlClosest(target, "[data-node-id]")?.dataset.nodeId ?? "";
                return this.blueprint.moveToNode(nodeId, true);
            }

            case "select-trigger": {
                const fullId = htmlClosest(target, "[data-full-id]")?.dataset.fullId ?? null;
                return (this.blueprint.trigger = fullId as TriggerFullId | null);
            }

            case "tab-gate": {
                const nodeId = htmlClosest(target, "[data-node-id]")?.dataset.nodeId ?? "";
                const nodes = this.blueprint.nodes.getGateEntries(nodeId);
                return this.#tabNode(nodes);
            }

            case "tab-variable": {
                const id = htmlClosest(target, "[data-id]")?.dataset.id as ConnectionId;
                const nodes = this.blueprint.nodes.getVariables(id);
                return this.#tabNode(nodes);
            }

            case "toggle-description": {
                const description = htmlQuery(this.element, ".ui > .description");
                if (!description) return;

                description.classList.toggle("show");

                const container = htmlQuery(description, ".item-summary");
                this.#addTriggerDescription(container);

                return;
            }

            case "toggle-enabled": {
                return event.stopPropagation();
            }

            case "toggle-folder": {
                const folder = htmlClosest(target, "[data-folder]")?.dataset.folder ?? "";

                if (this.#folders.has(folder)) {
                    this.#folders.delete(folder);
                } else {
                    this.#folders.add(folder);
                }

                return this.render();
            }

            case "toggle-stretch": {
                const current = getSetting("stretched");
                return setSetting("stretched", !current);
            }

            case "toggle-triggers": {
                const element = htmlClosest(target, "[data-folder]");
                if (!element) return;

                const { checked, folder } = element.dataset as { checked: TriggersGroupCheckedType; folder: string };
                const triggers = this.blueprint.triggers.filter((trigger) => trigger.folder === folder);

                this.blueprint.enableTrigger(triggers, checked !== "checked");
                this.#folders.add(folder);

                return this.render();
            }
        }
    }

    async #exportTriggers() {
        const triggers = this.blueprint.triggers.filter((trigger) => !trigger.locked);
        const result = await this.#importExportTriggers("export", triggers);
        if (!result) return;

        const purged = purgeObject(result);
        const stringified = JSON.stringify(purged);
        const filename = `${MODULE.id}-${Date.now()}`;

        foundry.utils.saveDataToFile(stringified, "text/json", `${filename}.json`);
    }

    async #importTriggers() {
        const fileResult = await waitDialog<{ file: File }>({
            i18n: "import-export-triggers",
            content: `<input type="file" name="file" accept=".json">`,
            title: localize("import-export-triggers.title.import"),
            yes: {
                label: localize("import-export-triggers.yes.import"),
            },
        });

        if (!fileResult || !fileResult.file) return;

        const triggers = await this.#parseTriggersData(fileResult.file);

        if (!triggers?.length) {
            return localize.error("import-export-triggers.error");
        }

        const result = await this.#importExportTriggers("import", triggers);
        if (!result) return;

        for (const source of result) {
            this.blueprint.addTrigger(source, false, false);
        }

        localize.info("import-export-triggers.imported");
        this.render();
    }

    async #parseTriggersData(file: File): Promise<TriggerData[] | undefined> {
        try {
            const content = await foundry.utils.readTextFromFile(file);
            const jsonData = JSON.parse(content);

            if (!R.isArray(jsonData)) {
                throw new Error("must be an array of triggers data.");
            }

            const triggers = R.pipe(
                jsonData,
                R.map((data) => {
                    try {
                        if (!R.isPlainObject(data)) {
                            throw new Error("invalid data type.");
                        }

                        const trigger = new TriggerData(data);
                        return trigger;
                    } catch (error: any) {
                        MODULE.error("an error occurred while trying to parse trigger data from file.", error);
                    }
                }),
                R.filter(R.isTruthy),
            );

            return triggers;
        } catch (error: any) {
            MODULE.error("an error occurred while trying to parse triggers data from file.", error);
        }
    }

    async #importExportTriggers<T extends TriggerData | OpenTrigger>(
        category: "import" | "export",
        triggers: T[],
    ): Promise<WithPartial<TriggerDataOutput, "id">[] | undefined> {
        const groups = R.map(this.#prepareTriggersGroups(triggers), (group) => {
            const triggers = R.map(group.triggers, (trigger) => {
                return {
                    id: trigger.id,
                    label: trigger.name || trigger.id,
                };
            });

            return {
                folder: group.folder,
                triggers,
            };
        });

        const result = await waitDialog<{ keepids?: boolean; selected: Record<string, boolean> }>({
            classes: ["trigger-engine-import-export"],
            content: "import-export-menu",
            data: { category, groups },
            expand: true,
            i18n: "import-export-triggers",
            onRender: (_event, dialog) => {
                const html = dialog.element;

                addListenerAll(html, `[data-action="toggle-all"]`, (el) => {
                    const parent = htmlClosest(el, ".group");
                    const inputs = htmlQueryAll<HTMLInputElement>(parent, ".trigger input");
                    const checked = inputs.some((input) => !input.checked);

                    for (const input of inputs) {
                        input.checked = checked;
                    }
                });
            },
            title: localize("import-export-triggers.title", category),
            yes: {
                label: localize("import-export-triggers.yes", category),
            },
        });

        if (!result) return;

        const keepIds = result.keepids !== false;
        const selected = R.pipe(
            triggers,
            R.filter((trigger) => result.selected[trigger.id]),
            R.map((trigger) => {
                const source = trigger.toObject() as WithPartial<TriggerDataOutput, "id">;
                if (!keepIds) {
                    delete source.id;
                }
                return source;
            }),
        );

        return selected.length ? selected : undefined;
    }

    async #addTriggerDescription(el: HTMLElement | null, fullId?: TriggerFullId) {
        if (!el || el.hasChildNodes()) return;

        const trigger = fullId ? this.blueprint.getTrigger(fullId) : this.blueprint.trigger;
        el.innerHTML = (await trigger?.enrichedDescription) || "<div></div>";
    }

    #copyTriggerPath(_event: PointerEvent, el: HTMLElement) {
        const path = el.dataset.path as string;
        game.clipboard.copyPlainText(path);
        return localize.info("blueprint.trigger.copy.notify", { path });
    }

    #createContextMenus() {
        this._createContextMenu(this.#triggerContextMenu, ".sidebar.triggers .trigger");

        this._createContextMenu(this.#triggerNodeContextMenu, ".sidebar.trigger .node");
        this._createContextMenu(this.#triggerVariableContextMenu, ".sidebar.trigger .variable");
    }

    #triggerVariableContextMenu(): ContextMenuEntry[] {
        return [
            {
                icon: `<i class="fa-solid fa-pen-to-square"></i>`,
                label: localize.path(`blueprint.variable.edit`),
                visible: () => !this.blueprint.locked,
                onClick: (_event, el) => {
                    const id = el.dataset.id as ConnectionId;
                    return this.blueprint.editVariable(id);
                },
            },
            {
                icon: `<i class="fa-solid fa-trash"></i>`,
                label: localize.path("blueprint.variable.delete.title"),
                visible: () => !this.blueprint.locked,
                onClick: async (_event, el) => {
                    const id = el.dataset.id as ConnectionId;
                    const confirm = await confirmDialog("blueprint.variable.delete");
                    return confirm && this.blueprint.deleteVariable(id);
                },
            },
        ];
    }

    #triggerNodeContextMenu(): ContextMenuEntry[] {
        return [
            {
                icon: `<i class="fa-solid fa-pen-to-square"></i>`,
                label: localize.path(`blueprint.node.edit`),
                visible: (el) => {
                    return !this.blueprint.locked && el.hasAttribute("data-editable");
                },
                onClick: (_event, el) => {
                    const nodeId = el.dataset.nodeId ?? "";
                    const node = this.blueprint.nodes.get(nodeId);
                    return node?.edit();
                },
            },
            {
                icon: `<i class="fa-solid fa-trash"></i>`,
                label: localize.path("blueprint.node.delete.single"),
                visible: (el) => {
                    if (this.blueprint.locked) return false;

                    const nodeId = el.dataset.nodeId ?? "";
                    const node = this.blueprint.nodes.get(nodeId);
                    return !!node && (!node.isEvent || !!this.blueprint.trigger?.application.hasMultipleEvents);
                },
                onClick: async (_event, el) => {
                    const nodeId = el.dataset.nodeId ?? "";
                    const confirm = await confirmDialog("blueprint.node.delete.confirm");
                    return confirm && this.blueprint.nodes.deleteById([nodeId]);
                },
            },
        ];
    }

    #triggerContextMenu(): ContextMenuEntry[] {
        return [
            {
                icon: `<i class="fa-solid fa-clipboard"></i>`,
                label: localize.path("blueprint.trigger.copy.label"),
                onClick: this.#copyTriggerPath.bind(this),
            },
            {
                icon: `<i class="fa-solid fa-pen-to-square"></i>`,
                label: localize.path("blueprint.trigger.edit"),
                visible: (el) => {
                    const trigger = this.getTriggerFromElement(el);
                    return !!trigger && !trigger.locked && !trigger.invalid;
                },
                onClick: (_event, el) => {
                    const trigger = this.getTriggerFromElement(el);
                    return trigger && this.#editTrigger(trigger.folder, trigger);
                },
            },
            {
                icon: `<i class="fa-solid fa-pen-to-square"></i>`,
                label: localize.path("edit-folder.title"),
                visible: (el) => {
                    const trigger = this.getTriggerFromElement(el);
                    return !!trigger?.locked;
                },
                onClick: (_event, el) => {
                    const trigger = this.getTriggerFromElement(el);
                    return trigger?.locked && this.#editFolder(trigger);
                },
            },
            {
                icon: `<i class="fa-solid fa-copy"></i>`,
                label: localize.path("blueprint.trigger.duplicate"),
                visible: (el) => {
                    const trigger = this.getTriggerFromElement(el);
                    return !!trigger && !trigger.invalid;
                },
                onClick: (_event, el) => {
                    const trigger = this.getTriggerFromElement(el);
                    const source = trigger?.duplicate();
                    return source && this.blueprint.addTrigger(source, true, true);
                },
            },
            {
                icon: `<i class="fa-solid fa-trash"></i>`,
                label: localize.path("blueprint.trigger.delete.title"),
                visible: (el) => {
                    const trigger = this.getTriggerFromElement(el);
                    return !!trigger && !trigger.locked;
                },
                onClick: (_event, el) => {
                    const fullId = el.dataset.fullId as TriggerFullId;
                    return this.blueprint.deleteTrigger(fullId);
                },
            },
        ];
    }

    #tabNode(nodes: BlueprintNode[]) {
        const nbNodes = nodes.length;
        if (!nbNodes) return;

        if (this.blueprint.nodes.selected.length !== 1 || nbNodes === 1) {
            return this.blueprint.moveToNode(nodes[0].id, true);
        }

        const currentIndex = nodes.findIndex((node) => node.selected);

        if (currentIndex >= 0) {
            const node = nodes[(currentIndex + 1) % nbNodes];
            this.blueprint.moveToNode(node.id, true);
        } else {
            this.blueprint.moveToNode(nodes[0].id, true);
        }
    }

    #filterTriggers() {
        filterElements(
            this.element.querySelectorAll<HTMLElement>(".sidebar.triggers .trigger"),
            this.search,
            this.tags,
            this.tagsMode,
        );
    }

    #prepareTriggerContext(trigger: OpenTrigger): TriggerContext {
        this.#search = "";

        // when we come back to triggers menu, we want the folder to be expanded
        if (trigger.folder) {
            this.#folders.add(trigger.folder);
        }

        const gates = R.map(
            this.blueprint.nodes.filter((node) => isGateExitNode(node)),
            (node): PreparedGate => {
                const hasEntries = this.blueprint.nodes.some((other) => {
                    return isGateEntryNode(other) && other.gateId === node.id;
                });
                return { hasEntries, node };
            },
        );

        const variables: PreparedVariable[] = R.pipe(
            this.blueprint.trigger?.data.variables ?? {},
            R.entries(),
            R.map(([id, variable]): PreparedVariable | undefined => {
                const entry = this.blueprint.nodes.getEntryFromId(id) as BlueprintEntry | undefined;
                if (!entry) return;

                const color = this.application.entries.get(variable.type)?.color;

                return {
                    ...variable,
                    color: new PIXI.Color(color).toHex(),
                    hasNodes: this.blueprint.nodes.some((node) => node.variableId === id),
                    id,
                    isArray: variable.isArray,
                    isCustom: foundry.data.validators.isValidId(entry.key),
                    nodeId: id.split(":")[0],
                };
            }),
            R.filter(R.isTruthy),
        );

        return {
            events: this.blueprint.nodes.filter((node) => node.isEvent),
            gates,
            hasDescription: !!trigger.description,
            isFree: this.application.isFreeApplication,
            trigger,
            variables,
        };
    }

    #prepareTriggersGroups<T extends MaybeTrigger>(triggersData: T[]): TriggersGroup<T>[] {
        return R.pipe(
            triggersData,
            R.groupBy((trigger) => this.blueprint.getFolder(trigger)),
            R.entries(),
            R.filter(([_folder, triggers]) => triggers.length > 0),
            R.sortBy(([folder]) => folder),
            R.map(([folder, triggers]): TriggersGroup<T> => {
                const checked = this.#testFolderChecked(triggers);
                const expanded = !folder || this.#folders.has(folder);

                return { checked, expanded, folder, triggers };
            }),
        );
    }

    #testFolderChecked(triggers: NonEmptyArray<MaybeTrigger>): TriggersGroupCheckedType {
        let hasEnabled = 0;

        for (let i = 0; i < triggers.length; i++) {
            const trigger = triggers[i];
            const enabled = this.blueprint.isEnabled(trigger);

            if (hasEnabled && !enabled) {
                return "partial"; // we know we have one enabled and one not
            }

            if (i !== 0 && !hasEnabled && enabled) {
                return "partial"; // same as above
            }

            if (enabled) {
                hasEnabled++;
            }
        }

        return hasEnabled === triggers.length ? "checked" : "unchecked";
    }

    #prepareTriggersContext(_options: BlueprintRenderOptions): TriggersContext {
        const triggers = [...this.blueprint.triggers, ...this.blueprint.invalids];
        const groups = this.#prepareTriggersGroups(triggers);

        // we move the folder-less group at the end
        if (groups.length > 1 && groups[0].folder === "") {
            groups.push(groups.shift()!);
        }

        const tags = R.pipe(
            triggers,
            R.flatMap((trigger) => {
                return trigger.tags;
            }),
            R.unique(),
            R.map((tag): { value: string; label: string } => {
                return { label: tag, value: tag };
            }),
            R.unique(),
            R.sortBy(R.identity()),
        );

        return {
            groups,
            isEnabled: (trigger) => this.blueprint.isEnabled(trigger),
            search: this.#search,
            tags: {
                list: tags,
                mode: this.tagsMode,
                selected: this.tags,
            },
            updated: this.blueprint.hasUpdatedTriggers,
        };
    }

    #activateTriggersListeners(html: HTMLElement) {
        addEnterKeyListeners(html, "text");

        addListenerAll(html, ".trigger", "pointerenter", async (el) => {
            const container = htmlQuery(html, ".ui > .description .item-summary");
            if (!container) return;

            const cached = htmlQuery(el, ".trigger-description");

            await this.#addTriggerDescription(cached, el.dataset.fullId as TriggerFullId);
            container.innerHTML = cached?.innerHTML ?? "";
        });

        addListenerAll(html, ".trigger input", "change", (el: HTMLInputElement, event) => {
            event.stopPropagation();

            const fullId = htmlClosest(el, "[data-full-id]")?.dataset.fullId as TriggerFullId;
            const trigger = this.blueprint.getTrigger(fullId);

            if (trigger) {
                this.blueprint.enableTrigger(trigger, el.checked);
                this.render();
            }
        });

        addListener(html, `[name="search"]`, "input", (el: ExtendedTextInputElement) => {
            this.search = el.value;
        });

        const multiSelect = htmlQuery<ExtendedMultiSelectElement>(html, `[name="tags"]`);

        if (multiSelect) {
            multiSelect.addEventListener("change", () => {
                this.tags = multiSelect.value;
            });

            multiSelect.addEventListener("mode", () => {
                this.tagsMode = multiSelect.mode;
            });
        }

        if (this.search !== "") {
            this.#filterTriggers();
        }
    }

    async #editFolder(trigger: OpenTrigger) {
        const current = this.blueprint.getFolder(trigger);

        const result = await waitDialog<{ folder: string; reset: boolean }>({
            content: "edit-folder",
            data: { value: current },
            i18n: "edit-folder",
        });

        if (!result) return;

        if (result.reset) {
            this.blueprint.resetFolder(trigger);
        } else if (result.folder !== current) {
            this.blueprint.setFolder(trigger, result.folder);
        }
    }

    async #editTrigger(folder?: string, trigger?: OpenTrigger) {
        const isEdit = !!trigger;

        const result = await waitDialog<UpdateTriggerData>({
            classes: ["trigger-engine-edit-trigger"],
            content: "edit-trigger",
            data: {
                description: trigger?.description ?? "",
                enrichedDescription: (await trigger?.enrichedDescription) ?? "",
                folder: trigger?.folder ?? folder ?? "",
                name: trigger?.name ?? "",
                placeholder: trigger?.label ?? "",
                priority: trigger?.priority ?? 0,
                tags: trigger?.data.tags,
            },
            i18n: "edit-trigger",
            title: localize(isEdit ? "blueprint.trigger.edit" : "blueprint.triggers.create"),
            yes: {
                label: localize("edit-trigger.yes", isEdit ? "edit" : "create"),
            },
        });

        if (!result) return;

        if (isEdit) {
            trigger.update(result);
            this.render();
        } else {
            this.blueprint.addTrigger(result, true, true);
        }
    }
}

interface BlueprintApplication {
    get application(): TriggerApplication;
    getTriggersSetting(): TriggersSetting;
    resolve(): Promise<void>;
}

function filterElements(
    elements: NodeListOf<HTMLElement>,
    search: string | undefined,
    tags: string[] | undefined = [],
    tagsMode: MultiSelectTagsMode = "and",
) {
    const searchTerm = search?.toLocaleLowerCase();
    const tagsFn = tagsMode === "and" ? includesAll : includesAny;

    const validateSearch = searchTerm?.length
        ? (value: string | undefined) => value?.toLowerCase().includes(searchTerm)
        : () => true;

    const validateTags = tags?.length
        ? (elementTags: string | undefined): boolean => tagsFn(elementTags?.split(",") ?? [], tags)
        : () => true;

    const validateAliases = searchTerm?.length
        ? (value: string | undefined) => value?.toLowerCase().includes(searchTerm)
        : () => false;

    for (const el of elements) {
        const validTag = validateTags(el.dataset.tags);
        const validName = validTag && validateSearch(el.dataset.name);

        let hasValidAlias = false;

        for (const alias of el.querySelectorAll<HTMLElement>(".alias")) {
            const validAlias = validTag && validateAliases(alias.dataset.alias);

            if (validAlias) {
                hasValidAlias = true;
            }

            alias.classList.toggle("hidden", !validAlias);
        }

        el.classList.toggle("hidden", !validName && !hasValidAlias);
    }
}

type EventAction =
    | "back-menu"
    | "close-window"
    | "collapse-window"
    | "copy-path"
    | "create-trigger"
    | "edit-trigger"
    | "expand-window"
    | "export-triggers"
    | "import-triggers"
    | "refresh-application"
    | "resolve-data"
    | "save-triggers"
    | "select-node"
    | "select-trigger"
    | "tab-gate"
    | "tab-variable"
    | "toggle-description"
    | "toggle-enabled"
    | "toggle-folder"
    | "toggle-stretch"
    | "toggle-triggers";

type BlueprintContext = TriggersContext | TriggerContext;

type TriggerContext = fa.ApplicationRenderContext & {
    events: BlueprintNode[];
    gates: PreparedGate[];
    hasDescription: boolean;
    isFree: boolean;
    trigger: OpenTrigger;
    variables: PreparedVariable[];
};

type PreparedGate = {
    hasEntries: boolean;
    node: BlueprintNode;
};

type PreparedVariable = TriggerVariable & {
    color: string;
    hasNodes: boolean;
    id: ConnectionId;
    isArray: boolean;
    isCustom: boolean;
    nodeId: string;
};

type TriggersContext = fa.ApplicationRenderContext & {
    groups: TriggersGroup[];
    isEnabled: (trigger: OpenTrigger) => boolean;
    search: string;
    tags: {
        list: { value: string; label: string }[];
        mode: MultiSelectTagsMode;
        selected: string[];
    };
    updated: boolean;
};

type TriggersGroupCheckedType = "checked" | "partial" | "unchecked";

type TriggersGroup<T extends MaybeTrigger = MaybeTrigger> = {
    checked: TriggersGroupCheckedType;
    expanded: boolean;
    folder: string;
    triggers: NonEmptyArray<T>;
};

type BlueprintRenderOptions = fa.ApplicationRenderOptions & {
    trigger: OpenTrigger | undefined;
};

export { BlueprintApplication, filterElements };
