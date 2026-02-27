import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import Dashboard from "./components/Dashboard";
import ShiftCards from "./components/ShiftCards";
import LocationPopup from "./components/LocationPopup";
import LocationSelection from "./components/LocationSelection";
import CheckIn from "./components/CheckIn";
import {
  type Location,
  type User,
  type Shift,
  type ShiftDisplayData,
} from "./types/types";
import { supabase } from "../supabaseClient";
import ActiveShift from "./components/ActiveShift";
import Clock from "./components/Clock";

export default function App() {
  const navigate = useNavigate();

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User>({
    id: "",
    username: "Unknown User",
    role: "",
    organization_id: "",
  });
  const [allActiveShifts, setAllActiveShifts] = useState<Shift[]>([]);

  useEffect(() => {
    const initData = async () => {
      try {
        setIsLoading(true);
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          navigate("/login", { replace: true });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, first_name, last_name, role, organization_id")
          .eq("id", session.user.id)
          .single();

        if (profileError || !profile) {
          console.error("Error fetching profile:", profileError?.message);
          return;
        }

        const userData: User = {
          id: profile.id,
          username: profile.username,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: profile.role,
          organization_id: profile.organization_id,
        };
        setUser(userData);

        const [
          { data: currentShift, error: shiftError },
          { data: locs, error: locsError },
          { data: activeShiftsData, error: activeShiftsError },
        ] = await Promise.all([
          supabase
            .from("shifts")
            .select("*")
            .eq("user_id", session.user.id)
            .is("ended_at", null)
            .maybeSingle(),
          supabase
            .from("locations")
            .select("*")
            .eq("organization_id", profile.organization_id),
          supabase
            .from("shifts")
            .select("*, profiles(username, first_name, last_name)")
            .eq("organization_id", profile.organization_id)
            .is("ended_at", null),
        ]);

        // Логируем ошибки, если какой-то из запросов упал
        if (shiftError)
          console.error("Error fetching current shift:", shiftError.message);
        if (locsError)
          console.error("Error fetching locations:", locsError.message);
        if (activeShiftsError)
          console.error(
            "Error fetching active shifts:",
            activeShiftsError.message,
          );

        // 3. Распределяем данные по стейтам
        if (currentShift) {
          setActiveShift(currentShift);
          setSelectedLocationId(currentShift.location_id);
        }

        if (locs) {
          setLocations(
            locs.map((l) => ({ id: l.id, name: l.name, shifts: [] })),
          );
        }

        if (activeShiftsData) {
          setAllActiveShifts(activeShiftsData);
        }
      } catch (err) {
        console.error("Unexpected error during initData:", err);
      } finally {
        // Гарантированно выключаем спиннеры загрузки, даже если была ошибка
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    };

    initData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          navigate("/login", { replace: true });
        }
      },
    );

    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user.organization_id) return;

    const channel = supabase
      .channel("realtime_shifts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shifts",
          filter: `organization_id=eq.${user.organization_id}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data: newShift } = await supabase
              .from("shifts")
              .select("*, profiles(username, first_name, last_name)")
              .eq("id", payload.new.id)
              .single();

            if (newShift) {
              setAllActiveShifts((prev) => [...prev, newShift]);
            }
          } else if (payload.eventType === "UPDATE") {
            if (payload.new.ended_at) {
              setAllActiveShifts((prev) =>
                prev.filter((s) => s.id !== payload.new.id),
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.organization_id]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate("/login", { replace: true });
    } else {
      console.error("Error logging out:", error.message);
    }
  };

  const handleLocationSelect = (locationId: string | null) => {
    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;
    if (locationId === selectedLocationId && activeShift) {
      setIsLocationPopupOpen(true);
      return;
    }
    setPendingLocation(selected);
    setIsLocationPopupOpen(true);
  };

  const handleStartShift = async () => {
    if (!selectedLocationId || !user) return;

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data, error } = await supabase
      .from("shifts")
      .insert({
        user_id: authUser.id,
        location_id: selectedLocationId,
        organization_id: user.organization_id,
        started_at: new Date().toISOString(),
        role: user.role,
      })
      .select()
      .single();

    if (data) {
      setActiveShift(data);
    } else if (error) {
      console.error("Error starting shift:", error.message);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    const { data, error } = await supabase
      .from("shifts")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", activeShift.id)
      .select()
      .single();

    if (data) {
      setActiveShift(null);
      setSelectedLocationId(null);
    } else if (error) {
      console.error("Error ending shift:", error.message);
    }
  };

  if (isLoading || isAuthChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-50 font-sans md:flex md:flex-row">
      <Dashboard
        user={user}
        locations={locations}
        selectedLocationId={selectedLocationId}
        onLocationSelect={handleLocationSelect}
        onLogout={handleLogout}
      />
      <main className="w-full max-w-7xl p-3 pb-32 md:w-2/3 lg:w-3/4">
        <p className="mb-6 hidden text-center text-xl font-bold md:block">
          <Clock seconds={true} />
        </p>

        {/* 1. Desktop & Mobile Status Card */}
        <ActiveShift
          activeShift={activeShift}
          onEndShift={handleEndShift}
          userName={`${user.first_name} ${user.last_name || ''}`.trim() || user.username}
          userRole={user.role}
          locationName={locations.find(l => l.id === activeShift?.location_id)?.name || 'Unknown Location'}
        />

        {/* 2. Mobile ONLY: Sticky bottom "End Shift" button */}
        {/* It only shows when shift is active, and hides on desktop (md:hidden) */}
        {activeShift && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden pb-safe">
            <button
              onClick={handleEndShift}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-8 py-4 text-lg font-bold text-white shadow-sm transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
              </svg>
              End Shift
            </button>
          </div>
        )}

        {/* 3. Show Start Shift CheckIn ONLY if there is NO active shift */}
        {!activeShift && (
          <CheckIn
            selectedLocationId={selectedLocationId}
            isShiftRunning={false}
            handleStartShift={handleStartShift}
            handleEndShift={handleEndShift}
          />
        )}

        <div className="md:hidden">
          <LocationSelection
            locations={locations}
            selectedLocationId={selectedLocationId}
            onLocationSelect={handleLocationSelect}
          />
        </div>
        <div className="space-y-4">
          {locations.map((location) => {
            const userFullName =
              `${user.first_name} ${user.last_name || ""}`.trim() ||
              "Unknown User";

            const colleaguesInLocation: ShiftDisplayData[] = allActiveShifts
              .filter(
                (s) => s.location_id === location.id && s.user_id !== user.id,
              )
              .map((s) => ({
                id: s.id,
                start: new Date(s.started_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                name: `${s.profiles?.first_name || "Employee"} ${s.profiles?.last_name || ""}`.trim(),
                role: s.role,
                end: null,
              }));

            const currentUserShiftData: ShiftDisplayData | undefined =
              activeShift && location.id === selectedLocationId
                ? {
                  name: userFullName,
                  role: user.role,
                  start: new Date(activeShift.started_at).toLocaleTimeString(
                    "en-GB",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  ),
                  end: null,
                  isChangeLocation: false,
                }
                : undefined;

            return (
              <section key={location.id}>
                <ShiftCards
                  locationName={location.name}
                  shifts={colleaguesInLocation}
                  userShift={currentUserShiftData}
                />
              </section>
            );
          })}
        </div>
      </main>

      {isLocationPopupOpen && pendingLocation && (
        <LocationPopup
          isChangedLocation={{
            selectedLocationId,
            pendingLocationId: pendingLocation.id,
          }}
          location={pendingLocation}
          setIsLocationPopupOpen={setIsLocationPopupOpen}
          setSelectedLocationId={setSelectedLocationId}
          handleChangeLocation={() => { }}
        />
      )}
    </div>
  );
}
