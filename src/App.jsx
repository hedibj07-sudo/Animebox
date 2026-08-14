import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Cropper from "react-easy-crop";
import {
  Home,
  Library,
  Plus,
  BookOpen,
  User,
  Search,
  Bell,
  UserPlus,
  Users,
  Check,
  X,
  LogOut,
  ArrowLeft,
  Bookmark,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Minus,
  Shuffle,
  Calendar,
  Pencil,
  MessageCircle,
  Info,
  ChevronRight,
  TrendingUp,
  Radio,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";

/* ============================================================
   SORTIA — carnet de visionnage d'anime
   Thème sombre, navigation basse façon application mobile
   ============================================================ */

const PALETTE = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surfaceAlt)",
  line: "var(--line)",
  text: "var(--text)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  accentText: "var(--accentText)",
  gold: "var(--gold)",
  danger: "var(--danger)",
  ok: "var(--ok)",
};

const GENRE_GRADIENTS = {
  Shonen: "linear-gradient(135deg,#2A2140,#4C3D6E)",
  Seinen: "linear-gradient(135deg,#1A2A3D,#274966)",
  Slice: "linear-gradient(135deg,#3D2A1A,#664927)",
  Fantasy: "linear-gradient(135deg,#2E1E44,#5A3B7A)",
  SF: "linear-gradient(135deg,#173B3D,#1F5B5E)",
  Anime: "linear-gradient(135deg,#1F1F29,#2A2A36)",
};

const STATUS_META = {
  a_voir: { label: "À voir", icon: Bookmark, color: PALETTE.muted },
  en_cours: { label: "En cours", icon: PlayCircle, color: PALETTE.accent },
  termine: { label: "Terminé", icon: CheckCircle2, color: PALETTE.ok },
  abandonne: { label: "Abandonné", icon: XCircle, color: PALETTE.danger },
};
const STATUS_ORDER = ["a_voir", "en_cours", "termine", "abandonne"];

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
        episodes
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
        episodes
        coverImage { large extraLarge }
        averageScore
      }
    }
  }
`;

const AIRING_QUERY = `
  query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(status: RELEASING, sort: POPULARITY_DESC, type: ANIME) {
        id
        title { romaji english }
        startDate { year }
        genres
        episodes
        coverImage { large extraLarge }
        averageScore
      }
    }
  }
`;

const RECOMMENDED_QUERY = `
  query ($genre: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(genre_in: [$genre], sort: SCORE_DESC, type: ANIME) {
        id
        title { romaji english }
        startDate { year }
        genres
        episodes
        coverImage { large extraLarge }
        averageScore
      }
    }
  }
`;

const QUIZ_QUERY = `
  query ($genre: String, $page: Int, $perPage: Int, $episodesGreater: Int, $episodesLesser: Int) {
    Page(page: $page, perPage: $perPage) {
      media(genre_in: [$genre], type: ANIME, sort: POPULARITY_DESC, episodes_greater: $episodesGreater, episodes_lesser: $episodesLesser) {
        id
        title { romaji english }
        startDate { year }
        genres
        episodes
        coverImage { large extraLarge }
        averageScore
      }
    }
  }
`;

const UPCOMING_QUERY = `
  query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME) {
        id
        title { romaji english }
        startDate { year month }
        genres
        coverImage { large extraLarge }
      }
    }
  }
`;

const MONTHS_FR = ["", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function fromAniListUpcoming(m) {
  const y = m.startDate && m.startDate.year;
  const mo = m.startDate && m.startDate.month;
  let releaseLabel = "Date inconnue";
  if (y && mo) releaseLabel = `${MONTHS_FR[mo]} ${y}`;
  else if (y) releaseLabel = String(y);
  return {
    id: `al-${m.id}`,
    title: (m.title && (m.title.english || m.title.romaji)) || "Sans titre",
    genre: (m.genres && m.genres[0]) || "Anime",
    image: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || null,
    releaseLabel,
  };
}

function fromAniList(m) {
  return {
    id: `al-${m.id}`,
    title: (m.title && (m.title.english || m.title.romaji)) || "Sans titre",
    year: String((m.startDate && m.startDate.year) || "?"),
    genre: (m.genres && m.genres[0]) || "Anime",
    image: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || null,
    imageSmall: (m.coverImage && (m.coverImage.large || m.coverImage.extraLarge)) || null,
    score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
    episodes: m.episodes || null,
  };
}

// Regroupe les différentes saisons/parties d'un même anime sous une seule entrée
// (ex: "Attack on Titan", "Attack on Titan Season 2", "Attack on Titan: Final Season" -> un seul)
function seasonGroupKey(title) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:\-–—].*$/, "")
    .replace(/\b(the\s+)?final season\b/gi, "")
    .replace(/\b(season|saison|part|cour|movie|ova)\b\s*\d*/gi, "")
    .replace(/\b\d+(st|nd|rd|th)?\s*season\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function groupSeasons(list) {
  const seen = new Map();
  for (const anime of list) {
    const key = seasonGroupKey(anime.title) || anime.id;
    if (!seen.has(key)) seen.set(key, anime);
  }
  return Array.from(seen.values());
}

function Poster({ image, genre, children }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: GENRE_GRADIENTS[genre] || GENRE_GRADIENTS.Anime, overflow: "hidden" }}>
      {image && <img src={image} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      {children}
    </div>
  );
}

function StatusBadge({ entry, size = "sm" }) {
  if (!entry) return null;
  const meta = STATUS_META[entry.status] || STATUS_META.a_voir;
  const Icon = meta.icon;
  const isCompact = size === "sm";
  let text = meta.label;
  if (entry.status === "en_cours" || (entry.status === "termine" && entry.total_episodes)) {
    text = `${entry.current_episode}/${entry.total_episodes || "?"}`;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: isCompact ? 10 : 11, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.55)", padding: isCompact ? "3px 7px" : "4px 9px", borderRadius: 999 }}>
      <Icon size={isCompact ? 10 : 12} color={meta.color} /> {text}
    </span>
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
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    :root, .theme-dark {
      --bg: #0B0B10;
      --surface: #17171F;
      --surfaceAlt: #1F1F29;
      --line: #2A2A36;
      --text: #F5F5F7;
      --muted: #8E8E99;
      --accent: #F1F1F4;
      --accentText: #101018;
      --gold: #F6C544;
      --danger: #FF5C5C;
      --ok: #3DDC84;
    }
    .theme-light {
      --bg: #F7F6F3;
      --surface: #FFFFFF;
      --surfaceAlt: #F0EEE8;
      --line: #E4E1D8;
      --text: #17171F;
      --muted: #6B6B74;
      --accent: #17171F;
      --accentText: #FFFFFF;
      --gold: #C98F1E;
      --danger: #D93B3B;
      --ok: #1F9D5C;
    }

    body { margin: 0; background: var(--bg); transition: background 200ms ease; }
    .st-title { font-family: 'Outfit', 'Inter', sans-serif; }
    .st-body { font-family: 'Inter', sans-serif; }
    .st-card { transition: transform 140ms ease; }
    .st-card:active { transform: scale(0.97); }
    .st-btn:active { transform: scale(0.96); }
    input, textarea { font-family: inherit; }
    ::-webkit-scrollbar { display: none; }
    .poster-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    @media (min-width: 640px) {
      .poster-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
    }
  `}</style>
);

