import { IconObject } from "_zod";
import { NodeEntry, TriggerNode } from "engine";
import { drawRectangleMask, LocalizeArgs, MODULE, R, z } from "foundry-helpers";
import { BlueprintNode, NodeFieldOptions, PreciseTextOptions } from "triggers-menu";

class NodeField<TValue extends unknown = unknown, TFieldSchema extends Record<string, any> = Record<string, any>>
    extends PIXI.Graphics
{
    #node: BlueprintNode;

    /** @private You musn't use constructor in your child class */
    constructor(node: BlueprintNode, parent: NodeEntry, options: NodeFieldOptions) {
        super();

        this.#node = node;

        Object.defineProperty(this, "entry", {
            value: parent,
            configurable: false,
            enumerable: false,
            writable: false,
        });

        // from options
        Object.defineProperties(
            this,
            R.fromKeys(R.keys(options), (property) => {
                return {
                    value: options[property],
                    configurable: false,
                    enumerable: true,
                    writable: false,
                };
            }),
        );

        // from BlueprintNode methods
        Object.defineProperties(
            this,
            R.pipe(
                [
                    ["createFontAwesomeIcon", node.fontAwesomeIcon],
                    ["createPreciseText", node.preciseText],
                ] as const,
                R.fromEntries(),
                R.mapValues((method) => {
                    return {
                        value: method.bind(node),
                        configurable: false,
                        enumerable: false,
                        writable: false,
                    };
                }),
            ),
        );

        // from private methods
        Object.defineProperties(
            this,
            R.pipe(
                [
                    ["addRectangleMask", this.#addRectangleMask],
                    ["getGlobalBounds", this.#getGlobalBounds],
                    ["localize", this.#localize],
                    ["rootLocalize", this.#rootLocalize],
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
    }

    /**
     * @abstract
     * Defines the DataSchema for the input field that will be used in the triggers menu.
     */
    static get defineSchema(): NodeFieldSchema {
        throw MODULE.Error("'defineSchema' accessor not implemented.");
    }

    /** The cursor when hovering over the field. */
    get cursor(): PIXI.Cursor {
        return "default";
    }

    /**
     * @abstract
     * Draw the actual field.
     */
    draw(): void {
        throw MODULE.Error("'draw' method not implemented.");
    }

    /**
     * @abstract
     * Event listener called when the field is clicked on. It is only registered if the entry isn't connected.
     */
    onClick(): Promise<TValue> {
        throw MODULE.Error("'onClick' method not implemented.");
    }

    /**
     * Don't look here, shoo!
     */

    #addRectangleMask(
        parent: PIXI.Container,
        x: number,
        y: number,
        width: number,
        height: number,
        radius?: number | undefined,
    ) {
        const mask = drawRectangleMask(x, y, width, height, radius);

        parent.addChild(mask);
        parent.mask = mask;
    }

    #getGlobalBounds(): PIXI.Rectangle {
        return this.#node.blueprint.getGlobalBounds(this);
    }

    #localize(...args: LocalizeArgs): string | undefined {
        return this.#node.localize(...args);
    }

    #rootLocalize(...args: LocalizeArgs): string | undefined {
        return this.#node.rootLocalize(...args);
    }
}

interface NodeField<TValue extends unknown = unknown, TFieldSchema extends Record<string, any> = Record<string, any>> {
    /** The base font size of nodes in 'px'. */
    get baseFontSize(): number;
    /** @see {@link NodeEntry.default} */
    get default(): TValue;
    /** The parent entry instance. */
    get entry(): NodeEntry<TValue, TFieldSchema>;
    /** @see {@link NodeField.defineSchema} The field data for this instance. */
    get field(): TFieldSchema;
    /** Is this entry currently connected to another node. */
    get isConnected(): boolean;
    /** The already generated entry label element in case you want to manipulate it. */
    get label(): PreciseText;
    /** The max height of an entry row. You should make sure everything fits in it to avoid overlapping between rows. */
    get maxHeight(): number;
    /**
     * The current value of this input after going through {@link NodeEntry#isValidType}
     * & {@link NodeEntry#processValue}
     */
    get value(): TValue;

    /** Creates a font-awesome icon in a canvas compatible form. */
    createFontAwesomeIcon(icon: IconObject): PreciseText;

    /** Creates a text element in a canvas compatible form. */
    createPreciseText(text: string, options?: PreciseTextOptions): PreciseText;

    /** Creates a PIXI mask and applies it directly onto `parent`. */
    addRectangleMask(
        parent: PIXI.Container,
        x: number,
        y: number,
        width: number,
        height: number,
        radius?: number | undefined,
    ): void;

    /** The bounds of the field in the viewport. */
    getGlobalBounds(): PIXI.Rectangle;

    /** @see {@link TriggerNode#localize} */
    localize(...args: LocalizeArgs): string | undefined;

    /** @see {@link TriggerNode#rootLocalize} */
    rootLocalize(...args: LocalizeArgs): string | undefined;
}

type NodeFieldSchema = Record<string, z.core.JSONSchema.JSONSchema>;

export { NodeField };
export type { NodeFieldSchema };
