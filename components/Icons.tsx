import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { name: string };

const paths: Record<string, React.ReactNode> = {
  village: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/></>,
  kingdom: <><path d="M5 21V4"/><path d="M5 5h11l-2 4 2 4H5"/><path d="M3 21h6"/></>,
  missions: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m15 9 5-5"/><path d="m17 4 3 0 0 3"/></>,
  gorilla: <><path d="M8 7c0-2 1.8-3.5 4-3.5S16 5 16 7"/><path d="M6.5 9.5C6.5 7 9 6 12 6s5.5 1 5.5 3.5v4C17.5 17 15 20 12 20s-5.5-3-5.5-6.5z"/><path d="M9 12h.01M15 12h.01"/><path d="M9.5 16c1.4.9 3.6.9 5 0"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  bolt: <path d="m13 2-7 11h6l-1 9 7-12h-6z"/>,
  coin: <><circle cx="12" cy="12" r="8"/><path d="M9.5 10c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.7-2.5 1.7-2.5.7-2.5 1.8 1 1.8 2.5 1.8 2.5-.7 2.5-1.8"/></>,
  brain: <><path d="M9 5a3 3 0 0 0-5 2.2A3 3 0 0 0 5 13v1a3 3 0 0 0 4 2.8"/><path d="M15 5a3 3 0 0 1 5 2.2A3 3 0 0 1 19 13v1a3 3 0 0 1-4 2.8"/><path d="M9 5v14M15 5v14"/><path d="M9 9H7M15 9h2M9 14H7M15 14h2"/></>,
  compass: <><circle cx="12" cy="12" r="8"/><path d="m15 9-2 5-5 2 2-5z"/></>,
  dumbbell: <><path d="M6 9v6M3 10v4M18 9v6M21 10v4M6 12h12"/></>,
  timer: <><circle cx="12" cy="13" r="7"/><path d="M9 2h6M12 6v7l3 2"/></>,
  walk: <><circle cx="13" cy="4" r="1.5"/><path d="m11 8 3 2 2 4M11 8l-2 5-3 3M13 11l-1 5 3 4"/></>,
  arrow: <path d="m9 18 6-6-6-6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  sword: <><path d="m14 5 5-2-2 5-8 8-3-3z"/><path d="m5 14 5 5M4 20l3-3"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6"/><circle cx="17" cy="9" r="2"/><path d="M16 14c3 .2 4.5 2 5 5"/></>,
};

export default function Icon({ name, ...props }: Props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.arrow}</svg>;
}
