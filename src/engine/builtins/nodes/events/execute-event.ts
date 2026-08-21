import { IconObject } from "_zod";
import { BaseEventNode, BuiltinsCustomEntry, ExecuteEventOptions } from "engine";

class ExecuteEvent extends BaseEventNode<never, never, "output"> {
    static get type(): "execute-event" {
        return "execute-event";
    }

    static get tags(): string[] {
        return ["macro"];
    }

    static get defineCustomOutputs(): BuiltinsCustomEntry[] {
        return [{ array: true, slug: "output" }];
    }

    get icon(): IconObject {
        return { unicode: "\uf144" };
    }

    async _execute({ converted, sceneId, userId, values }: ExecuteEventOptions): Promise<boolean> {
        const parsed = converted ? await this.convertValuesFomEmitable(values) : values;

        const user = userId ? game.users.get(userId) : undefined;
        if (user) {
            this.userContext = user;
        }

        const scene = sceneId ? game.scenes.get(sceneId) : undefined;
        if (scene) {
            this.sceneContext = scene;
        }

        this.setCustomOutputValues("output", parsed);
        return this.executeNext("out");
    }
}

export { ExecuteEvent };
