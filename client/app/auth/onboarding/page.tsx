"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function OnboardingPage() {
  const router = useRouter();
  const [age, setAge] = useState<number | "">("");
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const GENRES = ["Action", "Romance", "Comedy", "Thriller", "Fantasy"];
  const LANGUAGES = ["English", "Chinese", "Malay", "Japanese", "Korean"];

  const toggle = (list: string[], setList: any, value: string) => {
    if (list.includes(value)) setList(list.filter((v) => v !== value));
    else setList([...list, value]);
  };

  const token = localStorage.getItem("authToken");  
  if (!token) {
    setMsg("Not logged in. Please sign in again.");
    return;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("authToken");
    if (!token) return setMsg("Not logged in!");

    const res = await fetch(`${API}/auth/me/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, 
      },
      body: JSON.stringify({
        age: age === "" ? null : Number(age),
        preferredGenres: genres,
        preferredLanguages: languages,
      }),
    });

    const data = await res.json();
    if (!res.ok) return setMsg(data.message || "Failed to save");

    setMsg("Preferences saved!");
    router.push("/"); // ✅ go next
  };

  return (
    <main className="text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Set up your preferences</h1>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block mb-1">Your Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
            className="bg-white/10 rounded px-3 py-2"
          />
        </div>

        <div>
          <p className="mb-1">Preferred Genres</p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggle(genres, setGenres, g)}
                className={`px-3 py-2 rounded ${
                  genres.includes(g)
                    ? "bg-amber-500 text-black"
                    : "bg-white/10 text-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1">Preferred Languages</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggle(languages, setLanguages, l)}
                className={`px-3 py-2 rounded ${
                  languages.includes(l)
                    ? "bg-pink-500 text-black"
                    : "bg-white/10 text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {msg && <p className="text-amber-300">{msg}</p>}

        <button
          type="submit"
          className="w-full py-3 rounded bg-gradient-to-r from-amber-500 to-pink-500 font-semibold"
        >
          Save Preferences
        </button>
      </form>
    </main>
  );
}
