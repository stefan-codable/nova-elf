const paths = {
  home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V9.5Z",
  plus: "M10 4v12M4 10h12",
  search: "M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12Zm4.5-1.5L17 17",
  trash: "M4 6h12M8 6V4h4v2m-6 0 .7 10h6.6L14 6",
  image: "M3 5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Zm0 8 4-4 4 4 2-2 4 4M13 8.5h.01",
  spark: "M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3Zm5.5 9.5.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z",
  panel: "M3 5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Zm9-1v12",
  sun: "M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 2v2m0 12v2M2 10h2m12 0h2M4.3 4.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4",
  moon: "M16.5 11.5A7 7 0 0 1 8.5 3.5a7 7 0 1 0 8 8Z",
  auto: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-14v14",
  check: "m4.5 10.5 3.5 3.5 7.5-8",
  x: "m5 5 10 10M15 5 5 15",
  calendar: "M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 4h14M7 3v4m6-4v4",
  folder: "M3 6a1 1 0 0 1 1-1h3.6l1.6 2H16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z",
  refresh: "M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5",
} as const;

export function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
