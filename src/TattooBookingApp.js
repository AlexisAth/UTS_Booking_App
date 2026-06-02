import React, { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  Zap,
  Loader2,
  Mail,
  Phone,
  User,
  Maximize,
  Clock,
  UserCheck,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabaseClient";

// 1. Matches Dashboard: 12:30 to 22:00 in 15-minute segments
const HOURS_POOL = Array.from(
  { length: (22 * 60 - (12 * 60 + 30)) / 15 + 1 },
  (_, i) => {
    const totalMins = 12 * 60 + 30 + i * 15;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:00`;
  }
);

const TattooBookingDemo = () => {
  const [step, setStep] = useState(1);
  const [bookingPath, setBookingPath] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allBookings, setAllBookings] = useState([]);
  const [bookedAppointments, setBookedAppointments] = useState([]);

  // Lookup Table Database States
  const [styles, setStyles] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [artists, setArtists] = useState([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);

  const [booking, setBooking] = useState({
    style: "",
    placement: "Forearm",
    size: "",
    artist: "",
    date: "",
    time: "",
    color: false,
    customer_email: "",
    customer_phone: "",
  });

  // Fetch Lookups on Mount
  useEffect(() => {
    const fetchLookupTables = async () => {
      try {
        setIsLoadingLookups(true);

        // 1. Fetch Tattoo Styles
        const { data: stylesData, error: stylesError } = await supabase
          .from("LT_TATTOO_STYLES")
          .select("description")
          .order("id", { ascending: true });

        if (stylesError) console.error("Styles Database Error:", stylesError);

        // 2. Fetch Tattoo Sizes
        const { data: sizesData, error: sizesError } = await supabase
          .from("LT_TATTOO_SIZES")
          .select("id, Size, Duration")
          .order("id", { ascending: true });

        if (sizesError) console.error("Sizes Database Error:", sizesError);

        // 3. Fetch Artists
        const { data: artistsData, error: artistsError } = await supabase
          .from("Users")
          .select('id, username, role, "Specialty 1", "Specialty 2"');

        if (artistsError)
          console.error("Artists Database Error:", artistsError);

        // Process styles
        const formattedStyles =
          stylesData && stylesData.length > 0
            ? stylesData.map((s) => s.description)
            : ["Traditional", "Realism", "Fine Line", "Tribal", "Blackwork"];

        const formattedSizes = sizesData || [];

        // Process Artists
        let formattedArtists = [];

        if (artistsData && artistsData.length > 0) {
          formattedArtists = artistsData.map((a) => ({
            id: a.id,
            name: a.username,
            role: a.role,
            specialty_1: a["Specialty 1"],
            specialty_2: a["Specialty 2"],
          }));
        } else {
          console.warn(
            "Users table returned 0 rows. Using temporary fallback artists."
          );
          formattedArtists = [
            {
              id: 991,
              name: "Alex",
              role: "Artist",
              specialty_1: "Traditional",
              specialty_2: "Blackwork",
            },
            {
              id: 992,
              name: "Sarah",
              role: "Artist",
              specialty_1: "Realism",
              specialty_2: "Fine Line",
            },
            {
              id: 993,
              name: "Ilias",
              role: "Piercer",
              specialty_1: "Piercing",
              specialty_2: "",
            },
          ];
        }

        setStyles(formattedStyles);
        setSizes(formattedSizes);
        setArtists(formattedArtists);

        setBooking((prev) => ({
          ...prev,
          style: prev.style || formattedStyles[0] || "",
          size: prev.size || formattedSizes[0]?.Size || "",
        }));
      } catch (err) {
        console.error("Critical error building UI collections:", err);
      } finally {
        setIsLoadingLookups(false);
      }
    };

    fetchLookupTables();
  }, []);

  // Filter lists looking directly at mapped database users (ignoring Piercers)
  const tattooArtistsOnly = artists.filter((a) => {
    if (!a.name) return false;
    return a.name.toLowerCase() !== "ilias";
  });

  // Dynamic calculated duration from LT_TATTOO_SIZES table row
  const getCurrentDuration = () => {
    if (booking.style === "Piercing") return 30;
    const match = sizes.find((s) => s.Size === booking.size);
    return match ? Number(match.Duration) : 60;
  };

  const currentDuration = getCurrentDuration();

  const isArtistAvailable = (artistName, startTime, duration) => {
    const [startH, startM] = startTime.split(":").map(Number);
    const requestedStart = startH * 60 + startM;
    const requestedEnd = requestedStart + duration;

    return !bookedAppointments.some((appt) => {
      if (appt.Artist !== artistName && artistName !== "No Preference")
        return false;

      const [bStartH, bStartM] = appt.booking_time.split(":").map(Number);
      const [bEndH, bEndM] = appt.booking_time_to.split(":").map(Number);

      const bookedStart = bStartH * 60 + bStartM;
      const bookedEnd = bEndH * 60 + bEndM;

      return requestedStart < bookedEnd && requestedEnd > bookedStart;
    });
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const { data } = await supabase
        .from("Booking_Request")
        .select("Artist, booking_date, booking_time, booking_time_to");
      if (data) setAllBookings(data);
    };
    fetchAllData();
  }, []);

  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!booking.date) return;
      const { data } = await supabase
        .from("Booking_Request")
        .select("Artist, booking_date, booking_time, booking_time_to")
        .eq("booking_date", booking.date);
      if (data) setBookedAppointments(data);
    };
    fetchBookedSlots();
  }, [booking.date]);

  const getDateAvailability = (dateStr) => {
    if (!dateStr) return "text-white";
    const dayBookings = allBookings.filter((b) => b.booking_date === dateStr);
    const uniqueArtistsBooked = new Set(dayBookings.map((b) => b.Artist)).size;
    if (uniqueArtistsBooked >= 5) return "text-red-500";
    if (uniqueArtistsBooked >= 4) return "text-orange-500";
    if (uniqueArtistsBooked >= 2) return "text-yellow-500";
    return "text-green-500";
  };

  const handleBookingSubmit = async () => {
    setIsSubmitting(true);
    const duration = currentDuration;
    const [startHours, startMinutes] = booking.time.split(":").map(Number);
    const totalStartMinutes = startHours * 60 + startMinutes;

    const closingMinutes = 22 * 60;
    const totalEndMinutes = Math.min(
      totalStartMinutes + duration,
      closingMinutes
    );

    const bookingTimeTo = `${String(Math.floor(totalEndMinutes / 60)).padStart(
      2,
      "0"
    )}:${String(totalEndMinutes % 60).padStart(2, "0")}:00`;

    const formattedStartTime =
      booking.time.length === 5 ? `${booking.time}:00` : booking.time;

    try {
      const { error } = await supabase.from("Booking_Request").insert([
        {
          Artist: booking.artist || "No Preference",
          Style: booking.style,
          Placement: booking.placement,
          Size: booking.style === "Piercing" ? "Standard" : booking.size,
          booking_date: booking.date,
          booking_time: formattedStartTime,
          booking_time_to: bookingTimeTo,
          Black_Colored: booking.color ? "Colored" : "Black & Grey",
          customer_email: booking.customer_email,
          customer_phone: booking.customer_phone,
        },
      ]);
      if (error) throw error;
      setStep(7);
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUBTLE UI CONFIGURATION: Card always stays dark, accents swap cleanly.
  const mainCardBg = "bg-[#111]";
  const themeBg = "bg-[#fac700]";
  const themeText = "text-[#fac700]";
  const themeBorder = "border-[#fac700]";

  if (isLoadingLookups) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#fac700] w-12 h-12 mb-4" />
        <p className="text-xs uppercase font-black tracking-widest text-white/60">
          Loading Configurations...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 font-sans flex flex-col items-center">
      <div className="w-full max-w-md text-center mb-6 pt-4">
        <div className="w-16 h-16 bg-black rounded-full mx-auto mb-2 border-2 border-[#fac700] overflow-hidden">
          <img
            src="https://i.ibb.co/TMm4mvKb/under-the-skin-logo.jpg"
            alt="logo"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-xl font-black tracking-widest uppercase italic text-[#fac700]">
          Under The Skin
        </h1>
      </div>

      <div
        className={`w-full max-w-lg ${mainCardBg} border border-white/10 rounded-[2.5rem] shadow-2xl relative mb-10 overflow-hidden`}
      >
        <AnimatePresence mode="wait">
          {/* STEP 1: STYLE, PLACEMENT & SIZE */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() =>
                    setBooking({
                      ...booking,
                      style: styles[0] || "",
                      artist: "",
                    })
                  }
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    booking.style !== "Piercing"
                      ? "bg-[#fac700] text-black"
                      : "text-white/40"
                  }`}
                >
                  Tattoo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBooking({
                      ...booking,
                      style: "Piercing",
                      artist: "Ilias",
                      color: false,
                    })
                  }
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    booking.style === "Piercing"
                      ? "bg-white text-black"
                      : "text-white/40"
                  }`}
                >
                  Piercing
                </button>
              </div>

              <div className="flex justify-between items-center min-h-[32px]">
                <h2
                  className={`text-[10px] font-black uppercase tracking-widest ${themeText}`}
                >
                  1. Placement & Style
                </h2>
                {booking.style !== "Piercing" && (
                  <button
                    type="button"
                    onClick={() =>
                      setBooking({ ...booking, color: !booking.color })
                    }
                    className={`px-4 py-2 rounded-full border text-[10px] font-black tracking-wider transition-all ${
                      booking.color
                        ? "bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white border-transparent"
                        : "bg-white/5 text-white border-white/10 hover:border-white/20"
                    }`}
                  >
                    {booking.color ? "🌈 FULL COLOR" : "BLACK & GREY"}
                  </button>
                )}
              </div>

              {/* Anatomy Map */}
              <div className="relative w-full aspect-[1/1.1] bg-black/20 rounded-[2rem] overflow-hidden flex justify-center p-4 border border-white/5">
                <img
                  src="/body_tattoo.jpg"
                  alt="Anatomy"
                  className="h-full object-contain opacity-40"
                />
                {[
                  { id: "Head", top: "10%", left: "40%" },
                  { id: "Neck", top: "16%", left: "54%" },
                  { id: "Shoulder", top: "23%", left: "30%" },
                  { id: "Chest", top: "25%", left: "48%" },
                  { id: "Ribs", top: "38%", left: "40%" },
                  { id: "Stomach", top: "45%", left: "48%" },
                  { id: "Forearm", top: "44%", left: "28%" },
                  { id: "bicep", top: "34%", left: "65%" },
                  { id: "Hand", top: "55%", left: "69%" },
                  { id: "Thigh", top: "60%", left: "35%" },
                  { id: "Shin", top: "82%", left: "33%" },
                  { id: "Calf", top: "78%", left: "49%" },
                  { id: "Foot", top: "90%", left: "33%" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBooking({ ...booking, placement: p.id })}
                    className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2"
                    style={{ top: p.top, left: p.left }}
                  >
                    <span
                      className={`w-3 h-3 rounded-full block transition-all border-2 ${
                        booking.placement === p.id
                          ? "bg-[#fac700] border-white scale-150"
                          : "bg-white/40 border-transparent"
                      }`}
                    ></span>
                  </button>
                ))}
                <div
                  className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase px-4 py-1.5 rounded-full ${themeBg} text-black`}
                >
                  Area: {booking.placement}
                </div>
              </div>

              {/* Selection Grids */}
              {booking.style !== "Piercing" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-black opacity-60 mb-2">
                      Select Size
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {sizes
                        .filter(
                          (s) => !s.Size.toLowerCase().includes("piercing")
                        )
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setBooking({ ...booking, size: s.Size })
                            }
                            className={`py-3 px-2 rounded-xl text-[10px] font-bold border transition-all ${
                              booking.size === s.Size
                                ? `${themeBorder} ${themeText} bg-white/10 shadow-lg`
                                : "border-white/5 bg-black/40 text-white/60 hover:border-white/20"
                            }`}
                          >
                            {s.Size}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-black opacity-60 mb-2">
                      Select Style
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {styles
                        .filter((s) => s.toLowerCase() !== "piercing")
                        .map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setBooking({ ...booking, style: s })}
                            className={`py-2 rounded-xl text-[8px] font-black uppercase border transition-all ${
                              booking.style === s
                                ? `${themeBorder} ${themeText} bg-white/10`
                                : "border-white/5 bg-black/40 text-white/40"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(booking.style === "Piercing" ? 4 : 2)}
                className={`w-full ${themeBg} text-black font-black py-5 rounded-3xl uppercase tracking-widest`}
              >
                Next
              </button>
            </motion.div>
          )}

          {/* STEP 2: PATH SELECTION */}
          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 space-y-4"
            >
              <h2
                className={`text-[11px] font-black uppercase tracking-widest ${themeText}`}
              >
                Book by Artist or Date?
              </h2>
              <button
                type="button"
                onClick={() => {
                  setBookingPath("artist");
                  setStep(3);
                }}
                className="w-full p-6 rounded-3xl bg-black/40 border border-white/10 flex items-center gap-4 text-left"
              >
                <UserCheck className={themeText} />
                <div>
                  <p className="font-black text-xs uppercase">By Artist</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingPath("date");
                  setStep(4);
                }}
                className="w-full p-6 rounded-3xl bg-black/40 border border-white/10 flex items-center gap-4 text-left"
              >
                <Calendar className={themeText} />
                <div>
                  <p className="font-black text-xs uppercase">By Date</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-4 text-[9px] font-black opacity-40 text-center"
              >
                GO BACK
              </button>
            </motion.div>
          )}

          {/* STEP 3 & 3.5: ARTIST SELECT */}
          {(step === 3 || step === 3.5) && (
            <motion.div
              key="s3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 space-y-4"
            >
              <h2
                className={`text-[11px] font-black uppercase tracking-widest ${themeText}`}
              >
                Select Artist
              </h2>
              {step === 3.5 && (
                <button
                  type="button"
                  onClick={() =>
                    setBooking({ ...booking, artist: "No Preference" })
                  }
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    booking.artist === "No Preference"
                      ? `${themeBorder} bg-white/10`
                      : "border-white/5 bg-black/40"
                  }`}
                >
                  <p className="font-black uppercase italic">No Preference</p>
                  <p className="text-[10px] opacity-50">
                    Best available for chosen time
                  </p>
                </button>
              )}

              {tattooArtistsOnly.length === 0 ? (
                <div className="text-center py-6 text-xs text-white/40 uppercase tracking-wider font-bold">
                  No active tattoo artists found in database
                </div>
              ) : (
                tattooArtistsOnly.map((a) => {
                  const isSpecialist =
                    a.specialty_1?.toLowerCase() ===
                      booking.style?.toLowerCase() ||
                    a.specialty_2?.toLowerCase() ===
                      booking.style?.toLowerCase();

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBooking({ ...booking, artist: a.name })}
                      className={`w-full p-5 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${
                        booking.artist === a.name
                          ? `${themeBorder} bg-white/10`
                          : "border-white/5 bg-black/40"
                      }`}
                    >
                      <div>
                        <p className="font-black uppercase italic">{a.name}</p>
                        {isSpecialist && (
                          <p className="text-[9px] font-bold text-[#fac700]/70 uppercase tracking-widest mt-1">
                            Style Specialist
                          </p>
                        )}
                      </div>
                      {isSpecialist && <Zap size={14} className={themeText} />}
                    </button>
                  );
                })
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(step === 3 ? 2 : 4)}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  disabled={!booking.artist}
                  onClick={() => setStep(step === 3 ? 4 : 5)}
                  className={`flex-1 ${themeBg} text-black font-black py-5 rounded-2xl uppercase disabled:opacity-50`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: DATE PICKER */}
          {step === 4 && (
            <motion.div
              key="s4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 space-y-6"
            >
              <h2
                className={`text-[11px] font-black uppercase tracking-widest ${themeText}`}
              >
                Pick Date
              </h2>
              <input
                type="date"
                className={`w-full p-5 rounded-2xl bg-black border border-white/10 font-bold [color-scheme:dark] ${getDateAvailability(
                  booking.date
                )}`}
                onChange={(e) =>
                  setBooking({ ...booking, date: e.target.value })
                }
                value={booking.date}
              />
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(bookingPath === "date" ? 2 : 3)}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  disabled={!booking.date}
                  onClick={() => setStep(bookingPath === "date" ? 3.5 : 5)}
                  className={`flex-1 ${themeBg} text-black font-black py-5 rounded-2xl uppercase disabled:opacity-50`}
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: TIME PICKER */}
          {step === 5 && (
            <motion.div
              key="s5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 space-y-6"
            >
              <h2
                className={`text-[11px] font-black uppercase tracking-widest ${themeText}`}
              >
                Available Hours (Duration: {currentDuration} mins)
              </h2>
              <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {HOURS_POOL.filter((t) => {
                  const [startH, startM] = t.split(":").map(Number);
                  const sessionStartTimeInMinutes = startH * 60 + startM;
                  const sessionEndTimeInMinutes =
                    sessionStartTimeInMinutes + currentDuration;
                  const shopClosingTimeInMinutes = 22 * 60;

                  if (sessionEndTimeInMinutes > shopClosingTimeInMinutes) {
                    return false;
                  }

                  if (booking.artist === "No Preference") {
                    return tattooArtistsOnly.some((a) =>
                      isArtistAvailable(a.name, t, currentDuration)
                    );
                  }
                  return isArtistAvailable(booking.artist, t, currentDuration);
                }).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBooking({ ...booking, time: t })}
                    className={`p-4 rounded-xl border-2 font-black text-sm transition-all ${
                      booking.time === t
                        ? `${themeBg} text-black border-transparent`
                        : "border-white/10 bg-black/40 text-gray-400"
                    }`}
                  >
                    {t.substring(0, 5)}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(bookingPath === "date" ? 3.5 : 4)}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  disabled={!booking.time}
                  onClick={() => setStep(6)}
                  className={`flex-1 ${themeBg} text-black font-black py-5 rounded-2xl uppercase disabled:opacity-50`}
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 6: CONTACT */}
          {step === 6 && (
            <motion.div
              key="s6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 space-y-4"
            >
              <h2
                className={`text-[11px] font-black uppercase tracking-widest ${themeText}`}
              >
                Contact Info
              </h2>
              <input
                type="email"
                placeholder="EMAIL"
                className="w-full p-5 rounded-2xl bg-black border border-white/10 font-bold text-white"
                value={booking.customer_email}
                onChange={(e) =>
                  setBooking({ ...booking, customer_email: e.target.value })
                }
              />
              <input
                type="tel"
                placeholder="PHONE"
                className="w-full p-5 rounded-2xl bg-black border border-white/10 font-bold text-white"
                value={booking.customer_phone}
                onChange={(e) =>
                  setBooking({ ...booking, customer_phone: e.target.value })
                }
              />
              <div className="bg-black/40 p-4 rounded-2xl text-[10px] font-bold">
                <p className="flex justify-between uppercase">
                  <span>
                    {booking.style} {booking.color && "(Full Color)"}
                  </span>
                  <span>{booking.artist}</span>
                </p>
                <p className="flex justify-between uppercase mt-1">
                  <span>Schedule</span>
                  <span>
                    {booking.date} @ {booking.time.substring(0, 5)}
                  </span>
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  disabled={!booking.customer_email || isSubmitting}
                  onClick={handleBookingSubmit}
                  className={`flex-1 ${themeBg} text-black font-black py-5 rounded-2xl uppercase disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin mx-auto" />
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: SUCCESS */}
          {step === 7 && (
            <motion.div
              key="s7"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center space-y-6"
            >
              <CheckCircle size={60} className="text-[#fac700] mx-auto" />
              <h2 className="text-2xl font-black uppercase italic">Success!</h2>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full p-5 rounded-2xl bg-white text-black font-black uppercase"
              >
                Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TattooBookingDemo;
