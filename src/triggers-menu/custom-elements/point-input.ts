import { R } from "foundry-helpers";
import { createHTMLElement } from "foundry-helpers/src";

class PointInputElement extends foundry.applications.elements.AbstractFormInputElement<Point> {
    #id: string;
    #inputElements = {} as { x: HTMLInputElement; y: HTMLInputElement };
    #name: string;
    #step: number;

    static tagName: "point-input" = "point-input";

    constructor({ name, step, value }: { name: string; step: number; value: Point }) {
        super();

        this.#id = foundry.utils.randomID();
        this.#name = name;
        this.#step = step;

        this._setValue(value);
    }

    get name(): string {
        return this.#name;
    }

    set name(value: string) {
        this.#name = value;
    }

    protected _buildElements(): HTMLElement[] {
        const elements = R.flatMap(["x", "y"] as const, (key) => {
            const element = (this.#inputElements[key] = document.createElement("input"));

            element.name = key;
            element.type = "number";
            element.placeholder = String(this._value[key]);
            element.dataset.elementId = this.#id;
            element.classList.add(`key-${key}`);

            if (this.#step) {
                element.step = String(this.#step);
            }

            const label = createHTMLElement("label", {
                classes: [`key-${key}`],
                content: key,
            });

            return [element, label];
        });

        this._primaryInput = elements[0] as HTMLInputElement;

        return elements;
    }

    protected _toggleDisabled(disabled: boolean): void {
        for (const element of R.values(this.#inputElements)) {
            element.disabled = disabled;
        }
    }

    protected _refresh(): void {
        this.#inputElements.x.value = String(this._value.x);
        this.#inputElements.y.value = String(this._value.y);
    }

    _activateListeners(): void {
        for (const key of ["x", "y"] as const) {
            const element = this.#inputElements[key];

            element.addEventListener("blur", () => {
                this._value[key] = element.valueAsNumber;

                requestAnimationFrame(() => {
                    const focused = document.querySelector(":focus");
                    if (focused instanceof HTMLInputElement && focused.dataset.elementId === this.#id) return;
                    this.#blurOut();
                });
            });

            element.addEventListener("focus", () => {
                element.select();
            });

            element.addEventListener("keydown", (event) => {
                const eventKey = event.key;
                if (!R.isIncludedIn(eventKey, ["Enter", "Tab"] as const)) return;

                event.preventDefault();
                event.stopPropagation();

                if (eventKey === "Enter") {
                    this.#blurOut();
                } else if (eventKey === "Tab") {
                    const otherElement = this.#inputElements[key === "x" ? "y" : "x"];
                    otherElement.focus();
                }
            });
        }
    }

    #blurOut() {
        this.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
    }
}

interface PointInputElement {
    _primaryInput: HTMLInputElement;
}

export { PointInputElement };
