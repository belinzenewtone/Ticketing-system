import { type DefaultSession } from "next-auth";
import type { UserRole } from "@/types/database";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: UserRole;
        } & DefaultSession["user"];
    }

    interface User {
        role: UserRole;
    }
}

declare module "@auth/core/adapters" {
    interface AdapterUser {
        role: UserRole;
    }
}
