export type SnapshotSharePlatform = {
  id: string;
  label: string;
  kind: "download" | "copy";
  helper?: string;
};

export const SNAPSHOT_SHARE_PLATFORMS: SnapshotSharePlatform[] = [
  {
    id: "download",
    label: "Download Image",
    kind: "download",
    helper: "Save a PNG file to your device.",
  },
  {
    id: "copy",
    label: "Copy Image",
    kind: "copy",
    helper: "Copy the PNG to your clipboard.",
  },
];
