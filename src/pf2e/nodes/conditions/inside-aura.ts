import { BaseConditionNodeWithAfter } from "engine";
import { actorsRespectAlliance, localize } from "foundry-helpers";
import { BaseAuraEvent, PF2eInputEntry, PF2eOutputEntry, getAurasInMemory } from "pf2e";

class InsideAuraConditionNode extends BaseConditionNodeWithAfter<Inputs, Outputs> {
    static get type(): "inside-aura" {
        return "inside-aura";
    }

    static get tags(): string[] {
        return ["aura", "loop"];
    }

    static get defineInputs(): PF2eInputEntry[] {
        return [
            { key: "target", type: "target" },
            ...BaseAuraEvent.defineInputs.slice(0, 2),
            {
                key: "self",
                type: "boolean",
                label: localize.path("pf2e-trigger.shared.aura.origin.title"),
            },
        ];
    }

    static get defineOutputs(): PF2eOutputEntry[] {
        return [...BaseConditionNodeWithAfter.defineOutputs, BaseAuraEvent.defineOutputs[1]];
    }

    get isLoop(): boolean {
        return true;
    }

    async _execute(): Promise<boolean> {
        const target = await this.getInputValue("target");
        const slug = await this.getInputValue("slug");

        if (!target || !slug) {
            return this.excuteFalse();
        }

        const affects = await this.getInputValue("affects");
        const self = await this.getInputValue("self");
        const targetUUID = target.actor.uuid;

        const auras = getAurasInMemory(target.actor).filter(({ data, origin }) => {
            if (data.slug !== slug) return false;
            if (origin.actor.uuid === targetUUID) return self;
            return actorsRespectAlliance(origin.actor, target.actor, affects);
        });

        if (!auras.length) {
            return this.excuteFalse();
        }

        for (const { origin } of auras) {
            this.setOutputValue("source", origin);

            const keepExecuting = await this.execute("true");
            if (!keepExecuting) break;
        }

        return this.executeNext("after");
    }
}

type Inputs = {
    affects: "all" | "allies" | "enemies";
    self: boolean;
    slug: string;
    target?: TargetDocuments;
};

type Outputs = {
    boolean: boolean;
    source?: TargetDocuments;
};

export { InsideAuraConditionNode };
