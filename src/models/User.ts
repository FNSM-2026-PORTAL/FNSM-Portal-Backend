import { ObjectId } from "mongodb";

type Role = "admin" | "user" | "seller";

export type PackId = "juegos" | "toros" | "conciertos";

export const ALL_PACKS: PackId[] = ["juegos", "toros", "conciertos"];

export interface User {
    _id?: ObjectId;
    name: string;
    email: string;
    password: string;
    role: Role;
    createdAt: Date;
    profileImage?: string;
    resetCode?: string;
    resetCodeExpires?: Date;
    plan?: "free" | "plata" | "oro";
    hasLifetimeAccess?: boolean;
    ownedPacks?: PackId[];
    equippedPack?: PackId | null;
}
