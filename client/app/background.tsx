"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const backgrounds = ["/ironmanbg.jpg", "/ironmanbg2.jpg"];

export default function Background() {
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgrounds.length);
    }, 7000); // change bg every 7 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      {backgrounds.map((bg, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === bgIndex ? "opacity-90" : "opacity-0"
          }`}
        >
          <Image
            src={bg}
            alt="Background"
            fill
            className="object-cover"
            priority={i === bgIndex}
          />
        </div>
      ))}
    </div>
  );
}
