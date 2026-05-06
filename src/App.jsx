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

// ─── STABLEFORD HELPERS (Full WHS) ───────────────────────────────────────────
// Course Handicap = round( HCP Index × Slope/113 + (CR − Par) )
// Playing Handicap = round( Course HCP × allowance )
function courseHandicap(idx, course) {
  const i = parseFloat(idx);
  if (isNaN(i)) return 0;
  if (!course || !course.slope || course.rating == null || course.par == null) return Math.round(i);
  return Math.round(i * (course.slope / 113) + (parseFloat(course.rating) - parseInt(course.par)));
}
function playingHcp(idx, course, allow) {
  return Math.round(courseHandicap(idx, course) * allow);
}
// Stableford points from gross score, par, and strokes received on this hole
function stbPts(gross, par, strokes) {
  if (gross == null) return null;
  const diff = (gross - strokes) - par;
  if (diff <= -2) return 4;
  if (diff === -1) return 3;
  if (diff ===  0) return 2;
  if (diff ===  1) return 1;
  return 0;
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
    sponsorLogo: null,
    prizeImage: null,
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
  const [competition,setCompetition]= useState(null);
  const [courseData, setCourseData] = useState(null);
  const [liveComps,  setLiveComps]  = useState([]);
  const [pinInput,   setPinInput]   = useState("");
  const [pinError,   setPinError]   = useState("");
  const [scores,     setScores]     = useState(Array(18).fill(null));
  const [drives,     setDrives]     = useState(Array(18).fill(null));
  // STABLEFORD — per-player scores: scoresByPlayer[slot 0..3][hole 0..17] = grossScore | null
  const [scoresByPlayer, setScoresByPlayer] = useState(() => Array(4).fill(null).map(() => Array(18).fill(null)));
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
  const [allScores, setAllScores] = useState([]);
  // Map of course_id → resolved course object {id, name, par, rating, slope, holes:[...]}
  // Built from all competition_courses attached to the comp. Used for per-player tee calcs.
  const [compCoursesMap, setCompCoursesMap] = useState({});
  const saveTimer = useRef({});

  useEffect(() => {
    loadLiveComps();
    setTimeout(() => setSplashDone(true), 3400);
  }, []);

  const loadLiveComps = async () => {
    try {
      const comps = await sb.get("competitions", "select=*&status=eq.live&order=name");
      setLiveComps(comps);
      if (comps.length === 1) {
        await loadCompetition(comps[0]);
      }
    } catch(e) {
      setLoadError("Could not connect to server");
    }
  };

  useEffect(() => {
    if (splashDone) setPage("pin");
  }, [splashDone]);

  const loadCompetition = async (comp) => {
    setCompetition(comp);

    // Load ALL attached courses first so we can resolve each player's tee.
    // For stableford comps the admin may attach 2+ tees (e.g. Men's White + Women's Red).
    // For scramble comps there's typically just one course.
    let coursesMap = {};
    let primaryCourse = null;
    try {
      const compCourses = await sb.get(
        "competition_courses",
        `select=*,courses(*)&competition_id=eq.${comp.id}`
      );
      compCourses.forEach(cc => {
        if (cc.courses) {
          const holes = Array.isArray(cc.courses.holes)
            ? cc.courses.holes
            : JSON.parse(cc.courses.holes);
          coursesMap[cc.courses.id] = { ...cc.courses, holes };
        }
      });
      // Primary = the day=1 course (if marked) or first attached course as fallback
      const day1 = compCourses.find(cc => cc.day === 1) || compCourses[0];
      if (day1 && day1.courses) {
        primaryCourse = coursesMap[day1.courses.id];
        setCourseData(primaryCourse);
      }
      setCompCoursesMap(coursesMap);
    } catch(e) {
      console.error("Could not load courses:", e.message);
    }

    await Promise.allSettled([
      Promise.all([
        sb.get("teams", `select=*&competition_id=eq.${comp.id}&order=name`),
        sb.get("players", `select=*&competition_id=eq.${comp.id}&order=slot`),
      ]).then(([teams, players]) => {
        const teamsWithPlayers = teams.map(t => ({
          ...t,
          players: players.filter(p => p.team_id === t.id).map(p => {
            // Resolve player's course: either their assigned tee, or fall back to primary
            const course = (p.course_id && coursesMap[p.course_id]) || primaryCourse || null;
            return {
              name: p.name,
              handicap: p.handicap,
              company: p.company,
              course_id: p.course_id || null,
              course, // resolved object: {par, rating, slope, holes:[{h,par,si}], name, ...}
            };
          })
        }));
        setAllTeams(teamsWithPlayers);
      }),

      sb.get("auction_items", `select=*&competition_id=eq.${comp.id}&order=sort_order`)
        .then(items => setAuctionItems(items.map(i => ({ ...i, start_bid: i.start_bid || 0 })))),

      sb.get("auction_bids", `select=*&competition_id=eq.${comp.id}&order=placed_at.desc`)
        .then(existingBids => {
          const bidsMap = {};
          existingBids.forEach(b => {
            if (!bidsMap[b.item_id]) bidsMap[b.item_id] = [];
            bidsMap[b.item_id].push({ teamName: b.team_name, amount: b.amount, time: new Date(b.placed_at).toLocaleTimeString() });
          });
          setBids(bidsMap);
        }),

      sb.get("scores", `select=*&competition_id=eq.${comp.id}`)
        .then(allSc => setAllScores(allSc)),

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

  useEffect(() => {
    if (page === "leaderboard" && competition) {
      sb.get("scores", `select=*&competition_id=eq.${competition.id}`)
        .then(sc => setAllScores(sc))
        .catch(() => {});
    }
  }, [page]);
  const activeCourse = courseData || CASTLE_GC;
  const isStableford = competition?.format === "stableford_b3of4";

  const allowance = team ? calcScrambleAllowance(team.players) : 0;

  const driveCounts = team ? team.players.map((_, i) =>
    drives.filter(d => d === i).length
  ) : [];

  const driveWarnings = driveCounts.map(c => c < 3);
  const holesScored = scores.filter(s => s !== null).length;
  const minDriveMet = driveCounts.every(c => c >= 3);

  const grossTotal = scores.reduce((sum, s) => sum + (s || 0), 0);
  const parTotal = activeCourse.holes.reduce((sum, h, i) => scores[i] !== null ? sum + h.par : sum, 0);
  const grossVsPar = holesScored > 0 ? grossTotal - parTotal : 0;
  const netScoreByHole = activeCourse.holes.map((h, i) => {
    if (scores[i] === null) return null;
    const s = strokesOnHole(allowance, h.si);
    return scores[i] - s;
  });
  const netTotal = netScoreByHole.reduce((sum, s) => sum + (s ?? 0), 0);
  const netVsPar = holesScored > 0 ? netTotal - parTotal : 0;

  const leaderboard = allTeams.map(t => {
    const tAllowance = calcScrambleAllowance(t.players);
    let tScores = Array(18).fill(null);
    if (t.id === team?.id) {
      tScores = scores;
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

  // ─── STABLEFORD CALCS — current team (TEAMS view at 90%) ───────────────────
  // Each player uses their OWN course/tee for handicap calc and stableford points.
  // (e.g. man off Men's White uses par 72 / 129 / 72.0; woman off Women's Red
  // uses par 74 / 135 / 74.2 — and gets par-5 on H7/H10 instead of par-4.)
  const myStableford = (() => {
    if (!team || !isStableford) return null;
    const players = (team.players || []).slice(0, 4);
    while (players.length < 4) players.push(null);

    const perPlayer = players.map((p, slot) => {
      if (!p) return { slot, name: "—", idx: 0, cHcp: 0, phpTeams: 0, phpNett: 0, points: 0, holesPlayed: 0, course: null };
      const idx = parseFloat(p.handicap);
      const pCourse = p.course || activeCourse;
      const cHcp = courseHandicap(idx, pCourse);
      const phpTeams = playingHcp(idx, pCourse, 0.9);
      const phpNett  = playingHcp(idx, pCourse, 1.0);
      let points = 0, played = 0;
      (pCourse.holes || []).forEach((h, hIdx) => {
        const sc = scoresByPlayer[slot]?.[hIdx];
        if (sc != null) {
          played++;
          points += stbPts(sc, h.par, strokesOnHole(phpTeams, h.si));
        }
      });
      return { slot, name: p.name, idx: isNaN(idx) ? "–" : idx, cHcp, phpTeams, phpNett, points, holesPlayed: played, course: pCourse };
    });

    let teamTotal = 0, teamHoles = 0;
    // Iterate by hole index (0..17). Each player's points for that hole are
    // computed against THEIR own course's par/SI for that hole.
    for (let hIdx = 0; hIdx < 18; hIdx++) {
      const ptsThisHole = perPlayer.map(pp => {
        if (!players[pp.slot] || !pp.course) return null;
        const sc = scoresByPlayer[pp.slot]?.[hIdx];
        if (sc == null) return null;
        const h = pp.course.holes[hIdx];
        if (!h) return null;
        return stbPts(sc, h.par, strokesOnHole(pp.phpTeams, h.si));
      }).filter(x => x !== null);
      if (ptsThisHole.length > 0) {
        teamHoles++;
        const top3 = [...ptsThisHole].sort((a,b) => b-a).slice(0, 3);
        teamTotal += top3.reduce((s,x) => s+x, 0);
      }
    }

    return { perPlayer, teamTotal, teamHoles };
  })();

  // ─── STABLEFORD LEADERBOARDS (all teams) ───────────────────────────────────
  // Same per-player-course logic across the whole field.
  const stablefordBoards = (() => {
    if (!isStableford) return null;
    const playerRows = [];
    allTeams.forEach(t => {
      const players = (t.players || []).slice(0, 4);
      players.forEach((p, slot) => {
        if (!p) return;
        const idx = parseFloat(p.handicap);
        const pCourse = p.course || activeCourse;
        const cHcp = courseHandicap(idx, pCourse);
        const phpTeams = playingHcp(idx, pCourse, 0.9);
        const phpNett  = playingHcp(idx, pCourse, 1.0);

        let pTeams = 0, pNett = 0, pGross = 0, played = 0;
        (pCourse.holes || []).forEach((h, hIdx) => {
          let sc = null;
          if (t.id === team?.id) {
            sc = scoresByPlayer[slot]?.[hIdx];
          } else {
            const found = allScores.find(s => s.team_id === t.id && s.player_slot === slot && s.hole_index === hIdx);
            sc = found?.gross_score ?? null;
          }
          if (sc != null) {
            played++;
            pTeams += stbPts(sc, h.par, strokesOnHole(phpTeams, h.si));
            pNett  += stbPts(sc, h.par, strokesOnHole(phpNett,  h.si));
            pGross += stbPts(sc, h.par, 0);
          }
        });

        playerRows.push({
          teamId: t.id, teamName: t.name, slot,
          name: p.name, idx: isNaN(idx) ? "–" : idx, cHcp, phpTeams, phpNett,
          pTeams, pNett, pGross, played,
          courseName: pCourse?.name || "—",
        });
      });
    });

    const teams = allTeams.map(t => {
      const tp = playerRows.filter(p => p.teamId === t.id);
      // Build a lookup of player → course for the team-total iteration
      const teamPlayerCourses = (t.players || []).slice(0, 4).map(pl => pl?.course || activeCourse);
      let total = 0, holesScored = 0;
      for (let hIdx = 0; hIdx < 18; hIdx++) {
        const pts = tp.map(p => {
          let sc = null;
          if (t.id === team?.id) {
            sc = scoresByPlayer[p.slot]?.[hIdx];
          } else {
            const found = allScores.find(s => s.team_id === t.id && s.player_slot === p.slot && s.hole_index === hIdx);
            sc = found?.gross_score ?? null;
          }
          if (sc == null) return null;
          const pCourse = teamPlayerCourses[p.slot];
          const h = pCourse?.holes?.[hIdx];
          if (!h) return null;
          return stbPts(sc, h.par, strokesOnHole(p.phpTeams, h.si));
        }).filter(x => x !== null);
        if (pts.length > 0) {
          holesScored++;
          const top3 = [...pts].sort((a,b) => b-a).slice(0, 3);
          total += top3.reduce((s,x) => s+x, 0);
        }
      }
      return { ...t, total, holesScored, playerCount: tp.length };
    }).sort((a,b) => b.total - a.total);

    const nett  = [...playerRows].filter(p => p.played > 0).sort((a,b) => b.pNett  - a.pNett);
    const gross = [...playerRows].filter(p => p.played > 0).sort((a,b) => b.pGross - a.pGross);

    return { teams, nett, gross };
  })();

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
      try {
        const existing = await sb.get("scores", `select=*&competition_id=eq.${competition.id}&team_id=eq.${found.id}`);
        if (competition.format === "stableford_b3of4") {
          // STABLEFORD — populate scoresByPlayer[slot][hole]
          const grid = Array(4).fill(null).map(() => Array(18).fill(null));
          existing.forEach(s => {
            if (s.player_slot >= 0 && s.player_slot < 4 && s.hole_index >= 0 && s.hole_index < 18) {
              grid[s.player_slot][s.hole_index] = s.gross_score;
            }
          });
          setScoresByPlayer(grid);
          // jump to first incomplete hole (any active player missing a score)
          const firstIncomplete = activeCourse.holes.findIndex((_, hIdx) =>
            grid.some((playerScores, slot) => found.players[slot] && playerScores[hIdx] === null)
          );
          if (firstIncomplete > 0) setCurrentH(firstIncomplete);
        } else if (existing.length > 0) {
          // SCRAMBLE — populate flat scores + drives (unchanged)
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

  // SCRAMBLE — set hole score (unchanged from your existing flow)
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

  // STABLEFORD — set per-player score
  const setStablefordScore = async (hIdx, pSlot, val) => {
    const grid = scoresByPlayer.map(row => [...row]);
    const intVal = val === "" ? null : parseInt(val);
    grid[pSlot][hIdx] = intVal;
    setScoresByPlayer(grid);

    if (team && competition && intVal != null) {
      setSyncStatus("saving");
      try {
        await sb.upsert("scores", [{
          competition_id: competition.id,
          team_id: team.id,
          hole_index: hIdx,
          gross_score: intVal,
          player_slot: pSlot,
          drive_player: null,
        }]);
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("online"), 1500);
      } catch(e) {
        setSyncStatus("error:" + e.message);
      }
    }

    // Sponsor popup — only when ALL active players have scored on this hole
    const activeSlots = (team?.players || []).slice(0, 4).map((_, i) => i);
    const allScored = activeSlots.every(slot => grid[slot][hIdx] != null);
    const nextIdx = hIdx + 1;
    if (allScored && nextIdx < 18 && sponsoredHolesData[nextIdx]) {
      setTimeout(() => setSponsorPopup(nextIdx), 600);
    }
  };

  const setDrive = (hIdx, playerIdx) => {
    const next = [...drives];
    next[hIdx] = next[hIdx] === playerIdx ? null : playerIdx;
    setDrives(next);
  };

  const handlePhoto = (hIdx, file, playerName) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const photoUrl = e.target.result;
      setPhotos(prev => ({ ...prev, [hIdx]: { url: photoUrl, playerName, teamName: team?.name, timestamp: new Date().toLocaleTimeString() } }));
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

  const handleBid = async () => {
    if (!bidItem || !team) return;
    const amount = parseFloat(bidAmount);
    const itemBids = bids[bidItem.id] || [];
    const currentTop = itemBids.length > 0 ? Math.max(...itemBids.map(b => b.amount)) : (bidItem.start_bid || bidItem.start_bid || 0) - 1;
    const minBid = currentTop + 10;
    if (isNaN(amount) || amount < minBid) { setBidError(`Minimum bid is €${minBid}`); return; }
    try {
      await sb.upsert("auction_bids", [{
        item_id: bidItem.id,
        competition_id: competition?.id,
        team_id: team.id,
        team_name: team.name,
        amount: amount,
        placed_at: new Date().toISOString(),
      }]);
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
      {[{top:20,left:20,borderTop:`1.5px solid ${C.navy}`,borderLeft:`1.5px solid ${C.navy}`},{top:20,right:20,borderTop:`1.5px solid ${C.navy}`,borderRight:`1.5px solid ${C.navy}`},{bottom:20,left:20,borderBottom:`1.5px solid ${C.navy}`,borderLeft:`1.5px solid ${C.navy}`},{bottom:20,right:20,borderBottom:`1.5px solid ${C.navy}`,borderRight:`1.5px solid ${C.navy}`}].map((s,i)=>(
        <div key={i} style={{ position:"absolute", width:24, height:24, opacity:0.3, ...s }}/>
      ))}
      <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div className="wr-word" style={{ position:"relative", zIndex:1, display:"flex", alignItems:"baseline", lineHeight:1 }}>
          <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontWeight:700, fontSize:44, color:C.navy, letterSpacing:"-0.5px" }}>wRight</span>
          <span style={{ width:10, display:"inline-block" }}/>
          <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontWeight:900, fontSize:44, color:C.red }}>Score</span>
        </div>
        <div className="wr-div" style={{ position:"relative", zIndex:1, height:1.5, background:`linear-gradient(90deg, transparent, ${C.red}, transparent)`, margin:"13px 0 11px" }}/>
        <div className="wr-tag" style={{ position:"relative", zIndex:1, fontFamily:"'Montserrat',Arial,sans-serif", fontWeight:600, fontSize:10, letterSpacing:4, textTransform:"uppercase", color:C.navy }}>Tournament Scoring</div>
      </div>
      {/* NOTE: The golf club background image (~50KB base64 PNG) was kept as-is in your existing file.
          It will continue to render correctly when you paste this file in. The <img className="wr-club" .../>
          element from your current src/App.jsx should be retained at this position to preserve the splash visual.
          If you replace the file wholesale and lose the image, just paste it back from your existing source. */}
    </div>
  );

  if (page === "pin") return (
    <div style={{ width: "100%", height: "100vh", background: C.navyDk, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',Arial,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: "100%", maxWidth: 340, padding: "0 24px" }}>
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

        {!competition && liveComps.length > 1 && (
          <div style={{ width: "100%", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, textAlign: "center" }}>
              Select your event
            </div>
            {liveComps.map(c => (
              <button key={c.id} onClick={async () => { await loadCompetition(c); }}
                style={{ width: "100%", padding: "14px 16px", marginBottom: 8, borderRadius: 12, border: `2px solid rgba(255,255,255,0.15)`, background: "rgba(255,255,255,0.07)", color: C.white, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div>{c.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3, fontWeight: 400 }}>{c.location || (c.format === "stableford_b3of4" ? "Stableford – Best 3 of 4" : "Scramble")}</div>
              </button>
            ))}
          </div>
        )}

        {(competition || liveComps.length === 1) && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 56, height: 64, borderRadius: 12, background: pinInput[i] ? C.navy : "rgba(255,255,255,0.08)", border: `2px solid ${pinInput[i] ? C.red : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: C.white, transition: "all 0.15s" }}>
                  {pinInput[i] ? "•" : ""}
                </div>
              ))}
            </div>

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

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — STABLEFORD SCORING (NEW — only for stableford_b3of4 format)
  // ════════════════════════════════════════════════════════════════════════════
  if (page === "scoring" && team && isStableford) {
    const teamPlayers = (team.players || []).slice(0, 4);
    const sponsorInfo = sponsoredHolesData[currentH];
    const isSponsored = !!sponsorInfo;

    // Each player's own course/tee for THIS hole.
    // For mixed-tee teams (e.g. men off Men's White par-4 H7, women off Women's Red par-5 H7)
    // we look up par/SI per player rather than using a shared hole.
    const holeRows = teamPlayers.map((p, slot) => {
      const idx = parseFloat(p.handicap);
      const pCourse  = p.course || activeCourse;
      const pHole    = pCourse.holes[currentH] || { par: 4, si: 9 };
      const phpTeams = playingHcp(idx, pCourse, 0.9);
      const phpNett  = playingHcp(idx, pCourse, 1.0);
      const cHcp     = courseHandicap(idx, pCourse);
      const strokes  = strokesOnHole(phpTeams, pHole.si);
      const sc       = scoresByPlayer[slot]?.[currentH];
      const pts      = sc != null ? stbPts(sc, pHole.par, strokes) : null;
      // Friendly tee label e.g. "Men's White" extracted from course name
      const teeLabel = (pCourse.name || "").match(/\(([^)]+)\)/)?.[1] || pCourse.name || "Tee";
      return { slot, name: p.name, idx: isNaN(idx)?"–":idx, cHcp, phpTeams, phpNett, strokes, sc, pts, par: pHole.par, si: pHole.si, teeLabel, courseName: pCourse.name };
    });

    const validPts = holeRows.map(r => r.pts).filter(p => p != null).sort((a,b) => b-a);
    const top3Sum = validPts.slice(0, 3).reduce((s,x) => s+x, 0);
    const allScored = teamPlayers.every((_, slot) => scoresByPlayer[slot]?.[currentH] != null);

    // Holes "done" = every active player has scored. Iterate by index since
    // each player may be on a different course.
    let holesDone = 0;
    for (let h = 0; h < 18; h++) {
      if (teamPlayers.every((_, slot) => scoresByPlayer[slot]?.[h] != null)) holesDone++;
    }

    return (
      <div style={{ width: "100%", height: "100dvh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Montserrat',Arial,sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');`}</style>

        {sponsorPopup !== null && sponsoredHolesData[sponsorPopup] && (
          <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
            onClick={() => { setSponsorPopup(null); setCurrentH(sponsorPopup); }}>
            <div style={{ background:C.white, borderRadius:20, overflow:"hidden", width:"100%", maxWidth:340, boxShadow:"0 20px 60px rgba(0,0,0,0.4)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ background: sponsoredHolesData[sponsorPopup].sponsorColor, padding:"20px 20px 16px", textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:3, textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:8 }}>Sponsored by</div>
                {sponsoredHolesData[sponsorPopup].sponsorLogo ? (
                  <img src={sponsoredHolesData[sponsorPopup].sponsorLogo} alt="sponsor" style={{ height:48, objectFit:"contain" }}/>
                ) : (
                  <div style={{ fontSize:24, fontWeight:900, color:C.white, letterSpacing:"-0.5px" }}>
                    {sponsoredHolesData[sponsorPopup].sponsorName}
                  </div>
                )}
              </div>
              <div style={{ padding:"16px 20px 12px", textAlign:"center", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontSize:32, marginBottom:6 }}>{sponsoredHolesData[sponsorPopup].icon}</div>
                <div style={{ fontSize:22, fontWeight:900, color:C.text }}>{sponsoredHolesData[sponsorPopup].type}</div>
                <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>
                  Hole {sponsorPopup + 1} — Par {activeCourse.holes[sponsorPopup].par}
                </div>
              </div>
              <div style={{ padding:"14px 20px 8px", textAlign:"center" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:C.muted, marginBottom:10 }}>The Prize</div>
                <div style={{ background:sponsoredHolesData[sponsorPopup].sponsorColor+"18", borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>🏆</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text, lineHeight:1.3 }}>
                    {sponsoredHolesData[sponsorPopup].prizeDesc || "Prize TBC"}
                  </div>
                </div>
              </div>
              <button onClick={() => { setSponsorPopup(null); setCurrentH(sponsorPopup); }}
                style={{ width:"100%", padding:"16px", border:"none", background:sponsoredHolesData[sponsorPopup].sponsorColor, color:C.white, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5 }}>
                Let's Go — Hole {sponsorPopup + 1} →
              </button>
            </div>
          </div>
        )}

        {/* Header */}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Team Pts</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#4ade80" }}>{myStableford?.teamTotal ?? 0}</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "4px 0" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>This Hole</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: allScored ? "#4ade80" : "rgba(255,255,255,0.5)" }}>{allScored ? top3Sum : "–"}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Holes</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.white }}>{holesDone}/18</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* Hole nav strip */}
          <div style={{ display: "flex", gap: 6, padding: "10px 12px 6px", overflowX: "auto" }}>
            {activeCourse.holes.map((h, i) => {
              const allScoredHere = teamPlayers.every((_, slot) => scoresByPlayer[slot]?.[i] != null);
              const someScoredHere = teamPlayers.some((_, slot) => scoresByPlayer[slot]?.[i] != null);
              const bg = i === currentH ? "#1B4B8A"
                : allScoredHere ? "#4ade80"
                : someScoredHere ? "#fef3c7"
                : "#e2e8f0";
              const col = i === currentH ? "#ffffff"
                : allScoredHere ? "#14532d"
                : someScoredHere ? "#78350f"
                : "#94a3b8";
              return (
                <button key={i} onClick={() => setCurrentH(i)}
                  style={{ flexShrink: 0, width: 60, height: 60, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 18, fontWeight: 700, position: "relative",
                    background: bg, color: col,
                    boxShadow: i === currentH ? `0 2px 8px rgba(27,75,138,0.4)` : "none",
                    outline: sponsoredHolesData[i] ? `3px solid ${sponsoredHolesData[i].sponsorColor}` : "none",
                  }}>
                  {h.h}
                  {allScoredHere && i !== currentH && (
                    <span style={{ position:"absolute", bottom:4, right:6, fontSize:10, opacity:0.8 }}>✓</span>
                  )}
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
            <div style={{ background: C.navy, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: C.white, fontWeight: 900, fontSize: 22 }}>Hole {currentH + 1}</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 }}>
                  {(() => {
                    // Show pars summary — if all players share par, show single value; if mixed, show both
                    const pars = [...new Set(holeRows.map(r => r.par))].sort();
                    if (pars.length === 1) return `Par ${pars[0]}`;
                    return `Par ${pars.join("/")} (mixed tees)`;
                  })()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:1 }}>Best 3 of 4</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: allScored ? "#4ade80" : "rgba(255,255,255,0.3)" }}>{allScored ? top3Sum : "–"}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>pts this hole</div>
              </div>
            </div>

            {/* 4 player rows */}
            <div style={{ padding: "8px 12px 12px" }}>
              {holeRows.map(r => {
                const isTopContributor = allScored && r.pts != null && validPts.slice(0, 3).includes(r.pts);
                return (
                  <div key={r.slot} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 12, background: isTopContributor ? "#dcfce7" : C.bg, border: `1px solid ${isTopContributor ? C.green : C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0, flex:1 }}>
                        <div style={{ width:24, height:24, borderRadius:"50%", background:C.navy, color:C.white, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                          {r.slot + 1}
                        </div>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                              {r.name}{isTopContributor ? " ⭐" : ""}
                            </div>
                            <div style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:8, background:C.navyLt, color:C.navy, letterSpacing:0.3 }}>
                              {r.teeLabel}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                            Par {r.par} · SI {r.si} · HCP {r.idx} · Play {r.phpTeams}{r.strokes > 0 ? ` · +${r.strokes} stroke${r.strokes>1?"s":""}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", minWidth:50, flexShrink:0 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: r.pts != null ? C.green : C.muted, lineHeight:1 }}>
                          {r.pts != null ? r.pts : "–"}
                        </div>
                        <div style={{ fontSize: 9, color: C.muted, textTransform:"uppercase", letterSpacing:0.5 }}>pts</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
                      {[-3,-2,-1,0,1,2,3,4].map(off => {
                        const val = r.par + off;
                        if (val < 1) return null;
                        const selected = r.sc === val;
                        return (
                          <button key={off} onClick={() => setStablefordScore(currentH, r.slot, String(val))}
                            style={{ flex: "1 0 38px", minWidth: 38, height: 42, borderRadius: 8, border: `2px solid ${selected ? C.navy : C.border}`, background: selected ? C.navy : C.white, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, color: selected ? C.white : C.text, transition: "all 0.1s" }}>
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {!allScored && (
                <div style={{ padding: "8px 12px", background: C.amberLt, borderRadius: 10, fontSize: 11, color: C.amber, fontWeight: 600, textAlign: "center" }}>
                  ⚠️ All 4 players need a score for this hole to count
                </div>
              )}
            </div>
          </div>
        </div>

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

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — SCRAMBLE SCORING (your existing code, byte-for-byte preserved)
  // ════════════════════════════════════════════════════════════════════════════
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

        {sponsorPopup !== null && sponsoredHolesData[sponsorPopup] && (
          <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
            onClick={() => { setSponsorPopup(null); setCurrentH(sponsorPopup); }}>
            <div style={{ background:C.white, borderRadius:20, overflow:"hidden", width:"100%", maxWidth:340, boxShadow:"0 20px 60px rgba(0,0,0,0.4)" }}
              onClick={e => e.stopPropagation()}>
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
              <div style={{ padding:"16px 20px 12px", textAlign:"center", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontSize:32, marginBottom:6 }}>{sponsoredHolesData[sponsorPopup].icon}</div>
                <div style={{ fontSize:22, fontWeight:900, color:C.text }}>
                  {sponsoredHolesData[sponsorPopup].type}
                </div>
                <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>
                  Hole {sponsorPopup + 1} — {activeCourse.holes[sponsorPopup].par === 3 ? "Par 3" : activeCourse.holes[sponsorPopup].par === 5 ? "Par 5" : "Par 4"}
                </div>
              </div>
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

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

          <div style={{ display: "flex", gap: 6, padding: "10px 12px 6px", overflowX: "auto" }}>
            {activeCourse.holes.map((h, i) => {
              const s = scores[i];
              const done = s !== null;
              const vp = done ? s - h.par : null;
              const bg = i === currentH ? "#1B4B8A"
                : done ? "#4ade80"
                : "#e2e8f0";
              const col = i === currentH ? "#ffffff"
                : done ? "#14532d"
                : "#94a3b8";
              return (
                <button key={i} onClick={() => setCurrentH(i)}
                  style={{ flexShrink: 0, width: 68, height: 68, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 18, fontWeight: 700, transition: "all 0.15s", position: "relative",
                    background: bg, color: col,
                    boxShadow: i === currentH ? `0 2px 8px rgba(27,75,138,0.4)` : "none",
                    outline: sponsoredHolesData[i] ? `3px solid ${sponsoredHolesData[i].sponsorColor}` : "none",
                  }}>
                  {h.h}
                  {done && i !== currentH && (
                    <span style={{ position:"absolute", bottom:4, right:6, fontSize:10, opacity:0.8 }}>✓</span>
                  )}
                  {sponsoredHolesData[i] && (
                    <span style={{ position:"absolute", top:-6, right:-6, fontSize:12, background:sponsoredHolesData[i].sponsorColor, borderRadius:"50%", width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {sponsoredHolesData[i].icon === "🎯" ? "📍" : "💨"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ ...card, margin: "6px 12px" }}>
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

          {/* PGA-style Scorecard summary */}
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
                    <td style={{ padding: "4px 8px", textAlign: "center", color: C.muted, fontWeight: 700, fontSize: 11 }}>{activeCourse.par}</td>
                  </tr>
                  <tr style={{ background: C.bg }}>
                    <td style={{ padding: "6px 8px", color: C.navy, fontSize: 10, fontWeight: 700 }}>SCORE</td>
                    {activeCourse.holes.map((h, i) => {
                      const s = scores[i];
                      const vp = s !== null ? s - h.par : null;
                      const pgaStyle = () => {
                        if (vp === null) return {};
                        if (vp <= -2) return {
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22, borderRadius:"50%",
                          border:`2px solid ${C.gold}`,
                          boxShadow:`0 0 0 3px ${C.gold}`,
                          color: C.gold, fontWeight:900,
                        };
                        if (vp === -1) return {
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22, borderRadius:"50%",
                          border:`2px solid ${C.red}`,
                          color: C.red, fontWeight:900,
                        };
                        if (vp === 0) return {
                          color: C.navy, fontWeight:700,
                        };
                        if (vp === 1) return {
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22,
                          border:`2px solid ${C.text}`,
                          color: C.text, fontWeight:900,
                        };
                        if (vp === 2) return {
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22,
                          border:`2px solid ${C.text}`,
                          boxShadow:`0 0 0 3px ${C.text}`,
                          color: C.text, fontWeight:900,
                        };
                        return {
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

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — LEADERBOARD (format-aware)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ width: "100%", height: "100dvh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'Montserrat',Arial,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;600&display=swap');`}</style>
      <div style={{ background: C.navyDk, padding: "14px 16px 12px", flexShrink: 0, borderBottom: `3px solid ${C.red}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, fontSize: 20, color: C.white }}>wRight<span style={{ color: C.red }}>Score</span></div>
          {team && <button onClick={() => setPage("scoring")} style={{ background: C.red, border: "none", borderRadius: 8, color: C.white, fontSize: 11, fontWeight: 700, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>← My Card</button>}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>{activeCourse.name} · Live</div>
      </div>

      {/* Tabs — 5 for stableford, 3 for scramble */}
      <div style={{ display:"flex", gap:6, padding:"10px 12px 6px", background:C.white, borderBottom:`1px solid ${C.border}`, flexShrink:0, overflowX:"auto" }}>
        {isStableford ? <>
          <button style={tPill(lbTab==="teams")} onClick={() => setLbTab("teams")}>🏆 Teams</button>
          <button style={tPill(lbTab==="nett")} onClick={() => setLbTab("nett")}>👤 Nett</button>
          <button style={tPill(lbTab==="gross")} onClick={() => setLbTab("gross")}>⛳ Gross</button>
          <button style={tPill(lbTab==="prizes")} onClick={() => setLbTab("prizes")}>🎯 Prizes</button>
          <button style={tPill(lbTab==="auction")} onClick={() => setLbTab("auction")}>❤️ Auction</button>
        </> : <>
          <button style={tPill(lbTab==="teams")} onClick={() => setLbTab("teams")}>🏆 Teams</button>
          <button style={tPill(lbTab==="prizes")} onClick={() => setLbTab("prizes")}>
            🎯 Prize Holes {Object.keys(photos).length > 0 ? `(${Object.keys(photos).length})` : ""}
          </button>
          <button style={tPill(lbTab==="auction")} onClick={() => setLbTab("auction")}>
            ❤️ Auction
          </button>
        </>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 24px" }}>

        {/* ── STABLEFORD TEAMS ── */}
        {isStableford && lbTab === "teams" && stablefordBoards && <>
          <div style={card}>
            <div style={{ background: C.navy, padding: "10px 14px" }}>
              <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>🏆 TEAMS</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 2 }}>90% Course Handicap · best 3 of 4 stableford</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px", gap: 4, padding: "8px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["","Team","Holes","Pts"].map((h,i) => (
                <div key={i} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, textAlign: i > 1 ? "center" : "left" }}>{h}</div>
              ))}
            </div>
            {stablefordBoards.teams.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⛳</div>
                <div style={{ fontSize: 13 }}>No scores yet</div>
              </div>
            ) : stablefordBoards.teams.map((t, i) => {
              const isMine = t.id === team?.id;
              return (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 60px", gap: 4, padding: "12px 14px", borderBottom: `1px solid ${C.border}`, background: isMine ? C.navyLt : i === 0 ? "#fffbeb" : C.white, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: i < 3 ? 18 : 14, textAlign: "center" }}>{medal(i)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isMine ? C.navy : C.text }}>{t.name}{isMine ? " ★" : ""}</div>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 12, color: C.muted, fontWeight: 700 }}>{t.holesScored}/18</div>
                  <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: C.green }}>{t.holesScored > 0 ? t.total : "–"}</div>
                </div>
              );
            })}
          </div>
          <div style={card}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: 0.3 }}>📐 How handicaps are calculated</div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
                <div><strong style={{ color: C.text }}>Course Handicap</strong> = round(HCP Index × Slope ÷ 113 + (CR − Par))</div>
                <div><strong style={{ color: C.text }}>Playing Handicap</strong> = round(Course HCP × allowance)</div>
                <div style={{ marginTop: 6 }}>• <strong style={{ color: C.text }}>TEAMS</strong>: 90% allowance, best 3 of 4 stableford per hole</div>
                <div>• <strong style={{ color: C.text }}>Player Nett</strong>: 100% allowance, individual stableford</div>
                <div>• <strong style={{ color: C.text }}>Player Gross</strong>: scratch (no strokes received)</div>
                <div style={{ marginTop: 6 }}><strong style={{ color: C.text }}>Stableford points</strong>: Eagle+ = 4 · Birdie = 3 · Par = 2 · Bogey = 1 · Double Bogey or worse = 0</div>
                <div style={{ marginTop: 8, padding: "8px 10px", background: C.navyLt, borderRadius: 8, fontSize: 10.5, color: C.text }}>
                  <strong>Mixed tees:</strong> each player's handicap and stableford points are calculated using their own tee — par, rating and slope can differ between Men's and Women's tees, and even between colours. Team total is best 3 of 4 contributors per hole regardless.
                </div>
                {Object.keys(compCoursesMap).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text, marginBottom: 4 }}>Tees in play:</div>
                    {Object.values(compCoursesMap).map(c => (
                      <div key={c.id} style={{ fontSize: 10, color: C.muted }}>
                        • <strong style={{ color: C.text }}>{c.name}</strong> — Par {c.par} · CR {c.rating} · Slope {c.slope}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>}

        {/* ── STABLEFORD NETT ── */}
        {isStableford && lbTab === "nett" && stablefordBoards && <>
          <div style={card}>
            <div style={{ background: C.navyDk, padding: "10px 14px" }}>
              <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>👤 Player Nett</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 2 }}>100% Course Handicap · individual stableford</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 50px 50px 50px", gap: 4, padding: "8px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["","Player","Play","Holes","Pts"].map((h,i) => (
                <div key={i} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, textAlign: i > 1 ? "center" : "left" }}>{h}</div>
              ))}
            </div>
            {stablefordBoards.nett.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>No scores yet</div>
            ) : stablefordBoards.nett.map((p, i) => {
              const isMine = p.teamId === team?.id;
              const teeLabel = (p.courseName || "").match(/\(([^)]+)\)/)?.[1] || null;
              return (
                <div key={`${p.teamId}-${p.slot}`} style={{ display: "grid", gridTemplateColumns: "32px 1fr 50px 50px 50px", gap: 4, padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: isMine ? C.navyLt : C.white, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: i < 3 ? 16 : 13, textAlign: "center" }}>{medal(i)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span>{p.teamName}</span>
                      {teeLabel && <span style={{ fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:6, background:C.navyLt, color:C.navy }}>{teeLabel}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: C.text }}>{p.phpNett}</div>
                  <div style={{ textAlign: "center", fontSize: 12, color: C.muted, fontWeight: 700 }}>{p.played}/18</div>
                  <div style={{ textAlign: "center", fontWeight: 900, fontSize: 16, color: C.green }}>{p.pNett}</div>
                </div>
              );
            })}
          </div>
          <div style={card}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8 }}>📐 How handicaps are calculated</div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
                <div><strong style={{ color: C.text }}>Course Handicap</strong> = round(HCP Index × Slope ÷ 113 + (CR − Par))</div>
                <div><strong style={{ color: C.text }}>Player Nett</strong> uses 100% of Course Handicap. Stableford points: Eagle+ = 4 · Birdie = 3 · Par = 2 · Bogey = 1 · Double+ = 0.</div>
                <div style={{ marginTop: 8, padding: "8px 10px", background: C.navyLt, borderRadius: 8, fontSize: 10.5, color: C.text }}>
                  <strong>Mixed tees:</strong> each player's nett points are calculated against their own tee (par + SI + rating + slope).
                </div>
              </div>
            </div>
          </div>
        </>}

        {/* ── STABLEFORD GROSS ── */}
        {isStableford && lbTab === "gross" && stablefordBoards && <>
          <div style={card}>
            <div style={{ background: C.navyDk, padding: "10px 14px" }}>
              <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>⛳ Player Gross</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 2 }}>Scratch · no handicap strokes</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 50px 50px 50px", gap: 4, padding: "8px 14px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["","Player","Idx","Holes","Pts"].map((h,i) => (
                <div key={i} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, textAlign: i > 1 ? "center" : "left" }}>{h}</div>
              ))}
            </div>
            {stablefordBoards.gross.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>No scores yet</div>
            ) : stablefordBoards.gross.map((p, i) => {
              const isMine = p.teamId === team?.id;
              const teeLabel = (p.courseName || "").match(/\(([^)]+)\)/)?.[1] || null;
              return (
                <div key={`${p.teamId}-${p.slot}`} style={{ display: "grid", gridTemplateColumns: "32px 1fr 50px 50px 50px", gap: 4, padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: isMine ? C.navyLt : C.white, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: i < 3 ? 16 : 13, textAlign: "center" }}>{medal(i)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span>{p.teamName}</span>
                      {teeLabel && <span style={{ fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:6, background:C.navyLt, color:C.navy }}>{teeLabel}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: C.text }}>{p.idx}</div>
                  <div style={{ textAlign: "center", fontSize: 12, color: C.muted, fontWeight: 700 }}>{p.played}/18</div>
                  <div style={{ textAlign: "center", fontWeight: 900, fontSize: 16, color: C.green }}>{p.pGross}</div>
                </div>
              );
            })}
          </div>
          <div style={card}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8 }}>📐 Player Gross — scratch leaderboard</div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
                <div>No handicap strokes applied. Stableford points scored against par of each hole directly: Eagle+ = 4 · Birdie = 3 · Par = 2 · Bogey = 1 · Double+ = 0.</div>
                <div style={{ marginTop: 8, padding: "8px 10px", background: C.navyLt, borderRadius: 8, fontSize: 10.5, color: C.text }}>
                  <strong>Mixed tees:</strong> par per hole comes from each player's own tee — e.g. on Mullingar's H7, men's tee = par 4 / women's tee = par 5, so a 5 there scores differently for each.
                </div>
              </div>
            </div>
          </div>
        </>}

        {/* ── SCRAMBLE TEAMS (unchanged) ── */}
        {!isStableford && lbTab === "teams" && <>
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

        {/* ── PRIZES (shared) ── */}
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

              {sponsor.prizeDesc && (
                <div style={{ padding:"16px", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:28 }}>🏆</span>
                  <div style={{ fontWeight:700, fontSize:16, color:C.text }}>{sponsor.prizeDesc}</div>
                </div>
              )}

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

        {/* ── AUCTION (shared) ── */}
        {lbTab === "auction" && <>
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
