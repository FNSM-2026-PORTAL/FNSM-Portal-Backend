import { ObjectId } from "mongodb";

type Role = "admin" | "user";

export interface User {
    _id?: ObjectId;
    name: string;
    email: string;
    password: string;
    role: Role;
    createdAt: Date;
}
