type Role = "admin" | "user";

export interface User {
    _id?: string;
    name: string;
    email: string;
    password: string;
    role: Role;
    createdAt: Date;
}
