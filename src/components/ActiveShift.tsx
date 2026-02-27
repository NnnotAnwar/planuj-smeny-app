import type { Shift } from "../types/types"

interface ActiveShiftProbs {
    activeShift: Shift | null
}

export default function ActiveShift({ activeShift }: ActiveShiftProbs) {


    const shiftMessage = activeShift
        ? `Active Shift: ${new Date(activeShift.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : 'No Active Shift'

    const bgColor = !activeShift
        ? 'bg-gray-500/20 text-black'
        : 'bg-emerald-500/25 text-emerald-500'

    return (
        <div className="mb-3 justify-items-center ">
            {/* <p className="text-sm font-semibold text-gray-700 justify-self-start">
                    {user.first_name}{user.last_name ? ' ' + user.last_name : ''}, {user.role}:
                  </p> */}
            <div className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${bgColor}`}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 ${!activeShift && "animate-pulse"}`}
                >
                    <circle cx="12" cy="12" r="9" />

                    <path d="M12 7v5" />

                    <path
                        d={activeShift ? "M12 12v-5" : "M12 12h4"}
                        className={`origin-center ${activeShift && "animate-[spin_8s_steps(6)_infinite]"}`}
                    />
                </svg>
                <span className={`${!activeShift && "animate-pulse"}`}>
                    {shiftMessage}
                </span>
            </div>
        </div>
    )
}