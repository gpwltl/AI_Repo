export interface IReservation {
    id: number;
    userId: number;
    roomId: number;
    startTime: Date;
    endTime: Date;
    status: number;
    regdate: Date;
}

export interface IAvailableRoom {
    roomId: number;
    isAvailable: boolean;
    conflictingReservations?: IReservation[];
} 