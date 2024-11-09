import { Reservation } from '../domains/Reservation';

export interface GetRoomInterfaceUseCase {
    getComponents(roomId: string, date: Date): Promise<Reservation[]>;
}