const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const make = (paths, extra = {}) => function Icon({ size = 24, filled, ...props }) {
  return (
    <svg {...base} {...extra} width={size} height={size} fill={filled ? 'currentColor' : 'none'} {...props}>
      {paths}
    </svg>
  );
};

export const HomeIcon = make(<><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></>);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const PlusIcon = make(<><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></>);
export const ChatIcon = make(<><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" /></>);
export const TestIcon = make(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h3" /></>);
export const ShieldIcon = make(<><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>);
export const HeartIcon = make(<><path d="M12 20.5S3 15 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8C21 15 12 20.5 12 20.5z" /></>);
export const DownloadIcon = make(<><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>);
export const BookmarkIcon = make(<><path d="M6 3h12v18l-6-5-6 5z" /></>);
export const PlayIcon = make(<><rect x="2.5" y="4" width="19" height="16" rx="4" /><path d="m10 9 5 3-5 3z" /></>);
export const AudioIcon = make(<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>);
export const LogoutIcon = make(<><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" /></>);
export const MoreIcon = make(<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>);
export const FlagIcon = make(<><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>);
export const TrashIcon = make(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>);
export const SettingsIcon = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const FileIcon = make(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>);
export const GridIcon = make(<><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const UploadIcon = make(<><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></>);
export const CheckIcon = make(<><path d="m5 12 5 5 9-10" /></>);
export const XIcon = make(<><path d="M6 6l12 12M18 6 6 18" /></>);
export const ToothIcon = make(<><path d="M7 3c-2.5 0-4 2-4 4.5 0 2.5 1.2 3.6 1.8 6 .6 2.6 1 7.5 3 7.5s1.6-5 4.2-5 2.2 5 4.2 5 2.4-4.9 3-7.5c.6-2.4 1.8-3.5 1.8-6C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z" /></>);
export const TrophyIcon = make(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /></>);
export const CoinIcon = make(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><path d="M12 9.5v5" /></>);
export const CrownIcon = make(<><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /></>);
export const BellIcon = make(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>);
export const NewsIcon = make(<><path d="M4 5h13v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M17 9h3v10a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3" /></>);
export const BriefcaseIcon = make(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>);
export const MenuIcon = make(<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>);
export const ChevronUpIcon = make(<><path d="m6 15 6-6 6 6" /></>);
export const ChevronLeftIcon = make(<><path d="m15 6-6 6 6 6" /></>);
export const ChevronRightIcon = make(<><path d="m9 6 6 6-6 6" /></>);
export const ExternalIcon = make(<><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const PinIcon = make(<><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>);
export const BookIcon = make(<><path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z" /><path d="M4 20a2 2 0 0 0 2 2h13v-4M9 7h6M9 11h4" /></>);
