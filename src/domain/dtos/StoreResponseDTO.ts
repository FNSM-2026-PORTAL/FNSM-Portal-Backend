import {  Category, VenueType } from "../types/Bussiness";

export interface Store  {
    id: string;
    name: string;
    description: string;
    logo: string;
    payment_status: { 
        status: 'FREE_TIER' | 'PAID'; 
        isExpired: boolean;
        expiresAt?: string;
    },
    location: {
        lng: number;
        lat: number;
    };
    category: Category;
    venueType: VenueType;
}