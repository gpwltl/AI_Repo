export interface IReservationTool {
  checkAvailability(date: Date, startTime?: string, roomId?: number): Promise<{
    available: boolean;
    availableSlots: Array<{
      roomId: number;
      startTime: string;
      endTime: string;
    }>;
  }>;

  createReservation(data: {
    date: Date;
    startTime: string;
    duration: number;
    roomId: number;
    userName: string;
    content: string;
  }): Promise<boolean>;

  findNextAvailable(options: {
    timeRange: "morning" | "afternoon" | "all";
    preferredRoom?: number;
    startFrom: Date;
  }): Promise<{
    availableSlots: Array<{
      date: string;
      roomId: number;
      startTime: string;
      endTime: string;
    }>;
  }>;
} 