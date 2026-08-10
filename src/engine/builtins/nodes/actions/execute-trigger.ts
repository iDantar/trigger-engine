import { BuiltinsCustomEntry, BuiltinsInputEntry } from "engine";
import { BaseActionNode } from ".";
import { IconObject } from "_zod";

class ExecuteTriggerActionNode extends BaseActionNode<"out", Inputs, never, "input"> {
    static get type(): "execute-trigger" {
        return "execute-trigger";
    }

    get specialIcons(): { icon: IconObject; name?: string }[] | null {
        return [{ icon: { unicode: "\uf071", fontWeight: "900" }, name: "warning" }];
    }

    static get defineOuts(): null {
        return null;
    }

    static get defineInputs(): BuiltinsInputEntry[] {
        return [{ key: "path", type: "text" }];
    }

    static get defineCustomInputs(): BuiltinsCustomEntry[] {
        return [{ slug: "input", array: true }];
    }

    get headerColor(): ColorSource {
        return "#C40000";
    }

    get icon(): IconObject {
        return { unicode: "\uf2f6" };
    }

    async _execute(): Promise<boolean> {
        const path = await this.getInputValue("path");

        if (path === this.triggerPath) {
            return true;
        }

        const values = await this.getCustomInputs("input");

        game.triggerEngine!.execute(path, values);

        return this.executeNext("out");
    }
}

type Inputs = {
    path: `${string}:${string}:${string}`;
};

export { ExecuteTriggerActionNode };
