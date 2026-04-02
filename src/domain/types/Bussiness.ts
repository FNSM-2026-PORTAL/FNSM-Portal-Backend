export type PaymentStatus = {
    
    status: 'FREE_TIER' | 'PAID';
    expiresAt?: Date;
};

export type Category  =
| 'ALIMENTOS'
| 'BEBIDAS_Y_NOCHE' 
| 'COMERCIO' 
| 'ENTRETENIMIENTO' 
| 'SERVICIOS'
| 'CULTURA'
| 'COMPRAS';

export type  VenueType = 
| 'STAND'
| 'AMBULANTE' 
| 'LOCAL_FIJO' 
| 'MARCA_PREMIUM';

export type BussinessCategory = {
    category: Category;
    bussinesType: VenueType;
}