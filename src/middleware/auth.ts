import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { mongoClient } from "../server";
import { ObjectId } from "mongodb";

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "Acceso denegado: token no proporcionado" });
        return;
    }
    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
            userId: string;
            role: string;
        };

        const collection = mongoClient.db("fnsm").collection("users");
        const userExists = await collection.findOne({ _id: new ObjectId(decoded.userId) });

        if (!userExists) {
            res.status(401).json({ message: "El usuario ya no existe" });
            return;
        }

        req.user = decoded;
        next();

    } catch (error) {
        res.status(401).json({ message: "Token inválido o expirado" });
    }
}
