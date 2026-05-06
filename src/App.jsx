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

// ─── GOLF CLUB IMAGE (splash background) ─────────────────────────────────────
const CLUB_IMG = "data:image/png;base64,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";

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
      <img className="wr-club" src={CLUB_IMG} alt="" aria-hidden="true"
        style={{ position:"absolute", width:300, height:"auto", top:"50%", left:"50%",
                 transform:"translate(-50%, -52%)", pointerEvents:"none", zIndex:0 }}/>
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
                      {(() => {
                        const lo = Math.max(1, r.par - 3);
                        const vals = [];
                        for (let v = lo; v <= 10; v++) vals.push(v);
                        return vals.map(val => {
                          const selected = r.sc === val;
                          return (
                            <button key={val} onClick={() => setStablefordScore(currentH, r.slot, String(val))}
                              style={{ flex: "1 0 38px", minWidth: 38, height: 42, borderRadius: 8, border: `2px solid ${selected ? C.navy : C.border}`, background: selected ? C.navy : C.white, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, color: selected ? C.white : C.text, transition: "all 0.1s" }}>
                              {val}
                            </button>
                          );
                        });
                      })()}
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
                {(() => {
                  const lo = Math.max(1, hole.par - 3);
                  const vals = [];
                  for (let v = lo; v <= 10; v++) vals.push(v);
                  return vals.map(val => {
                    const offset = val - hole.par;
                    const selected = hScore === val;
                    const vp = vsParLabel(offset);
                    const label = offset === 0 ? "Par" : offset === -3 ? "Albatross" : vp.label;
                    return (
                      <button key={val} onClick={() => setHoleScore(currentH, String(val))}
                        style={{ flex: "1 0 auto", minWidth: 44, height: 52, borderRadius: 10, border: `2px solid ${selected ? C.navy : C.border}`, background: selected ? C.navy : C.white, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 900, color: selected ? C.white : C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, transition: "all 0.15s" }}>
                        <span>{val}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: selected ? "rgba(255,255,255,0.7)" : vp.color }}>{label}</span>
                      </button>
                    );
                  });
                })()}
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
          <button style={tPill(lbTab==="auction")} onClick={() => setLbTab("auction")}>❤️ Auction</button>
          <button style={tPill(lbTab==="prizes")} onClick={() => setLbTab("prizes")}>🎯 Prizes</button>
        </> : <>
          <button style={tPill(lbTab==="teams")} onClick={() => setLbTab("teams")}>🏆 Teams</button>
          <button style={tPill(lbTab==="auction")} onClick={() => setLbTab("auction")}>
            ❤️ Auction
          </button>
          <button style={tPill(lbTab==="prizes")} onClick={() => setLbTab("prizes")}>
            🎯 Prize Holes {Object.keys(photos).length > 0 ? `(${Object.keys(photos).length})` : ""}
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
