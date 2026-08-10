import { NodeFieldSchema } from "engine";
import { R, createHTMLElement, foundryLocalizeIfExist, htmlQuery } from "foundry-helpers";
import { SearchSelectInputElement } from "triggers-menu";
import { InputField } from ".";
import { TextEntry } from "../text";
import elements = foundry.applications.elements;

const NODE_INPUT_CODE_TYPES = ["javascript", "json"] as const;
const NODE_INPUT_TEXT_TYPES = ["enriched", "select", ...NODE_INPUT_CODE_TYPES] as const;

class TextField extends InputField<string, TextFieldSchema> {
    #toDisplay?: string;

    static get defineSchema(): NodeFieldSchema {
        return {
            connector: {
                default: true,
                type: "boolean",
            },
            default: { type: "string" },
            options: {
                type: "array",
                items: {
                    anyOf: [
                        { type: "string" },
                        {
                            type: "object",
                            properties: {
                                group: { type: "string" },
                                label: { type: "string" },
                                value: { type: "string" },
                            },
                            required: ["value"],
                        },
                    ],
                },
            },
            trim: {
                default: true,
                type: "boolean",
            },
            type: {
                type: "string",
                enum: NODE_INPUT_TEXT_TYPES as any,
            },
            width: {
                default: 140,
                type: "number",
            },
        };
    }

    get isNumberValue(): boolean {
        return false;
    }

    get cursor(): PIXI.Cursor {
        return this.isSelect ? "pointer" : "text";
    }

    get fontSize(): number {
        return this.baseFontSize * 0.86;
    }

    get width(): number {
        return this.field.width;
    }

    get innerWidth(): number {
        return super.innerWidth - (this.isSelect ? this.decoratorWidth : 0);
    }

    get decoratorWidth(): number {
        return 16;
    }

    get options(): SelectFieldOption[] {
        return this.entry.options;
    }

    get isSimpleInput(): boolean {
        return !this.field.type;
    }

    get isSelect(): boolean {
        return this.entry.isSelect;
    }

    get isEnrichedInput(): boolean {
        return this.entry.isEnrichedInput;
    }

    get isJavascript() {
        return this.entry.isJavascript;
    }

    get isJSONInput(): boolean {
        return this.entry.isJSONInput;
    }

    get targetFontSize(): number {
        return this.isSelect || this.isSimpleInput ? super.targetFontSize : 15;
    }

    get targetHeight(): number {
        return this.isSelect || this.isSimpleInput ? super.targetHeight : 400;
    }

    get targetWidth(): number {
        return this.isJavascript ? 540 : 400;
    }

    get transitionTime(): number {
        return this.isSimpleInput ? super.transitionTime : 250;
    }

