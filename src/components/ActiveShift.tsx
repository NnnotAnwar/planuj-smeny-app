import type { Shift } from "../types/types"

interface ActiveShiftProbs {
    activeShift: Shift | null
}

export default function ActiveShift({ activeShift }: ActiveShiftProbs) {


    const shiftMessage = activeShift
        ? `Active Shift: ${new Date(activeShift.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : 'No Active Shift'

    const bgColor = !activeShift
        ? 'bg-gray-300 text-black justify-center'
        : 'bg-emerald-200 text-emerald-800'

    return (
        <div className="mb-3 lg:mb-0 justify-items-center">
            {/* <p className="text-sm font-semibold text-gray-700 justify-self-start">
                    {user.first_name}{user.last_name ? ' ' + user.last_name : ''}, {user.role}:
                  </p> */}
            <p className={`flex gap-1.5 p-1.5 px-3 text-sm ${bgColor} items-center shadow-sm w-auto justify-around rounded-4xl mt-1`}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className='w-4 h-4 inline'
                >
                    <path
                        fillRule="evenodd"
                        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .241.096.472.267.643l4.5 4.5a.75.75 0 001.06-1.06l-4.077-4.077V6z"
                        clipRule="evenodd"
                    />
                </svg>
                <span>
                    {shiftMessage}
                </span>
            </p>
        </div>
    )
}