"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const GENRE_OPTIONS = [
  "Action","Adventure","Animation","Comedy","Crime","Documentary","Drama","Family","Fantasy","History",
  "Horror","Music","Mystery","Romance","Science Fiction","TV Movie","Thriller","War","Western",
  "Action & Adventure","Kids","News","Reality","Sci-Fi & Fantasy","Soap","Talk","War & Politics",
];

const LANGUAGE_OPTIONS = [
  "English","French","Spanish","Japanese","German","Portuguese","Chinese","Italian",
  "Russian","Korean","Czech","Arabic","Dutch",
];

const Chip: React.FC<{active?: boolean; onClick?: () => void; children: React.ReactNode}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "px-3 py-1.5 rounded-full text-sm transition-colors border",
      active
        ? "bg-amber-400 text-black border-amber-300"
        : "bg-white/5 text-white/90 hover:bg-white/10 border-white/10",
    ].join(" ")}
  >
    {children}
  </button>
);

export default function OnboardingPage() {
  const router = useRouter();

  const [age, setAge] = useState<number>(18);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    list.includes(v) ? set(list.filter((x) => x !== v)) : set([...list, v]);

  const canSubmit = useMemo(
    () => age >= 1 && age <= 100 && genres.length > 0 && languages.length > 0,
    [age, genres.length, languages.length]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("authToken");
    if (!token) return setMsg("Not logged in!");

    try {
      const res = await fetch(`${API_BASE}/auth/me/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ age, preferredGenres: genres, preferredLanguages: languages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save");
      router.push("/auth/login");
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  return (
    <div className="space-y-8 max-h-[70vh] overflow-auto pr-1">
      <div>
        <h1 className="text-2xl font-bold text-white">Set up your preferences</h1>
        <p className="mt-1 text-sm text-white/60">You can change these anytime in Settings.</p>
      </div>

      {/* Age */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="age" className="text-sm text-white/80">Your Age</label>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">{age}</span>
        </div>
        <input
          id="age"
          type="range"
          min={1}
          max={100}
          step={1}
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          className="range w-full accent-amber-400"
        />
        <div className="mt-2 flex justify-between text-xs text-white/40">
          <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>

      {/* Genres */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-white/80">Preferred Genres</p>
          <div className="text-xs text-white/60">
            {genres.length} selected{genres.length>0 && <> | <button type="button" onClick={()=>setGenres([])} className="underline decoration-dotted hover:text-white">Clear</button></>}
          </div>
        </div>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/10 p-3">
          {GENRE_OPTIONS.map((g) => (
            <Chip key={g} active={genres.includes(g)} onClick={() => toggle(genres, setGenres, g)}>{g}</Chip>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-white/80">Preferred Languages</p>
          <div className="text-xs text-white/60">
            {languages.length} selected{languages.length>0 && <> | <button type="button" onClick={()=>setLanguages([])} className="underline decoration-dotted hover:text-white">Clear</button></>}
          </div>
        </div>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/10 p-3">
          {LANGUAGE_OPTIONS.map((l) => (
            <Chip key={l} active={languages.includes(l)} onClick={() => toggle(languages, setLanguages, l)}>{l}</Chip>
          ))}
        </div>
      </div>

      {msg && <p className="text-sm font-medium text-amber-300">{msg}</p>}

      <button
        type="submit"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={[
          "w-full rounded-xl px-5 py-3 font-semibold text-white transition-all",
          "bg-gradient-to-r from-amber-500 to-pink-500 hover:brightness-110",
          !canSubmit ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        Save Preferences
      </button>

      {/* slider styling */}
      <style jsx>{`
        .range { appearance: none; height: 4px; border-radius: 9999px;
          background: linear-gradient(to right, rgb(251 191 36) 0%, rgb(236 72 153) 100%); outline: none; }
        .range::-webkit-slider-thumb { appearance: none; width: 18px; height: 18px; border-radius: 9999px;
          background: white; border: 3px solid rgba(255,255,255,.35); box-shadow: 0 6px 16px rgba(0,0,0,.35); cursor: pointer; }
        .range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 9999px; background: white;
          border: 3px solid rgba(255,255,255,.35); box-shadow: 0 6px 16px rgba(0,0,0,.35); cursor: pointer; }
      `}</style>
    </div>
  );
}
