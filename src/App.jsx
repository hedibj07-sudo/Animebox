import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  Home,
  Library,
  Plus,
  BookOpen,
  User,
  Search,
  Bell,
  UserPlus,
  Check,
  X,
  LogOut,
  ArrowLeft,
  Pencil,
} from "lucide-react";

/* ============================================================
   SORTIA — carnet de visionnage d'anime
   Thème sombre, navigation basse façon application mobile
   ============================================================ */

const PALETTE = {
  bg: "#0B0B10",
  surface: "#17171F",
  surfaceAlt: "#1F1F29",
  line: "#2A2A36",
  text: "#F5F5F7",
  muted: "#8E8E99",
  blue: "#4C7DFF",
  gold: "#F6C544",
  danger: "#FF5C5C",
  ok: "#3DDC84",
};

const GENRE_GRADIENTS = {
  Shonen: "linear-gradient(135deg,#2A2140,#4C3D6E)",
  Seinen: "linear-gradient(135deg,#1A2A3D,#274966)",
  Slice: "linear-gradient(135deg,#3D2A1A,#664927)",
  Fantasy: "linear-gradient(135deg,#2E1E44,#5A3B7A)",
  SF: "linear-gradient(135deg,#173B3D,#1F5B5E)",
  Anime: "linear-gradient(135deg,#1F1F29,#2A2A36)",
};

const ANILIST_URL = "https://graphql.anilist.co";

let alChain = Promise.resolve();
function aniListFetch(query, variables) {
  const call = alChain
    .then(() => new Promise((resolve) => setTimeout(resolve, 400)))
    .then(() =>
      fetch(ANILIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      })
    );
  alChain = call.catch(() => {});
  return call;
}

const TOP_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: POPULARITY_DESC, type: ANIME) {
        id
        title { romaji english }
        startDate { year }
        genres
        coverImage { large extraLarge }
        averageScore
      }
    }
  }
`;

const SEARCH_ANIME_QUERY = `
  query ($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english }
        startDate { year }
        genres
        coverImage { large extraLarge }
        averageScore
      }
    }
  }
`;

function fromAniList(m) {
  return {
    id: `al-${m.id}`,
    title: (m.title && (m.title.english || m.title.romaji)) || "Sans titre",
    year: String((m.startDate && m.startDate.year) || "?"),
    genre: (m.genres && m.genres[0]) || "Anime",
    image: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || null,
    score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
  };
}

function Poster({ image, genre, children }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: GENRE_GRADIENTS[genre] || GENRE_GRADIENTS.Anime, overflow: "hidden" }}>
      {image && <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      {children}
    </div>
  );
}

function StarIcon({ fill, size, color, emptyColor }) {
  if (fill === "full") return <span style={{ color, fontSize: size, lineHeight: 1 }}>★</span>;
  if (fill === "empty") return <span style={{ color: emptyColor, fontSize: size, lineHeight: 1 }}>★</span>;
  return (
    <span style={{ position: "relative", display: "inline-block", fontSize: size, lineHeight: 1 }}>
      <span style={{ color: emptyColor }}>★</span>
      <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden", color }}>★</span>
    </span>
  );
}

function Stars({ value, onChange, size = 20, readOnly = false }) {
  function handleClick(n) {
    if (readOnly) return;
    if (value === n) onChange(n - 0.5);
    else onChange(n);
  }
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        let fill = "empty";
        if (value >= n) fill = "full";
        else if (value >= n - 0.5) fill = "half";
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => handleClick(n)}
            aria-label={`${n} étoiles (appuyer à nouveau pour ${n - 0.5})`}
            style={{ background: "none", border: "none", padding: 0, cursor: readOnly ? "default" : "pointer" }}
          >
            <StarIcon fill={fill} size={size} color={PALETTE.gold} emptyColor={PALETTE.line} />
          </button>
        );
      })}
    </div>
  );
}

const fontImport = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; background: ${PALETTE.bg}; }
    .st-title { font-family: 'Baloo 2', 'Nunito', sans-serif; }
    .st-body { font-family: 'Nunito', sans-serif; }
    .st-card { transition: transform 140ms ease; }
    .st-card:active { transform: scale(0.97); }
    .st-btn:active { transform: scale(0.96); }
    input, textarea { font-family: inherit; }
    ::-webkit-scrollbar { display: none; }
  `}</style>
);

