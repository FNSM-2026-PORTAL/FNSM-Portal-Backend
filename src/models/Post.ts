import { ObjectId } from "mongodb";

export interface Reaction {
    type: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    count: number;
    userIds: string[];
}

export interface Comment {
    _id?: ObjectId;
    authorId: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    authorImage?: string;
    authorPlan: "free" | "plata" | "oro";
    text: string;
    createdAt: Date;
}

export interface Post {
    _id?: ObjectId;
    authorId: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    authorImage?: string;
    authorPlan: "free" | "plata" | "oro";
    content: string;
    image?: string;
    likes: string[];
    reactions: Reaction[];
    comments: Comment[];
    createdAt: Date;
}
