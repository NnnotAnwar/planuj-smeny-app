// export default function LocationPopup() {

//     return (
//         <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity'>
//             <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md transform transition-all">
//                 {isChangedLocation ? (
//                     <h2 className="text-2xl font-bold text-amber-600 mb-4">Change Your Location Shift to </h2>
//                 ) : (
//                     <h2 className="text-2xl font-bold text-emerald-600 mb-4">Confirm Location Shift as </h2>
//                 )}
//                 <h3 className="text-lg font-semibold text-gray-700">{location?.name}</h3>
//                 <div className="flex justify-end space-x-3 mt-6">
//                     <button
//                         onClick={() => {
//                             setIsLocationPopupOpen(false)
//                         }}
//                         className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
//                     >
//                         Cancel
//                     </button>
//                     <button
//                         className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
//                         onClick={() => {
//                             setSelectedLocationId(location?.id || null)
//                             setIsLocationPopupOpen(false)
//                         }}
//                     >
//                         Yes
//                     </button>
//                 </div>
//             </div>
//         </div>
//     )
// }