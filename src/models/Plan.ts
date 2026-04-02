import { ObjectId } from "mongodb";

export interface Plan {
    _id?: ObjectId;
    authorId: string;
    authorName: string;
    name: string;
    style: 1 | 2 | 3;
    activityCount: number;
    activities: string[];
    date: string;
    time: string;
    location: string;
    recommendation?: string;
    createdAt: Date;
}