const NAV_ITEMS = [
  { key: "accueil", label: "Accueil", icon: Home },
  { key: "collection", label: "Collection", icon: Library },
  { key: "add", label: "", icon: Plus },
  { key: "journal", label: "Journal", icon: BookOpen },
  { key: "profil", label: "Profil", icon: User },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);

  const [tab, setTab] = useState("accueil");
  const [topAnime, setTopAnime] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [openAnime, setOpenAnime] = useState(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");

  const [showAddSearch, setShowAddSearch] = useState(false);

  const [communityQuery, setCommunityQuery] = useState("");
  const [communityResults, setCommunityResults] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewedEntries, setViewedEntries] = useState([]);
  const [viewedLoading, setViewedLoading] = useState(false);

  /* --- session --- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  /* --- mon profil (pseudo) --- */
  const loadMyProfile = useCallback(async () => {
    if (!session) return;
    setProfileLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    setMyProfile(data || null);
    setProfileLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadMyProfile();
    else setProfileLoading(false);
  }, [session, loadMyProfile]);

  async function saveUsername(e) {
    e.preventDefault();
    setUsernameError("");
    const clean = usernameDraft.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setUsernameError("3 à 20 caractères : lettres, chiffres, underscore uniquement.");
      return;
    }
    setUsernameBusy(true);
    const { error } = await supabase.from("profiles").insert({ id: session.user.id, username: clean });
    if (error) {
      setUsernameError(error.code === "23505" ? "Ce pseudo est déjà pris." : error.message);
    } else {
      await loadMyProfile();
    }
    setUsernameBusy(false);
  }

  /* --- top anime --- */
  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      let loaded = [];
      for (const page of [1, 2, 3]) {
        try {
          const res = await aniListFetch(TOP_ANIME_QUERY, { page, perPage: 50 });
          const json = await res.json();
          if (json.errors) throw new Error(json.errors[0].message);
          loaded = [...loaded, ...(json.data.Page.media || [])];
          setTopAnime(loaded.map(fromAniList));
        } catch (e) {
          if (loaded.length === 0) setCatalogError("Impossible de charger les tendances pour le moment.");
          break;
        }
      }
      setCatalogLoading(false);
    })();
  }, []);

  /* --- recherche d'anime --- */
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const res = await aniListFetch(SEARCH_ANIME_QUERY, { search: q, perPage: 12 });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        const items = (json.data.Page.media || []).map(fromAniList);
        setSearchResults(items);
        if (items.length === 0) setSearchError("Aucun résultat pour cette recherche.");
      } catch (e) {
        setSearchError("Recherche indisponible : réessaie dans quelques secondes.");
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* --- mes notes --- */
  const loadEntries = useCallback(async () => {
    if (!session) return;
    setEntriesLoading(true);
    const { data, error } = await supabase.from("entries").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (!error) setEntries(data || []);
    setEntriesLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadEntries();
  }, [session, loadEntries]);

  /* --- demandes d'amis --- */
  const loadFriendRequests = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("friend_requests").select("*").or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);
    setFriendRequests(data || []);
  }, [session]);

  useEffect(() => {
    if (session) loadFriendRequests();
  }, [session, loadFriendRequests]);

  function relationWith(userId) {
    const row = friendRequests.find((r) => (r.sender_id === userId && r.receiver_id === session.user.id) || (r.receiver_id === userId && r.sender_id === session.user.id));
    if (!row) return { type: "none" };
    if (row.status === "accepted") return { type: "friends", row };
    if (row.sender_id === session.user.id) return { type: "sent", row };
    return { type: "received", row };
  }

  async function sendFriendRequest(userId) {
    await supabase.from("friend_requests").insert({ sender_id: session.user.id, receiver_id: userId, status: "pending" });
    loadFriendRequests();
  }
  async function acceptFriendRequest(row) {
    await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", row.id);
    loadFriendRequests();
  }
  async function removeRelation(row) {
    await supabase.from("friend_requests").delete().eq("id", row.id);
    loadFriendRequests();
  }

  /* --- recherche de pseudos --- */
  useEffect(() => {
    const q = communityQuery.trim();
    if (q.length < 2) {
      setCommunityResults([]);
      return;
    }
    setCommunityLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("*").ilike("username", `%${q}%`).neq("id", session.user.id).limit(20);
      setCommunityResults(data || []);
      setCommunityLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [communityQuery, session]);

  async function viewProfile(profile) {
    setViewingProfile(profile);
    setViewedLoading(true);
    const { data } = await supabase.from("entries").select("*").eq("user_id", profile.id).order("created_at", { ascending: false });
    setViewedEntries(data || []);
    setViewedLoading(false);
  }

  /* --- auth --- */
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthBusy(true);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
      else setAuthNotice("Compte créé ! Vérifie ta boîte mail si une confirmation est demandée, puis connecte-toi.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
    }
    setAuthBusy(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setEntries([]);
    setMyProfile(null);
  }

  /* --- notation --- */
  function openRating(anime) {
    const existing = entries.find((e) => e.anime_id === anime.id);
    setDraftRating(existing ? existing.rating : 0);
    setDraftComment(existing ? existing.comment || "" : "");
    setOpenAnime(anime);
    setShowAddSearch(false);
  }

  async function saveEntry() {
    if (!openAnime || !session) return;
    setSaveError("");
    const { error } = await supabase.from("entries").upsert(
      {
        user_id: session.user.id,
        anime_id: openAnime.id,
        anime_title: openAnime.title,
        anime_image: openAnime.image,
        anime_year: openAnime.year,
        anime_genre: openAnime.genre,
        rating: draftRating,
        comment: draftComment.trim(),
      },
      { onConflict: "user_id,anime_id" }
    );
    if (error) setSaveError("La sauvegarde a échoué : " + error.message);
    else {
      setOpenAnime(null);
      loadEntries();
    }
  }

  async function removeEntry(animeId) {
    const { error } = await supabase.from("entries").delete().eq("anime_id", animeId);
    if (error) setSaveError("La suppression a échoué : " + error.message);
    else loadEntries();
  }

  /* ---------- Chargement ---------- */
  if (authLoading) {
    return (
      <div className="st-body" style={{ background: PALETTE.bg, color: PALETTE.muted, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fontImport}
        Chargement…
      </div>
    );
  }

  /* ---------- Connexion ---------- */
  if (!session) {
    return (
      <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, padding: "48px 20px" }}>
        {fontImport}
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <h1 className="st-title" style={{ fontSize: 40, margin: "0 0 6px", fontWeight: 800 }}>Sortia</h1>
          <p style={{ color: PALETTE.muted, marginBottom: 28, fontSize: 15 }}>Ton carnet de visionnage d'anime. Note, commente, retrouve tes amis.</p>

          <div style={{ display: "flex", gap: 6, background: PALETTE.surface, padding: 5, borderRadius: 999, marginBottom: 20 }}>
            <button onClick={() => setAuthMode("signin")} className="st-btn" style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", background: authMode === "signin" ? PALETTE.blue : "transparent", color: authMode === "signin" ? "#fff" : PALETTE.muted }}>Connexion</button>
            <button onClick={() => setAuthMode("signup")} className="st-btn" style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", background: authMode === "signup" ? PALETTE.blue : "transparent", color: authMode === "signup" ? "#fff" : PALETTE.muted }}>Créer un compte</button>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Adresse email" style={{ padding: "13px 16px", borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }} />
            <input type="password" required minLength={6} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Mot de passe (6 caractères min.)" style={{ padding: "13px 16px", borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }} />
            <button type="submit" disabled={authBusy} className="st-btn" style={{ padding: "14px 0", borderRadius: 999, border: "none", background: PALETTE.blue, color: "#fff", fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", fontSize: 16, cursor: "pointer" }}>
              {authBusy ? "…" : authMode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>
          {authError && <p style={{ color: PALETTE.danger, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{authError}</p>}
          {authNotice && <p style={{ color: PALETTE.ok, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{authNotice}</p>}
        </div>
      </div>
    );
  }

  /* ---------- Choix du pseudo ---------- */
  if (!profileLoading && !myProfile) {
    return (
      <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, padding: "48px 20px", display: "flex", alignItems: "center" }}>
        {fontImport}
        <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
          <h1 className="st-title" style={{ fontSize: 28, marginBottom: 8, fontWeight: 800 }}>Choisis ton pseudo</h1>
          <p style={{ color: PALETTE.muted, marginBottom: 20, fontSize: 14 }}>Il sera visible par les autres utilisateurs pour te retrouver.</p>
          <form onSubmit={saveUsername} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ex: yuki_anime" style={{ padding: "13px 16px", borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }} />
            <button type="submit" disabled={usernameBusy} className="st-btn" style={{ padding: "14px 0", borderRadius: 999, border: "none", background: PALETTE.blue, color: "#fff", fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", fontSize: 16, cursor: "pointer" }}>
              {usernameBusy ? "…" : "Valider"}
            </button>
          </form>
          {usernameError && <p style={{ color: PALETTE.danger, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{usernameError}</p>}
        </div>
      </div>
    );
  }

  const incomingRequests = friendRequests.filter((r) => r.receiver_id === session.user.id && r.status === "pending");

  /* ---------- Vue du journal d'un autre profil ---------- */
  if (viewingProfile) {
    const rel = relationWith(viewingProfile.id);
    return (
      <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, paddingBottom: 100 }}>
        {fontImport}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setViewingProfile(null)} className="st-btn" style={{ background: PALETTE.surface, border: "none", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.text, cursor: "pointer" }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div className="st-title" style={{ fontSize: 20, fontWeight: 800 }}>@{viewingProfile.username}</div>
            <div style={{ fontSize: 12, color: PALETTE.muted }}>{viewedEntries.length} anime noté{viewedEntries.length > 1 ? "s" : ""}</div>
          </div>
          {rel.type === "none" && (
            <button onClick={() => sendFriendRequest(viewingProfile.id)} className="st-btn" style={{ background: PALETTE.blue, border: "none", borderRadius: 999, padding: "9px 14px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <UserPlus size={14} /> Ajouter
            </button>
          )}
          {rel.type === "sent" && <span style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Demande envoyée</span>}
          {rel.type === "received" && (
            <button onClick={() => acceptFriendRequest(rel.row)} className="st-btn" style={{ background: PALETTE.ok, border: "none", borderRadius: 999, padding: "9px 14px", color: "#062", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Accepter</button>
          )}
          {rel.type === "friends" && <span style={{ fontSize: 12, color: PALETTE.ok, fontWeight: 700 }}>✓ Ami</span>}
        </div>

        <div style={{ padding: "0 20px" }}>
          {viewedLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Chargement…</div>
          ) : viewedEntries.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Ce journal est vide pour l'instant.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {viewedEntries.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 14, background: PALETTE.surface, borderRadius: 16, padding: 14 }}>
                  <div style={{ width: 52, height: 74, flexShrink: 0, borderRadius: 10, overflow: "hidden" }}>
                    <Poster image={e.anime_image} genre={e.anime_genre} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="st-title" style={{ fontSize: 15, fontWeight: 700 }}>{e.anime_title}</div>
                    <Stars value={e.rating} readOnly size={13} />
                    {e.comment && <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: 4, marginBottom: 0 }}>{e.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- App principale ---------- */
  return (
    <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, paddingBottom: 100 }}>
      {fontImport}

      <div style={{ padding: "18px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="st-title" style={{ fontSize: 26, margin: 0, fontWeight: 800 }}>Sortia</h1>
        {incomingRequests.length > 0 && (
          <button onClick={() => setTab("profil")} className="st-btn" style={{ position: "relative", background: PALETTE.surface, border: "none", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.text, cursor: "pointer" }}>
            <Bell size={18} />
            <span style={{ position: "absolute", top: -2, right: -2, background: PALETTE.danger, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{incomingRequests.length}</span>
          </button>
        )}
      </div>

      {saveError && <div style={{ background: "#3A1414", color: PALETTE.danger, padding: "10px 20px", fontSize: 13, fontWeight: 600 }}>{saveError}</div>}

      <div style={{ padding: "8px 20px 20px" }}>
        {tab === "accueil" && (
          <>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: PALETTE.muted }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un anime sur Sortia"
                style={{ width: "100%", padding: "13px 16px 13px 38px", borderRadius: 14, border: "none", background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }}
              />
            </div>

            {searchQuery.trim().length > 1 ? (
              <div style={{ borderRadius: 16, background: PALETTE.surface, overflow: "hidden" }}>
                {searchLoading && <div style={{ padding: 14, fontSize: 13, color: PALETTE.muted }}>Recherche…</div>}
                {!searchLoading && searchError && <div style={{ padding: 14, fontSize: 13, color: PALETTE.danger }}>{searchError}</div>}
                {!searchLoading && !searchError && searchResults.map((r) => {
                  const entry = entries.find((e) => e.anime_id === r.id);
                  return (
                    <button key={r.id} onClick={() => openRating(r)} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 14px", borderBottom: `1px solid ${PALETTE.line}`, background: "none", border: "none", cursor: "pointer" }}>
                      <div style={{ width: 36, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}><Poster image={r.image} genre={r.genre} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: PALETTE.muted }}>{r.year} · {r.genre}</div>
                      </div>
                      {entry ? <span style={{ fontSize: 11, fontWeight: 800, color: PALETTE.ok }}>✓ noté</span> : <span style={{ fontSize: 12, fontWeight: 800, color: PALETTE.blue }}>Noter →</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 className="st-title" style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>Tendances</h2>
                </div>
                {catalogError && <div style={{ fontSize: 13, color: PALETTE.danger, marginBottom: 12 }}>{catalogError}</div>}
                {catalogLoading && topAnime.length === 0 && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Chargement…</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                  {topAnime.map((anime) => {
                    const entry = entries.find((e) => e.anime_id === anime.id);
                    return (
                      <button key={anime.id} onClick={() => openRating(anime)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                        <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                          <Poster image={anime.image} genre={anime.genre} />
                          {entry && <span style={{ position: "absolute", bottom: 6, right: 6, fontSize: 10, fontWeight: 800, color: "#062", background: PALETTE.ok, padding: "2px 8px", borderRadius: 999 }}>✓</span>}
                        </div>
                        <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{anime.title}</div>
                        <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 2 }}>{anime.year}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === "collection" && (
          <>
            <h2 className="st-title" style={{ fontSize: 20, margin: "0 0 14px", fontWeight: 800 }}>Ma collection</h2>
            {entriesLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Chargement…</div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Aucun anime noté pour l'instant.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                {entries.map((e) => (
                  <button key={e.id} onClick={() => openRating({ id: e.anime_id, title: e.anime_title, image: e.anime_image, year: e.anime_year, genre: e.anime_genre })} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                    <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                      <Poster image={e.anime_image} genre={e.anime_genre} />
                    </div>
                    <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{e.anime_title}</div>
                    <Stars value={e.rating} readOnly size={12} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "journal" && (
          <>
            <h2 className="st-title" style={{ fontSize: 20, margin: "0 0 14px", fontWeight: 800 }}>Mon journal</h2>
            {entriesLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Chargement…</div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📼</div>
                Rien de noté pour l'instant.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {entries.map((e) => (
                  <div key={e.id} style={{ display: "flex", gap: 14, background: PALETTE.surface, borderRadius: 16, padding: 14 }}>
                    <div style={{ width: 56, height: 78, flexShrink: 0, borderRadius: 10, overflow: "hidden" }}>
                      <Poster image={e.anime_image} genre={e.anime_genre} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div className="st-title" style={{ fontSize: 15, fontWeight: 700 }}>{e.anime_title}</div>
                        <span style={{ fontSize: 11, color: PALETTE.muted }}>{new Date(e.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <Stars value={e.rating} readOnly size={14} />
                      {e.comment && <p style={{ fontSize: 13, color: PALETTE.muted, marginTop: 6, marginBottom: 0 }}>{e.comment}</p>}
                      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                        <button onClick={() => openRating({ id: e.anime_id, title: e.anime_title, image: e.anime_image, year: e.anime_year, genre: e.anime_genre })} style={{ background: "none", border: "none", color: PALETTE.blue, fontSize: 12, fontWeight: 800, cursor: "pointer", padding: 0 }}>Modifier</button>
                        <button onClick={() => removeEntry(e.anime_id)} style={{ background: "none", border: "none", color: PALETTE.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>Retirer</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "profil" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: PALETTE.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff" }}>
                {myProfile.username.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div className="st-title" style={{ fontSize: 19, fontWeight: 800 }}>@{myProfile.username}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted }}>{session.user.email}</div>
              </div>
              <button onClick={handleSignOut} className="st-btn" style={{ background: PALETTE.surface, border: "none", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.danger, cursor: "pointer" }}>
                <LogOut size={16} />
              </button>
            </div>

            {(() => {
              const total = entries.length;
              const avg = total ? (entries.reduce((s, e) => s + Number(e.rating), 0) / total).toFixed(1) : "–";
              const now = new Date();
              const thisMonth = entries.filter((e) => {
                const d = new Date(e.created_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length;
              const genreCounts = {};
              entries.forEach((e) => {
                const g = e.anime_genre || "Anime";
                genreCounts[g] = (genreCounts[g] || 0) + 1;
              });
              const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
              const topGenre = topGenres[0] ? topGenres[0][0] : "–";
              const buckets = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
              const histo = buckets.map((b) => entries.filter((e) => Number(e.rating) === b).length);
              const maxHisto = Math.max(1, ...histo);
              const maxGenre = topGenres.length ? topGenres[0][1] : 1;

              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "NOTÉS", value: total },
                      { label: "NOTE MOY.", value: avg === "–" ? "–" : `${avg} ★` },
                      { label: "CE MOIS-CI", value: thisMonth },
                    ].map((s) => (
                      <div key={s.label} style={{ background: PALETTE.surface, borderRadius: 16, padding: "16px 12px" }}>
                        <div className="st-title" style={{ fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: PALETTE.muted, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {total > 0 && (
                    <>
                      <div style={{ background: PALETTE.surface, borderRadius: 16, padding: 16, marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 10 }}>RÉPARTITION DES NOTES</div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                          {histo.map((count, i) => (
                            <div key={i} style={{ flex: 1, background: PALETTE.gold, opacity: count === 0 ? 0.15 : 1, height: `${Math.max(6, (count / maxHisto) * 100)}%`, borderRadius: 4 }} title={`${buckets[i]}★ : ${count}`} />
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: PALETTE.muted }}>
                          <span>1★</span><span>3★</span><span>5★</span>
                        </div>
                      </div>

                      <div style={{ background: PALETTE.surface, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                        <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 12 }}>GENRES LES PLUS NOTÉS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {topGenres.slice(0, 5).map(([genre, count]) => (
                            <div key={genre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 70, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{genre}</div>
                              <div style={{ flex: 1, background: PALETTE.surfaceAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
                                <div style={{ width: `${(count / maxGenre) * 100}%`, background: PALETTE.blue, height: "100%", borderRadius: 999 }} />
                              </div>
                              <div style={{ fontSize: 12, color: PALETTE.muted, width: 18, textAlign: "right" }}>{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {incomingRequests.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 className="st-title" style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Demandes reçues</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {incomingRequests.map((r) => {
                    const p = communityResults.find((c) => c.id === r.sender_id);
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: PALETTE.surface, borderRadius: 14, padding: 12 }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{p ? `@${p.username}` : "Un utilisateur"}</div>
                        <button onClick={() => acceptFriendRequest(r)} className="st-btn" style={{ background: PALETTE.ok, border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Check size={15} color="#062" /></button>
                        <button onClick={() => removeRelation(r)} className="st-btn" style={{ background: PALETTE.surfaceAlt, border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={15} color={PALETTE.muted} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h3 className="st-title" style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Trouver des amis</h3>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: PALETTE.muted }} />
              <input value={communityQuery} onChange={(e) => setCommunityQuery(e.target.value)} placeholder="Chercher un pseudo…" style={{ width: "100%", padding: "12px 16px 12px 38px", borderRadius: 14, border: "none", background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }} />
            </div>
            {communityLoading && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 10 }}>Recherche…</div>}
            {!communityLoading && communityQuery.trim().length > 1 && communityResults.length === 0 && (
              <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 10 }}>Aucun pseudo trouvé.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {communityResults.map((p) => {
                const rel = relationWith(p.id);
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: PALETTE.surface, borderRadius: 14, padding: 12 }}>
                    <button onClick={() => viewProfile(p)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: PALETTE.text }}>@{p.username}</button>
                    {rel.type === "none" && (
                      <button onClick={() => sendFriendRequest(p.id)} className="st-btn" style={{ background: PALETTE.blue, border: "none", borderRadius: 999, padding: "7px 12px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Ajouter</button>
                    )}
                    {rel.type === "sent" && <span style={{ fontSize: 11, color: PALETTE.muted, fontWeight: 700 }}>Envoyée</span>}
                    {rel.type === "received" && (
                      <button onClick={() => acceptFriendRequest(rel.row)} className="st-btn" style={{ background: PALETTE.ok, border: "none", borderRadius: 999, padding: "7px 12px", color: "#062", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Accepter</button>
                    )}
                    {rel.type === "friends" && <span style={{ fontSize: 11, color: PALETTE.ok, fontWeight: 700 }}>✓ Ami</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Barre de navigation basse */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: PALETTE.surface, borderTop: `1px solid ${PALETTE.line}`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          if (item.key === "add") {
            return (
              <button key={item.key} onClick={() => setShowAddSearch(true)} className="st-btn" style={{ background: PALETTE.blue, border: "none", borderRadius: "50%", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: -22, boxShadow: "0 6px 16px rgba(76,125,255,0.5)" }}>
                <Icon size={24} color="#fff" />
              </button>
            );
          }
          const active = tab === item.key;
          return (
            <button key={item.key} onClick={() => setTab(item.key)} className="st-btn" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? PALETTE.blue : PALETTE.muted, padding: "4px 10px" }}>
              <Icon size={20} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recherche rapide (bouton +) */}
      {showAddSearch && (
        <div onClick={() => setShowAddSearch(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 20, padding: 18, maxWidth: 420, width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: PALETTE.muted }} />
              <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Chercher un anime à noter…" style={{ width: "100%", padding: "12px 16px 12px 38px", borderRadius: 14, border: "none", background: PALETTE.surfaceAlt, color: PALETTE.text, fontSize: 14 }} />
            </div>
            {searchLoading && <div style={{ fontSize: 13, color: PALETTE.muted, padding: "8px 4px" }}>Recherche…</div>}
            {!searchLoading && searchError && <div style={{ fontSize: 13, color: PALETTE.danger, padding: "8px 4px" }}>{searchError}</div>}
            {!searchLoading && searchResults.map((r) => (
              <button key={r.id} onClick={() => openRating(r)} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 4px", background: "none", border: "none", borderBottom: `1px solid ${PALETTE.line}`, cursor: "pointer" }}>
                <div style={{ width: 36, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}><Poster image={r.image} genre={r.genre} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: PALETTE.muted }}>{r.year} · {r.genre}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modale de notation */}
      {openAnime && (
        <div onClick={() => setOpenAnime(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 22, padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 64, height: 90, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Poster image={openAnime.image} genre={openAnime.genre} /></div>
              <div>
                <div className="st-title" style={{ fontSize: 19, marginBottom: 2, fontWeight: 700 }}>{openAnime.title}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted }}>{openAnime.year} · {openAnime.genre}</div>
              </div>
            </div>
            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", marginBottom: 6, fontWeight: 700 }}>Ta note</label>
            <Stars value={draftRating} onChange={setDraftRating} size={26} />
            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", margin: "16px 0 6px", fontWeight: 700 }}>Ton commentaire</label>
            <textarea value={draftComment} onChange={(e) => setDraftComment(e.target.value)} rows={4} placeholder="Qu'est-ce que tu en as pensé ?" style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 12, border: `1px solid ${PALETTE.line}`, background: PALETTE.bg, color: PALETTE.text, fontSize: 13 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button onClick={() => setOpenAnime(null)} className="st-btn" style={{ padding: "10px 18px", borderRadius: 999, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, cursor: "pointer", fontWeight: 700 }}>Annuler</button>
              <button onClick={saveEntry} disabled={draftRating === 0} className="st-btn" style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: draftRating === 0 ? PALETTE.line : PALETTE.blue, color: "#fff", fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", cursor: draftRating === 0 ? "not-allowed" : "pointer" }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