    get toDisplay(): string {
        return (this.#toDisplay ??= (() => {
            if ((this.isJSONInput || this.isJavascript) && this.value === this.default) {
                return "";
            }

            if (this.isSelect) {
                const option = this.options.find((option) => option.value === this.value);
                return option ? this.localizeOption(option) : this.value;
            }

            return this.isSimpleInput
                ? this.value
                : this.isEnrichedInput
                  ? this.value.replace(/\<\/?p\>/g, " ").trim()
                  : this.value.replace(/\s{1,}|\\n/g, this.field.type === "json" ? "" : " ");
        })());
    }

    get valueAlpha(): number {
        return this.isSelect ? 1 : super.valueAlpha;
    }

    localizeOptionOrGroupValue(value: string): string | undefined {
        return this.localize(this.entry.category, this.entry.slug ?? this.entry.key, "options", value);
    }

    localizeOption({ value, label }: { value: string; label?: string }): string {
        return R.isString(label) ? game.i18n.localize(label) : (this.localizeOptionOrGroupValue(value) ?? value);
    }

    draw(): void {
        super.draw();

        const label = this.label;
        const padding = this.innerPadding;
        const isSelect = this.isSelect;

        label.x = this.innerPadding;
        label.position.set(this.innerPadding, 0);
        label.style.fontSize = this.fontSize;
        label.style.lineHeight = this.lineHeight;

        if (isSelect) {
            const textWidth = this.width - this.decoratorWidth;

            label.alpha = this.isConnected ? 0.5 : 0;

            this.lineStyle({
                alpha: this.isConnected ? 0.5 : 1,
                color: this.borderColor,
                width: this.borderWidth,
            });

            // the demarcation
            this.moveTo(textWidth, 0);
            this.lineTo(textWidth, this.height);

            // the icon
            const highPoint = this.height / 3;
            const lowPoint = this.height * 0.66;
            const leftPoint = textWidth + this.decoratorWidth / 4;
            const rightPoint = textWidth + this.decoratorWidth * 0.75;
            const centerPoint = (leftPoint + rightPoint) / 2;

            this.lineStyle({
                alpha: this.isConnected ? 0.5 : 1,
                color: this.borderColor,
                width: 1,
            });

            this.moveTo(leftPoint, highPoint);
            this.lineTo(centerPoint, lowPoint);
            this.lineTo(rightPoint, highPoint);
        } else {
            label.alpha = this.isConnected || !this.toDisplay ? 0.5 : 0;
            this.addRectangleMask(label, 0, 0, this.width - padding * 2, this.height);
        }

        this.addChild(label);
    }

    createInput(): HTMLInputElement {
        if (this.isSelect && this.options.length) {
            const options: WithRequired<SelectFieldOption, "label">[] = R.map(this.options, (option) => {
                const group = option.group
                    ? (this.localizeOptionOrGroupValue(option.group) ??
                      foundryLocalizeIfExist(option.group) ??
                      option.group)
                    : undefined;

                return {
                    value: option.value,
                    label: this.localizeOption(option),
                    group,
                };
            });

            return new SearchSelectInputElement({ options, value: this.value }) as any;
        }

        if (this.isEnrichedInput) {
            return elements.HTMLProseMirrorElement.create({
                collaborate: false,
                compact: true,
                name: "field",
                toggled: false,
                value: this.value,
            }) as any;
        }

        if (R.isIncludedIn(this.field.type, ["javascript", "json"] as const)) {
            return foundry.applications.elements.HTMLCodeMirrorElement.create({
                language: this.field.type,
                name: "field",
                value: this.value,
            }) as any;
        }

        return foundry.applications.fields.createTextInput({
            name: "field",
            placeholder: this.label.text,
            value: this.value,
        });
    }

    afterRender(input: HTMLInputElement | SearchSelectInputElement) {
        input.focus();
        input.classList.toggle("bottom-half", input.getBoundingClientRect().y > window.outerHeight / 2);
    }

    afterAnimation(input: HTMLInputElement | SearchSelectInputElement): void {
        if (input instanceof SearchSelectInputElement) {
            input.expand();
        } else if (this.isSimpleInput) {
            input.select();
        } else {
            const selector = this.isEnrichedInput ? ".editor-content" : ".cm-content";
            const content = htmlQuery(input, selector);

            content?.focus();
        }

        if (this.isEnrichedInput) {
            const menu = htmlQuery(input, ".editor-menu");
            const btn = menu?.firstElementChild?.firstElementChild as HTMLElement | undefined;
            const span = btn?.firstElementChild as HTMLElement | undefined;

            if (menu && btn && span) {
                const icon = createHTMLElement("i", { classes: ["fa-solid", "fa-memo"] });
                menu.dataset.tooltipDirection = "UP";
                btn.dataset.tooltip = span.innerText;
                span.replaceWith(icon);
            }
        }
    }

    processReturnedValue(value: string): any {
        return value;
    }

    activateEventListeners(input: HTMLInputElement, returnValue: (value: any) => Promise<void>): void {
        if (this.isSelect) {
            const closeInput = (value: string) => {
                (input as unknown as SearchSelectInputElement).collapse();
                const processed = this.processReturnedValue(value);
                returnValue(processed);
            };

            input.addEventListener("change", () => {
                closeInput(input.value);
            });
            input.addEventListener("blur", () => {
                closeInput(this.value);
            });
        } else if (this.isSimpleInput) {
            super.activateEventListeners(input, returnValue);
        } else if (this.isEnrichedInput) {
            const onSave = () => {
                returnValue(input.value);
            };

            input.addEventListener("save", onSave, { once: true });

            input.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();

                    input.value = this.value;
                    input.removeEventListener("blur", onSave);
                    returnValue(this.value);
                }
            });
        } else {
            const onBlur = () => {
                // we wait one frame so the code-mirror #onBlur can happen before
                requestAnimationFrame(() => {
                    returnValue(input.value);
                });
            };

            const content = htmlQuery(input, ".cm-content");
            content?.addEventListener("blur", onBlur, { once: true });

            input.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();

                    content?.removeEventListener("blur", onBlur);

                    input.value = this.value;
                    returnValue(this.value);
                }
            });
        }
    }
}

interface TextField {
    get entry(): TextEntry;
}

type TextFieldSchemaType = (typeof NODE_INPUT_TEXT_TYPES)[number];

type TextFieldSchema = {
    connector: boolean;
    default?: string;
    options?: (SelectFieldOption | string)[] | ReadonlyArray<string>;
    trim: boolean;
    type?: TextFieldSchemaType;
    width: number;
};

type SelectFieldOption = { value: string; label?: string; group?: string };

export { TextField };
export type { SelectFieldOption, TextFieldSchema, TextFieldSchemaType };
