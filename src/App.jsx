import { useState, useEffect, useCallback, useRef } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mggtvitmicbzytklmkmm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZ3R2aXRtaWNienl0a2xta21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTg3NzAsImV4cCI6MjA5Mjc5NDc3MH0.H4ulHFHJQQ_5wvMLdzBrlqBi89SFCiNxuvLNQ9vX-5A";

const sb = {
  headers: {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  },
  async get(table, params = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: this.headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async upsert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...this.headers, "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

// ─── CASTLE GOLF CLUB DATA ───────────────────────────────────────────────────
const CASTLE_GC = {
  name: "Castle Golf Club",
  location: "Rathfarnham, Dublin",
  par: 70,
  rating: 69.4,
  slope: 123,
  holes: [
    {h:1,  par:5, si:9},  {h:2,  par:4, si:5},  {h:3,  par:3, si:17},
    {h:4,  par:4, si:15}, {h:5,  par:4, si:7},  {h:6,  par:4, si:1},
    {h:7,  par:3, si:13}, {h:8,  par:4, si:11}, {h:9,  par:4, si:3},
    {h:10, par:3, si:16}, {h:11, par:4, si:8},  {h:12, par:4, si:10},
    {h:13, par:3, si:18}, {h:14, par:4, si:4},  {h:15, par:3, si:14},
    {h:16, par:5, si:6},  {h:17, par:5, si:12}, {h:18, par:4, si:2},
  ]
};

// ─── COLOURS ─────────────────────────────────────────────────────────────────
const C = {
  navy:    "#1B4B8A",
  navyDk:  "#0F2D54",
  navyLt:  "#E8F0FA",
  red:     "#E8422A",
  redLt:   "#FFF0ED",
  green:   "#16a34a",
  greenLt: "#dcfce7",
  amber:   "#b45309",
  amberLt: "#fef3c7",
  text:    "#1E293B",
  muted:   "#64748B",
  border:  "#E2E8F0",
  bg:      "#F1F5F9",
  white:   "#FFFFFF",
  gold:    "#D97706",
};

// ─── SCRAMBLE HANDICAP ───────────────────────────────────────────────────────
// Combined handicaps ÷ 10, rounded to nearest whole number
function calcScrambleAllowance(players) {
  const total = players.reduce((sum, p) => sum + (parseFloat(p.handicap) || 0), 0);
  return Math.round(total / 10);
}

// Strokes received on a specific hole based on allowance
function strokesOnHole(allowance, si) {
  if (!allowance || allowance <= 0) return 0;
  return Math.floor(allowance / 18) + (si <= (allowance % 18) ? 1 : 0);
}

// Score vs par display
function vsParLabel(diff) {
  if (diff === 0) return { label: "E", color: C.text };
  if (diff < 0)  return { label: diff.toString(), color: C.green };
  return { label: `+${diff}`, color: C.red };
}

const medal = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const card = { background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05)", marginBottom: 12 };
const tPill = on => ({ flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap", background: on ? C.navy : C.white, color: on ? C.white : C.muted, boxShadow: on ? "none" : "0 1px 3px rgba(0,0,0,0.1)", transition: "all 0.15s" });

// ─── DEMO DATA (replace with Supabase in production) ─────────────────────────
const DEMO_TEAMS = [
  { id: "t1", pin: "1234", name: "Team Birdie", players: [
    { name: "Ted Wright",    handicap: 15 },
    { name: "Paul Carroll",  handicap: 12 },
    { name: "Mark Bonfield", handicap: 22 },
    { name: "Kevin Jinks",   handicap: 19 },
  ]},
  { id: "t2", pin: "5678", name: "Team Eagle", players: [
    { name: "Jim Nilsson",   handicap: 8  },
    { name: "Jon Ingram",    handicap: 14 },
    { name: "Josh Philips",  handicap: 9  },
    { name: "Marc Crote",    handicap: 31 },
  ]},
  { id: "t3", pin: "9012", name: "Team Par", players: [
    { name: "Eddie Pearson", handicap: 13 },
    { name: "Matt Parker",   handicap: 16 },
    { name: "Brendan ONeill",handicap: 24 },
    { name: "Simon Corbett", handicap: 18 },
  ]},
];

// ─── SPONSORED HOLES CONFIG ──────────────────────────────────────────────────
// Admin would configure these — hole index (0-based), type, sponsor name, colours
// Logo and prize images are placeholders — swap for real images before event
const SPONSORED_HOLES = {
  2: {  // Hole 3 (0-indexed = 2) — Nearest the Pin
    type: "Nearest the Pin",
    icon: "🎯",
    sponsorName: "Sponsor A",
    sponsorColor: "#2563eb",
    sponsorLogo: null,   // swap: "data:image/png;base64,..."
    prizeImage: null,    // swap: "data:image/png;base64,..."
    prizeDesc: "Prize to be confirmed",
  },
  15: { // Hole 16 (0-indexed = 15) — Longest Drive
    type: "Longest Drive",
    icon: "🏌️",
    sponsorName: "Sponsor B",
    sponsorColor: "#16a34a",
    sponsorLogo: null,
    prizeImage: null,
    prizeDesc: "Prize to be confirmed",
  },
};
// ─── AUCTION ITEMS ───────────────────────────────────────────────────────────
// Admin configures these — swap in real photos and details before event
const INITIAL_AUCTION_ITEMS = [
  { id:"a1", title:"Weekend Break", description:"2 nights for 2 in a 4-star hotel", startBid:150, image:null, closesAt:"17:30", emoji:"🏨" },
  { id:"a2", title:"Golf Day for 4", description:"Round of golf for 4 at a top Dublin course", startBid:200, image:null, closesAt:"17:30", emoji:"⛳" },
  { id:"a3", title:"Sports Jersey", description:"Signed Ireland rugby jersey", startBid:100, image:null, closesAt:"17:30", emoji:"🏉" },
  { id:"a4", title:"Fine Dining", description:"Dinner for 2 at a Michelin-starred restaurant", startBid:250, image:null, closesAt:"17:30", emoji:"🍽️" },
  { id:"a5", title:"Spa Day", description:"Full spa day for 2 including treatments", startBid:120, image:null, closesAt:"17:30", emoji:"💆" },
  { id:"a6", title:"Wine Hamper", description:"Premium selection of 12 wines", startBid:80, image:null, closesAt:"17:30", emoji:"🍷" },
  { id:"a7", title:"Tech Bundle", description:"Smart speaker and wireless headphones", startBid:180, image:null, closesAt:"17:30", emoji:"🎧" },
  { id:"a8", title:"Golf Equipment", description:"Full set of Titleist irons", startBid:300, image:null, closesAt:"17:30", emoji:"🏌️" },
  { id:"a9", title:"Concert Tickets", description:"2 tickets to a major concert", startBid:90, image:null, closesAt:"17:30", emoji:"🎵" },
  { id:"a10", title:"Artwork", description:"Original painting by a local artist", startBid:75, image:null, closesAt:"17:30", emoji:"🎨" },
];

export default function WRightScore() {
  const [page,       setPage]       = useState("splash");
  const [team,       setTeam]       = useState(null);
  const [competition,setCompetition]= useState(null);  // active competition from Supabase
  const [courseData, setCourseData] = useState(null);  // course holes from Supabase
  const [liveComps,  setLiveComps]  = useState([]);    // all live competitions
  const [pinInput,   setPinInput]   = useState("");
  const [pinError,   setPinError]   = useState("");
  const [scores,     setScores]     = useState(Array(18).fill(null));
  const [drives,     setDrives]     = useState(Array(18).fill(null));
  const [currentH,  setCurrentH]   = useState(0);
  const [allTeams,   setAllTeams]   = useState([]);
  const [syncStatus, setSyncStatus] = useState("offline");
  const [splashDone, setSplashDone] = useState(false);
  const [sponsorPopup, setSponsorPopup] = useState(null);
  const [photos,     setPhotos]     = useState({});
  const [lbTab,      setLbTab]      = useState("teams");
  const [prizeWinners, setPrizeWinners] = useState({});
  const [assigningPrize, setAssigningPrize] = useState(null);
  const [auctionItems, setAuctionItems] = useState([]);
  const [bids,       setBids]       = useState({});
  const [bidItem,    setBidItem]    = useState(null);
  const [bidAmount,  setBidAmount]  = useState("");
  const [bidError,   setBidError]   = useState("");
  const [bidSuccess, setBidSuccess] = useState(null);
  const [loadError,  setLoadError]  = useState(null);
  const [sponsoredHolesData, setSponsoredHolesData] = useState({});
  const [allScores, setAllScores] = useState([]); // all teams' scores from Supabase
  const saveTimer = useRef({});

  // Splash then load live competitions from Supabase
  useEffect(() => {
    // Start loading data immediately in background
    loadLiveComps();
    // Splash finishes at 3.3s (club animation ends) — add small buffer
    setTimeout(() => setSplashDone(true), 3400);
  }, []);

  const loadLiveComps = async () => {
    try {
      const comps = await sb.get("competitions", "select=*&status=eq.live&order=name");
      setLiveComps(comps);
      if (comps.length === 1) {
        await loadCompetition(comps[0]);
      }
      // Don't call setPage here — wait for splashDone
    } catch(e) {
      setLoadError("Could not connect to server");
    }
  };

  // Once splash is done, go to PIN
  useEffect(() => {
    if (splashDone) setPage("pin");
  }, [splashDone]);

  const loadCompetition = async (comp) => {
    setCompetition(comp);

    // Load all in parallel — each section independent so one failure doesn't block others
    await Promise.allSettled([

      // Course
      sb.get("competition_courses", `select=*,courses(*)&competition_id=eq.${comp.id}&day=eq.1`)
        .then(compCourses => {
          if (compCourses.length > 0 && compCourses[0].courses) {
            const course = compCourses[0].courses;
            const holes = Array.isArray(course.holes) ? course.holes : JSON.parse(course.holes);
            setCourseData({ ...course, holes });
          }
        }),

      // Teams + players
      Promise.all([
        sb.get("teams", `select=*&competition_id=eq.${comp.id}&order=name`),
        sb.get("players", `select=*&competition_id=eq.${comp.id}&order=slot`),
      ]).then(([teams, players]) => {
        const teamsWithPlayers = teams.map(t => ({
          ...t,
          players: players.filter(p => p.team_id === t.id).map(p => ({
            name: p.name, handicap: p.handicap, company: p.company
          }))
        }));
        setAllTeams(teamsWithPlayers);
      }),

      // Auction items
      sb.get("auction_items", `select=*&competition_id=eq.${comp.id}&order=sort_order`)
        .then(items => setAuctionItems(items.map(i => ({ ...i, start_bid: i.start_bid || 0 })))),

      // Bids
      sb.get("auction_bids", `select=*&competition_id=eq.${comp.id}&order=placed_at.desc`)
        .then(existingBids => {
          const bidsMap = {};
          existingBids.forEach(b => {
            if (!bidsMap[b.item_id]) bidsMap[b.item_id] = [];
            bidsMap[b.item_id].push({ teamName: b.team_name, amount: b.amount, time: new Date(b.placed_at).toLocaleTimeString() });
          });
          setBids(bidsMap);
        }),

      // All scores for leaderboard
      sb.get("scores", `select=*&competition_id=eq.${comp.id}`)
        .then(allSc => setAllScores(allSc)),

      // Sponsored holes
      sb.get("sponsored_holes", `select=*&competition_id=eq.${comp.id}&order=hole_index`)
        .then(sponsors => {
          const sponsorMap = {};
          sponsors.forEach(sh => {
            sponsorMap[sh.hole_index] = {
              type: sh.type === "nearest_pin" ? "Nearest the Pin" : sh.type === "longest_drive" ? "Longest Drive" : "Hole Sponsor",
              icon: sh.type === "nearest_pin" ? "🎯" : sh.type === "longest_drive" ? "🏌️" : "🏅",
              sponsorName: sh.sponsor_name || "Sponsor",
              sponsorColor: sh.sponsor_color || "#2563eb",
              sponsorLogo: sh.sponsor_logo || null,
              prizeImage: sh.prize_image || null,
              prizeDesc: sh.prize_desc || "Prize TBC",
            };
          });
          setSponsoredHolesData(sponsorMap);
        }),
    ]);
  };

  // Refresh all scores whenever leaderboard is opened
  useEffect(() => {
    if (page === "leaderboard" && competition) {
      sb.get("scores", `select=*&competition_id=eq.${competition.id}`)
        .then(sc => setAllScores(sc))
        .catch(() => {});
    }
  }, [page]);
  const activeCourse = courseData || CASTLE_GC;

  // Allowance for current team
  const allowance = team ? calcScrambleAllowance(team.players) : 0;

  // Drive counts per player
  const driveCounts = team ? team.players.map((_, i) =>
    drives.filter(d => d === i).length
  ) : [];

  // Min drives check (need at least 3 per player across 18 holes — actually min 3 drives used total per player... 
  // Standard rule: each player's drive must be used at least 3 times
  // Flag players with fewer than 3 drives used
  const driveWarnings = driveCounts.map(c => c < 3);
  const holesScored = scores.filter(s => s !== null).length;
  const minDriveMet = driveCounts.every(c => c >= 3);

  // Gross total and net
  const grossTotal = scores.reduce((sum, s) => sum + (s || 0), 0);
  const parTotal = activeCourse.holes.reduce((sum, h, i) => scores[i] !== null ? sum + h.par : sum, 0);
  const grossVsPar = holesScored > 0 ? grossTotal - parTotal : 0;
  // Net: apply allowance distributed by SI — strokes come off holes with lowest SI first
  const netScoreByHole = activeCourse.holes.map((h, i) => {
    if (scores[i] === null) return null;
    const s = strokesOnHole(allowance, h.si);
    return scores[i] - s;
  });
  const netTotal = netScoreByHole.reduce((sum, s) => sum + (s ?? 0), 0);
  const netVsPar = holesScored > 0 ? netTotal - parTotal : 0;

  // Leaderboard — use allScores from Supabase, merge current team's live local scores
  const leaderboard = allTeams.map(t => {
    const tAllowance = calcScrambleAllowance(t.players);
    // Use local scores for current team (live), Supabase scores for others
    let tScores = Array(18).fill(null);
    if (t.id === team?.id) {
      tScores = scores; // live local state
    } else {
      const teamDbScores = allScores.filter(s => s.team_id === t.id);
      teamDbScores.forEach(s => { if (s.hole_index >= 0 && s.hole_index < 18) tScores[s.hole_index] = s.gross_score; });
    }
    const tHoles = tScores.filter(s => s !== null).length;
    const tGross = tScores.reduce((sum, s) => sum + (s || 0), 0);
    const tPar = activeCourse.holes.reduce((sum, h, i) => tScores[i] !== null ? sum + h.par : sum, 0);
    const tGrossVsPar = tHoles > 0 ? tGross - tPar : null;
    const tNet = activeCourse.holes.reduce((sum, h, i) => {
      if (tScores[i] === null) return sum;
      return sum + tScores[i] - strokesOnHole(tAllowance, h.si);
    }, 0);
    const tNetVsPar = tHoles > 0 ? tNet - tPar : null;
    return { ...t, allowance: tAllowance, gross: tGross, net: tNet, holes: tHoles, netVsPar: tNetVsPar, grossVsPar: tGrossVsPar };
  }).filter(t => t.holes > 0).sort((a, b) => (a.netVsPar ?? 999) - (b.netVsPar ?? 999));

  // PIN sign in
  const handlePin = async () => {
    if (!pinInput.trim()) return;
    if (!competition && liveComps.length !== 1) return;
    try {
      const found = allTeams.find(t => t.pin === pinInput.trim());
      if (!found) { setPinError("PIN not recognised — try again"); return; }
      setTeam(found);
      setPinError("");
      setPinInput("");
      // Load any existing scores for this team
      try {
        const existing = await sb.get("scores", `select=*&competition_id=eq.${competition.id}&team_id=eq.${found.id}`);
        if (existing.length > 0) {
          const loadedScores = Array(18).fill(null);
          const loadedDrives = Array(18).fill(null);
          existing.forEach(s => {
            if (s.hole_index >= 0 && s.hole_index < 18) {
              loadedScores[s.hole_index] = s.gross_score;
              loadedDrives[s.hole_index] = s.drive_player ?? null;
            }
          });
          setScores(loadedScores);
          setDrives(loadedDrives);
          const firstUnscore = loadedScores.findIndex(s => s === null);
          if (firstUnscore > 0) setCurrentH(firstUnscore);
        }
      } catch(e) { console.error("Could not load existing scores:", e.message); }
      setPage("scoring");
    } catch(e) {
      setPinError("Error connecting — try again");
    }
  };

  // Set score for hole — saves to Supabase and triggers sponsor popup
  const setHoleScore = async (hIdx, val) => {
    const next = [...scores];
    next[hIdx] = val === "" ? null : parseInt(val);
    setScores(next);
    if (team && competition && val !== "") {
      setSyncStatus("saving");
      try {
        await sb.upsert("scores", [{
          competition_id: competition.id,
          team_id: team.id,
          hole_index: hIdx,
          gross_score: parseInt(val),
          player_slot: 0,
          drive_player: drives[hIdx] ?? null,
        }]);
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("online"), 1500);
      } catch(e) {
        setSyncStatus("error:" + e.message);
      }
    }
    const nextIdx = hIdx + 1;
    if (nextIdx < 18 && sponsoredHolesData[nextIdx] && val !== "") {
      setTimeout(() => setSponsorPopup(nextIdx), 600);
    }
  };

  // Set drive used for hole
  const setDrive = (hIdx, playerIdx) => {
    const next = [...drives];
    next[hIdx] = next[hIdx] === playerIdx ? null : playerIdx;
    setDrives(next);
  };

  // Handle photo upload for sponsored hole — saves to Supabase
  const handlePhoto = (hIdx, file, playerName) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const photoUrl = e.target.result;
      // Update local state immediately
      setPhotos(prev => ({ ...prev, [hIdx]: { url: photoUrl, playerName, teamName: team?.name, timestamp: new Date().toLocaleTimeString() } }));
      // Save to Supabase
      if (team && competition) {
        try {
          await sb.upsert("prize_photos", [{
            competition_id: competition.id,
            hole_index: hIdx,
            team_id: team.id,
            player_name: playerName,
            photo_url: photoUrl,
            is_winner: false,
          }]);
        } catch(e) {
          console.error("Photo save failed:", e.message);
        }
      }
    };
    reader.readAsDataURL(file);
  };
  // Handle bid submission
  const handleBid = async () => {
    if (!bidItem || !team) return;
    const amount = parseFloat(bidAmount);
    const itemBids = bids[bidItem.id] || [];
    const currentTop = itemBids.length > 0 ? Math.max(...itemBids.map(b => b.amount)) : (bidItem.start_bid || bidItem.start_bid || 0) - 1;
    const minBid = currentTop + 10;
    if (isNaN(amount) || amount < minBid) { setBidError(`Minimum bid is €${minBid}`); return; }
    try {
      // Save to Supabase
      await sb.upsert("auction_bids", [{
        item_id: bidItem.id,
        competition_id: competition?.id,
        team_id: team.id,
        team_name: team.name,
        amount: amount,
        placed_at: new Date().toISOString(),
      }]);
      // Update local state so UI refreshes immediately
      setBids(prev => ({ ...prev, [bidItem.id]: [...(prev[bidItem.id] || []), { teamName: team.name, amount, time: new Date().toLocaleTimeString() }] }));
      setBidSuccess(`Bid of €${amount} placed! ❤️`);
      setBidAmount(""); setBidError("");
      setTimeout(() => { setBidItem(null); setBidSuccess(null); }, 2500);
    } catch(e) {
      setBidError("Failed to save bid — check connection");
    }
  };

  const topBid = (itemId) => {
    const b = bids[itemId] || [];
    if (!b.length) return null;
    return b.reduce((top, x) => x.amount > top.amount ? x : top);
  };

  if (page === "splash") return (
    <div style={{ width: "100%", height: "100vh", background: C.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideDiv { from { width:0; } to { width:240px; } }
        @keyframes fadeTag { from { opacity:0; } to { opacity:0.55; } }
        @keyframes swipeClub { from { clip-path:inset(0 100% 0 0); } to { clip-path:inset(0 0% 0 0); } }
        .wr-word  { opacity:0; animation: fadeUp   0.9s cubic-bezier(0.22,1,0.36,1) 0.3s forwards; }
        .wr-div   { width:0;   animation: slideDiv 0.7s cubic-bezier(0.22,1,0.36,1) 1.1s forwards; }
        .wr-tag   { opacity:0; animation: fadeTag  0.7s ease 1.7s forwards; }
        .wr-club  { clip-path:inset(0 100% 0 0); animation: swipeClub 1.0s cubic-bezier(0.4,0,0.2,1) 2.3s forwards; opacity:0.55; }
      `}</style>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 50% 45%, rgba(27,75,138,0.04) 0%, transparent 70%)`, pointerEvents:"none" }}/>
      {/* Corner brackets */}
      {[{top:20,left:20,borderTop:`1.5px solid ${C.navy}`,borderLeft:`1.5px solid ${C.navy}`},{top:20,right:20,borderTop:`1.5px solid ${C.navy}`,borderRight:`1.5px solid ${C.navy}`},{bottom:20,left:20,borderBottom:`1.5px solid ${C.navy}`,borderLeft:`1.5px solid ${C.navy}`},{bottom:20,right:20,borderBottom:`1.5px solid ${C.navy}`,borderRight:`1.5px solid ${C.navy}`}].map((s,i)=>(
        <div key={i} style={{ position:"absolute", width:24, height:24, opacity:0.3, ...s }}/>
      ))}
      <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center" }}>
        {/* Wordmark — all at once, "wRight" navy then "Score" red */}
        <div className="wr-word" style={{ position:"relative", zIndex:1, display:"flex", alignItems:"baseline", lineHeight:1 }}>
          <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontWeight:700, fontSize:44, color:C.navy, letterSpacing:"-0.5px" }}>wRight</span>
          <span style={{ width:10, display:"inline-block" }}/>
          <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontWeight:900, fontSize:44, color:C.red }}>Score</span>
        </div>
        {/* Divider */}
        <div className="wr-div" style={{ position:"relative", zIndex:1, height:1.5, background:`linear-gradient(90deg, transparent, ${C.red}, transparent)`, margin:"13px 0 11px" }}/>
        {/* Tagline */}
        <div className="wr-tag" style={{ position:"relative", zIndex:1, fontFamily:"'Montserrat',Arial,sans-serif", fontWeight:600, fontSize:10, letterSpacing:4, textTransform:"uppercase", color:C.navy }}>Scramble Scoring</div>
      </div>
      {/* Golf club — swipes in last */}
      <img
        className="wr-club"
        src="data:image/png;base64,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"
        alt=""
        style={{ position:"absolute", width:300, height:"auto", top:"50%", left:"50%", transform:"translate(-50%, -52%)", pointerEvents:"none", zIndex:0 }}
      />
    </div>
  );

  // ── PIN ENTRY ─────────────────────────────────────────────────────────────
  if (page === "pin") return (
    <div style={{ width: "100%", height: "100vh", background: C.navyDk, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',Arial,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: "100%", maxWidth: 340, padding: "0 24px" }}>

        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, fontSize: 32, color: C.white }}>
            wRight<span style={{ color: C.red }}>Score</span>
          </div>
          {competition ? (
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
              {competition.name}
            </div>
          ) : liveComps.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
              {loadError || "No live competitions right now"}
            </div>
          ) : null}
        </div>

        {/* ── COMPETITION SELECTOR — only when multiple live ── */}
        {!competition && liveComps.length > 1 && (
          <div style={{ width: "100%", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, textAlign: "center" }}>
              Select your event
            </div>
            {liveComps.map(c => (
              <button key={c.id} onClick={async () => { await loadCompetition(c); }}
                style={{ width: "100%", padding: "14px 16px", marginBottom: 8, borderRadius: 12, border: `2px solid rgba(255,255,255,0.15)`, background: "rgba(255,255,255,0.07)", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div>{c.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3, fontWeight: 400 }}>{c.location || "Scramble"}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── PIN entry — only show when competition is selected or only one live ── */}
        {(competition || liveComps.length === 1) && (
          <>
            {/* PIN display */}
            <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 56, height: 64, borderRadius: 12, background: pinInput[i] ? C.navy : "rgba(255,255,255,0.08)", border: `2px solid ${pinInput[i] ? C.red : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: C.white, transition: "all 0.15s" }}>
                  {pinInput[i] ? "•" : ""}
                </div>
              ))}
            </div>

            {/* Numpad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%" }}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                <button key={i} onClick={() => {
                  if (!k) return;
                  if (k === "⌫") { setPinInput(p => p.slice(0,-1)); setPinError(""); return; }
                  if (pinInput.length < 4) setPinInput(p => p + k);
                }}
                style={{ height: 60, borderRadius: 12, border: "none", background: k ? "rgba(255,255,255,0.1)" : "transparent", color: C.white, fontSize: k === "⌫" ? 20 : 24, fontWeight: 700, cursor: k ? "pointer" : "default", fontFamily: "inherit", transition: "background 0.1s" }}>
                  {k}
                </button>
              ))}
            </div>

            {pinError && <div style={{ color: C.red, fontSize: 13, marginTop: 16, textAlign: "center" }}>{pinError}</div>}

            <button onClick={handlePin} disabled={pinInput.length !== 4}
              style={{ marginTop: 20, width: "100%", padding: "16px", borderRadius: 14, border: "none", background: pinInput.length === 4 ? C.red : "rgba(255,255,255,0.1)", color: C.white, fontSize: 16, fontWeight: 700, cursor: pinInput.length === 4 ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.2s" }}>
              Enter →
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ── SCORING ───────────────────────────────────────────────────────────────
  if (page === "scoring" && team) {
    const hole = activeCourse.holes[currentH];
    const strokes = strokesOnHole(allowance, hole.si);
    const netPar = hole.par + strokes;
    const hScore = scores[currentH];
    const hDrive = drives[currentH];
    const hVsPar = hScore !== null ? hScore - hole.par : null;
    const { label: hLabel, color: hColor } = hVsPar !== null ? vsParLabel(hVsPar) : { label: "–", color: C.muted };
    const { label: gLabel, color: gColor } = vsParLabel(grossVsPar);

    const sponsorInfo = sponsoredHolesData[currentH];
    const isSponsored = !!sponsorInfo;

    return (
      <div style={{ width: "100%", height: "100dvh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Montserrat',Arial,sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');`}</style>

        {/* ── SPONSOR POPUP ── */}
        {sponsorPopup !== null && sponsoredHolesData[sponsorPopup] && (
          <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
            onClick={() => { setSponsorPopup(null); setCurrentH(sponsorPopup); }}>
            <div style={{ background:C.white, borderRadius:20, overflow:"hidden", width:"100%", maxWidth:340, boxShadow:"0 20px 60px rgba(0,0,0,0.4)" }}
              onClick={e => e.stopPropagation()}>
              {/* Sponsor colour header */}
              <div style={{ background: sponsoredHolesData[sponsorPopup].sponsorColor, padding:"20px 20px 16px", textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:3, textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:8 }}>
                  Sponsored by
                </div>
                {sponsoredHolesData[sponsorPopup].sponsorLogo ? (
                  <img src={sponsoredHolesData[sponsorPopup].sponsorLogo} alt="sponsor" style={{ height:48, objectFit:"contain" }}/>
                ) : (
                  <div style={{ fontSize:24, fontWeight:900, color:C.white, letterSpacing:"-0.5px" }}>
                    {sponsoredHolesData[sponsorPopup].sponsorName}
                  </div>
                )}
              </div>
              {/* Competition type */}
              <div style={{ padding:"16px 20px 12px", textAlign:"center", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontSize:32, marginBottom:6 }}>{sponsoredHolesData[sponsorPopup].icon}</div>
                <div style={{ fontSize:22, fontWeight:900, color:C.text }}>
                  {sponsoredHolesData[sponsorPopup].type}
                </div>
                <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>
                  Hole {sponsorPopup + 1} — {activeCourse.holes[sponsorPopup].par === 3 ? "Par 3" : activeCourse.holes[sponsorPopup].par === 5 ? "Par 5" : "Par 4"}
                </div>
              </div>
              {/* Prize */}
              <div style={{ padding:"14px 20px 8px", textAlign:"center" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:C.muted, marginBottom:10 }}>The Prize</div>
                {sponsoredHolesData[sponsorPopup].prizeImage && (
                  <img src={sponsoredHolesData[sponsorPopup].prizeImage} alt="prize" style={{ width:"100%", maxHeight:160, objectFit:"contain", borderRadius:10, marginBottom:10 }}/>
                )}
                <div style={{ background:sponsoredHolesData[sponsorPopup].sponsorColor+"18", borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>🏆</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text, lineHeight:1.3 }}>
                    {sponsoredHolesData[sponsorPopup].prizeDesc || "Prize TBC"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setSponsorPopup(null); setCurrentH(sponsorPopup); }}
                style={{ width:"100%", padding:"16px", border:"none", background:sponsoredHolesData[sponsorPopup].sponsorColor, color:C.white, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5 }}>
                Let's Go — Hole {sponsorPopup + 1} →
              </button>
            </div>
          </div>
        )}

        {/* Sticky header */}
        <div style={{ background: C.navyDk, padding: "10px 16px 12px", flexShrink: 0, borderBottom: `3px solid ${C.red}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, fontSize: 18, color: C.white }}>
              wRight<span style={{ color: C.red }}>Score</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{team.name}</div>
              {syncStatus === "saving" && <div style={{ fontSize: 9, color: C.amber }}>💾</div>}
              {syncStatus === "saved" && <div style={{ fontSize: 9, color: "#4ade80" }}>✓</div>}
              {syncStatus.startsWith("error") && <div style={{ fontSize: 9, color: C.red }} title={syncStatus}>⚠️</div>}
              <button onClick={() => setPage("leaderboard")} style={{ background: C.red, border: "none", borderRadius: 8, color: C.white, fontSize: 11, fontWeight: 700, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>🏆</button>
            </div>
          </div>
          {/* Score banner */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Gross</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: grossVsPar < 0 ? "#4ade80" : grossVsPar > 0 ? "#fca5a5" : C.white }}>{holesScored > 0 ? vsParLabel(grossVsPar).label : "–"}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "4px 0" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Net</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: netVsPar < 0 ? "#4ade80" : netVsPar > 0 ? "#fca5a5" : C.white }}>{holesScored > 0 ? vsParLabel(netVsPar).label : "–"}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Holes</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.white }}>{holesScored}/18</div>
              </div>
            </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

          {/* Hole navigation */}
          <div style={{ display: "flex", gap: 6, padding: "10px 12px 6px", overflowX: "auto" }}>
            {activeCourse.holes.map((h, i) => {
              const s = scores[i];
              const done = s !== null;
              const vp = done ? s - h.par : null;
              // Strong contrast colours
              const bg = i === currentH ? "#000000"
                : done ? "#16A34A"
                : "#e2e8f0";
              const col = i === currentH ? C.white
                : done ? C.white
                : "#94a3b8";
              return (
                <button key={i} onClick={() => setCurrentH(i)}
                  style={{ flexShrink: 0, width: 68, height: 68, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 18, fontWeight: 700, transition: "all 0.15s", position: "relative",
                    background: bg, color: col,
                    boxShadow: i === currentH ? `0 2px 8px rgba(0,0,0,0.4)` : "none",
                    outline: sponsoredHolesData[i] ? `3px solid ${sponsoredHolesData[i].sponsorColor}` : "none",
                  }}>
                  {h.h}
                  {/* Tick for completed holes */}
                  {done && i !== currentH && (
                    <span style={{ position:"absolute", bottom:4, right:6, fontSize:10, opacity:0.8 }}>✓</span>
                  )}
                  {/* Sponsor badge */}
                  {sponsoredHolesData[i] && (
                    <span style={{ position:"absolute", top:-6, right:-6, fontSize:12, background:sponsoredHolesData[i].sponsorColor, borderRadius:"50%", width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {sponsoredHolesData[i].icon === "🎯" ? "📍" : "💨"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current hole card */}
          <div style={{ ...card, margin: "6px 12px" }}>
            {/* Sponsor banner — shows if hole is sponsored */}
            {isSponsored && (
              <div style={{ background: sponsorInfo.sponsorColor }}>
                <div style={{ padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:18 }}>{sponsorInfo.icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:C.white, letterSpacing:0.3 }}>{sponsorInfo.type}</div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Sponsored by {sponsorInfo.sponsorName}</div>
                    </div>
                  </div>
                  {sponsorInfo.sponsorLogo && <img src={sponsorInfo.sponsorLogo} alt="sponsor" style={{ height:28, objectFit:"contain", background:"rgba(255,255,255,0.9)", borderRadius:4, padding:"1px 4px" }}/>}
                </div>
                {sponsorInfo.prizeDesc && (
                  <div style={{ padding:"6px 16px 10px", display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:14 }}>🏆</span>
                    <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{sponsorInfo.prizeDesc}</div>
                  </div>
                )}
              </div>
            )}
            {/* Hole header */}
            <div style={{ background: C.navy, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 22 }}>Hole {hole.h}</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>Par {hole.par} · SI {hole.si}{strokes > 0 ? ` · +${strokes} stroke${strokes > 1 ? "s" : ""}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: hVsPar !== null ? hColor : "rgba(255,255,255,0.3)" }}>{hLabel}</div>
                {hScore !== null && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{hScore} strokes</div>}
              </div>
            </div>

            {/* Whose drive? — REQUIRED before scoring */}
            <div style={{ padding: "14px 16px 10px", background: hDrive === null ? "#fff7ed" : C.white, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: hDrive === null ? C.amber : C.green, textTransform: "uppercase", letterSpacing: 1 }}>
                  {hDrive === null ? "⚠️ Select whose drive was used" : `✓ Drive: ${team.players[hDrive].name.split(" ")[0]}`}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {team.players.map((p, i) => {
                  const selected = hDrive === i;
                  const count = driveCounts[i];
                  const needsMore = count < 3 && holesScored >= 15;
                  return (
                    <button key={i} onClick={() => setDrive(currentH, i)}
                      style={{ padding: "10px 12px", borderRadius: 12, border: `2px solid ${selected ? C.green : needsMore ? C.red : C.border}`, background: selected ? C.green : needsMore ? C.redLt : C.white, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: selected ? C.white : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selected ? "✓ " : ""}{p.name.split(" ")[0]}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <div style={{ fontSize: 11, color: selected ? "rgba(255,255,255,0.7)" : C.muted }}>HCP {p.handicap}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: selected ? "rgba(255,255,255,0.9)" : needsMore ? C.red : count >= 3 ? C.green : C.navy, background: selected ? "rgba(255,255,255,0.2)" : needsMore ? C.redLt : count >= 3 ? C.greenLt : C.navyLt, padding: "1px 6px", borderRadius: 8 }}>
                          {count} drive{count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {driveWarnings.some(w => w) && holesScored >= 12 && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: C.amberLt, borderRadius: 10, fontSize: 12, color: C.amber, fontWeight: 600 }}>
                  ⚠️ {team.players.filter((_, i) => driveWarnings[i]).map(p => p.name.split(" ")[0]).join(", ")} need{driveWarnings.filter(w=>w).length === 1 ? "s" : ""} min 3 drives
                </div>
              )}
            </div>

            {/* Score input — blocked until drive selected */}
            <div style={{ padding: "14px 16px 16px", opacity: hDrive === null ? 0.4 : 1, pointerEvents: hDrive === null ? "none" : "auto", transition:"opacity 0.2s" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Team Score {hDrive === null ? "— select drive first" : ""}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[-3,-2,-1,0,1,2,3,4].map(offset => {
                  const val = hole.par + offset;
                  if (val < 1) return null;
                  const selected = hScore === val;
                  const vp = vsParLabel(offset);
                  return (
                    <button key={offset} onClick={() => setHoleScore(currentH, String(val))}
                      style={{ flex: "1 0 auto", minWidth: 44, height: 52, borderRadius: 10, border: `2px solid ${selected ? C.navy : C.border}`, background: selected ? C.navy : C.white, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 900, color: selected ? C.white : C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, transition: "all 0.15s" }}>
                      <span>{val}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: selected ? "rgba(255,255,255,0.7)" : vp.color }}>{offset === 0 ? "Par" : offset === -3 ? "Albatross" : vp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hole scorecard summary */}
          <div style={{ ...card, margin: "0 12px 16px" }}>
            <div style={{ padding: "12px 16px 4px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Scorecard</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: C.muted, fontWeight: 700, fontSize: 10 }}>HOLE</th>
                    {activeCourse.holes.map(h => (
                      <th key={h.h} style={{ padding: "6px 4px", textAlign: "center", color: h.h === hole.h ? C.navy : C.muted, fontWeight: h.h === hole.h ? 900 : 600, fontSize: 10, minWidth: 24 }}>{h.h}</th>
                    ))}
                    <th style={{ padding: "6px 8px", textAlign: "center", color: C.muted, fontWeight: 700, fontSize: 10 }}>TOT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 8px", color: C.muted, fontSize: 10, fontWeight: 700 }}>PAR</td>
                    {activeCourse.holes.map(h => (
                      <td key={h.h} style={{ padding: "4px 4px", textAlign: "center", color: C.muted, fontSize: 11 }}>{h.par}</td>
                    ))}
                    <td style={{ padding: "4px 8px", textAlign: "center", color: C.muted, fontWeight: 700, fontSize: 11 }}>70</td>
                  </tr>
                  <tr style={{ background: C.bg }}>
                    <td style={{ padding: "6px 8px", color: C.navy, fontSize: 10, fontWeight: 700 }}>SCORE</td>
                    {activeCourse.holes.map((h, i) => {
                      const s = scores[i];
                      const vp = s !== null ? s - h.par : null;
                      // PGA scorecard formatting:
                      // Eagle or better (-2+): double circle (gold)
                      // Birdie (-1): single circle (red)
                      // Par (0): plain number (navy)
                      // Bogey (+1): single square (black border)
                      // Double bogey (+2): double square (black border)
                      // Triple+ (+3): double square red border
                      const pgaStyle = () => {
                        if (vp === null) return {};
                        if (vp <= -2) return { // Eagle or better — double circle gold
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22, borderRadius:"50%",
                          border:`2px solid ${C.gold}`,
                          boxShadow:`0 0 0 3px ${C.gold}`,
                          color: C.gold, fontWeight:900,
                        };
                        if (vp === -1) return { // Birdie — single circle red
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22, borderRadius:"50%",
                          border:`2px solid ${C.red}`,
                          color: C.red, fontWeight:900,
                        };
                        if (vp === 0) return { // Par — plain
                          color: C.navy, fontWeight:700,
                        };
                        if (vp === 1) return { // Bogey — single square
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22,
                          border:`2px solid ${C.text}`,
                          color: C.text, fontWeight:900,
                        };
                        if (vp === 2) return { // Double bogey — double square
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22,
                          border:`2px solid ${C.text}`,
                          boxShadow:`0 0 0 3px ${C.text}`,
                          color: C.text, fontWeight:900,
                        };
                        return { // Triple+ — double square red
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22,
                          border:`2px solid ${C.red}`,
                          boxShadow:`0 0 0 3px ${C.red}`,
                          color: C.red, fontWeight:900,
                        };
                      };
                      return (
                        <td key={h.h} style={{ padding: "4px 2px", textAlign: "center", fontSize: 11 }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <span style={pgaStyle()}>{s ?? "·"}</span>
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 900, fontSize: 12, color: vsParLabel(grossVsPar).color }}>{holesScored > 0 ? grossTotal : "–"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ padding: "10px 16px", display: "flex", gap: 16, borderTop: `1px solid ${C.border}` }}>
              <div><div style={{ fontSize: 10, color: C.muted }}>Gross</div><div style={{ fontWeight: 900, fontSize: 16, color: vsParLabel(grossVsPar).color }}>{holesScored > 0 ? vsParLabel(grossVsPar).label : "–"}</div></div>
              <div><div style={{ fontSize: 10, color: C.muted }}>Allowance</div><div style={{ fontWeight: 900, fontSize: 16, color: C.navy }}>-{allowance}</div></div>
              <div><div style={{ fontSize: 10, color: C.muted }}>Net</div><div style={{ fontWeight: 900, fontSize: 16, color: holesScored > 0 ? vsParLabel(netVsPar).color : C.muted }}>{holesScored > 0 ? vsParLabel(netVsPar).label : "–"}</div></div>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ flexShrink: 0, background: C.navyDk, display: "flex", borderTop: "1px solid rgba(255,255,255,0.08)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <button onClick={() => setCurrentH(h => Math.max(0, h - 1))} disabled={currentH === 0}
            style={{ flex: 1, padding: "12px 0", border: "none", background: "none", color: currentH === 0 ? "rgba(255,255,255,0.2)" : C.white, fontSize: 22, cursor: currentH === 0 ? "not-allowed" : "pointer" }}>‹</button>
          <button onClick={() => setPage("leaderboard")}
            style={{ flex: 2, padding: "12px 0", border: "none", background: "none", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}>🏆 LEADERBOARD</button>
          <button onClick={() => setCurrentH(h => Math.min(17, h + 1))} disabled={currentH === 17}
            style={{ flex: 1, padding: "12px 0", border: "none", background: "none", color: currentH === 17 ? "rgba(255,255,255,0.2)" : C.white, fontSize: 22, cursor: currentH === 17 ? "not-allowed" : "pointer" }}>›</button>
        </div>
      </div>
    );
  }

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100dvh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'Montserrat',Arial,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');`}</style>
      <div style={{ background: C.navyDk, padding: "14px 16px 12px", flexShrink: 0, borderBottom: `3px solid ${C.red}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, fontSize: 20, color: C.white }}>wRight<span style={{ color: C.red }}>Score</span></div>
          {team && <button onClick={() => setPage("scoring")} style={{ background: C.red, border: "none", borderRadius: 8, color: C.white, fontSize: 11, fontWeight: 700, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>← My Card</button>}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Castle Golf Club · Live</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, padding:"10px 12px 6px", background:C.white, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <button style={tPill(lbTab==="teams")} onClick={() => setLbTab("teams")}>🏆 Teams</button>
        <button style={tPill(lbTab==="prizes")} onClick={() => setLbTab("prizes")}>
          🎯 Prize Holes {Object.keys(photos).length > 0 ? `(${Object.keys(photos).length})` : ""}
        </button>
        <button style={tPill(lbTab==="auction")} onClick={() => setLbTab("auction")}>
          ❤️ Auction
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 24px" }}>

        {/* ── TEAMS TAB ── */}
        {lbTab === "teams" && <>
          <div style={card}>
            <div style={{ background: C.navy, padding: "10px 14px" }}>
              <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>🏆 Team Standings</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>Ranked by net score · Scramble allowance applied</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 40px", gap: 4, padding: "8px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["","Team","Shots","Net","Holes"].map((h,i) => (
                <div key={i} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, textAlign: i > 1 ? "center" : "left" }}>{h}</div>
              ))}
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⛳</div>
                <div style={{ fontSize: 13 }}>No scores submitted yet</div>
              </div>
            ) : leaderboard.map((t, i) => {
              const isMine = t.id === team?.id;
              const gvp = vsParLabel(t.grossVsPar);
              const nvp = vsParLabel(t.netVsPar);
              return (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 40px", gap: 4, padding: "12px 14px", borderBottom: `1px solid ${C.border}`, background: isMine ? C.navyLt : i === 0 ? "#fffbeb" : C.white, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: i < 3 ? 18 : 14, textAlign: "center" }}>{medal(i)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isMine ? C.navy : C.text }}>{t.name}{isMine ? " ★" : ""}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Allow: -{t.allowance} shots</div>
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 700, fontSize: 16, color: C.text }}>{t.gross}</div>
                  <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: nvp.color }}>{nvp.label}</div>
                  <div style={{ textAlign: "center", fontSize: 12, color: C.muted, fontWeight: 700 }}>{t.holes}</div>
                </div>
              );
            })}
          </div>
          {allTeams.filter(t => !leaderboard.find(l => l.id === t.id)).length > 0 && (
            <div style={card}>
              <div style={{ padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Yet to Start</div>
              </div>
              {allTeams.filter(t => !leaderboard.find(l => l.id === t.id)).map(t => (
                <div key={t.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Allow: -{calcScrambleAllowance(t.players)} shots</div>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ── PRIZES TAB ── */}
        {lbTab === "prizes" && Object.keys(sponsoredHolesData).length === 0 && (
          <div style={{ ...card, padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>
            No sponsored holes set up for this competition yet.
          </div>
        )}
        {lbTab === "prizes" && Object.entries(sponsoredHolesData).map(([holeIdx, sponsor]) => {
          const idx = parseInt(holeIdx);
          const hole = activeCourse.holes[idx];
          const photo = photos[idx];
          const winner = prizeWinners[idx];
          return (
            <div key={idx} style={card}>
              {/* Sponsor header with large logo */}
              <div style={{ background: sponsor.sponsorColor, padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", gap:16 }}>
                {sponsor.sponsorLogo && (
                  <img src={sponsor.sponsorLogo} alt="sponsor" style={{ height:120, maxWidth:"80%", objectFit:"contain", background:"rgba(255,255,255,0.95)", borderRadius:12, padding:"8px 16px" }}/>
                )}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:2, textTransform:"uppercase" }}>Hole {idx+1} · Par {hole.par}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:C.white, marginTop:4 }}>{sponsor.icon} {sponsor.type}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.8)", marginTop:4, fontWeight:600 }}>Sponsored by {sponsor.sponsorName}</div>
                </div>
              </div>

              {/* Prize description */}
              {sponsor.prizeDesc && (
                <div style={{ padding:"16px", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:28 }}>🏆</span>
                  <div style={{ fontWeight:700, fontSize:16, color:C.text }}>{sponsor.prizeDesc}</div>
                </div>
              )}

              {/* Winner banner */}
              {winner ? (
                <div style={{ background:C.greenLt, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ fontSize:28 }}>🏆</div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:"uppercase", letterSpacing:1 }}>Winner</div>
                    <div style={{ fontSize:16, fontWeight:900, color:C.text }}>{winner.playerName}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{winner.teamName}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding:"10px 16px", background:C.amberLt }}>
                  <div style={{ fontSize:12, color:C.amber, fontWeight:600 }}>⏳ Winner not yet confirmed</div>
                </div>
              )}
            </div>
          );
        })}

        {lbTab === "prizes" && Object.keys(sponsoredHolesData).length === 0 && (
          <div style={{ padding:"40px 20px", textAlign:"center", color:C.muted }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
            <div style={{ fontSize:13 }}>No prize holes configured</div>
          </div>
        )}

        {/* ── AUCTION TAB ── */}
        {lbTab === "auction" && <>
          {/* Bid modal */}
          {bidItem && (
            <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}
              onClick={() => { setBidItem(null); setBidError(""); setBidAmount(""); }}>
              <div style={{ background:C.white, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:420, overflow:"hidden", boxShadow:"0 -8px 40px rgba(0,0,0,0.3)" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ background:C.navy, padding:"16px 20px 14px" }}>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Place a Bid · All proceeds to charity ❤️</div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ fontSize:36 }}>{bidItem.emoji || "🏆"}</div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:900, color:C.white }}>{bidItem.title}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:2 }}>{bidItem.description}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding:"16px 20px" }}>
                  {(() => {
                    const top = topBid(bidItem.id);
                    const minNext = (top ? top.amount : bidItem.start_bid - 1) + 10;
                    return (<>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
                        <div>
                          <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>{top ? "Current Bid" : "Starting Bid"}</div>
                          <div style={{ fontSize:28, fontWeight:900, color:C.navy }}>€{top ? top.amount : bidItem.start_bid}</div>
                          <div style={{ fontSize:11, color:C.muted }}>Min next bid: €{minNext}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>Closes</div>
                          <div style={{ fontSize:18, fontWeight:700, color:C.red }}>{bidItem.closes_at}</div>
                          <div style={{ fontSize:11, color:C.muted }}>{(bids[bidItem.id]||[]).length} bid{(bids[bidItem.id]||[]).length!==1?"s":""}</div>
                        </div>
                      </div>
                      {bidSuccess ? (
                        <div style={{ padding:"16px", background:C.greenLt, borderRadius:12, textAlign:"center", fontSize:15, fontWeight:700, color:C.green }}>{bidSuccess}</div>
                      ) : (<>
                        {/* Quick bid buttons */}
                        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                          {[minNext, minNext+20, minNext+50, minNext+100].map(amt => (
                            <button key={amt} onClick={() => setBidAmount(String(amt))}
                              style={{ flex:1, padding:"10px 0", borderRadius:10, border:`2px solid ${bidAmount===String(amt)?C.navy:C.border}`, background:bidAmount===String(amt)?C.navy:C.white, color:bidAmount===String(amt)?C.white:C.text, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                              €{amt}
                            </button>
                          ))}
                        </div>
                        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                          <div style={{ flex:1, position:"relative" }}>
                            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, fontWeight:700, color:C.muted }}>€</span>
                            <input type="number" placeholder={String(minNext)} value={bidAmount}
                              onChange={e => { setBidAmount(e.target.value); setBidError(""); }}
                              style={{ width:"100%", padding:"12px 12px 12px 28px", border:`2px solid ${bidError?C.red:C.border}`, borderRadius:10, fontSize:18, fontWeight:700, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                          </div>
                          <button onClick={handleBid} disabled={!team || bidItem?.is_closed}
                            style={{ padding:"12px 20px", borderRadius:10, border:"none", background:team&&!bidItem?.is_closed?C.red:"#ccc", color:C.white, fontWeight:700, fontSize:15, cursor:team&&!bidItem?.is_closed?"pointer":"not-allowed", fontFamily:"inherit" }}>
                            Bid ❤️
                          </button>
                        </div>
                        {bidError && <div style={{ fontSize:12, color:C.red, fontWeight:600 }}>{bidError}</div>}
                        {!team && <div style={{ fontSize:12, color:C.amber, fontWeight:600, marginTop:4 }}>⚠️ Sign in to place a bid</div>}
                      </>)}
                    </>);
                  })()}
                </div>
                <button onClick={() => { setBidItem(null); setBidError(""); setBidAmount(""); }}
                  style={{ width:"100%", padding:"14px", border:"none", background:C.bg, color:C.muted, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.muted, fontStyle:"italic" }}>
              ❤️ All proceeds go to charity — bid generously!
            </div>
            <button onClick={async () => {
              if (!competition) return;
              const [items, existingBids] = await Promise.all([
                sb.get("auction_items", `select=*&competition_id=eq.${competition.id}&order=sort_order`),
                sb.get("auction_bids", `select=*&competition_id=eq.${competition.id}&order=placed_at.desc`),
              ]);
              setAuctionItems(items.map(i => ({ ...i, start_bid: i.start_bid || 0 })));
              const bidsMap = {};
              existingBids.forEach(b => {
                if (!bidsMap[b.item_id]) bidsMap[b.item_id] = [];
                bidsMap[b.item_id].push({ teamName: b.team_name, amount: b.amount, time: new Date(b.placed_at).toLocaleTimeString() });
              });
              setBids(bidsMap);
            }}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:20, border:`1px solid ${C.border}`, background:C.white, color:C.navy, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              ↺ Refresh
            </button>
          </div>

          {auctionItems.map(item => {
            const top = topBid(item.id);
            const myBids = (bids[item.id]||[]).filter(b => b.teamName === team?.name);
            const iAmWinning = top && team && top.teamName === team.name;
            return (
              <div key={item.id} style={{ ...card, border: iAmWinning ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
                    {item.image ? (
                      <img src={item.image} alt={item.title} style={{ width:64, height:64, borderRadius:10, objectFit:"cover", flexShrink:0 }}/>
                    ) : (
                      <div style={{ width:64, height:64, borderRadius:10, background:C.navyLt, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, flexShrink:0 }}>{item.emoji}</div>
                    )}
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{item.title}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{item.description}</div>
                      <div style={{ fontSize:11, color:C.red, marginTop:4, fontWeight:600 }}>⏰ Closes {item.closes_at}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>{top ? "Current Bid" : "Starting Bid"}</div>
                      <div style={{ fontSize:24, fontWeight:900, color:iAmWinning?C.green:C.navy }}>€{top ? top.amount : item.start_bid}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{(bids[item.id]||[]).length} bid{(bids[item.id]||[]).length!==1?"s":""}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      {iAmWinning && <div style={{ fontSize:11, color:C.green, fontWeight:700, marginBottom:6 }}>🏆 You're winning!</div>}
                      {myBids.length > 0 && !iAmWinning && <div style={{ fontSize:11, color:C.amber, fontWeight:700, marginBottom:6 }}>⚡ You've been outbid!</div>}
                      {item.is_closed ? (
                        <div style={{ padding:"10px 18px", borderRadius:10, background:"rgba(0,0,0,0.1)", color:C.muted, fontWeight:700, fontSize:14, textAlign:"center" }}>
                          🔒 Bidding Closed
                        </div>
                      ) : (
                        <button onClick={() => { setBidItem(item); setBidAmount(""); setBidError(""); }}
                          style={{ padding:"10px 18px", borderRadius:10, border:"none", background:iAmWinning?C.green:C.red, color:C.white, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                          {myBids.length > 0 ? "Bid Again" : "Place Bid"} ❤️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>}

      </div>

      {!team && (
        <div style={{ flexShrink: 0, padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", background: C.navyDk }}>
          <button onClick={() => setPage("pin")} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: C.red, color: C.white, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Sign In to Score →
          </button>
        </div>
      )}
    </div>
  );
}
