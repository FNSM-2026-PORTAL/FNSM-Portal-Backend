import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mongoClient } from "../server";
import { User } from "../models/User";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { ObjectId } from "mongodb";

const router = Router();

const getCollection = () => {
    return mongoClient.db("fnsm").collection<User>("users");
}


router.post("/register", async (req: Request, res: Response) => {
    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
            return;
        }

        const collection = getCollection();

        const existingUser = await collection.findOne({ email: email });
        if (existingUser) {
            res.status(409).json({ message: "Ya existe una cuenta con ese email" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser: User = {
            name,
            email,
            password: hashedPassword,
            role: "user",
            createdAt: new Date(),
        };

        const result = await collection.insertOne(newUser);

        const token = jwt.sign(
            { userId: result.insertedId, role: newUser.role },
            process.env.JWT_SECRET as string,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            message: "Cuenta creada exitosamente",
            token,
            user: {
                id: result.insertedId,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
            },
        });

    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ message: "Email y contraseña son requeridos" });
            return;
        }

        const collection = getCollection();

        const user = await collection.findOne({ email: email });

        if (!user) {
            res.status(401).json({ message: "Credenciales inválidas" });
            return;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ message: "Credenciales inválidas" });
            return;
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            message: "Sesión iniciada correctamente",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});


router.get("/me", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        
        if (!userId) {
            res.status(401).json({ message: "Usuario no autenticado" });
            return;
        }

        const collection = getCollection();
        const user = await collection.findOne({ _id: new ObjectId(userId) });

        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });
    } catch (error) {
        console.error("Error al obtener perfil:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

export default router;
