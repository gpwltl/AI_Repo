"use client"

import * as React from "react"
import { Calendar, Search, MessageCircle } from "lucide-react"

import { Button } from "@/src/components/button"
import { Calendar as CalendarComponent } from "@/src/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/alert-dialog"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/src/components/hover-card"

interface Reservation {
  time: string;
  name: string;
}

type Reservations = {
  [key: number]: Reservation[];
}

// Sample reservation data
const reservations = {
  1: [{ time: "10:00", name: "김철수" }],
  4: [{ time: "14:00", name: "이영희" }],
  5: [{ time: "15:00", name: "박지성" }],
  6: [{ time: "11:00", name: "손흥민" }],
}

export function RoomReservation() {
  const [date, setDate] = React.useState<Date>()
  const [timeSlot, setTimeSlot] = React.useState<string>()
  const [selectedRoom, setSelectedRoom] = React.useState<number | null>(null)
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 })

  const today = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const timeSlots = Array.from({ length: 9 }, (_, i) => `${i + 9}:00`)

  const handleSearch = () => {
    console.log("Searching for:", { date, timeSlot })
  }

  const handleRoomClick = (roomNumber: number) => {
    setSelectedRoom(roomNumber)
  }

  const handleReservation = () => {
    console.log(`Room ${selectedRoom} reserved for ${date?.toLocaleDateString()} at ${timeSlot}`)
    setSelectedRoom(null)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    setMousePosition({ x: event.clientX, y: event.clientY })
  }

  return (
    <div className="min-h-screen bg-[#3b547b]/5">
      <div className="container mx-auto p-6">
        <div className="mb-8 rounded-lg bg-white p-4 shadow-md">
          <div className="grid gap-4 md:grid-cols-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? date.toLocaleDateString() : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger>
                <SelectValue placeholder="시간대 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="09:00">09:00 - 10:00</SelectItem>
                <SelectItem value="10:00">10:00 - 11:00</SelectItem>
                <SelectItem value="11:00">11:00 - 12:00</SelectItem>
                <SelectItem value="13:00">13:00 - 14:00</SelectItem>
                <SelectItem value="14:00">14:00 - 15:00</SelectItem>
                <SelectItem value="15:00">15:00 - 16:00</SelectItem>
                <SelectItem value="16:00">16:00 - 17:00</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleSearch}
              className="bg-[#3b547b] text-white hover:bg-[#3b547b]/90"
            >
              <Search className="mr-2 h-4 w-4" />
              검색
            </Button>
          </div>
        </div>

        <div className="relative mx-auto max-w-4xl rounded-lg border-2 border-[#3b547b] p-4">
          <div className="aspect-[2/1] w-full" onMouseMove={handleMouseMove}>
            {/* Rooms */}
            <HoverCard openDelay={0} closeDelay={0}>
              <HoverCardTrigger>
                <Room number={1} available onClick={() => handleRoomClick(1)} className="absolute left-[12%] top-[2%] h-[30%] w-[15%]" />
              </HoverCardTrigger>
              <HoverCardContent 
                className="w-80"
                style={{
                  position: 'fixed',
                  left: `${mousePosition.x + 10}px`,
                  top: `${mousePosition.y + 10}px`,
                }}
              >
                <TimeTable roomNumber={1} />
              </HoverCardContent>
            </HoverCard>

            <Room number={2} disabled className="absolute left-[25%] top-[2%] h-[30%] w-[15%]" />
            <Room number={3} disabled className="absolute left-[40%] top-[2%] h-[30%] w-[15%]" />

            <HoverCard openDelay={0} closeDelay={0}>
              <HoverCardTrigger>
                <Room number={4} available onClick={() => handleRoomClick(4)} className="absolute left-[55%] top-[2%] h-[30%] w-[15%]" />
              </HoverCardTrigger>
              <HoverCardContent 
                className="w-80"
                style={{
                  position: 'fixed',
                  left: `${mousePosition.x + 10}px`,
                  top: `${mousePosition.y + 10}px`,
                }}
              >
                <TimeTable roomNumber={4} />
              </HoverCardContent>
            </HoverCard>

            <HoverCard openDelay={0} closeDelay={0}>
              <HoverCardTrigger>
                <Room number={5} available onClick={() => handleRoomClick(5)} className="absolute left-[70%] top-[2%] h-[30%] w-[15%]" />
              </HoverCardTrigger>
              <HoverCardContent 
                className="w-80"
                style={{
                  position: 'fixed',
                  left: `${mousePosition.x + 10}px`,
                  top: `${mousePosition.y + 10}px`,
                }}
              >
                <TimeTable roomNumber={5} />
              </HoverCardContent>
            </HoverCard>

            <HoverCard openDelay={0} closeDelay={0}>
              <HoverCardTrigger>
                <Room number={6} available onClick={() => handleRoomClick(6)} className="absolute bottom-[2%] right-[2%] h-[50%] w-[20%]" />
              </HoverCardTrigger>
              <HoverCardContent 
                className="w-80"
                style={{
                  position: 'fixed',
                  left: `${mousePosition.x + 10}px`,
                  top: `${mousePosition.y + 10}px`,
                }}
              >
                <TimeTable roomNumber={6} />
              </HoverCardContent>
            </HoverCard>

            {/* Other Elements */}
            <div className="absolute bottom-[40%] left-[45%] text-sm text-[#3b547b]">
              더블어숲
            </div>
            <div className="absolute right-[2%] top-[2%] text-sm text-[#3b547b]">
              계단
            </div>
            <div className="absolute bottom-[50%] left-[5%] text-sm text-[#3b547b]">
              앞문
            </div>
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-[10%] left-[5%] bg-[#3b547b] text-white hover:bg-[#3b547b]/90"
              aria-label="채팅"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <AlertDialog open={selectedRoom !== null} onOpenChange={() => setSelectedRoom(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>토론방 {selectedRoom} 예약</AlertDialogTitle>
              <AlertDialogDescription>
                {date && timeSlot
                  ? `${date.toLocaleDateString()}에 ${timeSlot} 시간대로 토론방 ${selectedRoom}을 예약하시겠습니까?`
                  : "날짜와 시간을 선택해주세요."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleReservation} disabled={!date || !timeSlot}>
                예약
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function TimeTable({ roomNumber }: { roomNumber: number }) {
  const today = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const timeSlots = Array.from({ length: 9 }, (_, i) => `${i + 9}:00`)

  const isReserved = (time: string) => {
    return (reservations as Reservations)[roomNumber]?.some(r => r.time === time)
  }

  return (
    <div className="p-2">
      <div className="mb-2 text-sm font-medium">
        {`${today.getMonth() + 1}월 ${today.getDate()}일 (${days[today.getDay()]}) 토론방 ${roomNumber}`}
      </div>
      <div className="space-y-2">
        {timeSlots.map((time) => (
          <div
            key={time}
            className={`flex items-center rounded-sm p-1 text-sm
              ${isReserved(time) ? 'bg-[#3b547b]/20' : 'bg-gray-50'}
            `}
          >
            <span className="w-16">{time}</span>
            <span className="flex-1 text-right">
              {isReserved(time) ? 
                (reservations as Reservations)[roomNumber].find((r: Reservation) => r.time === time)?.name 
                : '예약가능'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Room({
  number,
  disabled = false,
  available = false,
  onClick,
  className = "",
}: {
  number: number
  disabled?: boolean
  available?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <div
      onClick={available ? onClick : undefined}
      className={`border-2 text-center text-sm flex items-center justify-center ${className}
        ${
          disabled
            ? "border-gray-300 bg-gray-100 text-gray-500"
            : available
            ? "border-[#3b547b] bg-[#3b547b] text-white cursor-pointer hover:bg-[#3b547b]/90"
            : "border-[#3b547b]/20 bg-white text-[#3b547b]"
        }
      `}
    >
      토론방 {number}
    </div>
  )
}

export default RoomReservation;