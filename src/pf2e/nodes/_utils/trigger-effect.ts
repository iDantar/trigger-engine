import { TriggerNode } from "engine";
import { joinListString } from "foundry-helpers";

async function getTriggerEffectData(this: TriggerNode<any, { identifier: string }>): Promise<TriggerEffectData> {
    const identifier = await this.getInputValue("identifier");
    const triggerPath = game.pf2e.system.sluggify(this.triggerPath);

    return {
        identifier,
        slug: joinListString([triggerPath, identifier], "-"),
    };
}

type TriggerEffectData = {
    identifier: string;
    slug: string;
};

export { getTriggerEffectData };
