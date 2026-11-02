import Link from "next/link";
import styles from "./celebrity-hub.module.css";

export default function CelebrityProfileNav({
  id,
  active = "overview",
}: {
  id: number;
  active?: string;
}) {
  return (
    <nav
      aria-label="Celebrity content"
      className={`${styles.nav} mt-6 sm:mt-8`}
    >
      {[
        { key: "overview", label: "Profile", href: `/celeb/${id}` },
        { key: "news", label: "News", href: `/celeb/${id}/news` },
        { key: "videos", label: "Videos", href: `/celeb/${id}/videos` },
        { key: "photos", label: "Photos", href: `/celeb/${id}/photos` },
      ].map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
