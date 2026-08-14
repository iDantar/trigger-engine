import { assignStyle, getInputValue, R, setStyleProperties } from "foundry-helpers";
import { BuiltInEntryField } from ".";

abstract class InputField<TValue extends unknown, TSchema extends Record<string, any>> extends BuiltInEntryField<
    TValue,
    TSchema
> {
    abstract get fontSize(): number;
    abstract get targetWidth(): number;
    abstract get toDisplay(): string;

    get cursor(): PIXI.Cursor {
        return "text";
    }

    get height(): number {
        return this.maxHeight;
    }

    get innerPadding(): number {
        return 4;
    }

    get innerWidth(): number {
        return this.width - this.innerPadding * 2;
    }

    get lineHeight(): number {
        return this.height - 1;
    }

    get targetHeight(): number {
        return 40;
    }

    get targetFontSize(): number {
        return 25.17;
    }

    get transitionTime(): number {
        return 150;
    }

    get valueAlpha(): number {
        return this.value === this.default ? 0.5 : 1;
    }

    draw(): void {
        if (this.isConnected) {
            this.beginFill(this.backgroundColor);
        } else {
            const valueElement = this.createPreciseText(this.toDisplay, {
                fontSize: this.fontSize,
                lineHeight: this.lineHeight,
            });

            valueElement.x = this.innerPadding;
            valueElement.alpha = this.valueAlpha;

            this.addRectangleMask(valueElement, 0, 0, this.innerWidth, this.height);
            this.addChild(valueElement);
        }

        this.lineStyle({ color: this.borderColor, width: this.borderWidth });
        this.drawRect(0, 0, this.width, this.height);

        this.endFill();
    }

    abstract createInput(): HTMLInputElement;
    abstract afterRender(input: HTMLInputElement | AbstractFormInputElement): void;
    abstract afterAnimation(input: HTMLInputElement | AbstractFormInputElement): void;

    onClick(): Promise<TValue> {
        const { center, width, height } = this.getGlobalBounds();
        const { targetFontSize, targetWidth, targetHeight, transitionTime } = this;
        const scale = targetHeight / height;

        const input = this.createInput();
        input.id = "trigger-engine-field";

        document.body.appendChild(input);

        setStyleProperties(input, {
            "--origin-font-size": `${targetFontSize / scale}px`,
            "--origin-width": `${width}px`,
            "--origin-height": `${height}px`,
            "--target-font-size": `${targetFontSize}px`,
            "--target-width": `${targetWidth}px`,
            "--target-height": `${targetHeight}px`,
            "--transition-time": `${transitionTime}ms`,
        });

        assignStyle(input, {
            left: `${center.x}px`,
            top: `${center.y}px`,
        });

        this.afterRender(input);

        input.classList.add("scale-to");
        setTimeout(() => {
            input.classList.add("scaled");
            this.afterAnimation(input);
        }, transitionTime);

        return new Promise((resolve) => {
            const returnValue = async (value: TValue) => {
                input.classList.remove("scaled");
                input.classList.remove("scale-to");
                setTimeout(() => {
                    input.remove();
                    resolve(value);
                }, transitionTime + 10);
            };

            this.activateEventListeners(input, returnValue);
        });
    }

    activateEventListeners(
        input: HTMLInputElement | AbstractFormInputElement,
        returnValue: (value: TValue) => Promise<void>,
    ): void {
        if (!(input instanceof HTMLInputElement)) return;

        const onBlur = () => {
            const value = getInputValue(input) as TValue;
            returnValue(value);
        };

        input.addEventListener("blur", onBlur, { once: true });

        input.addEventListener("keydown", (event) => {
            const key = event.key;
            if (!R.isIncludedIn(key, ["Enter", "Escape"] as const)) return;

            event.preventDefault();
            event.stopPropagation();

            if (key === "Enter") {
                input.blur();
            } else {
                input.value = String(this.value);
                input.removeEventListener("blur", onBlur);
                returnValue(this.value);
            }
        });
    }
}

type AbstractFormInputElement = foundry.applications.elements.AbstractFormInputElement<any>;

export { InputField };
