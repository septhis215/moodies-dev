/**
 * Shared YouTube IFrame API access.
 *
 * Trailers are driven through the official IFrame API rather than a hand-rolled
 * `postMessage` bridge. The API is the only source of trustworthy playback
 * signals — `onReady`/`onStateChange`/`onError` plus `onAutoplayBlocked`, which
 * fires when the browser refuses autoplay. Raw embed iframes cannot report any
 * of that, so a UI built on them ends up guessing (and guessing wrong).
 */

export type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  cueVideoById: (videoId: string) => void;
  loadVideoById: (videoId: string) => void;
  getIframe: () => HTMLIFrameElement;
  destroy: () => void;
};

export type YouTubePlayerVars = Record<string, number | string>;

export type YouTubePlayerEvents = {
  onReady?: (event: { target: YouTubePlayer }) => void;
  onStateChange?: (event: { data: number }) => void;
  onPlaybackRateChange?: (event: { data: number }) => void;
  onError?: (event: { data: number }) => void;
  /** Fires when the browser blocks autoplay or scripted playback. */
  onAutoplayBlocked?: () => void;
};

export type YouTubePlayerOptions = {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  host?: HTMLElement | string;
  playerVars?: YouTubePlayerVars;
  events?: YouTubePlayerEvents;
};

/** Player states reported by `onStateChange`/`getPlayerState`. */
export const YT_PLAYER_STATE = {
  UNSTARTED: 5,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 4,
} as const;

export type YouTubePlayerState = {
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
  UNSTARTED: number;
};

export type YouTubeNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: YouTubePlayerOptions,
  ) => YouTubePlayer;
  PlayerState?: YouTubePlayerState;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";

/**
 * Loads the IFrame API once per page and resolves with the `YT` namespace.
 * Reuses the script tag if another component already requested it, and chains
 * onto any `onYouTubeIframeAPIReady` handler that was installed first, so every
 * consumer on the page shares a single API instance.
 */
export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("YouTube IFrame API requires a browser"));
      return;
    }
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousReady) previousReady();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube IFrame API failed to initialise"));
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const tag = document.createElement("script");
      tag.src = API_SRC;
      tag.async = true;
      tag.onerror = () =>
        reject(new Error("YouTube IFrame API script failed to load"));
      document.body.appendChild(tag);
    }
  });
}

/**
 * Creates a player inside `host` without letting the API replace a node React
 * owns. The API swaps the element it is given for its own iframe, so it gets a
 * throwaway child; destroying the player removes that child and leaves the
 * React-rendered host intact for the next mount.
 */
export async function createYouTubePlayer(
  host: HTMLElement,
  options: YouTubePlayerOptions,
): Promise<YouTubePlayer> {
  const YT = await loadYouTubeApi();
  const mount = document.createElement("div");
  mount.style.width = "100%";
  mount.style.height = "100%";
  host.appendChild(mount);

  try {
    const player = new YT.Player(mount, options);
    return player;
  } catch (error) {
    mount.remove();
    throw error;
  }
}
