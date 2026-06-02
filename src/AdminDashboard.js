import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  CheckCircle2,
  Loader2,
  X,
  User,
  Tag,
  Lock,
  Edit2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabaseClient";

const OwnerDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // DYNAMIC LOOKUP STATES FROM SUPABASE
  const [artists, setArtists] = useState([]);
  const [styles, setStyles] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);

  // NEW STATES FOR EDIT MODAL
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [editFormData, setEditFormData] = useState({
    id: "",
    Customer_Name: "",
    customer_email: "",
    customer_phone: "",
    Artist: "",
    Style: "",
    Size: "",
    Placement: "Arm",
    booking_date: "",
    booking_time: "",
    booking_time_to: "",
    confirmed: "YES",
  });

  const [formData, setFormData] = useState({
    Customer_Name: "",
    customer_email: "",
    customer_phone: "",
    Artist: "",
    Style: "",
    Size: "",
    Placement: "Arm",
    booking_date: selectedDate,
    booking_time: "12:30:00", // Updated default
    booking_time_to: "13:00:00", // Updated default
    confirmed: "YES",
  });

  const placements = [
    "Arm",
    "Forearm",
    "Leg",
    "Thigh",
    "Calf",
    "Chest",
    "Back",
    "Ribs",
    "Hand",
    "Neck",
    "Foot",
    "Other",
  ];

  const timeSlots = Array.from(
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

  // FETCH DYNAMIC LOOKUPS & SYNC DATABASE CONFIGS
  useEffect(() => {
    const fetchDashboardLookups = async () => {
      try {
        // 1. Fetch Tattoo Styles
        const { data: stylesData } = await supabase
          .from("LT_TATTOO_STYLES")
          .select("description")
          .order("id", { ascending: true });

        const formattedStyles =
          stylesData && stylesData.length > 0
            ? stylesData.map((s) => s.description)
            : [
                "Traditional",
                "Realism",
                "Fine Line",
                "Blackwork",
                "Minimalist",
              ];
        setStyles(formattedStyles);

        // 2. Fetch Tattoo Sizes
        const { data: sizesData } = await supabase
          .from("LT_TATTOO_SIZES")
          .select("id, Size, Duration")
          .order("id", { ascending: true });

        const formattedSizes =
          sizesData && sizesData.length > 0
            ? sizesData.map((s) => ({
                label: `${s.Size} (${s.Duration} min)`,
                value: s.Size,
                mins: s.Duration,
              }))
            : [
                { label: "Small (30 min)", value: "Small", mins: 30 },
                { label: "Medium (45 min)", value: "Medium", mins: 45 },
                { label: "Large (1h 30min)", value: "Large", mins: 90 },
              ];
        setSizeOptions(formattedSizes);

        // 3. Fetch Active Users/Artists from the "Users" table
        const { data: artistsData } = await supabase
          .from("Users")
          .select("id, username, role");

        let formattedArtists = [];

        if (artistsData && artistsData.length > 0) {
          const dbArtists = artistsData.map((a) => a.username).filter(Boolean);

          // Filter out the DB "No Preference" row and manually push it to the end
          const filtered = dbArtists.filter((name) => name !== "No Preference");
          formattedArtists = [...filtered, "No Preference"];
        }

        setArtists(formattedArtists);

        // Set baseline selection defaults for manual entries once loaded
        setFormData((prev) => ({
          ...prev,
          Artist: formattedArtists[0] || "No Preference",
          Style: formattedStyles[0] || "",
          Size: formattedSizes[0]?.value || "",
        }));
      } catch (err) {
        console.error("Error loading dashboard lookup fields:", err);
      }
    };

    fetchDashboardLookups();
  }, []);

  const toMins = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const availableSlots = useMemo(() => {
    if (sizeOptions.length === 0) return timeSlots;
    const selectedSizeObj = sizeOptions.find((s) => s.value === formData.Size);
    const durationMins = selectedSizeObj ? selectedSizeObj.mins : 30;

    return timeSlots.filter((slot) => {
      const slotStartMins = toMins(slot);
      const slotEndMins = slotStartMins + durationMins;

      return !appointments.some((appo) => {
        if (appo.Artist !== formData.Artist) return false;
        const existingStart = toMins(appo.booking_time);
        const existingEnd = toMins(appo.booking_time_to);
        return slotEndMins > existingStart && slotStartMins < existingEnd;
      });
    });
  }, [appointments, formData.Artist, formData.Size, sizeOptions]);

  const editAvailableSlots = useMemo(() => {
    if (!editingAppointment || sizeOptions.length === 0) return timeSlots;
    const selectedSizeObj = sizeOptions.find(
      (s) => s.value === editFormData.Size
    );
    const durationMins = selectedSizeObj ? selectedSizeObj.mins : 30;

    return timeSlots.filter((slot) => {
      const slotStartMins = toMins(slot);
      const slotEndMins = slotStartMins + durationMins;

      return !appointments.some((appo) => {
        if (appo.id === editingAppointment.id) return false;
        if (appo.Artist !== editFormData.Artist) return false;

        const existingStart = toMins(appo.booking_time);
        const existingEnd = toMins(appo.booking_time_to);
        return slotEndMins > existingStart && slotStartMins < existingEnd;
      });
    });
  }, [
    appointments,
    editFormData.Artist,
    editFormData.Size,
    editingAppointment,
    sizeOptions,
  ]);

  const calculateEndTime = (
    startTime,
    sizeValue,
    existingDurationMins = null
  ) => {
    if (!startTime) return "13:15:00";
    const sizeObj = sizeOptions.find(
      (s) => s.value?.toLowerCase() === sizeValue?.toLowerCase()
    );

    const duration = sizeObj ? sizeObj.mins : existingDurationMins || 30;

    const [h, m] = startTime.split(":").map(Number);
    const totalMinutes = h * 60 + m + duration;

    // Hard ceiling at 22:00 closing time (1320 total minutes)
    const closingMins = 22 * 60;
    const finalMinutes = Math.min(totalMinutes, closingMins);

    const endH = Math.floor(finalMinutes / 60);
    const endM = finalMinutes % 60;

    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(
      2,
      "0"
    )}:00`;
  };

  useEffect(() => {
    if (sizeOptions.length === 0) return;
    const suggestedEnd = calculateEndTime(formData.booking_time, formData.Size);
    setFormData((prev) => ({
      ...prev,
      booking_time_to: suggestedEnd,
      booking_date: selectedDate,
    }));
  }, [formData.booking_time, formData.Size, selectedDate, sizeOptions]);

  useEffect(() => {
    if (!editingAppointment || sizeOptions.length === 0) return;
    const suggestedEnd = calculateEndTime(
      editFormData.booking_time,
      editFormData.Size
    );
    setEditFormData((prev) => ({
      ...prev,
      booking_time_to: suggestedEnd,
    }));
  }, [
    editFormData.booking_time,
    editFormData.Size,
    editingAppointment,
    sizeOptions,
  ]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("Booking_Request")
        .select("*")
        .eq("booking_date", selectedDate);
      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const onDragStart = (e, appo) => {
    if (appo.confirmed === "YES") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("appointmentId", appo.id);
  };

  const onDrop = async (e, newArtist, newTime) => {
    const id = e.dataTransfer.getData("appointmentId");
    const appo = appointments.find((a) => a.id.toString() === id);
    if (!appo || appo.confirmed === "YES") return;

    const currentDurationMins =
      toMins(appo.booking_time_to) - toMins(appo.booking_time);

    const newEndTime = calculateEndTime(
      newTime,
      appo.Size || appo.size,
      currentDurationMins
    );

    try {
      const { error } = await supabase
        .from("Booking_Request")
        .update({
          Artist: newArtist,
          booking_time: newTime,
          booking_time_to: newEndTime,
        })
        .eq("id", id);

      if (error) throw error;
      fetchAppointments();
    } catch (err) {
      console.error(err);
    }
  };

  const confirmAppointment = async (appo, e) => {
    if (e) e.stopPropagation();
    setIsProcessing(appo.id);
    try {
      await supabase
        .from("Booking_Request")
        .update({ confirmed: "YES" })
        .eq("id", appo.id);
      fetchAppointments();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleOpenEditModal = (appo) => {
    const rawSize = appo.Size || appo.size || "Small";
    const matchedSizeObj = sizeOptions.find(
      (s) => s.value.toLowerCase() === rawSize.toLowerCase()
    );
    const correctSizeValue = matchedSizeObj
      ? matchedSizeObj.value
      : sizeOptions[0]?.value || "Small";

    const rawStyle = appo.Style || appo.style || "Realism";
    const matchedStyle = styles.find(
      (s) =>
        s.toLowerCase().replace(/\s+/g, "") ===
        rawStyle.toLowerCase().replace(/\s+/g, "")
    );
    const correctStyleValue = matchedStyle ? matchedStyle : rawStyle;

    setEditingAppointment(appo);
    setEditFormData({
      id: appo.id,
      Customer_Name: appo.Customer_Name || "",
      customer_email: appo.customer_email || "",
      customer_phone: appo.customer_phone || "",
      Artist: appo.Artist || artists[0],
      Style: correctStyleValue,
      Size: correctSizeValue,
      Placement: appo.Placement || "Arm",
      booking_date: appo.booking_date || selectedDate,
      booking_time: appo.booking_time || "10:00:00",
      booking_time_to: appo.booking_time_to || "10:30:00",
      confirmed: appo.confirmed || "YES",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing("updating");
    try {
      const { error } = await supabase
        .from("Booking_Request")
        .update({
          Customer_Name: editFormData.Customer_Name,
          customer_email: editFormData.customer_email,
          customer_phone: editFormData.customer_phone,
          Artist: editFormData.Artist,
          Style: editFormData.Style,
          Size: editFormData.Size,
          Placement: editFormData.Placement,
          booking_date: editFormData.booking_date,
          booking_time: editFormData.booking_time,
          booking_time_to: editFormData.booking_time_to,
          confirmed: editFormData.confirmed,
        })
        .eq("id", editFormData.id);

      if (error) throw error;

      if (editFormData.booking_date !== selectedDate) {
        setSelectedDate(editFormData.booking_date);
      }

      setEditingAppointment(null);
      fetchAppointments();
    } catch (error) {
      alert(error.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing("submitting");
    try {
      const initialPayload = {
        ...formData,
        confirmed: "NO",
      };

      const { data, error: insertError } = await supabase
        .from("Booking_Request")
        .insert([initialPayload])
        .select();

      if (insertError) throw insertError;
      if (!data || data.length === 0)
        throw new Error("Failed to retrieve new booking data.");

      const newBookingId = data[0].id;

      const { error: updateError } = await supabase
        .from("Booking_Request")
        .update({ confirmed: "YES" })
        .eq("id", newBookingId);

      if (updateError) throw updateError;

      setSelectedDate(formData.booking_date);

      setFormData({
        Customer_Name: "",
        customer_email: "",
        customer_phone: "",
        Artist: artists[0] || "No Preference",
        Style: styles[0] || "",
        Size: sizeOptions[0]?.value || "",
        Placement: "Arm",
        booking_date: formData.booking_date,
        booking_time: "12:30:00", // Match new opening time
        booking_time_to: "13:00:00",
        confirmed: "YES",
      });

      setIsModalOpen(false);
      fetchAppointments();
    } catch (error) {
      alert(error.message);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#fac700] rounded-full flex items-center justify-center font-black text-black">
              UTS
            </div>
            <h1 className="text-[#fac700] text-xl font-black italic uppercase tracking-tighter">
              Studio Manager
            </h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#fac700] text-black px-5 py-2.5 rounded-full font-black text-xs uppercase hover:scale-105 transition-all"
          >
            <Plus size={16} strokeWidth={3} /> New Booking
          </button>
        </div>
        <div className="flex items-center bg-[#111] p-2 rounded-2xl border border-white/10 gap-4">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-bold border-none outline-none cursor-pointer text-[#fac700] [color-scheme:dark]"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <div className="max-w-7xl mx-auto bg-[#111] border border-white/20 rounded-[2.5rem] relative shadow-2xl overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px] table-fixed">
          <thead>
            <tr className="border-b border-white/20 bg-black/20">
              <th className="p-6 w-24 border-r border-white/20">
                <Clock size={18} className="mx-auto text-white" />
                mount
              </th>
              {artists.map((artist) => (
                <th
                  key={artist}
                  className="p-6 text-center font-black uppercase italic tracking-widest text-[#fac700] border-r border-white/10"
                >
                  {artist}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((time) => (
              <tr key={time} className="border-b border-white/10 h-16">
                <td className="p-2 text-center border-r border-white/20 bg-black/5 font-black text-white text-[11px]">
                  {time.substring(0, 5)}
                </td>
                {artists.map((artist) => {
                  const appo = appointments.find(
                    (a) =>
                      a.Artist === artist &&
                      a.booking_time.substring(0, 5) === time.substring(0, 5)
                  );
                  let span = 0;
                  if (appo) {
                    span = Math.max(
                      1,
                      (toMins(appo.booking_time_to) -
                        toMins(appo.booking_time)) /
                        30
                    );
                  }
                  return (
                    <td
                      key={`${artist}-${time}`}
                      className="p-1 relative border-r border-white/10"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(e, artist, time)}
                    >
                      {appo && (
                        <motion.div
                          draggable={appo.confirmed !== "YES"}
                          onDragStart={(e) => onDragStart(e, appo)}
                          onClick={() => handleOpenEditModal(appo)}
                          whileHover={{
                            height: "auto",
                            minHeight: "240px",
                            zIndex: 100,
                            scale: 1.02,
                            boxShadow: "0px 20px 40px rgba(0,0,0,0.6)",
                          }}
                          className={`p-3 rounded-xl absolute inset-x-1 top-1 flex flex-col border-l-4 z-10 overflow-hidden transition-all group ${
                            appo.confirmed === "YES"
                              ? "bg-green-600 border-green-800 text-white cursor-pointer"
                              : "bg-[#fac700] border-black/30 text-black cursor-pointer active:cursor-grabbing"
                          }`}
                          style={{
                            height: `calc(${span * 100}% - 8px)`,
                            minHeight: "45px",
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex flex-col min-w-0">
                              <span className="font-black text-[10px] uppercase truncate flex items-center gap-1">
                                {appo.Customer_Name}
                                <Edit2
                                  size={8}
                                  className="opacity-0 group-hover:opacity-60 transition-opacity ml-1"
                                />
                              </span>
                              <div className="flex items-center gap-1 opacity-70">
                                <Tag size={8} />
                                <span className="text-[8px] font-bold uppercase italic">
                                  {appo.Style || appo.style}{" "}
                                  {appo.Placement ? `• ${appo.Placement}` : ""}
                                </span>
                              </div>
                            </div>
                            {appo.confirmed === "YES" ? (
                              <Lock size={10} className="opacity-40" />
                            ) : (
                              <button
                                onClick={(e) => confirmAppointment(appo, e)}
                                className="bg-black/10 p-1 rounded-full hover:bg-black/20 shrink-0"
                              >
                                {isProcessing === appo.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={10} />
                                )}
                              </button>
                            )}
                          </div>

                          <div className="space-y-1 mt-1 border-t border-black/10 pt-2 flex-grow overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <Mail size={9} className="shrink-0" />
                              <span className="text-[8px] font-black truncate">
                                {appo.customer_email}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Phone size={9} className="shrink-0" />
                              <span className="text-[8px] font-black">
                                {appo.customer_phone}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User size={9} className="shrink-0" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">
                                Size: {appo.Size || appo.size}
                              </span>
                            </div>
                          </div>

                          <div className="mt-auto flex justify-between items-end border-t border-black/10 pt-1">
                            <span className="text-[8px] font-black opacity-50 uppercase">
                              {appo.Artist}
                            </span>
                            <span className="text-[9px] font-black bg-black/10 px-1 rounded whitespace-nowrap">
                              {appo.booking_time.substring(0, 5)} -{" "}
                              {appo.booking_time_to.substring(0, 5)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <AnimatePresence>
          {loading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center">
              <Loader2 className="animate-spin text-[#fac700]" size={40} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* EDIT POPUP WINDOW */}
      <AnimatePresence>
        {editingAppointment && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={() => setEditingAppointment(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#111] border border-white/20 p-8 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[#fac700] text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                  <Edit2 size={22} /> Edit Appointment
                </h2>
                <button onClick={() => setEditingAppointment(null)}>
                  <X className="text-white/40 hover:text-white" />
                </button>
              </div>
              <form
                onSubmit={handleEditSubmit}
                className="grid grid-cols-2 gap-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Artist
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.Artist}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        Artist: e.target.value,
                      })
                    }
                  >
                    {artists.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#fac700] ml-2">
                    Booking Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-black border border-[#fac700]/40 p-4 rounded-2xl text-white outline-none [color-scheme:dark]"
                    value={editFormData.booking_date}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        booking_date: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#fac700] ml-2">
                    Tattoo Size
                  </label>
                  <select
                    className="w-full bg-black border border-[#fac700]/40 p-4 rounded-2xl text-white outline-none focus:border-[#fac700]"
                    value={editFormData.Size}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, Size: e.target.value })
                    }
                  >
                    {sizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Start Time
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.booking_time}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        booking_time: e.target.value,
                      })
                    }
                  >
                    {!editAvailableSlots.includes(
                      editFormData.booking_time
                    ) && (
                      <option value={editFormData.booking_time}>
                        {editFormData.booking_time.substring(0, 5)}
                      </option>
                    )}
                    {editAvailableSlots.map((t) => (
                      <option key={t} value={t}>
                        {t.substring(0, 5)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    End Time (Auto-calculated)
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white/70 outline-none pointer-events-none bg-black/40"
                    value={editFormData.booking_time_to}
                    disabled
                  >
                    <option value={editFormData.booking_time_to}>
                      {editFormData.booking_time_to.substring(0, 5)}
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Status Confirmation
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.confirmed}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        confirmed: e.target.value,
                      })
                    }
                  >
                    <option value="YES">Confirmed (YES)</option>
                    <option value="NO">Pending (NO)</option>
                  </select>
                </div>

                <div className="col-span-2 h-px bg-white/10 my-2" />

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Customer Name
                  </label>
                  <input
                    required
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.Customer_Name}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        Customer_Name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Style
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.Style}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        Style: e.target.value,
                      })
                    }
                  >
                    {styles.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Placement Location
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.Placement}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        Placement: e.target.value,
                      })
                    }
                  >
                    {placements.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.customer_email}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        customer_email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Phone
                  </label>
                  <input
                    required
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={editFormData.customer_phone}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        customer_phone: e.target.value,
                      })
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing === "updating"}
                  className="col-span-2 bg-[#fac700] text-black py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest mt-4 hover:scale-[1.01] transition-all"
                >
                  {isProcessing === "updating"
                    ? "Updating..."
                    : "Save Modifications"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL ENTRY MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#111] border border-white/20 p-8 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[#fac700] text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                  <Plus size={22} /> Manual Booking Entry
                </h2>
                <button onClick={() => setIsModalOpen(false)}>
                  <X className="text-white/40 hover:text-white" />
                </button>
              </div>
              <form
                onSubmit={handleManualSubmit}
                className="grid grid-cols-2 gap-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Artist
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.Artist}
                    onChange={(e) =>
                      setFormData({ ...formData, Artist: e.target.value })
                    }
                  >
                    {artists.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#fac700] ml-2">
                    Booking Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-black border border-[#fac700]/40 p-4 rounded-2xl text-white outline-none [color-scheme:dark]"
                    value={formData.booking_date}
                    onChange={(e) =>
                      setFormData({ ...formData, booking_date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#fac700] ml-2">
                    Tattoo Size
                  </label>
                  <select
                    className="w-full bg-black border border-[#fac700]/40 p-4 rounded-2xl text-white outline-none focus:border-[#fac700]"
                    value={formData.Size}
                    onChange={(e) =>
                      setFormData({ ...formData, Size: e.target.value })
                    }
                  >
                    {sizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Start Time
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.booking_time}
                    onChange={(e) =>
                      setFormData({ ...formData, booking_time: e.target.value })
                    }
                  >
                    {availableSlots.map((t) => (
                      <option key={t} value={t}>
                        {t.substring(0, 5)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    End Time (Auto-calculated)
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white/70 outline-none pointer-events-none bg-black/40"
                    value={formData.booking_time_to}
                    disabled
                  >
                    <option value={formData.booking_time_to}>
                      {formData.booking_time_to.substring(0, 5)}
                    </option>
                  </select>
                </div>

                <div className="col-span-2 h-px bg-white/10 my-2" />

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Customer Name
                  </label>
                  <input
                    required
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.Customer_Name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        Customer_Name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Style
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.Style}
                    onChange={(e) =>
                      setFormData({ ...formData, Style: e.target.value })
                    }
                  >
                    {styles.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Placement Location
                  </label>
                  <select
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.Placement}
                    onChange={(e) =>
                      setFormData({ ...formData, Placement: e.target.value })
                    }
                  >
                    {placements.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.customer_email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-white/40 ml-2">
                    Phone
                  </label>
                  <input
                    required
                    className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white outline-none"
                    value={formData.customer_phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_phone: e.target.value,
                      })
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing === "submitting"}
                  className="col-span-2 bg-[#fac700] text-black py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest mt-4 hover:scale-[1.01] transition-all"
                >
                  {isProcessing === "submitting"
                    ? "Submitting..."
                    : "Create Appointment"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OwnerDashboard;
