import { DeleteStatement, ObjectId } from "mongodb";
import { BussinessCategory, PaymentStatus } from "../domain/types/Bussiness";


export interface Store  {
    _id?: ObjectId;
    name: string;
    description: string;
    logo: string;
    payment_status: PaymentStatus; 
    location: {
        type: "Point";
        coordinates: [ number, number ]; 
    };
    category: BussinessCategory;

}