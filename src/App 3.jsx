import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ============================================================
   ANIMEBOX — carnet de visionnage d'anime
   Palette : nuit indigo + accent sakura + or (étoiles)
   ============================================================ */

const PALETTE = {
  bg: "#12111C",
  surface: "#1B1930",
  surfaceAlt: "#242140",
  line: "#332F52",
  sakura: "#FF5D8F",
  gold: "#FFC94A",
  text: "#F2EFE9",
  muted: "#9C97B3",
  ok: "#5FD3A0",
};

const GENRE_GRADIENTS = {
  Shonen: "linear-gradient(135deg,#3A1C4E,#7A2E4E)",
  Seinen: "linear-gradient(135deg,#1C2A4E,#2E4E5A)",
  Slice: "linear-gradient(135deg,#4E3A1C,#7A5E2E)",
  Fantasy: "linear-gradient(135deg,#2A1C4E,#5E2E7A)",
  SF: "linear-gradient(135deg,#1C3A4E,#2E6E7A)",
  Anime: "linear-gradient(135deg,#2A1C4E,#5E2E7A)",
};

const JIKAN_BASE = "https://api.jikan.moe/v4";

// File d'attente : espace toutes les requêtes vers Jikan d'au moins 500ms
// pour ne jamais dépasser sa limite de 3 requêtes/seconde, même si le
// catalogue et la recherche essaient d'appeler l'API en même temps.
let jikanChain = Promise.resolve();
function jikanFetch(url) {
  const call = jikanChain.then(
    () => new Promise((resolve) => setTimeout(resolve, 500))
  ).then(() => fetch(url));
  jikanChain = call.catch(() => {});
  return call;
}

function fromJikan(item) {
  return {
    id: `mal-${item.mal_id}`,
    title: item.title,
    year: String(item.year || (item.aired && item.aired.prop && item.aired.prop.from && item.aired.prop.from.year) || "?"),
    genre: (item.genres && item.genres[0] && item.genres[0].name) || "Anime",
    image: (item.images && item.images.jpg && (item.images.jpg.large_image_url || item.images.jpg.image_url)) || null,
    score: item.score || null,
  };
}

function Screentone() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.18,
        backgroundImage: `radial-gradient(${PALETTE.text} 1px, transparent 1px)`,
        backgroundSize: "7px 7px",
        pointerEvents: "none",
      }}
    />
  );
}