const NAV_ITEMS = [
  { key: "accueil", label: "Accueil", icon: Home },
  { key: "collection", label: "Collection", icon: Library },
  { key: "add", label: "", icon: Plus },
  { key: "journal", label: "Journal", icon: BookOpen },
  { key: "profil", label: "Profil", icon: User },
];

// Découpe une image selon une zone de recadrage (pixels) et renvoie un Blob carré
function getCroppedBlob(imageSrc, cropPixels, outWidth = 512, outHeight = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, outWidth, outHeight);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Découpage impossible"))), "image/jpeg", 0.9);
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

export default function App() {
  const [session, setSession] = useState(null);
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem("sortia-theme") || "dark";
    } catch (e) {
      return "dark";
    }
  });

  useEffect(() => {
    document.body.className = themeMode === "light" ? "theme-light" : "theme-dark";
    try {
      localStorage.setItem("sortia-theme", themeMode);
    } catch (e) {}
  }, [themeMode]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);

  const [tab, setTab] = useState("accueil");
  const [topAnime, setTopAnime] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [airingNow, setAiringNow] = useState([]);
  const [airingLoading, setAiringLoading] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [recommendedGenre, setRecommendedGenre] = useState(null);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [fullListView, setFullListView] = useState(null); // null | "trending" | "airing" | "recommended"
  const [upcoming, setUpcoming] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("tous");

  const [openAnime, setOpenAnime] = useState(null);
  const [draftStatus, setDraftStatus] = useState("a_voir");
  const [draftEpisode, setDraftEpisode] = useState(0);
  const [draftTotalEpisodes, setDraftTotalEpisodes] = useState(null);
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
  const [viewedComment, setViewedComment] = useState(null);
  const [friendProfiles, setFriendProfiles] = useState([]);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0); // 0,1,2 = questions, 3 = résultat
  const [quizAnswers, setQuizAnswers] = useState({ ambiance: null, know: null, format: null });
  const [quizResults, setQuizResults] = useState([]);
  const [quizPick, setQuizPick] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [justConfirmed, setJustConfirmed] = useState(false);

  /* --- retour depuis le lien de confirmation d'email --- */
  useEffect(() => {
    if (window.location.hash.includes("type=signup") || window.location.hash.includes("type=email_change")) {
      setJustConfirmed(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  /* --- session --- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) setAuthModalOpen(false);
  }, [session]);

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

  /* --- photo de profil / affiche personnalisée (avec recadrage) --- */
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = React.useRef(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  function onSelectAvatarFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result);
    reader.readAsDataURL(file);
  }

  function onCropComplete(_area, pixels) {
    setCroppedAreaPixels(pixels);
  }

  async function confirmCrop() {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels, 512, 512);
      setCropImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      await uploadAvatar(blob);
    } catch (e) {
      setAvatarError("Le recadrage a échoué, réessaie.");
    }
  }

  async function uploadAvatar(fileOrBlob) {
    if (!fileOrBlob || !session) return;
    setAvatarError("");
    setAvatarBusy(true);
    const path = `${session.user.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, fileOrBlob, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      setAvatarError("L'envoi de la photo a échoué : " + uploadError.message);
      setAvatarBusy(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", session.user.id);
    if (updateError) setAvatarError("La sauvegarde a échoué : " + updateError.message);
    else await loadMyProfile();
    setAvatarBusy(false);
  }

  /* --- top anime (aperçu court ; la recherche, elle, couvre tout AniList) --- */
  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const res = await aniListFetch(TOP_ANIME_QUERY, { page: 1, perPage: 18 });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        setTopAnime(groupSeasons((json.data.Page.media || []).map(fromAniList)));
      } catch (e) {
        setCatalogError("Impossible de charger les tendances pour le moment.");
      }
      setCatalogLoading(false);
    })();
  }, []);

  /* --- en ce moment (diffusion en cours) --- */
  useEffect(() => {
    (async () => {
      setAiringLoading(true);
      try {
        const res = await aniListFetch(AIRING_QUERY, { perPage: 20 });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        setAiringNow(groupSeasons((json.data.Page.media || []).map(fromAniList)));
      } catch (e) {
        // section discrète, pas d'erreur bloquante si ça rate
      }
      setAiringLoading(false);
    })();
  }, []);

  /* --- anime à venir --- */
  useEffect(() => {
    (async () => {
      setUpcomingLoading(true);
      try {
        const res = await aniListFetch(UPCOMING_QUERY, { perPage: 20 });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        setUpcoming((json.data.Page.media || []).map(fromAniListUpcoming));
      } catch (e) {
        // section discrète, pas d'erreur bloquante si ça rate
      }
      setUpcomingLoading(false);
    })();
  }, []);

  /* --- recommandations selon le genre le plus noté --- */
  useEffect(() => {
    if (entries.length === 0) return;
    const counts = {};
    entries.forEach((e) => {
      const g = e.anime_genre || null;
      if (g) counts[g] = (counts[g] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topGenre = sorted[0] ? sorted[0][0] : null;
    if (!topGenre || topGenre === recommendedGenre) return;
    setRecommendedGenre(topGenre);
    (async () => {
      setRecommendedLoading(true);
      try {
        const res = await aniListFetch(RECOMMENDED_QUERY, { genre: topGenre, perPage: 20 });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        const ratedIds = new Set(entries.map((e) => e.anime_id));
        const items = (json.data.Page.media || []).map(fromAniList).filter((a) => !ratedIds.has(a.id));
        setRecommended(groupSeasons(items));
      } catch (e) {
        // section discrète
      }
      setRecommendedLoading(false);
    })();
  }, [entries, recommendedGenre]);

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
        setSearchResults(groupSeasons(items));
        if (items.length === 0) setSearchError("Aucun résultat pour cette recherche.");
      } catch (e) {
        setSearchError("Recherche indisponible : réessaie dans quelques secondes.");
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* --- mes entrées (collection) --- */
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

  /* --- liste des profils d'amis (pseudos) --- */
  useEffect(() => {
    if (!session) return;
    const ids = friendRequests.filter((r) => r.status === "accepted").map((r) => (r.sender_id === session.user.id ? r.receiver_id : r.sender_id));
    if (ids.length === 0) {
      setFriendProfiles([]);
      return;
    }
    supabase.from("profiles").select("*").in("id", ids).then(({ data }) => setFriendProfiles(data || []));
  }, [friendRequests, session]);

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
    setTab("accueil");
  }

  /* --- ouverture de la fiche anime (ajout / suivi) --- */
  function requireAuth(action) {
    if (session) action();
    else setAuthModalOpen(true);
  }

  function openRating(anime) {
    if (!session) {
      setAuthModalOpen(true);
      return;
    }
    const existing = entries.find((e) => e.anime_id === anime.id);
    setDraftStatus(existing ? existing.status : "a_voir");
    setDraftEpisode(existing ? existing.current_episode : 0);
    setDraftTotalEpisodes(existing ? existing.total_episodes : anime.episodes || null);
    setDraftRating(existing && existing.rating ? Number(existing.rating) : 0);
    setDraftComment(existing ? existing.comment || "" : "");
    setOpenAnime(anime);
    setShowAddSearch(false);
  }

  function bumpEpisode(delta) {
    setDraftEpisode((prev) => {
      let next = prev + delta;
      if (next < 0) next = 0;
      if (draftTotalEpisodes && next > draftTotalEpisodes) next = draftTotalEpisodes;
      if (draftTotalEpisodes && next === draftTotalEpisodes && next > 0) {
        setDraftStatus("termine");
      } else if (next > 0 && draftStatus === "a_voir") {
        setDraftStatus("en_cours");
      }
      return next;
    });
  }

  function chooseStatus(key) {
    setDraftStatus(key);
    if (key === "termine" && draftTotalEpisodes) setDraftEpisode(draftTotalEpisodes);
    if (key === "a_voir") setDraftEpisode(0);
  }

  const holdTimer = React.useRef(null);
  function startHold(delta) {
    bumpEpisode(delta);
    let delay = 350;
    const tick = () => {
      holdTimer.current = setTimeout(() => {
        bumpEpisode(delta);
        delay = Math.max(30, delay * 0.82);
        tick();
      }, delay);
    };
    tick();
  }
  function stopHold() {
    clearTimeout(holdTimer.current);
  }

  function setEpisodeDirect(raw) {
    let next = parseInt(raw, 10);
    if (isNaN(next) || next < 0) next = 0;
    if (draftTotalEpisodes && next > draftTotalEpisodes) next = draftTotalEpisodes;
    setDraftEpisode(next);
    if (draftTotalEpisodes && next === draftTotalEpisodes && next > 0) setDraftStatus("termine");
    else if (next > 0 && draftStatus === "a_voir") setDraftStatus("en_cours");
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
        status: draftStatus,
        current_episode: draftEpisode,
        total_episodes: draftTotalEpisodes,
        rating: draftRating > 0 ? draftRating : null,
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
    else {
      setOpenAnime(null);
      loadEntries();
    }
  }

  /* --- "Je ne sais pas quoi regarder" --- */
  function openQuiz() {
    setQuizAnswers({ ambiance: null, know: null, format: null });
    setQuizResults([]);
    setQuizPick(null);
    setQuizError("");
    setQuizStep(0);
    setQuizOpen(true);
  }

  async function runQuiz(answers) {
    setQuizStep(3);
    setQuizLoading(true);
    setQuizError("");
    const genreMap = { action: "Action", comedie: "Comedy", emotion: "Drama", mystere: "Mystery" };
    const genre = genreMap[answers.ambiance];
    const page = answers.know === "decouverte" ? Math.floor(Math.random() * 6) + 4 : 1;
    const variables = { genre, page, perPage: 25 };
    if (answers.format === "court") variables.episodesLesser = 27;
    if (answers.format === "long") variables.episodesGreater = 26;
    try {
      const res = await aniListFetch(QUIZ_QUERY, variables);
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      const items = (json.data.Page.media || []).map(fromAniList);
      if (items.length === 0) throw new Error("Aucun résultat");
      setQuizResults(items);
      setQuizPick(items[Math.floor(Math.random() * items.length)]);
    } catch (e) {
      setQuizError("Impossible de trouver une proposition pour ces critères, réessaie.");
    }
    setQuizLoading(false);
  }

  function anotherQuizProposal() {
    if (quizResults.length <= 1) {
      runQuiz(quizAnswers);
      return;
    }
    let pick;
    do {
      pick = quizResults[Math.floor(Math.random() * quizResults.length)];
    } while (quizPick && pick.id === quizPick.id);
    setQuizPick(pick);
  }

  function acceptQuizPick() {
    setQuizOpen(false);
    openRating(quizPick);
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

  /* ---------- Choix du pseudo ---------- */
  if (session && !profileLoading && !myProfile) {
    return (
      <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, padding: "48px 20px", display: "flex", alignItems: "center" }}>
        {fontImport}
        <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
          <h1 className="st-title" style={{ fontSize: 28, marginBottom: 8, fontWeight: 800 }}>Choisis ton pseudo</h1>
          <p style={{ color: PALETTE.muted, marginBottom: 20, fontSize: 14 }}>Il sera visible par les autres utilisateurs pour te retrouver.</p>
          <form onSubmit={saveUsername} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ex: yuki_anime" style={{ padding: "13px 16px", borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }} />
            <button type="submit" disabled={usernameBusy} className="st-btn" style={{ padding: "14px 0", borderRadius: 999, border: "none", background: PALETTE.accent, color: PALETTE.accentText, fontWeight: 800, fontFamily: "'Outfit', sans-serif", fontSize: 16, cursor: "pointer" }}>
              {usernameBusy ? "…" : "Valider"}
            </button>
          </form>
          {usernameError && <p style={{ color: PALETTE.danger, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{usernameError}</p>}
        </div>
      </div>
    );
  }

  const incomingRequests = friendRequests.filter((r) => r.receiver_id === session.user.id && r.status === "pending");
  const filteredEntries = collectionFilter === "tous" ? entries : entries.filter((e) => e.status === collectionFilter);

  /* ---------- Vue du journal d'un autre profil ---------- */
  /* ---------- Page dédiée "Tout voir" ---------- */
  if (fullListView) {
    const sections = {
      trending: { title: "Tendances", desc: "Les anime les plus suivis en ce moment sur Sortia.", icon: TrendingUp, items: topAnime },
      airing: { title: "En ce moment", desc: "Les anime actuellement en cours de diffusion.", icon: Radio, items: airingNow },
      recommended: { title: "Recommandé pour toi", desc: recommendedGenre ? `Basé sur ton goût pour le genre ${recommendedGenre}.` : "Sélectionné pour toi.", icon: Sparkles, items: recommended },
    };
    const section = sections[fullListView];
    const SectionIcon = section.icon;
    return (
      <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, paddingBottom: 60 }}>
        {fontImport}
        <div style={{ padding: "18px 20px 0" }}>
          <button onClick={() => setFullListView(null)} className="st-btn" style={{ background: "none", border: "none", color: PALETTE.text, cursor: "pointer", padding: 0, marginBottom: 18, display: "flex", alignItems: "center" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <SectionIcon size={20} color={PALETTE.accent} />
            <h1 className="st-title" style={{ fontSize: 22, margin: 0, fontWeight: 800 }}>{section.title}</h1>
          </div>
          <p style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 22, lineHeight: 1.5 }}>{section.desc}</p>
        </div>
        <div style={{ padding: "0 20px" }}>
          <div className="poster-grid">
            {section.items.map((anime) => {
              const entry = entries.find((e) => e.anime_id === anime.id);
              return (
                <button key={anime.id} onClick={() => openRating(anime)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                  <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                    <Poster image={anime.imageSmall || anime.image} genre={anime.genre} />
                    {entry && <div style={{ position: "absolute", bottom: 6, left: 6 }}><StatusBadge entry={entry} /></div>}
                  </div>
                  <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{anime.title}</div>
                  <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 2 }}>{anime.year}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (viewingProfile) {
    const rel = relationWith(viewingProfile.id);
    return (
      <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, paddingBottom: 100 }}>
        {fontImport}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { setViewingProfile(null); setViewedComment(null); }} className="st-btn" style={{ background: PALETTE.surface, border: "none", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.text, cursor: "pointer" }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div className="st-title" style={{ fontSize: 20, fontWeight: 800 }}>@{viewingProfile.username}</div>
            <div style={{ fontSize: 12, color: PALETTE.muted }}>{viewedEntries.length} anime dans sa collection</div>
          </div>
          {rel.type === "none" && (
            <button onClick={() => sendFriendRequest(viewingProfile.id)} className="st-btn" style={{ background: PALETTE.accent, border: "none", borderRadius: 999, padding: "9px 14px", color: PALETTE.accentText, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
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
            <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Cette collection est vide pour l'instant.</div>
          ) : (
            <div className="poster-grid">
              {viewedEntries.map((e) => (
                <button key={e.id} onClick={() => setViewedComment(e)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                  <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                    <Poster image={e.anime_image} genre={e.anime_genre} />
                    <div style={{ position: "absolute", bottom: 6, left: 6 }}><StatusBadge entry={e} /></div>
                    {e.comment && <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle size={11} color="#fff" /></div>}
                  </div>
                  <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{e.anime_title}</div>
                  {e.rating ? <Stars value={Number(e.rating)} readOnly size={12} /> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {viewedComment && (
          <div onClick={() => setViewedComment(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 22, padding: 22, maxWidth: 380, width: "100%" }}>
              <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 56, height: 78, flexShrink: 0, borderRadius: 10, overflow: "hidden" }}><Poster image={viewedComment.anime_image} genre={viewedComment.anime_genre} /></div>
                <div>
                  <div className="st-title" style={{ fontSize: 16, fontWeight: 700 }}>{viewedComment.anime_title}</div>
                  {viewedComment.rating ? <Stars value={Number(viewedComment.rating)} readOnly size={14} /> : null}
                </div>
              </div>
              {viewedComment.comment ? (
                <p style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.5, margin: 0 }}>{viewedComment.comment}</p>
              ) : (
                <p style={{ fontSize: 13, color: PALETTE.muted, margin: 0 }}>Pas de commentaire pour cet anime.</p>
              )}
              <button onClick={() => setViewedComment(null)} className="st-btn" style={{ marginTop: 18, width: "100%", padding: "11px 0", borderRadius: 999, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- App principale ---------- */
  return (
    <div className="st-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, paddingBottom: 100 }}>
      {fontImport}

      <div style={{ padding: "18px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1
          className="st-title"
          onClick={() => {
            if (tab === "accueil") window.scrollTo({ top: 0, behavior: "smooth" });
            else setTab("accueil");
          }}
          style={{ fontSize: 26, margin: 0, fontWeight: 800, cursor: "pointer" }}
        >
          Sortia
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {incomingRequests.length > 0 && (
            <button onClick={() => setTab("profil")} className="st-btn" style={{ position: "relative", background: PALETTE.surface, border: "none", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.text, cursor: "pointer" }}>
              <Bell size={18} />
              <span style={{ position: "absolute", top: -2, right: -2, background: PALETTE.danger, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{incomingRequests.length}</span>
            </button>
          )}
          {!session && (
            <button onClick={() => setAuthModalOpen(true)} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.accent, border: "none", borderRadius: 999, padding: "8px 14px", color: PALETTE.accentText, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
              <User size={14} /> Connexion
            </button>
          )}
        </div>
      </div>

      {justConfirmed && (
        <div style={{ background: PALETTE.surface, borderBottom: `1px solid ${PALETTE.line}`, padding: "10px 20px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>✅ Compte confirmé, bienvenue sur Sortia !</span>
          <button onClick={() => setJustConfirmed(false)} style={{ background: "none", border: "none", color: PALETTE.muted, cursor: "pointer", padding: 4 }}><X size={14} /></button>
        </div>
      )}
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
                      <div style={{ width: 36, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}><Poster image={r.imageSmall || r.image} genre={r.genre} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: PALETTE.muted }}>{r.year} · {r.genre}</div>
                      </div>
                      {entry ? <StatusBadge entry={entry} /> : <span style={{ fontSize: 12, fontWeight: 800, color: PALETTE.accent }}>Ajouter →</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 className="st-title" style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>Tendances</h2>
                  {topAnime.length > 12 && (
                    <button onClick={() => setFullListView("trending")} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", color: PALETTE.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                      Tout voir <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                {catalogError && <div style={{ fontSize: 13, color: PALETTE.danger, marginBottom: 12 }}>{catalogError}</div>}
                {catalogLoading && topAnime.length === 0 && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Chargement…</div>}
                <div className="poster-grid">
                  {topAnime.slice(0, 12).map((anime) => {
                    const entry = entries.find((e) => e.anime_id === anime.id);
                    return (
                      <button key={anime.id} onClick={() => openRating(anime)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                        <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                          <Poster image={anime.imageSmall || anime.image} genre={anime.genre} />
                          {entry && <div style={{ position: "absolute", bottom: 6, left: 6 }}><StatusBadge entry={entry} /></div>}
                        </div>
                        <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{anime.title}</div>
                        <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 2 }}>{anime.year}</div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={openQuiz}
                  className="st-btn"
                  style={{ width: "100%", marginTop: 24, display: "flex", alignItems: "center", gap: 14, background: PALETTE.surface, border: `1px solid ${PALETTE.line}`, borderRadius: 16, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: PALETTE.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Shuffle size={18} color={PALETTE.accent} />
                  </div>
                  <span>
                    <span className="st-title" style={{ display: "block", fontSize: 14, fontWeight: 800, color: PALETTE.text }}>Je ne sais pas quoi regarder</span>
                    <span style={{ display: "block", fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>3 questions, et on te propose un anime</span>
                  </span>
                </button>

                {(airingNow.length > 0 || airingLoading) && (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "28px 0 12px" }}>
                      <h2 className="st-title" style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>En ce moment</h2>
                      {airingNow.length > 12 && (
                        <button onClick={() => setFullListView("airing")} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", color: PALETTE.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                          Tout voir <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                    {airingLoading && airingNow.length === 0 && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Chargement…</div>}
                    <div className="poster-grid">
                      {airingNow.slice(0, 12).map((anime) => {
                        const entry = entries.find((e) => e.anime_id === anime.id);
                        return (
                          <button key={anime.id} onClick={() => openRating(anime)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                            <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                              <Poster image={anime.imageSmall || anime.image} genre={anime.genre} />
                              {entry && <div style={{ position: "absolute", bottom: 6, left: 6 }}><StatusBadge entry={entry} /></div>}
                            </div>
                            <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{anime.title}</div>
                            <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 2 }}>{anime.year}</div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {(recommended.length > 0 || recommendedLoading) && (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "28px 0 4px" }}>
                      <h2 className="st-title" style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>Recommandé pour toi</h2>
                      {recommended.length > 12 && (
                        <button onClick={() => setFullListView("recommended")} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", color: PALETTE.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                          Tout voir <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                    {recommendedGenre && <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 12 }}>Parce que tu aimes le genre {recommendedGenre}</div>}
                    {recommendedLoading && recommended.length === 0 && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Chargement…</div>}
                    <div className="poster-grid">
                      {recommended.slice(0, 12).map((anime) => (
                        <button key={anime.id} onClick={() => openRating(anime)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                          <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                            <Poster image={anime.imageSmall || anime.image} genre={anime.genre} />
                          </div>
                          <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{anime.title}</div>
                          <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 2 }}>{anime.year}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {(upcoming.length > 0 || upcomingLoading) && (
                  <>
                    <h2 className="st-title" style={{ fontSize: 20, margin: "28px 0 12px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                      <Calendar size={18} color={PALETTE.muted} /> À venir
                    </h2>
                    {upcomingLoading && upcoming.length === 0 && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Chargement…</div>}
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginRight: -20, paddingRight: 20 }}>
                      {upcoming.map((anime) => (
                        <button key={anime.id} onClick={() => openRating(anime)} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text, flex: "0 0 120px" }}>
                          <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
                            <Poster image={anime.imageSmall || anime.image} genre={anime.genre} />
                          </div>
                          <div className="st-title" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{anime.title}</div>
                          <div style={{ fontSize: 11, color: PALETTE.accent, marginTop: 2, fontWeight: 700 }}>{anime.releaseLabel}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {tab === "collection" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 className="st-title" style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>Ma collection</h2>
              <button onClick={() => setShowFriendsList(true)} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.surface, border: "none", borderRadius: 999, padding: "8px 14px", color: PALETTE.text, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
                <Users size={15} /> Mes amis
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
              {["tous", ...STATUS_ORDER].map((key) => {
                const label = key === "tous" ? "Tous" : STATUS_META[key].label;
                const active = collectionFilter === key;
                return (
                  <button key={key} onClick={() => setCollectionFilter(key)} className="st-btn" style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: active ? PALETTE.accent : PALETTE.surface, color: active ? PALETTE.accentText : PALETTE.muted }}>
                    {label}
                  </button>
                );
              })}
            </div>
            {entriesLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Chargement…</div>
            ) : filteredEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: PALETTE.muted }}>Rien ici pour l'instant.</div>
            ) : (
              <div className="poster-grid">
                {filteredEntries.map((e) => (
                  <button key={e.id} onClick={() => openRating({ id: e.anime_id, title: e.anime_title, image: e.anime_image, year: e.anime_year, genre: e.anime_genre, episodes: e.total_episodes })} className="st-card" style={{ textAlign: "left", cursor: "pointer", border: "none", background: "none", padding: 0, color: PALETTE.text }}>
                    <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 14, overflow: "hidden", marginBottom: 6 }}>
                      <Poster image={e.anime_image} genre={e.anime_genre} />
                      <div style={{ position: "absolute", bottom: 6, left: 6 }}><StatusBadge entry={e} /></div>
                    </div>
                    <div className="st-title" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{e.anime_title}</div>
                    {e.rating ? <Stars value={Number(e.rating)} readOnly size={12} /> : null}
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
                Rien dans ta collection pour l'instant.
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
                      <div style={{ margin: "4px 0" }}><StatusBadge entry={e} /></div>
                      {e.rating ? <Stars value={Number(e.rating)} readOnly size={14} /> : null}
                      {e.comment && <p style={{ fontSize: 13, color: PALETTE.muted, marginTop: 6, marginBottom: 0 }}>{e.comment}</p>}
                      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                        <button onClick={() => openRating({ id: e.anime_id, title: e.anime_title, image: e.anime_image, year: e.anime_year, genre: e.anime_genre, episodes: e.total_episodes })} style={{ background: "none", border: "none", color: PALETTE.accent, fontSize: 12, fontWeight: 800, cursor: "pointer", padding: 0 }}>Modifier</button>
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
              <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files && e.target.files[0] && onSelectAvatarFile(e.target.files[0])}
                />
                <button
                  onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
                  className="st-btn"
                  style={{ width: 56, height: 56, borderRadius: "50%", background: myProfile.avatar_url ? PALETTE.surfaceAlt : PALETTE.accent, border: "none", padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: PALETTE.accentText, cursor: "pointer" }}
                >
                  {myProfile.avatar_url ? (
                    <img src={myProfile.avatar_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: avatarBusy ? 0.5 : 1 }} />
                  ) : (
                    myProfile.username.slice(0, 1).toUpperCase()
                  )}
                </button>
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: "50%", background: PALETTE.surface, border: `2px solid ${PALETTE.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Pencil size={11} color={PALETTE.text} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="st-title" style={{ fontSize: 19, fontWeight: 800 }}>@{myProfile.username}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted }}>{session.user.email}</div>
                {avatarBusy && <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 2 }}>Envoi de la photo…</div>}
                {avatarError && <div style={{ fontSize: 11, color: PALETTE.danger, marginTop: 2 }}>{avatarError}</div>}
              </div>
              <button onClick={handleSignOut} className="st-btn" style={{ background: PALETTE.surface, border: "none", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.danger, cursor: "pointer" }}>
                <LogOut size={16} />
              </button>
            </div>

            {(() => {
              const rated = entries.filter((e) => e.rating);
              const total = entries.length;
              const avg = rated.length ? (rated.reduce((s, e) => s + Number(e.rating), 0) / rated.length).toFixed(1) : "–";
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
              const buckets = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
              const histo = buckets.map((b) => rated.filter((e) => Number(e.rating) === b).length);
              const maxHisto = Math.max(1, ...histo);
              const maxGenre = topGenres.length ? topGenres[0][1] : 1;
              const enCoursCount = entries.filter((e) => e.status === "en_cours").length;

              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "DANS MA COLLECTION", value: total },
                      { label: "NOTE MOY.", value: avg === "–" ? "–" : `${avg} ★` },
                      { label: "EN COURS", value: enCoursCount },
                    ].map((s) => (
                      <div key={s.label} style={{ background: PALETTE.surface, borderRadius: 16, padding: "16px 10px" }}>
                        <div className="st-title" style={{ fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: PALETTE.muted, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {total > 0 && (
                    <>
                      {rated.length > 0 && (
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
                      )}

                      <div style={{ background: PALETTE.surface, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                        <div style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700, marginBottom: 12 }}>GENRES LES PLUS PRÉSENTS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {topGenres.slice(0, 5).map(([genre, count]) => (
                            <div key={genre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 70, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{genre}</div>
                              <div style={{ flex: 1, background: PALETTE.surfaceAlt, borderRadius: 999, height: 8, overflow: "hidden" }}>
                                <div style={{ width: `${(count / maxGenre) * 100}%`, background: PALETTE.accent, height: "100%", borderRadius: 999 }} />
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
                      <button onClick={() => sendFriendRequest(p.id)} className="st-btn" style={{ background: PALETTE.accent, border: "none", borderRadius: 999, padding: "7px 12px", color: PALETTE.accentText, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Ajouter</button>
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

            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 28, background: PALETTE.surface, borderRadius: 14, padding: "14px 16px" }}>
              {themeMode === "light" ? <Sun size={18} color={PALETTE.muted} /> : <Moon size={18} color={PALETTE.muted} />}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: PALETTE.text }}>Mode {themeMode === "light" ? "clair" : "sombre"}</span>
              <button
                onClick={() => setThemeMode((m) => (m === "light" ? "dark" : "light"))}
                className="st-btn"
                style={{ position: "relative", width: 46, height: 26, borderRadius: 999, border: "none", background: themeMode === "light" ? PALETTE.gold : PALETTE.surfaceAlt, cursor: "pointer", flexShrink: 0 }}
              >
                <span style={{ position: "absolute", top: 3, left: themeMode === "light" ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 160ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </button>
            </div>

            <button
              onClick={() => setShowAbout(true)}
              className="st-btn"
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 12, background: PALETTE.surface, border: "none", borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}
            >
              <Info size={18} color={PALETTE.muted} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: PALETTE.text }}>À propos de Sortia</span>
              <ChevronRight size={16} color={PALETTE.muted} />
            </button>
          </>
        )}
      </div>

      {/* Barre de navigation basse */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: PALETTE.surface, borderTop: `1px solid ${PALETTE.line}`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          if (item.key === "add") {
            return (
              <button key={item.key} onClick={() => requireAuth(() => setShowAddSearch(true))} className="st-btn" style={{ background: PALETTE.accent, border: "none", borderRadius: "50%", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: -22, boxShadow: "0 6px 16px rgba(0,0,0,0.35)" }}>
                <Icon size={24} color={PALETTE.accentText} />
              </button>
            );
          }
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (item.key === "accueil") {
                  if (tab === "accueil") window.scrollTo({ top: 0, behavior: "smooth" });
                  else setTab("accueil");
                  return;
                }
                requireAuth(() => setTab(item.key));
              }}
              className="st-btn"
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? PALETTE.accent : PALETTE.muted, padding: "4px 10px" }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recadrage de la photo de profil */}
      {cropImageSrc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", zIndex: 70 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Cropper
              image={cropImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={cropMode === "avatar" ? 1 : 2 / 3}
              cropShape={cropMode === "avatar" ? "round" : "rect"}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div style={{ background: PALETTE.surface, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "100%" }} />
            {avatarError && <div style={{ fontSize: 12, color: PALETTE.danger, fontWeight: 700 }}>{avatarError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setCropImageSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                className="st-btn"
                style={{ flex: 1, padding: "13px 0", borderRadius: 999, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, fontWeight: 700, cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                onClick={confirmCrop}
                disabled={avatarBusy}
                className="st-btn"
                style={{ flex: 1, padding: "13px 0", borderRadius: 999, border: "none", background: PALETTE.accent, color: PALETTE.accentText, fontWeight: 800, fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}
              >
                {avatarBusy ? "Envoi…" : "Valider"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Je ne sais pas quoi regarder */}
      {quizOpen && (
        <div onClick={() => setQuizOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 22, padding: 24, maxWidth: 420, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            {quizStep === 0 && (
              <>
                <div className="st-title" style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>Quelle ambiance ?</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 18 }}>Question 1 sur 3</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { key: "action", label: "Action, adrénaline" },
                    { key: "comedie", label: "Comédie, légèreté" },
                    { key: "emotion", label: "Émotion, drame" },
                    { key: "mystere", label: "Mystère, intrigue" },
                  ].map((o) => (
                    <button key={o.key} onClick={() => { setQuizAnswers((a) => ({ ...a, ambiance: o.key })); setQuizStep(1); }} className="st-btn" style={{ padding: "14px 16px", borderRadius: 14, border: "none", background: PALETTE.surfaceAlt, color: PALETTE.text, fontSize: 14, fontWeight: 700, textAlign: "left", cursor: "pointer" }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {quizStep === 1 && (
              <>
                <div className="st-title" style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>Connu ou découverte ?</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 18 }}>Question 2 sur 3</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { key: "connu", label: "Un classique populaire" },
                    { key: "decouverte", label: "Une découverte moins connue" },
                  ].map((o) => (
                    <button key={o.key} onClick={() => { setQuizAnswers((a) => ({ ...a, know: o.key })); setQuizStep(2); }} className="st-btn" style={{ padding: "14px 16px", borderRadius: 14, border: "none", background: PALETTE.surfaceAlt, color: PALETTE.text, fontSize: 14, fontWeight: 700, textAlign: "left", cursor: "pointer" }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {quizStep === 2 && (
              <>
                <div className="st-title" style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>Quel format ?</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 18 }}>Question 3 sur 3</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { key: "court", label: "Court (≤ 26 épisodes)" },
                    { key: "long", label: "Une longue saga" },
                    { key: "peu_importe", label: "Peu importe" },
                  ].map((o) => (
                    <button key={o.key} onClick={() => { const next = { ...quizAnswers, format: o.key }; setQuizAnswers(next); runQuiz(next); }} className="st-btn" style={{ padding: "14px 16px", borderRadius: 14, border: "none", background: PALETTE.surfaceAlt, color: PALETTE.text, fontSize: 14, fontWeight: 700, textAlign: "left", cursor: "pointer" }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {quizStep === 3 && (
              <>
                {quizLoading && <div style={{ textAlign: "center", padding: "40px 0", color: PALETTE.muted }}>On cherche…</div>}
                {!quizLoading && quizError && (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ color: PALETTE.danger, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{quizError}</div>
                    <button onClick={() => runQuiz(quizAnswers)} className="st-btn" style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: PALETTE.accent, color: PALETTE.accentText, fontWeight: 800, cursor: "pointer" }}>Réessayer</button>
                  </div>
                )}
                {!quizLoading && !quizError && quizPick && (
                  <>
                    <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 10, textAlign: "center" }}>On te propose…</div>
                    <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
                      <div style={{ width: 80, height: 112, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Poster image={quizPick.image} genre={quizPick.genre} /></div>
                      <div>
                        <div className="st-title" style={{ fontSize: 18, fontWeight: 800 }}>{quizPick.title}</div>
                        <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 4 }}>{quizPick.year} · {quizPick.genre}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button onClick={acceptQuizPick} className="st-btn" style={{ padding: "13px 0", borderRadius: 999, border: "none", background: PALETTE.accent, color: PALETTE.accentText, fontWeight: 800, fontFamily: "'Outfit', sans-serif", fontSize: 15, cursor: "pointer" }}>
                        <PlayCircle size={18} style={{ verticalAlign: "middle", marginRight: 6, marginTop: -2 }} /> Je regarde ça
                      </button>
                      <button onClick={anotherQuizProposal} className="st-btn" style={{ padding: "12px 0", borderRadius: 999, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        Autre proposition
                      </button>
                      <button onClick={() => setQuizOpen(false)} style={{ padding: "6px 0", background: "none", border: "none", color: PALETTE.muted, fontSize: 13, cursor: "pointer" }}>
                        Fermer
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Connexion (modale, ne bloque pas la navigation) */}
      {authModalOpen && (
        <div onClick={() => setAuthModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 70 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 22, padding: 26, maxWidth: 420, width: "100%", maxHeight: "85vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setAuthModalOpen(false)} className="st-btn" style={{ position: "absolute", top: 16, right: 16, background: PALETTE.surfaceAlt, border: "none", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.text, cursor: "pointer" }}>
              <X size={14} />
            </button>

            <h1 className="st-title" style={{ fontSize: 26, margin: "0 0 6px", fontWeight: 800 }}>Sortia</h1>
            <p style={{ color: PALETTE.muted, marginBottom: 22, fontSize: 13 }}>Connecte-toi pour noter, suivre ta progression et retrouver tes amis.</p>

            {justConfirmed && (
              <div style={{ background: PALETTE.surfaceAlt, borderRadius: 14, padding: "12px 14px", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>✅ Compte confirmé !</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>Connecte-toi ci-dessous pour continuer.</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, background: PALETTE.surfaceAlt, padding: 5, borderRadius: 999, marginBottom: 18 }}>
              <button onClick={() => setAuthMode("signin")} className="st-btn" style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif", background: authMode === "signin" ? PALETTE.accent : "transparent", color: authMode === "signin" ? PALETTE.accentText : PALETTE.muted }}>Connexion</button>
              <button onClick={() => setAuthMode("signup")} className="st-btn" style={{ flex: 1, padding: "10px 0", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontFamily: "'Outfit', sans-serif", background: authMode === "signup" ? PALETTE.accent : "transparent", color: authMode === "signup" ? PALETTE.accentText : PALETTE.muted }}>Créer un compte</button>
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Adresse email" style={{ padding: "13px 16px", borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: PALETTE.bg, color: PALETTE.text, fontSize: 14 }} />
              <input type="password" required minLength={6} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Mot de passe (6 caractères min.)" style={{ padding: "13px 16px", borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: PALETTE.bg, color: PALETTE.text, fontSize: 14 }} />
              <button type="submit" disabled={authBusy} className="st-btn" style={{ padding: "14px 0", borderRadius: 999, border: "none", background: PALETTE.accent, color: PALETTE.accentText, fontWeight: 800, fontFamily: "'Outfit', sans-serif", fontSize: 16, cursor: "pointer" }}>
                {authBusy ? "…" : authMode === "signup" ? "Créer mon compte" : "Se connecter"}
              </button>
            </form>
            {authError && <p style={{ color: PALETTE.danger, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{authError}</p>}
            {authNotice && <p style={{ color: PALETTE.ok, fontSize: 13, marginTop: 12, fontWeight: 700 }}>{authNotice}</p>}
          </div>
        </div>
      )}

      {/* À propos */}
      {showAbout && (
        <div onClick={() => setShowAbout(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 22, padding: 26, maxWidth: 420, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <div className="st-title" style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Sortia</div>
            <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 22 }}>Ton carnet de visionnage d'anime</div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: PALETTE.muted, letterSpacing: 0.5, marginBottom: 6 }}>LE PRINCIPE</div>
              <p style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.5, margin: 0 }}>
                Note les anime que tu regardes, suis ta progression épisode par épisode, et retrouve tes amis pour voir ce qu'ils regardent.
              </p>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: PALETTE.muted, letterSpacing: 0.5, marginBottom: 6 }}>FONCTIONNALITÉS</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: PALETTE.text, lineHeight: 1.7 }}>
                <li>Notes sur 5, avec demi-étoiles</li>
                <li>Suivi À voir / En cours / Terminé</li>
                <li>Recommandations personnalisées</li>
                <li>Amis et journaux partagés</li>
              </ul>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: PALETTE.muted, letterSpacing: 0.5, marginBottom: 6 }}>DONNÉES</div>
              <p style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.5, margin: 0 }}>
                Tes notes et ton profil sont hébergés de façon sécurisée et ne sont visibles que par toi et tes amis.
              </p>
            </div>

            <button onClick={() => setShowAbout(false)} className="st-btn" style={{ width: "100%", padding: "12px 0", borderRadius: 999, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
          </div>
        </div>
      )}

      {/* Liste des amis */}
      {showFriendsList && (
        <div onClick={() => setShowFriendsList(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 20, padding: 18, maxWidth: 420, width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div className="st-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Mes amis</div>
            {friendProfiles.length === 0 ? (
              <div style={{ fontSize: 13, color: PALETTE.muted, padding: "10px 4px" }}>Tu n'as pas encore d'amis ajoutés. Cherche des pseudos dans l'onglet Profil.</div>
            ) : (
              friendProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setShowFriendsList(false);
                    viewProfile(p);
                  }}
                  className="st-btn"
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 6px", background: "none", border: "none", borderBottom: `1px solid ${PALETTE.line}`, cursor: "pointer" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: PALETTE.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: PALETTE.accentText, flexShrink: 0, overflow: "hidden" }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.text }}>@{p.username}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Recherche rapide (bouton +) */}
      {showAddSearch && (
        <div onClick={() => setShowAddSearch(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 20, padding: 18, maxWidth: 420, width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: PALETTE.muted }} />
              <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Chercher un anime à ajouter…" style={{ width: "100%", padding: "12px 16px 12px 38px", borderRadius: 14, border: "none", background: PALETTE.surfaceAlt, color: PALETTE.text, fontSize: 14 }} />
            </div>
            {searchLoading && <div style={{ fontSize: 13, color: PALETTE.muted, padding: "8px 4px" }}>Recherche…</div>}
            {!searchLoading && searchError && <div style={{ fontSize: 13, color: PALETTE.danger, padding: "8px 4px" }}>{searchError}</div>}
            {!searchLoading && searchResults.map((r) => (
              <button key={r.id} onClick={() => openRating(r)} className="st-btn" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 4px", background: "none", border: "none", borderBottom: `1px solid ${PALETTE.line}`, cursor: "pointer" }}>
                <div style={{ width: 36, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}><Poster image={r.imageSmall || r.image} genre={r.genre} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: PALETTE.muted }}>{r.year} · {r.genre}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modale de suivi / notation */}
      {openAnime && (
        <div onClick={() => setOpenAnime(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, borderRadius: 22, padding: 24, maxWidth: 420, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 64, height: 90, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Poster image={openAnime.image} genre={openAnime.genre} /></div>
              <div>
                <div className="st-title" style={{ fontSize: 19, marginBottom: 2, fontWeight: 700 }}>{openAnime.title}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted }}>{openAnime.year} · {openAnime.genre}</div>
              </div>
            </div>

            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", marginBottom: 8, fontWeight: 700 }}>Statut</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 18 }}>
              {STATUS_ORDER.map((key) => {
                const meta = STATUS_META[key];
                const Icon = meta.icon;
                const active = draftStatus === key;
                return (
                  <button key={key} onClick={() => chooseStatus(key)} className="st-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", borderRadius: 12, border: active ? `2px solid ${meta.color}` : `2px solid ${PALETTE.line}`, background: active ? PALETTE.surfaceAlt : "transparent", color: active ? meta.color : PALETTE.muted, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
                    <Icon size={14} /> {meta.label}
                  </button>
                );
              })}
            </div>

            {draftStatus !== "a_voir" && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", marginBottom: 8, fontWeight: 700 }}>Progression</label>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, background: PALETTE.surfaceAlt, borderRadius: 14, padding: "10px 14px" }}>
                  <button
                    onMouseDown={() => startHold(-1)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHold(-1)}
                    onTouchEnd={stopHold}
                    className="st-btn"
                    style={{ background: PALETTE.surface, border: "none", borderRadius: 999, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.text, cursor: "pointer" }}
                  >
                    <Minus size={16} />
                  </button>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 90, justifyContent: "center" }}>
                    <span style={{ fontSize: 12, color: PALETTE.muted, fontWeight: 700 }}>Ép.</span>
                    <input
                      type="number"
                      value={draftEpisode}
                      onChange={(e) => setEpisodeDirect(e.target.value)}
                      className="st-title"
                      style={{ width: 54, fontSize: 16, fontWeight: 800, textAlign: "center", background: "none", border: "none", color: PALETTE.text, padding: 0 }}
                    />
                    <span style={{ fontSize: 13, color: PALETTE.muted, fontWeight: 700 }}>/ {draftTotalEpisodes || "?"}</span>
                  </div>
                  <button
                    onMouseDown={() => startHold(1)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={() => startHold(1)}
                    onTouchEnd={stopHold}
                    className="st-btn"
                    style={{ background: PALETTE.accent, border: "none", borderRadius: 999, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.accentText, cursor: "pointer" }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: PALETTE.muted, textAlign: "center", marginTop: 6 }}>Maintiens +/- pour avancer vite, ou tape le numéro directement</div>
              </div>
            )}

            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", marginBottom: 6, fontWeight: 700 }}>Ta note (optionnel)</label>
            <Stars value={draftRating} onChange={setDraftRating} size={26} />

            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", margin: "16px 0 6px", fontWeight: 700 }}>Ton commentaire</label>
            <textarea value={draftComment} onChange={(e) => setDraftComment(e.target.value)} rows={3} placeholder="Qu'est-ce que tu en as pensé ?" style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 12, border: `1px solid ${PALETTE.line}`, background: PALETTE.bg, color: PALETTE.text, fontSize: 13 }} />

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "space-between" }}>
              {entries.some((e) => e.anime_id === openAnime.id) ? (
                <button onClick={() => removeEntry(openAnime.id)} className="st-btn" style={{ padding: "10px 16px", borderRadius: 999, border: "none", background: "none", color: PALETTE.danger, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Retirer</button>
              ) : <span />}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setOpenAnime(null)} className="st-btn" style={{ padding: "10px 18px", borderRadius: 999, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, cursor: "pointer", fontWeight: 700 }}>Annuler</button>
                <button onClick={saveEntry} className="st-btn" style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: PALETTE.accent, color: PALETTE.accentText, fontWeight: 800, fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
