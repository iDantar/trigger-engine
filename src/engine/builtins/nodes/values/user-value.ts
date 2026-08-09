import { BuiltinsInputEntry, BuiltinsOutputEntry, SelectField, SelectFieldOption } from "engine";
import { BaseValueNode } from ".";

class UserValueNode extends BaseValueNode<User | undefined, Inputs> {
    static get type(): "user-value" {
        return "user-value";
    }

    static get tags(): string[] {
        return ["user"];
    }

    static get defineInputs(): [BuiltinsInputEntry] {
        const options: SelectField["options"] = [
            { value: "__context-user__", group: "specials" },
            "__self-user__",
            "__active-gm__",
            ...game.users.map((user, index): SelectFieldOption => {
                return { value: user.id, label: user.name, group: index === 0 ? "users" : undefined };
            }),
        ];

        return [
            {
                key: "id",
                type: "text",
                tooltip: false,
                field: {
                    options,
                    type: "select",
                },
            },
        ];
    }

    static get defineOutputs(): [BuiltinsOutputEntry] {
        return [{ key: "user", type: "user" }];
    }

    async _getValue(): Promise<User | undefined> {
        const id = await this.getInputValue("id");

        switch (id) {
            case "__active-gm__":
                return game.users.activeGM ?? undefined;
            case "__context-user__":
                return this.userContext;
            case "__self-user__":
                return game.user;
            default:
                return game.users.get(id);
        }
    }
}

type Inputs = {
    id: "__context-user__" | "__self-user__" | "__active-gm__" | (string & {});
};

export { UserValueNode };
