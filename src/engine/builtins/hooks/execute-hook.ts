import { TriggerHook, TriggerPath, UserValue, getTriggerPathData } from "engine";
import { R } from "foundry-helpers";

class ExecuteHook extends TriggerHook<ExecuteEventOptions> {
    static executePath = "game.triggerEngine.execute";

    static get type(): "execute-hook" {
        return "execute-hook";
    }

    get events(): ["execute-event"] {
        return ["execute-event"];
    }

    get gmOnly(): boolean {
        return false;
    }

    _enable(): void {
        foundry.utils.setProperty(globalThis, ExecuteHook.executePath, this.#execute.bind(this));
    }

    _disable(): void {
        foundry.utils.setProperty(globalThis, ExecuteHook.executePath, () => {});
    }

    #execute(triggerPath: TriggerPath, values: UserValue[], userContext?: User | string) {
        const { applicationKey, triggerId } = getTriggerPathData(triggerPath);
        if (this.applicationKey !== applicationKey) return;

        const userId = userContext instanceof User ? userContext.id : R.isString(userContext) ? userContext : undefined;

        if (game.user.isActiveGM) {
            this.executeTriggerEvent(triggerId, "execute-event", {
                userId,
                values: this.parseUserValues(values).map((x) => x?.value),
            } satisfies ExecuteEventOptions);
        } else {
            this.executeTriggerEventAsGM(triggerId, "execute-event", {
                converted: true,
                userId,
                values: this.convertValuesToEmitable(values, true),
            } satisfies ExecuteEventOptions);
        }
    }
}

type ExecuteEventOptions = {
    converted?: boolean;
    values: (UserValue | undefined)[];
    userId: string | undefined;
};

export { ExecuteHook };
export type { ExecuteEventOptions };