function Stars({ value, onChange, size = 20, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: readOnly ? "default" : "pointer",
            fontSize: size,
            lineHeight: 1,
            color: n <= display ? PALETTE.gold : PALETTE.line,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const fontImport = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    .ab-title { font-family: 'Bebas Neue', 'Manrope', sans-serif; letter-spacing: 0.04em; }
    .ab-body { font-family: 'Manrope', sans-serif; }
    .ab-card:hover { transform: translateY(-3px); border-color: ${PALETTE.sakura}; }
    .ab-card { transition: transform 160ms ease, border-color 160ms ease; }
    .ab-btn:active { transform: scale(0.97); }
    input, textarea { font-family: inherit; }
    @media (prefers-reduced-motion: reduce) { .ab-card, .ab-btn { transition: none !important; } }
  `}</style>
);

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState("catalogue");
  const [topAnime, setTopAnime] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [entries, setEntries] = useState([]); // lignes venant de la table `entries`
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [openAnime, setOpenAnime] = useState(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");

  /* --- session --- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  /* --- top anime au chargement --- */
  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      let loaded = [];
      try {
        const res1 = await jikanFetch(`${JIKAN_BASE}/top/anime?limit=25&page=1`);
        const data1 = await res1.json();
        loaded = [...(data1.data || [])];
        setTopAnime(loaded.map(fromJikan));
      } catch (e) {
        setCatalogError("Impossible de charger le catalogue MyAnimeList pour le moment. Réessaie dans quelques secondes.");
      }
      try {
        const res2 = await jikanFetch(`${JIKAN_BASE}/top/anime?limit=25&page=2`);
        const data2 = await res2.json();
        loaded = [...loaded, ...(data2.data || [])];
        setTopAnime(loaded.map(fromJikan));
      } catch (e) {
        // pas grave si la 2e page échoue, on garde la 1ère
      }
      setCatalogLoading(false);
    })();
  }, []);

  /* --- recherche --- */
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
        const res = await jikanFetch(`${JIKAN_BASE}/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true`);
        if (res.status === 429) {
          setSearchError("Trop de recherches d'un coup — attends 2 secondes et réessaie.");
          setSearchResults([]);
        } else if (!res.ok) {
          setSearchError("Recherche indisponible pour le moment.");
          setSearchResults([]);
        } else {
          const data = await res.json();
          setSearchResults((data.data || []).map(fromJikan));
          if ((data.data || []).length === 0) setSearchError("Aucun résultat pour cette recherche.");
        }
      } catch (e) {
        setSearchError("Recherche indisponible : vérifie ta connexion et réessaie.");
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* --- charger mes notes --- */
  const loadEntries = useCallback(async () => {
    if (!session) return;
    setEntriesLoading(true);
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setEntries(data || []);
    setEntriesLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadEntries();
  }, [session, loadEntries]);

  /* --- auth actions --- */
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthBusy(true);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
      else setAuthNotice("Compte créé ! Si la confirmation par email est activée, vérifie ta boîte mail avant de te connecter.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
    }
    setAuthBusy(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setEntries([]);
  }

  /* --- notation --- */
  function openRating(anime) {
    const existing = entries.find((e) => e.anime_id === anime.id);
    setDraftRating(existing ? existing.rating : 0);
    setDraftComment(existing ? existing.comment || "" : "");
    setOpenAnime(anime);
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

  /* ---------- Écran de chargement ---------- */
  if (authLoading) {
    return (
      <div className="ab-body" style={{ background: PALETTE.bg, color: PALETTE.muted, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fontImport}
        Chargement…
      </div>
    );
  }

  /* ---------- Écran de connexion ---------- */
  if (!session) {
    return (
      <div className="ab-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text, padding: "48px 20px" }}>
        {fontImport}
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 14, background: `linear-gradient(135deg, ${PALETTE.surfaceAlt}, ${PALETTE.surface})`, border: `1px solid ${PALETTE.line}`, padding: "36px 28px", marginBottom: 28 }}>
            <Screentone />
            <div style={{ position: "relative" }}>
              <h1 className="ab-title" style={{ fontSize: 44, margin: 0 }}>
                ANIME<span style={{ color: PALETTE.sakura }}>BOX</span>
              </h1>
              <p style={{ color: PALETTE.muted, marginTop: 8, fontSize: 15 }}>
                Ton carnet de visionnage. Une note sur 5, un commentaire, pour chaque anime.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, background: PALETTE.surface, padding: 4, borderRadius: 10, marginBottom: 20 }}>
            <button onClick={() => setAuthMode("signin")} className="ab-btn" style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, background: authMode === "signin" ? PALETTE.sakura : "transparent", color: authMode === "signin" ? "#12111C" : PALETTE.muted }}>
              Connexion
            </button>
            <button onClick={() => setAuthMode("signup")} className="ab-btn" style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, background: authMode === "signup" ? PALETTE.sakura : "transparent", color: authMode === "signup" ? "#12111C" : PALETTE.muted }}>
              Créer un compte
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Adresse email"
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }}
            />
            <input
              type="password"
              required
              minLength={6}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Mot de passe (6 caractères min.)"
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14 }}
            />
            <button type="submit" disabled={authBusy} className="ab-btn" style={{ padding: "12px 0", borderRadius: 10, border: "none", background: PALETTE.sakura, color: "#12111C", fontWeight: 700, cursor: "pointer" }}>
              {authBusy ? "…" : authMode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>

          {authError && <p style={{ color: PALETTE.sakura, fontSize: 13, marginTop: 12 }}>{authError}</p>}
          {authNotice && <p style={{ color: PALETTE.ok, fontSize: 13, marginTop: 12 }}>{authNotice}</p>}
        </div>
      </div>
    );
  }

  const catalogList = [...topAnime, ...searchResults.filter((r) => !topAnime.some((t) => t.id === r.id))];

  /* ---------- App principale ---------- */
  return (
    <div className="ab-body" style={{ background: PALETTE.bg, minHeight: "100vh", color: PALETTE.text }}>
      {fontImport}

      <div style={{ borderBottom: `1px solid ${PALETTE.line}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="ab-title" style={{ fontSize: 26, margin: 0 }}>
          ANIME<span style={{ color: PALETTE.sakura }}>BOX</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", gap: 6, background: PALETTE.surface, padding: 4, borderRadius: 10 }}>
            <button onClick={() => setTab("catalogue")} className="ab-btn" style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: tab === "catalogue" ? PALETTE.sakura : "transparent", color: tab === "catalogue" ? "#12111C" : PALETTE.muted }}>
              Catalogue
            </button>
            <button onClick={() => setTab("journal")} className="ab-btn" style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: tab === "journal" ? PALETTE.sakura : "transparent", color: tab === "journal" ? "#12111C" : PALETTE.muted }}>
              Mon journal ({entries.length})
            </button>
          </div>
          <button onClick={handleSignOut} className="ab-btn" style={{ background: "none", border: `1px solid ${PALETTE.line}`, borderRadius: 20, padding: "6px 14px", color: PALETTE.muted, cursor: "pointer", fontSize: 13 }}>
            {session.user.email} · Déconnexion
          </button>
        </div>
      </div>

      {saveError && <div style={{ background: "#3A1220", color: PALETTE.sakura, padding: "8px 20px", fontSize: 13 }}>{saveError}</div>}

      <div style={{ padding: "24px 20px 60px", maxWidth: 1000, margin: "0 auto" }}>
        {tab === "catalogue" && (
          <>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher un anime sur MyAnimeList…"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.surface, color: PALETTE.text, fontSize: 14, marginBottom: 20 }}
            />
            {searchLoading && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Recherche…</div>}
            {searchError && <div style={{ fontSize: 13, color: PALETTE.sakura, marginBottom: 12 }}>{searchError}</div>}
            {catalogError && <div style={{ fontSize: 13, color: PALETTE.sakura, marginBottom: 12 }}>{catalogError}</div>}
            {catalogLoading && catalogList.length === 0 && <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 12 }}>Chargement du catalogue…</div>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
              {catalogList.map((anime) => {
                const entry = entries.find((e) => e.anime_id === anime.id);
                return (
                  <button
                    key={anime.id}
                    onClick={() => openRating(anime)}
                    className="ab-card"
                    style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${PALETTE.line}`, borderRadius: 12, overflow: "hidden", background: PALETTE.surface, padding: 0, color: PALETTE.text }}
                  >
                    <div style={{ position: "relative", height: 240, background: GENRE_GRADIENTS[anime.genre] || GENRE_GRADIENTS.Anime, overflow: "hidden" }}>
                      {anime.image ? <img src={anime.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Screentone />}
                      <span style={{ position: "absolute", top: 8, left: 10, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", background: "rgba(0,0,0,0.45)", padding: "2px 8px", borderRadius: 20 }}>{anime.genre}</span>
                      {entry && <span style={{ position: "absolute", bottom: 8, right: 10, fontSize: 11, fontWeight: 800, color: PALETTE.ok, background: "rgba(0,0,0,0.45)", padding: "2px 8px", borderRadius: 20 }}>✓ vu</span>}
                    </div>
                    <div style={{ padding: "12px 12px 14px" }}>
                      <div className="ab-title" style={{ fontSize: 17, lineHeight: 1.15 }}>{anime.title}</div>
                      <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 4 }}>{anime.year}</div>
                      {entry ? (
                        <div style={{ marginTop: 8 }}>
                          <Stars value={entry.rating} readOnly size={14} />
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: PALETTE.muted }}>Pas encore noté</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === "journal" && (
          <div>
            {entriesLoading ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: PALETTE.muted }}>Chargement…</div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: PALETTE.muted }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📼</div>
                Rien de noté pour l'instant. Ouvre le catalogue et pose ta première note.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {entries.map((e) => (
                  <div key={e.id} style={{ display: "flex", gap: 14, background: PALETTE.surface, border: `1px solid ${PALETTE.line}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ width: 56, height: 78, flexShrink: 0, borderRadius: 8, background: GENRE_GRADIENTS[e.anime_genre] || GENRE_GRADIENTS.Anime, position: "relative", overflow: "hidden" }}>
                      {e.anime_image ? <img src={e.anime_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Screentone />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div className="ab-title" style={{ fontSize: 17 }}>{e.anime_title}</div>
                        <span style={{ fontSize: 11, color: PALETTE.muted }}>{new Date(e.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <Stars value={e.rating} readOnly size={15} />
                      {e.comment && <p style={{ fontSize: 13, color: PALETTE.muted, marginTop: 6, marginBottom: 0 }}>{e.comment}</p>}
                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <button onClick={() => openRating({ id: e.anime_id, title: e.anime_title, image: e.anime_image, year: e.anime_year, genre: e.anime_genre })} style={{ background: "none", border: "none", color: PALETTE.sakura, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                          Modifier
                        </button>
                        <button onClick={() => removeEntry(e.anime_id)} style={{ background: "none", border: "none", color: PALETTE.muted, fontSize: 12, cursor: "pointer", padding: 0 }}>
                          Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {openAnime && (
        <div onClick={() => setOpenAnime(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.line}`, borderRadius: 14, padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
              {openAnime.image ? (
                <img src={openAnime.image} alt="" style={{ width: 64, height: 90, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 64, height: 90, borderRadius: 8, background: GENRE_GRADIENTS[openAnime.genre] || GENRE_GRADIENTS.Anime, flexShrink: 0 }} />
              )}
              <div>
                <div className="ab-title" style={{ fontSize: 22, marginBottom: 2 }}>{openAnime.title}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted }}>{openAnime.year} · {openAnime.genre}</div>
              </div>
            </div>

            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", marginBottom: 6 }}>Ta note</label>
            <Stars value={draftRating} onChange={setDraftRating} size={26} />

            <label style={{ fontSize: 12, color: PALETTE.muted, display: "block", margin: "16px 0 6px" }}>Ton commentaire</label>
            <textarea
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
              rows={4}
              placeholder="Qu'est-ce que tu en as pensé ?"
              style={{ width: "100%", resize: "vertical", padding: 10, borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.bg, color: PALETTE.text, fontSize: 13 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button onClick={() => setOpenAnime(null)} className="ab-btn" style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${PALETTE.line}`, background: "none", color: PALETTE.text, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={saveEntry} disabled={draftRating === 0} className="ab-btn" style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: draftRating === 0 ? PALETTE.line : PALETTE.sakura, color: "#12111C", fontWeight: 700, cursor: draftRating === 0 ? "not-allowed" : "pointer" }}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
