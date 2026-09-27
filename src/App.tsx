/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Share2,
  Globe,
  Volume2,
  VolumeX,
  Check,
  MapPin,
  Mail,
  Download,
  QrCode,
  Search,
  Copy,
  ExternalLink,
  X,
  Play,
  Pause,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle2,
  Upload,
  Camera,
  Lock,
  KeyRound,
  Music,
  Image as ImageIcon,
  User as UserIcon,
  RotateCcw,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Maximize2,
  Home,
  Layers,
  Users,
  Smartphone,
  Laptop,
  Activity,
  FolderOpen,
  FileText,
  Trash2,
  Plus,
  Phone,
} from 'lucide-react';
import { musicEngine } from './utils/audioPlayer.ts';
import { initAuth, googleSignIn, logout, fetchDriveFiles, uploadFileToDrive, deleteDriveFile, DriveFile } from './utils/googleDrive.ts';
import { initContactsAuth, signInWithGoogleContacts, logoutContacts, fetchGoogleContacts, createGoogleContact, GoogleContact } from './utils/googleContacts.ts';
import type { User } from 'firebase/auth';

// Default initial images
import coverImgDefault from './assets/images/user_cover_signs_1790463426101.jpg';
import avatarImgDefault from './assets/images/avatar.png';

// Authentic Official Platform App Icons
import snapchatIcon from './assets/images/snapchat_app_icon.svg';
import playstationIcon from './assets/images/playstation_app_icon.svg';

interface PlatformItem {
  id: string;
  name: string;
  category: 'social' | 'messaging' | 'video' | 'gaming';
  handle: string;
  copyValue: string;
  description: string;
  badge: string;
  actionText: string;
  directUrl: string;
  iconType: string;
}

// Secret Passcode validated strictly without showing in UI
const PASSCODE = 'lyyfhmw3';

/**
 * FadeInCard: Smoothly animates platform cards as they scroll into view
 */
interface FadeInCardProps {
  children: React.ReactNode;
  delay?: number;
}

function FadeInCard({ children, delay = 0 }: FadeInCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (domRef.current) {
      const rect = domRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight - 30) {
        setIsVisible(true);
        return;
      }
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (domRef.current) observer.unobserve(domRef.current);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    const currentEl = domRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) observer.unobserve(currentEl);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={domRef}
      style={{
        transitionDelay: isVisible ? `${delay}ms` : '0ms',
      }}
      className={`transform transition-all duration-700 ease-out will-change-transform ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 filter-none'
          : 'opacity-0 translate-y-8 scale-[0.98]'
      }`}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5); // 50% volume default
  const [currentTrackTitle, setCurrentTrackTitle] = useState('Michael Jackson - Chicago');
  const [showVolumeMenu, setShowVolumeMenu] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState<boolean>(() => {
    const stored = localStorage.getItem('divo_show_audio_banner');
    return stored !== null ? stored === 'true' : false;
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [showCollabModal, setShowCollabModal] = useState(false);
  // Full-resolution Lightbox Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string; subtitle?: string } | null>(null);
  // Platform Card Active Press Animation State
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);

  // Admin / Passcode Management Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState<'cover' | 'avatar' | 'music'>('cover');
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [passcodeError, setPasscodeError] = useState(false);

  // Form states in Admin Modal
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [audioTitleInput, setAudioTitleInput] = useState('');

  // Images state (synced with global server config & cached in localStorage)
  const [coverImage, setCoverImage] = useState<string>(() => {
    return localStorage.getItem('divo_custom_cover_v2') || coverImgDefault;
  });

  const [avatarImage, setAvatarImage] = useState<string>(avatarImgDefault);

  // Real Persistent Page Visits Counter (Monotonic: never decreases)
  const [actualVisits, setActualVisits] = useState<number>(1);
  const [uniqueVisitsCount, setUniqueVisitsCount] = useState<number>(1);
  const [recentVisitorsList, setRecentVisitorsList] = useState<
    Array<{ id: string; device: string; time: number }>
  >([]);
  const [showVisitorsModal, setShowVisitorsModal] = useState(false);

  // Helper: Format relative time
  const formatRelativeTime = (timestamp: number, currentLang: 'ar' | 'en') => {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return currentLang === 'ar' ? 'منذ لحظات' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return currentLang === 'ar' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return currentLang === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return currentLang === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  };

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File Input Refs
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Active navigation tab state for Bottom Navigation Bar
  const [activeNav, setActiveNav] = useState<'home' | 'accounts' | 'contact' | 'share' | 'qr'>('home');

  // Google Drive Integration States & Handlers
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveNeedsAuth, setDriveNeedsAuth] = useState(true);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);

  // Google Contacts Integration States & Handlers
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contactsUser, setContactsUser] = useState<User | null>(null);
  const [contactsToken, setContactsToken] = useState<string | null>(null);
  const [contactsNeedsAuth, setContactsNeedsAuth] = useState(true);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [googleContactsList, setGoogleContactsList] = useState<GoogleContact[]>([]);
  const [contactsSearchQuery, setContactsSearchQuery] = useState('');
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [isCreatingContact, setIsCreatingContact] = useState(false);

  // DIVO AI Studio States & Handlers
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTab, setAiTab] = useState<'chat' | 'search' | 'maps' | 'image' | 'video' | 'music' | 'transcribe'>('chat');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; text: string }>>([
    { role: 'model', text: lang === 'ar' ? 'أهلاً بك في استوديو الذكاء الاصطناعي لـ DIVO! كيف يمكنني مساعدتك اليوم؟' : 'Welcome to DIVO AI Studio! How can I assist you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedChatModel, setSelectedChatModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const historyPayload = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: historyPayload, modelName: selectedChatModel })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(prev => [...prev, { role: 'model', text: data.response }]);
      } else {
        throw new Error(data.error || 'Chat failed');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'model', text: lang === 'ar' ? 'عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.' : 'Sorry, an error occurred while connecting to AI.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const [searchQueryInput, setSearchQueryInput] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [searchChunks, setSearchChunks] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQueryInput.trim() || isSearchLoading) return;
    setIsSearchLoading(true);
    setSearchResult('');
    setSearchChunks([]);
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: searchQueryInput })
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResult(data.text);
        setSearchChunks(data.groundingChunks || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      triggerToast(lang === 'ar' ? 'فشل البحث' : 'Search failed');
    } finally {
      setIsSearchLoading(false);
    }
  };

  const [mapsQueryInput, setMapsQueryInput] = useState('');
  const [mapsResult, setMapsResult] = useState('');
  const [isMapsLoading, setIsMapsLoading] = useState(false);

  const handleAiMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQueryInput.trim() || isMapsLoading) return;
    setIsMapsLoading(true);
    setMapsResult('');
    try {
      const res = await fetch('/api/ai/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: mapsQueryInput })
      });
      const data = await res.json();
      if (res.ok) {
        setMapsResult(data.text);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      triggerToast(lang === 'ar' ? 'فشل البحث الجغرافي' : 'Maps search failed');
    } finally {
      setIsMapsLoading(false);
    }
  };

  const [imagePromptInput, setImagePromptInput] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [isImageLoading, setIsImageLoading] = useState(false);

  const handleAiImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePromptInput.trim() || isImageLoading) return;
    setIsImageLoading(true);
    setGeneratedImageUrl('');
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePromptInput })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedImageUrl(data.imageUrl);
        triggerToast(lang === 'ar' ? 'تم توليد الصورة بنجاح!' : 'Image generated successfully!');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      triggerToast(lang === 'ar' ? 'فشل توليد الصورة' : 'Image generation failed');
    } finally {
      setIsImageLoading(false);
    }
  };

  const [videoPromptInput, setVideoPromptInput] = useState('');
  const [generatedVideoUri, setGeneratedVideoUri] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const handleAiVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoPromptInput.trim() || isVideoLoading) return;
    setIsVideoLoading(true);
    setGeneratedVideoUri('');
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: videoPromptInput, aspectRatio: '16:9' })
      });
      const data = await res.json();
      if (res.ok && data.videoUri) {
        setGeneratedVideoUri(data.videoUri);
        triggerToast(lang === 'ar' ? 'تم توليد الفيديو بنجاح!' : 'Video generated successfully!');
      } else {
        throw new Error(data.error || 'Video generation failed');
      }
    } catch (err: any) {
      triggerToast(lang === 'ar' ? 'فشل توليد الفيديو' : 'Video generation failed');
    } finally {
      setIsVideoLoading(false);
    }
  };

  const [musicPromptInput, setMusicPromptInput] = useState('');
  const [generatedMusicAudio, setGeneratedMusicAudio] = useState('');
  const [isMusicLoading, setIsMusicLoading] = useState(false);

  const handleAiMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicPromptInput.trim() || isMusicLoading) return;
    setIsMusicLoading(true);
    setGeneratedMusicAudio('');
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: musicPromptInput })
      });
      const data = await res.json();
      if (res.ok && data.audioBase64) {
        setGeneratedMusicAudio(data.audioBase64);
        triggerToast(lang === 'ar' ? 'تم توليد الموسيقى بنجاح!' : 'Music generated successfully!');
      } else {
        throw new Error(data.error || 'Music generation failed');
      }
    } catch (err: any) {
      triggerToast(lang === 'ar' ? 'فشل توليد الموسيقى' : 'Music generation failed');
    } finally {
      setIsMusicLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribeContacts = initContactsAuth(
      (user, token) => {
        setContactsUser(user);
        setContactsToken(token);
        setContactsNeedsAuth(false);
        loadGoogleContacts();
      },
      () => {
        setContactsUser(null);
        setContactsToken(null);
        setContactsNeedsAuth(true);
        setGoogleContactsList([]);
      }
    );
    return () => unsubscribeContacts();
  }, []);

  const loadGoogleContacts = async () => {
    setIsContactsLoading(true);
    try {
      const contacts = await fetchGoogleContacts();
      setGoogleContactsList(contacts);
    } catch (err: any) {
      console.error('Error loading contacts:', err);
    } finally {
      setIsContactsLoading(false);
    }
  };

  const handleContactsLogin = async () => {
    setIsContactsLoading(true);
    try {
      const result = await signInWithGoogleContacts();
      if (result) {
        setContactsUser(result.user);
        setContactsToken(result.accessToken);
        setContactsNeedsAuth(false);
        await loadGoogleContacts();
        triggerToast(lang === 'ar' ? 'تم الاتصال بـ Google Contacts بنجاح!' : 'Connected to Google Contacts!');
      }
    } catch (err: any) {
      console.error('Contacts sign-in error:', err);
      triggerToast(lang === 'ar' ? 'فشل تسجيل الدخول' : 'Sign-in failed');
    } finally {
      setIsContactsLoading(false);
    }
  };

  const handleContactsLogout = async () => {
    await logoutContacts();
    setContactsUser(null);
    setContactsToken(null);
    setContactsNeedsAuth(true);
    setGoogleContactsList([]);
    triggerToast(lang === 'ar' ? 'تم تسجيل الخروج من Contacts' : 'Logged out from Contacts');
  };

  const handleCreateContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;
    setIsCreatingContact(true);
    try {
      await createGoogleContact({
        name: newContactName,
        email: newContactEmail || undefined,
        phone: newContactPhone || undefined,
      });
      triggerToast(lang === 'ar' ? 'تم إضافة جهة الاتصال بنجاح!' : 'Contact added successfully!');
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setShowAddContactModal(false);
      await loadGoogleContacts();
    } catch (err: any) {
      console.error('Create contact error:', err);
      triggerToast(lang === 'ar' ? 'فشل إضافة جهة الاتصال' : 'Failed to add contact');
    } finally {
      setIsCreatingContact(false);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
        setDriveNeedsAuth(false);
        loadDriveFiles(token);
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
        setDriveNeedsAuth(true);
        setDriveFiles([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadDriveFiles = async (_tokenOverride?: string) => {
    setIsDriveLoading(true);
    try {
      const files = await fetchDriveFiles(driveSearchQuery);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Error loading drive files:', err);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveLogin = async () => {
    setIsDriveLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setDriveUser(result.user);
        setDriveToken(result.accessToken);
        setDriveNeedsAuth(false);
        await loadDriveFiles(result.accessToken);
        triggerToast(lang === 'ar' ? 'تم الاتصال بـ Google Drive بنجاح!' : 'Connected to Google Drive!');
      }
    } catch (err: any) {
      console.error('Drive sign-in error:', err);
      triggerToast(lang === 'ar' ? 'فشل تسجيل الدخول' : 'Sign-in failed');
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveLogout = async () => {
    await logout();
    setDriveUser(null);
    setDriveToken(null);
    setDriveNeedsAuth(true);
    setDriveFiles([]);
    triggerToast(lang === 'ar' ? 'تم تسجيل الخروج من Drive' : 'Logged out from Drive');
  };

  const handleUploadSiteBackup = async () => {
    setIsUploadingDrive(true);
    try {
      const backupData = JSON.stringify({
        appName: 'DIVO - FD Official',
        timestamp: new Date().toISOString(),
        visits: actualVisits,
        uniqueVisitors: uniqueVisitsCount,
        platformsCount: platforms.length
      }, null, 2);

      const fileName = `DIVO_Site_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      await uploadFileToDrive(fileName, 'application/json', backupData);
      triggerToast(lang === 'ar' ? 'تم رفع نسخة احتياطية إلى Google Drive!' : 'Backup uploaded to Google Drive!');
      await loadDriveFiles();
    } catch (err: any) {
      console.error('Upload error:', err);
      triggerToast(lang === 'ar' ? 'فشل رفع الملف' : 'Upload failed');
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const confirmAndDeleteDriveFile = async (file: DriveFile) => {
    try {
      await deleteDriveFile(file.id);
      setFileToDelete(null);
      triggerToast(lang === 'ar' ? 'تم حذف الملف بنجاح' : 'File deleted successfully');
      await loadDriveFiles();
    } catch (err: any) {
      console.error('Delete error:', err);
      triggerToast(lang === 'ar' ? 'فشل حذف الملف' : 'Failed to delete file');
    }
  };

  // Sync with global server config on load
  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.coverImage) {
            setCoverImage(cfg.coverImage);
            localStorage.setItem('divo_custom_cover_v2', cfg.coverImage);
          }
          if (cfg.avatarImage) {
            setAvatarImage(cfg.avatarImage);
            localStorage.setItem('divo_custom_avatar_v2', cfg.avatarImage);
          }
          if (cfg.audioUrl) {
            musicEngine.setCustomAudio(cfg.audioUrl, cfg.audioTitle || 'Michael Jackson - Chicago');
            setCurrentTrackTitle(cfg.audioTitle || 'Michael Jackson - Chicago');
          }
          if (typeof cfg.visits === 'number') {
            setActualVisits((prev) => Math.max(prev, cfg.visits));
          }
          if (Array.isArray(cfg.uniqueVisitors)) {
            setUniqueVisitsCount((prev) => Math.max(prev, cfg.uniqueVisitors.length));
          }
          if (Array.isArray(cfg.recentVisitors)) {
            setRecentVisitorsList(cfg.recentVisitors);
          }
        }
      } catch {
        // Fallback to local storage if offline
      }
    };

    fetchGlobalConfig();
  }, []);

  // Increment and record real visit count per visitor (Strictly monotonic: increases, never decreases)
  useEffect(() => {
    // Generate or fetch permanent visitor UUID
    let visitorId = localStorage.getItem('divo_permanent_visitor_uuid');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('divo_permanent_visitor_uuid', visitorId);
    }

    // Detect client device
    const ua = navigator.userAgent;
    let device = 'متصفح ويب';
    if (/iPhone/i.test(ua)) device = 'هاتف iPhone';
    else if (/iPad/i.test(ua)) device = 'جهاز iPad';
    else if (/Android/i.test(ua)) device = 'هاتف Android';
    else if (/Macintosh|Mac OS/i.test(ua)) device = 'جهاز Mac';
    else if (/Windows/i.test(ua)) device = 'كمبيوتر Windows';

    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, device }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (typeof data.visits === 'number') {
            // Guarantee monotonic: always increases or remains equal, never decreases
            setActualVisits((prev) => Math.max(prev, data.visits));
          }
          if (typeof data.uniqueCount === 'number') {
            setUniqueVisitsCount((prev) => Math.max(prev, data.uniqueCount));
          }
          if (Array.isArray(data.recentVisitors)) {
            setRecentVisitorsList(data.recentVisitors);
          }
        }
      })
      .catch(() => {
        // Local monotonic fallback
        setActualVisits((prev) => prev + 1);
      });
  }, []);

  // Music setup: Autoplay at 50% on mount / first user interaction
  useEffect(() => {
    const unsubscribe = musicEngine.subscribe((playing, vol) => {
      setIsPlayingMusic(playing);
      setMusicVolume(vol);
      setCurrentTrackTitle(musicEngine.trackTitle);
    });

    musicEngine.setVolume(0.5);

    // Attempt autoplay immediately
    musicEngine.start().catch(() => {
      const handleFirstInteraction = () => {
        musicEngine.start();
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
      };
      window.addEventListener('click', handleFirstInteraction, { once: true });
      window.addEventListener('touchstart', handleFirstInteraction, { once: true });
      window.addEventListener('keydown', handleFirstInteraction, { once: true });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Track scroll position to update activeNav automatically
  useEffect(() => {
    const handleScroll = () => {
      const accountsEl = document.getElementById('accounts-section');
      if (accountsEl) {
        const rect = accountsEl.getBoundingClientRect();
        if (rect.top <= 250) {
          setActiveNav('accounts');
        } else {
          setActiveNav('home');
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcut: Escape to close full-size image preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerToast(lang === 'ar' ? 'تم نسخ المعرف بنجاح!' : 'Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle hiding the audio banner
  const toggleAudioBanner = () => {
    setShowAudioBanner((prev) => {
      const next = !prev;
      localStorage.setItem('divo_show_audio_banner', String(next));
      return next;
    });
  };

  // Check Passcode (Masked, no hints)
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPasscode.trim() === PASSCODE) {
      setIsUnlocked(true);
      sessionStorage.setItem('divo_admin_unlocked', 'true');
      setPasscodeError(false);
      triggerToast(lang === 'ar' ? 'تم التحقق بنجاح!' : 'Passcode verified!');
    } else {
      setPasscodeError(true);
    }
  };

  // Save changes to server to apply to ALL visitors globally & permanently
  const syncChangeToServer = async (payload: {
    coverImage?: string;
    avatarImage?: string;
    audioUrl?: string;
    audioTitle?: string;
  }) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: PASSCODE,
          ...payload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          if (data.config.coverImage) {
            setCoverImage(data.config.coverImage);
            localStorage.setItem('divo_custom_cover_v2', data.config.coverImage);
          }
          if (data.config.avatarImage) {
            setAvatarImage(data.config.avatarImage);
            localStorage.setItem('divo_custom_avatar_v2', data.config.avatarImage);
          }
          if (data.config.audioUrl) {
            musicEngine.setCustomAudio(data.config.audioUrl, data.config.audioTitle);
            setCurrentTrackTitle(data.config.audioTitle || 'Michael Jackson - Chicago');
          }
        }
      }
    } catch {
      // Offline fallback
    }
  };

  // Card click smooth scale-up animation handler
  const handleCardClick = (platformId: string) => {
    setPressedCardId(platformId);
    setTimeout(() => {
      setPressedCardId((prev) => (prev === platformId ? null : prev));
    }, 350);
  };

  // Smooth scroll handler for Bottom Navigation Bar
  const scrollToSection = (section: 'home' | 'accounts') => {
    if (section === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveNav('home');
    } else if (section === 'accounts') {
      const el = document.getElementById('accounts-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveNav('accounts');
    }
  };

  // Open Admin Modal to a specific tab
  const openAdminModal = (tab: 'cover' | 'avatar' | 'music') => {
    setAdminTab(tab);
    setShowAdminModal(true);
  };

  // Handle Cover Photo Change (Applied globally to all)
  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setCoverImage(result);
        localStorage.setItem('divo_custom_cover_v2', result);
        syncChangeToServer({ coverImage: result });
        triggerToast(lang === 'ar' ? 'تم تحديث صورة الغلاف وتطبيقها على الجميع!' : 'Cover updated globally for everyone!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverUrlSubmit = () => {
    if (coverUrlInput.trim()) {
      const url = coverUrlInput.trim();
      setCoverImage(url);
      localStorage.setItem('divo_custom_cover_v2', url);
      syncChangeToServer({ coverImage: url });
      setCoverUrlInput('');
      triggerToast(lang === 'ar' ? 'تم تحديث صورة الغلاف وتطبيقها على الجميع!' : 'Cover updated globally for everyone!');
    }
  };

  // Handle Avatar Photo Change (Applied globally to all)
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAvatarImage(result);
        localStorage.setItem('divo_custom_avatar_v2', result);
        syncChangeToServer({ avatarImage: result });
        triggerToast(lang === 'ar' ? 'تم تحديث الصورة الشخصية وتطبيقها على الجميع!' : 'Avatar updated globally for everyone!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUrlSubmit = () => {
    if (avatarUrlInput.trim()) {
      const url = avatarUrlInput.trim();
      setAvatarImage(url);
      localStorage.setItem('divo_custom_avatar_v2', url);
      syncChangeToServer({ avatarImage: url });
      setAvatarUrlInput('');
      triggerToast(lang === 'ar' ? 'تم تحديث الصورة الشخصية وتطبيقها على الجميع!' : 'Avatar updated globally for everyone!');
    }
  };

  // Handle Audio File / URL Change (Applied globally to all)
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const title = file.name.replace(/\.[^/.]+$/, '') || 'Custom Track';
        musicEngine.setCustomAudio(result, title);
        setCurrentTrackTitle(title);
        syncChangeToServer({ audioUrl: result, audioTitle: title });
        triggerToast(lang === 'ar' ? `تم تطبيق الأغنية الجديدة للجميع: ${title}` : `Audio updated globally: ${title}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioUrlSubmit = () => {
    if (audioUrlInput.trim()) {
      const title = audioTitleInput.trim() || 'Custom Track';
      musicEngine.setCustomAudio(audioUrlInput.trim(), title);
      setCurrentTrackTitle(title);
      syncChangeToServer({ audioUrl: audioUrlInput.trim(), audioTitle: title });
      setAudioUrlInput('');
      setAudioTitleInput('');
      triggerToast(lang === 'ar' ? `تم تطبيق الأغنية الجديدة للجميع!` : 'New audio applied globally!');
    }
  };

  // Reset to default "Michael Jackson - Chicago"
  const handleResetToDefaultAudio = () => {
    musicEngine.setCustomAudio('/audio/chicago.mp3', 'Michael Jackson - Chicago');
    setCurrentTrackTitle('Michael Jackson - Chicago');
    syncChangeToServer({ audioUrl: '/audio/chicago.mp3', audioTitle: 'Michael Jackson - Chicago' });
    triggerToast(lang === 'ar' ? 'تمت استعادة أغنية Michael Jackson - Chicago' : 'Restored Michael Jackson - Chicago');
  };

  // vCard contact download
  const handleDownloadVCard = () => {
    const vCardData = `BEGIN:VCARD
VERSION:3.0
FN:DIVO
N:DIVO;;;;
ORG:DIVO
TITLE:Official Profile
EMAIL;TYPE=INTERNET:wwfahedcom1@gmail.com
TEL;TYPE=CELL:+9647731482705
ADR;TYPE=HOME:;;بغداد;Baghdad;;Iraq
URL:https://www.instagram.com/lyy8f?stkn=cmk5YjdrcWN1enV5
NOTE:المنصة الرسمية لـ DIVO (@lyy8f)
END:VCARD`;

    const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'DIVO_Official.vcf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(lang === 'ar' ? 'تم تحميل بطاقة الاتصال الرسمية بنجاح!' : 'Contact vCard downloaded!');
  };

  // Exact platforms with authentic user links
  const platforms: PlatformItem[] = [
    {
      id: 'whatsapp',
      name: lang === 'ar' ? 'واتساب' : 'WhatsApp',
      category: 'messaging',
      handle: '+964 773 148 2705',
      copyValue: '+9647731482705',
      description:
        lang === 'ar'
          ? 'خط التواصل المباشر للاستفسارات السريعة، والشراكات التجارية، والرسائل الفورية.'
          : 'Direct line for fast business inquiries and commercial partnerships.',
      badge: lang === 'ar' ? 'متاح للتواصل المباشر' : 'Available for direct contact',
      actionText: lang === 'ar' ? 'محادثة واتساب فورية' : 'Chat on WhatsApp',
      directUrl: 'https://wa.me/qr/XT65YXAQCOTWE1',
      iconType: 'whatsapp',
    },
    {
      id: 'tiktok',
      name: lang === 'ar' ? 'تيك توك' : 'TikTok',
      category: 'video',
      handle: 'lyy8f@',
      copyValue: 'lyy8f',
      description:
        lang === 'ar'
          ? 'مقاطع فيديو سريعة، تريندات، ومحتوى إبداعي ملهم ومتجدد.'
          : 'High-energy short videos, top trending creative content.',
      badge: lang === 'ar' ? 'فيديوهات وتريندات مستمرة' : 'Ongoing Trends & Clips',
      actionText: lang === 'ar' ? 'مشاهدة الفيديوهات' : 'Watch Videos',
      directUrl: 'https://www.tiktok.com/@lyy8f?_r=1&_t=ZS-9A3jhXqsYS1',
      iconType: 'tiktok',
    },
    {
      id: 'instagram',
      name: lang === 'ar' ? 'انستغرام' : 'Instagram',
      category: 'social',
      handle: 'lyy8f@',
      copyValue: 'lyy8f',
      description:
        lang === 'ar'
          ? 'يوميات حصرية، صور، وستوريات يومية وتغطيات لأبرز الفعاليات والمشاريع.'
          : 'Exclusive daily moments, photos, stories and event highlights.',
      badge: lang === 'ar' ? 'حساب رسمي معتمد' : 'Verified Official Account',
      actionText: lang === 'ar' ? 'متابعة الحساب' : 'Follow on Instagram',
      directUrl: 'https://www.instagram.com/lyy8f?stkn=cmk5YjdrcWN1enV5',
      iconType: 'instagram',
    },
    {
      id: 'telegram',
      name: lang === 'ar' ? 'تلغرام' : 'Telegram',
      category: 'messaging',
      handle: 't.me/lyy8f',
      copyValue: 'https://t.me/lyy8f',
      description:
        lang === 'ar'
          ? 'القناة الرسمية لنشر التحديثات الفورية، الأخبار الحصرية، والمجتمع المباشر.'
          : 'Official channel for instant breaking updates and direct community.',
      badge: lang === 'ar' ? 'قناة رسمية مباشرة' : 'Direct Official Channel',
      actionText: lang === 'ar' ? 'الانضمام للقناة' : 'Join Channel',
      directUrl: 'https://t.me/lyy8f',
      iconType: 'telegram',
    },
    {
      id: 'snapchat',
      name: lang === 'ar' ? 'سناب شات' : 'Snapchat',
      category: 'social',
      handle: 'lyy8f@',
      copyValue: 'lyy8f',
      description:
        lang === 'ar'
          ? 'يوميات عفوية، كواليس حية ومباشرة، وتواصل يومي مستمر مع المتابعين.'
          : 'Spontaneous behind the scenes, live moments, and daily fan chats.',
      badge: lang === 'ar' ? 'إضافة ومتابعة يومية' : 'Daily Add & Follow',
      actionText: lang === 'ar' ? 'إضافة في سناب شات' : 'Add on Snapchat',
      directUrl: 'https://www.snapchat.com/add/lyy8f?share_id=sD5KyLUNSmQ&locale=ar-IQ',
      iconType: 'snapchat',
    },
    {
      id: 'discord',
      name: lang === 'ar' ? 'ديسكورد' : 'Discord',
      category: 'gaming',
      handle: 'discord.gg/Qcj6JRnG',
      copyValue: 'https://discord.gg/Qcj6JRnG',
      description:
        lang === 'ar'
          ? 'سيرفر ديسكورد الرسمي - مجتمع الألعاب، الغرف الصوتية، والفعاليات المشتركة.'
          : 'Official Discord server for gaming sessions and voice lounges.',
      badge: lang === 'ar' ? 'سيرفر مجتمعي وغرف صوتية' : 'Community & Voice Rooms',
      actionText: lang === 'ar' ? 'انضمام للسيرفر' : 'Join Server',
      directUrl: 'https://discord.gg/Qcj6JRnG',
      iconType: 'discord',
    },
    {
      id: 'x',
      name: lang === 'ar' ? 'منصة إكس (تويتر)' : 'X (Twitter)',
      category: 'social',
      handle: 'lyy8f@',
      copyValue: 'lyy8f',
      description:
        lang === 'ar'
          ? 'الحساب الرسمي على منصة X - تدوينات يومية، آراء، وتغطيات مباشرة.'
          : 'Official X handle for tweets, tech opinions and live commentary.',
      badge: lang === 'ar' ? 'تغريدات وتواصل حصري' : 'Exclusive Posts & Chats',
      actionText: lang === 'ar' ? 'متابعة على X' : 'Follow on X',
      directUrl: 'https://x.com/lyy8f',
      iconType: 'x',
    },
    {
      id: 'facebook',
      name: lang === 'ar' ? 'فيسبوك' : 'Facebook',
      category: 'social',
      handle: 'fb.com/share/1CcwaDJVwN',
      copyValue: 'https://www.facebook.com/share/1CcwaDJVwN/',
      description:
        lang === 'ar'
          ? 'الصفحة والملف الرسمي للمشاركات العامة، التدوينات، والتواصل المستمر.'
          : 'Official Facebook profile for articles, public posts and news.',
      badge: lang === 'ar' ? 'صفحة معتمدة ومباشرة' : 'Verified Direct Page',
      actionText: lang === 'ar' ? 'فتح الحساب' : 'Open Profile',
      directUrl: 'https://www.facebook.com/share/1CcwaDJVwN/',
      iconType: 'facebook',
    },
    {
      id: 'playstation',
      name: lang === 'ar' ? 'بليستيشن (PSN)' : 'PlayStation (PSN)',
      category: 'gaming',
      handle: 'PSN: lyy8f',
      copyValue: 'lyy8f',
      description:
        lang === 'ar'
          ? 'حساب بلايستيشن الرسمي (PSN) - ألعاب الأونلاين، البطولات، وقائمة الأصدقاء.'
          : 'Official PSN ID for online gaming tournaments and friend lobbies.',
      badge: lang === 'ar' ? 'حساب بلايستيشن الرسمي' : 'Official PlayStation ID',
      actionText: lang === 'ar' ? 'عرض ملف PSN' : 'View PSN Profile',
      directUrl: 'https://profile.playstation.com/lyy8f',
      iconType: 'playstation',
    },
  ];

  // Filtering
  const filteredPlatforms = platforms.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' ||
      (activeCategory === 'social' && (item.category === 'social' || item.category === 'gaming')) ||
      (activeCategory === 'messaging' && item.category === 'messaging') ||
      (activeCategory === 'video' && item.category === 'video');

    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Authentic Original Icons for Platforms
  const renderPlatformIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center shadow-md shrink-0 border border-emerald-400/20">
            <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
          </div>
        );
      case 'tiktok':
        return (
          <div className="w-12 h-12 rounded-xl bg-black border border-neutral-800 flex items-center justify-center shadow-md relative overflow-hidden shrink-0">
            <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.87-4.47V8.71a8.28 8.28 0 0 0 4.9 1.59V6.85a4.85 4.85 0 0 1-1-.16z" />
            </svg>
          </div>
        );
      case 'instagram':
        return (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
            <svg
              className="w-7 h-7 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </div>
        );
      case 'telegram':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#229ED9] flex items-center justify-center shadow-md shrink-0 border border-sky-400/20">
            <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
        );
      case 'snapchat':
        return (
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0 border border-yellow-300/30 flex items-center justify-center bg-[#FFFC00]">
            <img
              src={snapchatIcon}
              alt="Snapchat"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        );
      case 'discord':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#5865F2] flex items-center justify-center shadow-md shrink-0 border border-indigo-400/20">
            <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </div>
        );
      case 'x':
        return (
          <div className="w-12 h-12 rounded-xl bg-black border border-neutral-800 flex items-center justify-center shadow-md shrink-0">
            <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        );
      case 'facebook':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#1877F2] flex items-center justify-center shadow-md shrink-0 border border-blue-400/20">
            <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
        );
      case 'playstation':
        return (
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md shrink-0 border border-blue-400/20 flex items-center justify-center bg-[#003791]">
            <img
              src={playstationIcon}
              alt="PlayStation"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6 text-neutral-400" />
          </div>
        );
    }
  };

  return (
    <div
      className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Hidden File Inputs for Admin Image and Audio Upload */}
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverFileUpload}
        className="hidden"
      />
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarFileUpload}
        className="hidden"
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioFileUpload}
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 inset-x-0 mx-auto w-fit z-50 px-4 py-2.5 rounded-full bg-neutral-900/95 border border-amber-500/50 text-amber-300 text-sm font-medium shadow-2xl flex items-center gap-2 backdrop-blur">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Navigation */}
      <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur border-b border-neutral-900/80 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Controls: Share, Language, Sound, Admin Edit */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Share Button (Orange) */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>{lang === 'ar' ? 'مشاركة' : 'Share'}</span>
              <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>{lang === 'ar' ? 'EN' : 'العربية'}</span>
              <Globe className="w-3.5 h-3.5 text-amber-500" />
            </button>

            {/* Google Drive Cloud Button */}
            <button
              onClick={() => setShowDriveModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title={lang === 'ar' ? 'سحابة Google Drive' : 'Google Drive Cloud'}
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Drive</span>
            </button>

            {/* Google Contacts Button */}
            <button
              onClick={() => setShowContactsModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title={lang === 'ar' ? 'جهات اتصال Google' : 'Google Contacts'}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Contacts</span>
            </button>

            {/* DIVO AI Studio Button */}
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border border-purple-500/30 text-xs font-semibold text-white transition-all shadow-md active:scale-95 cursor-pointer"
              title={lang === 'ar' ? 'استوديو الذكاء الاصطناعي DIVO AI' : 'DIVO AI Studio'}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="hidden sm:inline">AI Studio</span>
            </button>

            {/* Sound Button & Audio Controls Popup */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowVolumeMenu(!showVolumeMenu);
                }}
                title={isPlayingMusic ? 'التحكم في الصوت' : 'تشغيل الصوت'}
                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer ${
                  isPlayingMusic
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-sm shadow-amber-500/20'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {isPlayingMusic ? (
                  <Volume2 className="w-4 h-4 animate-pulse" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              {/* Volume & Track Popup Menu */}
              {showVolumeMenu && (
                <div
                  className={`absolute top-full mt-2 ${
                    lang === 'ar' ? 'right-0' : 'left-0'
                  } w-72 p-4 bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl z-50 space-y-3.5 backdrop-blur`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                    <span className="font-semibold text-white text-xs flex items-center gap-1.5 truncate max-w-[190px]">
                      <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{currentTrackTitle}</span>
                    </span>
                    <button
                      onClick={() => setShowVolumeMenu(false)}
                      className="text-neutral-500 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Volume Slider (50% default) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span>{lang === 'ar' ? 'مستوى الصوت' : 'Volume Level'}</span>
                      <span className="font-mono text-amber-400 font-bold tabular-nums">
                        {Math.round(musicVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={musicVolume}
                      onChange={(e) => musicEngine.setVolume(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Action Buttons: Play/Pause, Toggle Banner */}
                  <div className="flex items-center justify-between pt-1 gap-2">
                    <button
                      onClick={() => musicEngine.toggle()}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isPlayingMusic ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlayingMusic ? (lang === 'ar' ? 'إيقاف' : 'Pause') : (lang === 'ar' ? 'تشغيل' : 'Play')}</span>
                    </button>

                    <button
                      onClick={toggleAudioBanner}
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      title={showAudioBanner ? 'إخفاء شريط الصوت' : 'إظهار شريط الصوت'}
                    >
                      {showAudioBanner ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showAudioBanner ? (lang === 'ar' ? 'إخفاء الشريط' : 'Hide Banner') : (lang === 'ar' ? 'إظهار الشريط' : 'Show Banner')}</span>
                    </button>
                  </div>

                  {/* Change Track Option */}
                  <button
                    onClick={() => {
                      setShowVolumeMenu(false);
                      openAdminModal('music');
                    }}
                    className="w-full py-1.5 text-center text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'تغيير الأغنية برمز الأمان' : 'Change Audio with Passcode'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Admin Customizer Button */}
            <button
              onClick={() => openAdminModal('cover')}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 text-xs font-medium text-neutral-300 hover:text-amber-300 transition-all shadow-sm active:scale-95 group cursor-pointer"
              title={lang === 'ar' ? 'تخصيص' : 'Customize'}
            >
              <KeyRound className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-400 group-hover:rotate-12 transition-all duration-300" />
              <span className="hidden sm:inline font-medium">
                {lang === 'ar' ? 'تخصيص' : 'Customize'}
              </span>
            </button>
          </div>

          {/* Top Corner Badge: FD as requested */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-black font-black text-sm tracking-tighter">FD</span>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Audio Status Bar */}
      {showAudioBanner && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-2">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-full px-3.5 py-1.5 flex items-center justify-between text-xs text-neutral-400 backdrop-blur">
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-2 w-2 relative shrink-0">
                {isPlayingMusic && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isPlayingMusic ? 'bg-amber-500' : 'bg-neutral-600'
                  }`}
                ></span>
              </span>
              <span className="text-neutral-300 font-medium truncate">
                {lang === 'ar' ? 'الموسيقى: ' : 'Track: '}
                <span className="text-amber-400 font-semibold">{currentTrackTitle}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono">
                {lang === 'ar' ? 'صوت' : 'Vol'} {Math.round(musicVolume * 100)}%
              </span>
              <button
                onClick={() => musicEngine.toggle()}
                className="hover:text-white transition-colors cursor-pointer"
                title={isPlayingMusic ? 'إيقاف' : 'تشغيل'}
              >
                {isPlayingMusic ? (
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </button>
              <button
                onClick={toggleAudioBanner}
                className="text-neutral-500 hover:text-white p-0.5 cursor-pointer"
                title="إخفاء شريط الصوت"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto px-4 pb-16 pt-2 space-y-6 flex-1">
        {/* Profile Card Container */}
        <div className="relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-900 shadow-2xl">
          {/* Cover Photo */}
          <div
            onClick={() =>
              setPreviewImage({
                src: coverImage,
                title: lang === 'ar' ? 'صورة الغلاف الرسمية' : 'Official Cover Photo',
                subtitle: lang === 'ar' ? 'اللافتات الحضرية المسائية' : 'Urban Street Signs',
              })
            }
            className="relative h-48 sm:h-56 w-full overflow-hidden bg-neutral-900 group cursor-pointer"
            title={lang === 'ar' ? 'انقر لمعاينة صورة الغلاف' : 'Click to preview cover photo'}
          >
            <img
              src={coverImage}
              alt="Profile Cover"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center filter brightness-95 transition-transform duration-500 group-hover:scale-105"
            />
            {/* Top dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-black/60 pointer-events-none" />

            {/* Quick Preview Badge on Hover */}
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-neutral-800 text-[11px] text-neutral-300 font-medium flex items-center gap-1.5 shadow">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'ar' ? 'معاينة الغلاف' : 'Preview Cover'}</span>
              </span>
            </div>
          </div>

          {/* Profile Avatar & Info Section */}
          <div className="relative px-5 pb-6 pt-0 text-center flex flex-col items-center">
            {/* Circular Avatar */}
            <div
              onClick={() =>
                setPreviewImage({
                  src: avatarImage,
                  title: lang === 'ar' ? 'الصورة الشخصية الأساسية' : 'Main Profile Photo',
                  subtitle: 'DIVO - FD Official',
                })
              }
              className="-mt-16 sm:-mt-20 relative group cursor-pointer"
              title={lang === 'ar' ? 'انقر لمعاينة الصورة بالحجم الكامل' : 'Click to preview full size'}
            >
              {/* Outer Orange Glowing Ring */}
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-600 shadow-xl shadow-amber-500/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-black bg-neutral-900 relative">
                  <img
                    src={avatarImage}
                    alt="DIVO"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Subtle Eye/Zoom Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 text-white">
                    <Maximize2 className="w-6 h-6 text-amber-400 drop-shadow" />
                    <span className="text-[10px] font-bold tracking-tight text-white/95">
                      {lang === 'ar' ? 'معاينة' : 'Preview'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verified check badge at bottom */}
              <div className="absolute bottom-1 -left-1 w-7 h-7 rounded-full bg-amber-500 border-2 border-black text-black flex items-center justify-center shadow-md">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>

            {/* DIVO Badge + Preview Button */}
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/40 px-4 py-1 rounded-full uppercase shadow-sm">
                DIVO
              </span>

              {/* Clean Preview Button */}
              <button
                onClick={() =>
                  setPreviewImage({
                    src: avatarImage,
                    title: lang === 'ar' ? 'الصورة الشخصية الأساسية' : 'Main Profile Photo',
                    subtitle: 'DIVO - FD Official',
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 hover:text-amber-400 transition-colors shadow-sm cursor-pointer"
                title={lang === 'ar' ? 'انقر لمعاينة الصورة بالحجم الكامل' : 'Preview Photo Full Size'}
              >
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'ar' ? 'معاينة الصورة' : 'Preview'}</span>
              </button>
            </div>

            {/* Info Row: Location, Email, Accounts Count, Real Visitors */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-y-1.5 gap-x-3 text-xs text-neutral-400">
              <div className="flex items-center gap-1 font-medium text-neutral-300">
                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{lang === 'ar' ? 'العراق / بغداد' : 'Iraq / Baghdad'}</span>
              </div>
              <span className="text-neutral-700">·</span>
              <a
                href="mailto:wwfahedcom1@gmail.com"
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
                dir="ltr"
              >
                <span>wwfahedcom1@gmail.com</span>
                <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </a>
              <span className="text-neutral-700">·</span>
              <div className="flex items-center gap-1 text-amber-500 font-medium">
                <span>{lang === 'ar' ? '9 حسابات نشطة' : '9 Active Accounts'}</span>
              </div>
              <span className="text-neutral-700">·</span>
              <button
                onClick={() => setShowVisitorsModal(true)}
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer transition-colors"
                title={lang === 'ar' ? 'عرض قائمة وسجل الزوار الفعليين' : 'View verified visitors log'}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{actualVisits.toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-US')} {lang === 'ar' ? 'زائر حقيقي' : 'visitors'}</span>
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="mt-6 w-full flex items-center justify-center gap-2.5 sm:gap-3">
              {/* QR Code Button */}
              <button
                onClick={() => setShowQrModal('profile')}
                className="w-11 h-11 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 text-amber-400 flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
                title={lang === 'ar' ? 'عرض رمز QR' : 'Show QR Code'}
              >
                <QrCode className="w-5 h-5" />
              </button>

              {/* Inquiry / Collab Button */}
              <button
                onClick={() => setShowCollabModal(true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs sm:text-sm font-semibold text-neutral-200 transition-all text-center active:scale-95 cursor-pointer"
              >
                {lang === 'ar' ? 'طلب تعاون أو استفسار' : 'Partnership Inquiry'}
              </button>

              {/* Save Contact Button (Orange CTA) */}
              <button
                onClick={handleDownloadVCard}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{lang === 'ar' ? 'حفظ جهة الاتصال' : 'Save Contact'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Header: Official Accounts & Channels */}
        <div id="accounts-section" className="space-y-1.5 pt-2 scroll-mt-24">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'الحسابات والقنوات الرسمية' : 'Official Accounts & Channels'}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            {lang === 'ar'
              ? 'تواصل مباشرة وتابع التحديثات اليومية عبر المنصات الـ 9 المعتمدة'
              : 'Connect directly and follow daily updates across all 9 verified platforms'}
          </p>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث عن منصة أو معرّف...' : 'Search for a platform or handle...'}
            className="w-full bg-neutral-950 border border-neutral-800/90 rounded-xl py-3 px-11 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-colors"
          />
          <Search
            className={`w-4 h-4 text-neutral-500 absolute top-3.5 ${
              lang === 'ar' ? 'right-3.5' : 'left-3.5'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute top-3 text-neutral-500 hover:text-white cursor-pointer ${
                lang === 'ar' ? 'left-3.5' : 'right-3.5'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Pills Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: lang === 'ar' ? 'كافة المنصات (9)' : 'All Platforms (9)' },
            { id: 'social', label: lang === 'ar' ? 'شبكات اجتماعية' : 'Social Networks' },
            { id: 'messaging', label: lang === 'ar' ? 'مراسلة وتواصل' : 'Messaging' },
            { id: 'video', label: lang === 'ar' ? 'فيديو' : 'Video' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-neutral-950 border border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Platform Cards Grid */}
        <div className="space-y-4">
          {filteredPlatforms.map((platform, index) => (
            <FadeInCard key={platform.id} delay={(index % 4) * 75}>
              <div
                onClick={() => handleCardClick(platform.id)}
                className={`bg-neutral-950 border rounded-2xl p-5 shadow-lg transition-all duration-300 space-y-3.5 relative overflow-hidden group cursor-pointer select-none ${
                  pressedCardId === platform.id
                    ? 'scale-[1.04] -translate-y-1 border-amber-500/60 shadow-2xl shadow-amber-500/25 ring-1 ring-amber-500/30'
                    : 'border-neutral-900/90 hover:border-amber-500/30 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/10 active:scale-[1.04] active:-translate-y-1 active:border-amber-500/60 active:shadow-2xl active:shadow-amber-500/20'
                }`}
              >
                {/* Top Row: Icon, Title, Username, QR button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    {/* Platform Brand Icon */}
                    {renderPlatformIcon(platform.iconType)}

                    {/* Title & Username */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {platform.name}
                        </h3>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </div>

                      {/* Copyable Handle with strict LTR for phone numbers */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(platform.copyValue, platform.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                        dir="ltr"
                      >
                        <bdo dir="ltr" className="font-mono">
                          {platform.handle}
                        </bdo>
                        {copiedId === platform.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-neutral-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* QR Code Button for Platform */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQrModal(platform.id);
                    }}
                    className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'رمز QR' : 'QR Code'}
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {platform.description}
                </p>

                {/* Metadata Row: Badge */}
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span className="text-amber-500/90 font-medium">{platform.badge}</span>
                </div>

                {/* Action Buttons Row */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-900">
                  {/* Secondary Button: Open Direct Link */}
                  <a
                    href={platform.directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
                  >
                    {lang === 'ar' ? 'فتح الرابط' : 'Open Link'}
                  </a>

                  {/* Primary Action Button */}
                  <a
                    href={platform.directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors group-hover:underline underline-offset-4"
                  >
                    <span>{platform.actionText}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </FadeInCard>
          ))}

          {filteredPlatforms.length === 0 && (
            <div className="text-center py-12 bg-neutral-950 border border-neutral-900 rounded-2xl p-6 text-neutral-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-neutral-600" />
              <p className="text-sm font-semibold text-white">
                {lang === 'ar' ? 'لم يتم العثور على نتائج مطابقة' : 'No matching results found'}
              </p>
              <p className="text-xs">
                {lang === 'ar'
                  ? 'جرب البحث بكلمة أخرى أو اختر تبويب "كافة المنصات"'
                  : 'Try searching with another word or select "All Platforms"'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer with Real Actual Page Visits Counter */}
      <footer className="border-t border-neutral-900 bg-neutral-950 pt-8 pb-28 text-center text-xs text-neutral-500">
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          {/* Actual Real Visits Counter with View List Button */}
          <div className="flex flex-col items-center justify-center gap-2.5">
            <button
              onClick={() => setShowVisitorsModal(true)}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/50 text-neutral-200 text-xs shadow-inner cursor-pointer transition-all active:scale-95 group"
              title={lang === 'ar' ? 'عرض سجل وقائمة الزوار الفعليين' : 'View real visitors log'}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-neutral-400">
                {lang === 'ar' ? 'إجمالي الزوار الفعليين:' : 'Total Real Visitors:'}
              </span>
              <span className="font-mono font-bold text-amber-400 tabular-nums text-sm">
                {lang === 'ar' ? actualVisits.toLocaleString('ar-IQ') : actualVisits.toLocaleString('en-US')}
              </span>
              <span className="text-neutral-400">
                {lang === 'ar' ? 'شخص زارني' : 'visitors'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold group-hover:bg-amber-500 group-hover:text-black transition-colors flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{lang === 'ar' ? 'قائمة الزوار' : 'Visitors Log'}</span>
              </span>
            </button>

            <p className="text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{lang === 'ar' ? 'عداد حقيقي وموثق على السيرفر - الرقم يزيد دائماً ولا ينقص نهائياً' : 'Real verified counter that increases permanently and never decreases'}</span>
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 text-neutral-400">
            <span className="font-bold text-neutral-200">DIVO</span>
            <span>·</span>
            <span dir="ltr">@lyy8f</span>
            <span>·</span>
            <span>{lang === 'ar' ? 'العراق / بغداد' : 'Iraq / Baghdad'}</span>
          </div>

          <p className="text-[11px] text-neutral-600">
            {lang === 'ar' ? 'جميع الحقوق محفوظة' : 'All rights reserved'} © {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Fixed Bottom Navigation Bar for Mobile and Quick Navigation */}
      {!previewImage && (
        <nav
          aria-label="شريط التنقل السريع"
          className="fixed bottom-0 inset-x-0 z-40 bg-neutral-950/92 backdrop-blur-xl border-t border-neutral-800/90 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-300"
        >
          <div className="max-w-md mx-auto px-3 py-1.5 flex items-center justify-between">
            {/* Home / Profile */}
            <button
              onClick={() => scrollToSection('home')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeNav === 'home'
                  ? 'text-amber-400 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title={lang === 'ar' ? 'الرئيسية' : 'Home'}
            >
              <div className="relative flex items-center justify-center">
                <Home className="w-5 h-5" />
                {activeNav === 'home' && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">
                {lang === 'ar' ? 'الرئيسية' : 'Home'}
              </span>
            </button>

            {/* Accounts & Channels */}
            <button
              onClick={() => scrollToSection('accounts')}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                activeNav === 'accounts'
                  ? 'text-amber-400 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title={lang === 'ar' ? 'الحسابات والمنصات' : 'Accounts'}
            >
              <div className="relative flex items-center justify-center">
                <Layers className="w-5 h-5" />
                <span className="absolute -top-1 -right-1.5 px-1 py-0.2 bg-amber-500 text-black text-[9px] font-black rounded-full leading-none">
                  9
                </span>
                {activeNav === 'accounts' && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">
                {lang === 'ar' ? 'المنصات' : 'Platforms'}
              </span>
            </button>

            {/* Quick Contact / Inquiry */}
            <button
              onClick={() => setShowCollabModal(true)}
              className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-neutral-400 hover:text-emerald-400 transition-all duration-200 active:scale-90 cursor-pointer group"
              title={lang === 'ar' ? 'تواصل مباشر أو استفسار' : 'Contact & Collab'}
            >
              <div className="relative flex items-center justify-center">
                <MessageSquare className="w-5 h-5 group-hover:text-emerald-400 transition-colors" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[10px] mt-1 tracking-tight group-hover:text-emerald-400 transition-colors">
                {lang === 'ar' ? 'تواصل' : 'Contact'}
              </span>
            </button>

            {/* Share */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-neutral-400 hover:text-amber-400 transition-all duration-200 active:scale-90 cursor-pointer group"
              title={lang === 'ar' ? 'مشاركة المنصة' : 'Share'}
            >
              <div className="relative flex items-center justify-center">
                <Share2 className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
              </div>
              <span className="text-[10px] mt-1 tracking-tight group-hover:text-amber-400 transition-colors">
                {lang === 'ar' ? 'مشاركة' : 'Share'}
              </span>
            </button>

            {/* QR Code */}
            <button
              onClick={() => setShowQrModal('profile')}
              className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-neutral-400 hover:text-amber-400 transition-all duration-200 active:scale-90 cursor-pointer group"
              title={lang === 'ar' ? 'رمز QR السريع' : 'QR Code'}
            >
              <div className="relative flex items-center justify-center">
                <QrCode className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
              </div>
              <span className="text-[10px] mt-1 tracking-tight group-hover:text-amber-400 transition-colors">
                {lang === 'ar' ? 'رمز QR' : 'QR'}
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ar' ? 'مشاركة المنصة' : 'Share Platform'}</span>
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              {lang === 'ar'
                ? 'انسخ الرابط الرسمي لمنصة DIVO أو شاركه عبر تطبيقاتك:'
                : 'Copy the official link or share across your favorite apps:'}
            </p>

            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2.5">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="bg-transparent text-xs font-mono text-neutral-300 flex-1 outline-none"
                dir="ltr"
              />
              <button
                onClick={() => handleCopy(window.location.href, 'share-link')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedId === 'share-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'share-link' ? (lang === 'ar' ? 'تم' : 'Copied') : (lang === 'ar' ? 'نسخ' : 'Copy')}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent('تابع المنصة الرسمية لـ DIVO: ' + window.location.href)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs text-neutral-300 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('المنصة الرسمية لـ DIVO')}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs text-neutral-300 transition-colors"
              >
                <Send className="w-4 h-4 text-sky-400" />
                <span>{lang === 'ar' ? 'تلغرام' : 'Telegram'}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ar' ? 'رمز QR السريع' : 'Quick QR Code'}</span>
              </h3>
              <button
                onClick={() => setShowQrModal(null)}
                className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl inline-block shadow-lg mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  showQrModal === 'profile'
                    ? window.location.href
                    : platforms.find((p) => p.id === showQrModal)?.directUrl || window.location.href
                )}`}
                alt="QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <p className="text-xs text-neutral-400">
              {lang === 'ar'
                ? 'امسح الرمز بكاميرا الهاتف للوصول السريع والمباشر'
                : 'Scan with camera for instant access'}
            </p>
          </div>
        </div>
      )}

      {/* Partnership Inquiry Modal */}
      {showCollabModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ar' ? 'طلب تعاون أو استفسار' : 'Inquiry / Collaboration'}</span>
              </h3>
              <button
                onClick={() => setShowCollabModal(false)}
                className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              {lang === 'ar'
                ? 'للتواصل بشأن الإعلانات، الشراكات التجارية، أو الاستفسارات المباشرة:'
                : 'For collaborations, sponsorships, or direct commercial inquiries:'}
            </p>

            <div className="space-y-3 pt-1">
              <a
                href="https://wa.me/qr/XT65YXAQCOTWE1"
                target="_blank"
                rel="noreferrer"
                className="w-full p-3.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {lang === 'ar' ? 'محادثة واتساب فورية' : 'Direct WhatsApp Chat'}
                    </p>
                    <p className="text-[11px] text-emerald-400" dir="ltr">+964 773 148 2705</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-emerald-400" />
              </a>

              <a
                href="mailto:wwfahedcom1@gmail.com"
                className="w-full p-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-between text-neutral-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">
                      {lang === 'ar' ? 'البريد الإلكتروني التجاري' : 'Business Email'}
                    </p>
                    <p className="text-[11px] text-neutral-400" dir="ltr">wwfahedcom1@gmail.com</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Admin Customizer Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'لوحة التخصيص والإدارة' : 'Customizer Panel'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {lang === 'ar' ? 'تعديل الصور والموسيقى وتطبيقها للجميع' : 'Edit photos & music globally'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setPasscodeError(false);
                }}
                className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If NOT Unlocked: Show Clean Password Input with Code Helper */}
            {!isUnlocked ? (
              <form onSubmit={handleVerifyPasscode} className="space-y-4">
                <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{lang === 'ar' ? 'أدخل رمز الأمان للمتابعة:' : 'Enter security passcode:'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasscodeText(!showPasscodeText)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      {showPasscodeText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPasscodeText ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPasscodeText ? 'text' : 'password'}
                      value={enteredPasscode}
                      onChange={(e) => {
                        setEnteredPasscode(e.target.value);
                        setPasscodeError(false);
                      }}
                      placeholder={lang === 'ar' ? 'اكتب رمز الأمان هنا...' : 'Enter passcode here...'}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-center tracking-widest text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                      autoFocus
                    />
                  </div>

                  {passcodeError && (
                    <p className="text-xs text-rose-400 flex items-center justify-center gap-1 pt-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'رمز الأمان غير صحيح، يرجى المحاولة مجدداً' : 'Incorrect security passcode, please try again'}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>{lang === 'ar' ? 'فتح لوحة التحكم' : 'Unlock Panel'}</span>
                </button>
              </form>
            ) : (
              /* If Unlocked: Full Customizer Panel */
              <div className="space-y-4">
                {/* Global & Permanent Persistence Notice */}
                <div className="p-3 bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">
                      {lang === 'ar' ? 'تطبيق فوري وتخزين دائم للموقع' : 'Instant & Permanent Global Persistence'}
                    </p>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'أي صورة أو أغنية تقوم بتغييرها هنا يتم حفظها في الموقع فوراً وتظهر لجميع الزوار تلقائياً وبشكل دائم.'
                        : 'Any photo or song you change here is immediately saved on the server and applies to all visitors permanently.'}
                    </p>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                  <button
                    onClick={() => setAdminTab('cover')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      adminTab === 'cover' ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'صورة الغلاف' : 'Cover'}</span>
                  </button>
                  <button
                    onClick={() => setAdminTab('avatar')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      adminTab === 'avatar' ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'الصورة الشخصية' : 'Avatar'}</span>
                  </button>
                  <button
                    onClick={() => setAdminTab('music')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      adminTab === 'music' ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'الأغنية' : 'Audio'}</span>
                  </button>
                </div>

                {/* Tab 1: Cover Photo */}
                {adminTab === 'cover' && (
                  <div className="space-y-4">
                    <div className="w-full h-28 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 relative">
                      <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs text-white">
                        {lang === 'ar' ? 'معاينة الغلاف الحالي' : 'Current Cover Preview'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => coverFileInputRef.current?.click()}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-white transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{lang === 'ar' ? 'رفع من الجهاز' : 'Upload File'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setCoverImage(coverImgDefault);
                          localStorage.removeItem('divo_custom_cover_v2');
                          syncChangeToServer({ coverImage: '' });
                          triggerToast(lang === 'ar' ? 'تمت استعادة الغلاف الافتراضي' : 'Default cover restored');
                        }}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-neutral-400" />
                        <span>{lang === 'ar' ? 'استعادة الافتراضي' : 'Reset Default'}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-neutral-400">
                        {lang === 'ar' ? 'أو ضع رابط صورة مباشر:' : 'Or enter direct image URL:'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={coverUrlInput}
                          onChange={(e) => setCoverUrlInput(e.target.value)}
                          placeholder="https://example.com/cover.jpg"
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          dir="ltr"
                        />
                        <button
                          onClick={handleCoverUrlSubmit}
                          className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {lang === 'ar' ? 'تطبيق' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Avatar Photo */}
                {adminTab === 'avatar' && (
                  <div className="space-y-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-900 border-2 border-amber-500 mx-auto">
                      <img src={avatarImage} alt="Avatar Preview" className="w-full h-full object-cover object-top" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-white transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{lang === 'ar' ? 'رفع صورة من الجهاز' : 'Upload Photo'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setAvatarImage(avatarImgDefault);
                          localStorage.removeItem('divo_custom_avatar_v2');
                          syncChangeToServer({ avatarImage: '' });
                          triggerToast(lang === 'ar' ? 'تمت استعادة الصورة الافتراضية' : 'Default avatar restored');
                        }}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-neutral-400" />
                        <span>{lang === 'ar' ? 'استعادة الافتراضية' : 'Reset Default'}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-neutral-400">
                        {lang === 'ar' ? 'أو ضع رابط صورة شخصية:' : 'Or enter direct avatar URL:'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={avatarUrlInput}
                          onChange={(e) => setAvatarUrlInput(e.target.value)}
                          placeholder="https://example.com/avatar.jpg"
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          dir="ltr"
                        />
                        <button
                          onClick={handleAvatarUrlSubmit}
                          className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {lang === 'ar' ? 'تطبيق' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Music Audio */}
                {adminTab === 'music' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate">{currentTrackTitle}</p>
                        <p className="text-[11px] text-amber-400">
                          {lang === 'ar' ? 'تشتغل تلقائياً بصوت 50% للزوار' : 'Plays automatically at 50% volume'}
                        </p>
                      </div>
                      <button
                        onClick={() => musicEngine.toggle()}
                        className="p-2 bg-amber-500 text-black rounded-lg cursor-pointer"
                      >
                        {isPlayingMusic ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Quick Preset: Michael Jackson - Chicago */}
                    <button
                      onClick={() => {
                        musicEngine.setCustomAudio('/audio/chicago.mp3', 'Michael Jackson - Chicago');
                        setCurrentTrackTitle('Michael Jackson - Chicago');
                        syncChangeToServer({ audioUrl: '/audio/chicago.mp3', audioTitle: 'Michael Jackson - Chicago' });
                        triggerToast(lang === 'ar' ? 'تم اختيار أغنية Chicago وتطبيقها للجميع بشكل دائم!' : 'Chicago applied permanently for everyone!');
                      }}
                      className={`w-full p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        currentTrackTitle === 'Michael Jackson - Chicago'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          <Music className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-right truncate">
                          <p className="font-bold text-white text-xs truncate">Michael Jackson - Chicago</p>
                          <p className="text-[10px] text-amber-400/90">الأغنية المعتمدة للموقع</p>
                        </div>
                      </div>
                      {currentTrackTitle === 'Michael Jackson - Chicago' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold shrink-0">
                          مفعلة
                        </span>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => audioFileInputRef.current?.click()}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-white transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{lang === 'ar' ? 'رفع ملف MP3 جديد' : 'Upload MP3'}</span>
                      </button>

                      <button
                        onClick={handleResetToDefaultAudio}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-neutral-400" />
                        <span>{lang === 'ar' ? 'استعادة Chicago' : 'Reset Chicago'}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-neutral-400">
                        {lang === 'ar' ? 'أو ضع رابط ملف صوتي مباشر:' : 'Or enter direct audio URL:'}
                      </label>
                      <input
                        type="text"
                        value={audioTitleInput}
                        onChange={(e) => setAudioTitleInput(e.target.value)}
                        placeholder={lang === 'ar' ? 'اسم الأغنية أو الفنان...' : 'Track or artist title...'}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500 mb-2"
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={audioUrlInput}
                          onChange={(e) => setAudioUrlInput(e.target.value)}
                          placeholder="https://example.com/music.mp3"
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                          dir="ltr"
                        />
                        <button
                          onClick={handleAudioUrlSubmit}
                          className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {lang === 'ar' ? 'تطبيق' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-900 flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تم فتح لوحة التحكم بنجاح' : 'Control Panel Unlocked'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsUnlocked(false);
                        sessionStorage.removeItem('divo_admin_unlocked');
                        setEnteredPasscode('');
                        triggerToast(lang === 'ar' ? 'تم قفل لوحة التحكم' : 'Panel locked');
                      }}
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      title="إعادة طلب رمز الأمان"
                    >
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>{lang === 'ar' ? 'قفل اللوحة' : 'Lock'}</span>
                    </button>
                    <button
                      onClick={() => setShowAdminModal(false)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      {lang === 'ar' ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real Visitors Log Modal */}
      {showVisitorsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{lang === 'ar' ? 'سجل وقائمة الزوار الحقيقية' : 'Real Visitors Log'}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {lang === 'ar' ? 'عداد حقيقي وموثق يزيد مع كل زيارة ولا ينقص' : 'Verified monotonic real visitor tracking'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVisitorsModal(false)}
                className="w-7 h-7 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Summary Cards */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1">
                <p className="text-[11px] text-neutral-400">
                  {lang === 'ar' ? 'إجمالي الزيارات الفعلية' : 'Total Verified Visits'}
                </p>
                <p className="text-xl font-black text-amber-400 font-mono tabular-nums">
                  {lang === 'ar' ? actualVisits.toLocaleString('ar-IQ') : actualVisits.toLocaleString('en-US')}
                </p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'يزيد دائماً ولا ينقص' : 'Always increases'}</span>
                </p>
              </div>

              <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1">
                <p className="text-[11px] text-neutral-400">
                  {lang === 'ar' ? 'الزوار الفريدين' : 'Unique Visitors'}
                </p>
                <p className="text-xl font-black text-white font-mono tabular-nums">
                  {lang === 'ar' ? uniqueVisitsCount.toLocaleString('ar-IQ') : uniqueVisitsCount.toLocaleString('en-US')}
                </p>
                <p className="text-[10px] text-neutral-400">
                  {lang === 'ar' ? 'أجهزة موثقة ومميزة' : 'Distinct verified devices'}
                </p>
              </div>
            </div>

            {/* Visitors List Header */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'ar' ? 'قائمة آخر الزوار الفعليين للموقع:' : 'Recent verified visitors:'}</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {recentVisitorsList.length} {lang === 'ar' ? 'مسجلين' : 'recorded'}
              </span>
            </div>

            {/* Scrollable Visitors List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-neutral-900 min-h-[140px] max-h-[260px]">
              {recentVisitorsList.length > 0 ? (
                recentVisitorsList.map((visitor, idx) => (
                  <div key={idx} className="pt-2 pb-1 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0">
                        {visitor.device.includes('iPhone') || visitor.device.includes('Android') || visitor.device.includes('هاتف') ? (
                          <Smartphone className="w-3.5 h-3.5" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-white truncate flex items-center gap-1">
                          <span>{visitor.device}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">#{visitor.id}</span>
                        </p>
                        <p className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          <span>{lang === 'ar' ? 'زيارة مسجلة' : 'Verified visit'}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-neutral-400 font-medium shrink-0">
                      {formatRelativeTime(visitor.time, lang)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-neutral-500 text-xs">
                  {lang === 'ar' ? 'جارٍ تسجيل الزيارات المباشرة...' : 'Recording live visits...'}
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="pt-3 border-t border-neutral-900 text-center">
              <p className="text-[11px] text-neutral-400">
                {lang === 'ar'
                  ? 'كل زائر يتصفح الموقع يُسجل بشكل فوري ودائم على السيرفر.'
                  : 'Every visitor browsing the site is logged immediately & permanently on the server.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6"
          onClick={() => setPreviewImage(null)}
        >
          {/* Top Control Bar */}
          <div
            className="w-full max-w-4xl flex items-center justify-between z-10 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title and Badge */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {previewImage.title}
                </h3>
                {previewImage.subtitle && (
                  <p className="text-xs text-neutral-400">{previewImage.subtitle}</p>
                )}
              </div>
            </div>

            {/* Actions: Switch Image, Download, Close */}
            <div className="flex items-center gap-2">
              {/* Toggle between Avatar and Cover */}
              <button
                onClick={() => {
                  if (previewImage.src === avatarImage) {
                    setPreviewImage({
                      src: coverImage,
                      title: lang === 'ar' ? 'صورة الغلاف الرسمية' : 'Cover Photo',
                      subtitle: lang === 'ar' ? 'اللافتات المرورية الحضرية المسائية' : 'Evening Urban Signs',
                    });
                  } else {
                    setPreviewImage({
                      src: avatarImage,
                      title: lang === 'ar' ? 'الصورة الشخصية الأساسية' : 'Main Profile Photo',
                      subtitle: 'DIVO - FD Official',
                    });
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="عرض الصورة الأخرى"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {previewImage.src === avatarImage
                    ? (lang === 'ar' ? 'معاينة الغلاف' : 'Preview Cover')
                    : (lang === 'ar' ? 'معاينة الأساسية' : 'Preview Avatar')}
                </span>
              </button>

              {/* Download original image */}
              <a
                href={previewImage.src}
                download="divo_photo.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                title={lang === 'ar' ? 'فتح أو تحميل الصورة بدقتها الكاملة' : 'Download Full Resolution'}
              >
                <Download className="w-4 h-4" />
              </a>

              {/* Close Button */}
              <button
                onClick={() => setPreviewImage(null)}
                className="w-9 h-9 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Image Container */}
          <div
            className="flex-1 w-full max-w-4xl flex items-center justify-center p-2 sm:p-4 my-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-h-[80vh] max-w-full rounded-2xl overflow-hidden shadow-2xl border border-neutral-800/80 bg-neutral-950 flex items-center justify-center ring-1 ring-amber-500/20 group">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[78vh] max-w-full w-auto h-auto object-contain select-none"
              />
            </div>
          </div>

          {/* Bottom Footer Hint */}
          <div
            className="w-full max-w-4xl flex items-center justify-between text-xs text-neutral-500 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>{lang === 'ar' ? 'صورة أصلية بالدقة الكاملة' : 'Original Full Resolution'}</span>
            </span>
            <span className="text-[11px] text-neutral-500">
              {lang === 'ar' ? 'انقر في أي مكان خارج الصورة أو Esc للإغلاق' : 'Click outside or press Esc to close'}
            </span>
          </div>
        </div>
      )}

      {/* Google Drive Cloud Workspace Modal */}
      {showDriveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowDriveModal(false)}
        >
          <div
            className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {lang === 'ar' ? 'سحابة Google Drive' : 'Google Drive Cloud'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {lang === 'ar' ? 'إدارة وتصفح الملفات والنسخ الاحتياطي' : 'Manage and browse files & backups'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDriveModal(false)}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {driveNeedsAuth || !driveUser ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="font-bold text-white text-lg">
                      {lang === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar'
                        ? 'اتصل بحساب Google Drive الخاص بك للوصول إلى ملفاتك، رفع النسخ الاحتياطية، وتخزين البيانات.'
                        : 'Connect your Google Drive account to access files, upload site backups, and store data securely.'}
                    </p>
                  </div>

                  {/* Official Google Sign In Button */}
                  <button
                    onClick={handleDriveLogin}
                    disabled={isDriveLoading}
                    className="gsi-material-button mx-auto flex items-center gap-3 px-6 py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <span>{isDriveLoading ? (lang === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...') : (lang === 'ar' ? 'تسجيل الدخول بـ Google' : 'Sign in with Google')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* User Bar & Actions */}
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {driveUser.email ? driveUser.email[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm truncate max-w-[200px]">
                          {driveUser.displayName || 'Google User'}
                        </p>
                        <p className="text-xs text-neutral-400 truncate max-w-[220px]">
                          {driveUser.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUploadSiteBackup}
                        disabled={isUploadingDrive}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="رفع نسخة احتياطية للموقع"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingDrive ? (lang === 'ar' ? 'جارٍ الرفع...' : 'Uploading...') : (lang === 'ar' ? 'رفع نسخة احتياطية' : 'Backup Site')}</span>
                      </button>
                      <button
                        onClick={handleDriveLogout}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {lang === 'ar' ? 'خروج' : 'Logout'}
                      </button>
                    </div>
                  </div>

                  {/* Search and File List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span>{lang === 'ar' ? 'ملفات Google Drive الخاصة بك:' : 'Your Google Drive Files:'}</span>
                      </span>
                      <button
                        onClick={() => loadDriveFiles()}
                        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
                      <input
                        type="text"
                        placeholder={lang === 'ar' ? 'بحث في ملفات Drive...' : 'Search Drive files...'}
                        value={driveSearchQuery}
                        onChange={(e) => setDriveSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadDriveFiles()}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-9 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Files Scrollable Container */}
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {isDriveLoading ? (
                        <div className="py-12 text-center text-neutral-500 text-xs">
                          {lang === 'ar' ? 'جارٍ تحميل الملفات من Drive...' : 'Loading files from Drive...'}
                        </div>
                      ) : driveFiles.length > 0 ? (
                        driveFiles.map((file) => (
                          <div
                            key={file.id}
                            className="p-3 bg-neutral-900/80 border border-neutral-800/80 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-colors"
                          >
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <p className="font-semibold text-white text-xs truncate">
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                                  title="فتح في Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => setFileToDelete(file)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="حذف الملف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-neutral-500 text-xs">
                          {lang === 'ar' ? 'لم يتم العثور على ملفات.' : 'No files found.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-900 bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-400">
              <span>{lang === 'ar' ? 'مدعوم بواسطة Google Drive API' : 'Powered by Google Drive API'}</span>
              <button
                onClick={() => setShowDriveModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Mandatory per Workspace Skill for destructive/mutating operations) */}
      {fileToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFileToDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-white text-base">
                {lang === 'ar' ? 'تأكيد حذف الملف' : 'Confirm File Deletion'}
              </h4>
              <p className="text-xs text-neutral-400">
                {lang === 'ar'
                  ? `هل أنت متأكد من رغبتك في حذف الملف "${fileToDelete.name}" نهائياً من Google Drive؟`
                  : `Are you sure you want to permanently delete "${fileToDelete.name}" from Google Drive?`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => confirmAndDeleteDriveFile(fileToDelete)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'حذف نهائي' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Contacts Modal */}
      {showContactsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowContactsModal(false)}
        >
          <div
            className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {lang === 'ar' ? 'جهات اتصال Google' : 'Google Contacts'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {lang === 'ar' ? 'إدارة وتصفح جهات الاتصال الخاصة بك' : 'Manage and browse your contacts'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowContactsModal(false)}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {contactsNeedsAuth || !contactsUser ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                    <Users className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="font-bold text-white text-lg">
                      {lang === 'ar' ? 'تسجيل الدخول بـ Google Contacts' : 'Sign in with Google Contacts'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar'
                        ? 'اتصل بحساب Google الخاص بك لعرض جهات الاتصال، أرقام الهواتف، والبريد الإلكتروني.'
                        : 'Connect your Google account to view your contacts, phone numbers, and email addresses.'}
                    </p>
                  </div>

                  <button
                    onClick={handleContactsLogin}
                    disabled={isContactsLoading}
                    className="gsi-material-button mx-auto flex items-center gap-3 px-6 py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <span>{isContactsLoading ? (lang === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...') : (lang === 'ar' ? 'تسجيل الدخول بـ Google' : 'Sign in with Google')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* User Bar & Add Contact Button */}
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
                        {contactsUser.email ? contactsUser.email[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm truncate max-w-[200px]">
                          {contactsUser.displayName || 'Google User'}
                        </p>
                        <p className="text-xs text-neutral-400 truncate max-w-[220px]">
                          {contactsUser.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAddContactModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إضافة جهة اتصال' : 'Add Contact'}</span>
                      </button>
                      <button
                        onClick={handleContactsLogout}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {lang === 'ar' ? 'خروج' : 'Logout'}
                      </button>
                    </div>
                  </div>

                  {/* Search and Contacts List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{lang === 'ar' ? 'جهات الاتصال الخاصة بك:' : 'Your Google Contacts:'}</span>
                      </span>
                      <button
                        onClick={() => loadGoogleContacts()}
                        className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto" />
                      <input
                        type="text"
                        placeholder={lang === 'ar' ? 'بحث في جهات الاتصال...' : 'Search contacts...'}
                        value={contactsSearchQuery}
                        onChange={(e) => setContactsSearchQuery(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-9 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Contacts Scrollable Container */}
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {isContactsLoading ? (
                        <div className="py-12 text-center text-neutral-500 text-xs">
                          {lang === 'ar' ? 'جارٍ تحميل جهات الاتصال...' : 'Loading contacts...'}
                        </div>
                      ) : googleContactsList.filter(c => c.name.toLowerCase().includes(contactsSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(contactsSearchQuery.toLowerCase()))).length > 0 ? (
                        googleContactsList
                          .filter(c => c.name.toLowerCase().includes(contactsSearchQuery.toLowerCase()) || (c.email && c.email.toLowerCase().includes(contactsSearchQuery.toLowerCase())))
                          .map((contact) => (
                            <div
                              key={contact.resourceName}
                              className="p-3 bg-neutral-900/80 border border-neutral-800/80 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-colors"
                            >
                              <div className="flex items-center gap-3 truncate">
                                {contact.photoUrl ? (
                                  <img src={contact.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                                    {contact.name[0]?.toUpperCase() || 'C'}
                                  </div>
                                )}
                                <div className="truncate">
                                  <p className="font-semibold text-white text-xs truncate">
                                    {contact.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-neutral-400 truncate">
                                    {contact.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-emerald-400" />
                                        <span>{contact.phone}</span>
                                      </span>
                                    )}
                                    {contact.email && (
                                      <span className="flex items-center gap-1 truncate">
                                        <Mail className="w-3 h-3 text-blue-400" />
                                        <span className="truncate">{contact.email}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="py-12 text-center text-neutral-500 text-xs">
                          {lang === 'ar' ? 'لم يتم العثور على جهات اتصال.' : 'No contacts found.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-900 bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-400">
              <span>{lang === 'ar' ? 'مدعوم بواسطة Google People API' : 'Powered by Google People API'}</span>
              <button
                onClick={() => setShowContactsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowAddContactModal(false)}
        >
          <div
            className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <h4 className="font-bold text-white text-base">
                {lang === 'ar' ? 'إضافة جهة اتصال جديدة' : 'Add New Contact'}
              </h4>
              <button
                onClick={() => setShowAddContactModal(false)}
                className="w-7 h-7 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateContactSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  {lang === 'ar' ? 'الاسم الكامل *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ar' ? 'أدخل اسم جهة الاتصال' : 'Enter contact name'}
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  placeholder={lang === 'ar' ? 'example@gmail.com' : 'example@gmail.com'}
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input
                  type="tel"
                  placeholder={lang === 'ar' ? '+966 50 000 0000' : '+1 (555) 000-0000'}
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingContact}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreatingContact ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ جهة الاتصال' : 'Save Contact')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIVO AI Studio Modal */}
      {showAiModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowAiModal(false)}
        >
          <div
            className="w-full max-w-3xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {lang === 'ar' ? 'استوديو الذكاء الاصطناعي DIVO AI' : 'DIVO AI Studio'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {lang === 'ar' ? 'شات ذكي، بحث، خرائط، وتوليد صور وفيديو وموسيقى' : 'Smart Chat, Search, Maps, Image & Video Gen'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1.5 px-6 py-3 border-b border-neutral-900 bg-neutral-900/30 overflow-x-auto shrink-0">
              <button
                onClick={() => setAiTab('chat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aiTab === 'chat' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white bg-neutral-900'
                }`}
              >
                💬 {lang === 'ar' ? 'المساعد الذكي' : 'Gemini Chat'}
              </button>
              <button
                onClick={() => setAiTab('search')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aiTab === 'search' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white bg-neutral-900'
                }`}
              >
                🔍 {lang === 'ar' ? 'بحث Google' : 'Search Grounding'}
              </button>
              <button
                onClick={() => setAiTab('maps')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aiTab === 'maps' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white bg-neutral-900'
                }`}
              >
                📍 {lang === 'ar' ? 'خرائط Google' : 'Maps Grounding'}
              </button>
              <button
                onClick={() => setAiTab('image')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aiTab === 'image' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white bg-neutral-900'
                }`}
              >
                🎨 {lang === 'ar' ? 'توليد الصور' : 'Image Gen'}
              </button>
              <button
                onClick={() => setAiTab('video')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aiTab === 'video' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white bg-neutral-900'
                }`}
              >
                🎬 {lang === 'ar' ? 'فيديو Veo' : 'Veo Video'}
              </button>
              <button
                onClick={() => setAiTab('music')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  aiTab === 'music' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white bg-neutral-900'
                }`}
              >
                🎵 {lang === 'ar' ? 'موسيقى Lyria' : 'Lyria Music'}
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Tab 1: Chat */}
              {aiTab === 'chat' && (
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
                    <span className="text-xs font-semibold text-neutral-400">
                      {lang === 'ar' ? 'نموذج المحادثة:' : 'Model:'}
                    </span>
                    <select
                      value={selectedChatModel}
                      onChange={(e: any) => setSelectedChatModel(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Complex)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
                    </select>
                  </div>

                  {/* Messages Thread */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-[250px] max-h-[350px]">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-purple-600 text-white rounded-br-xs'
                              : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-2xl px-4 py-3 text-xs animate-pulse">
                          {lang === 'ar' ? 'جارٍ الكتابة...' : 'Thinking...'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Input Form */}
                  <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-neutral-900">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message...'}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إرسال' : 'Send'}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Tab 2: Search Grounding */}
              {aiTab === 'search' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">
                      {lang === 'ar' ? 'بحث Google Grounding' : 'Google Search Grounding'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar' ? 'احصل على إجابات موثوقة ومحدثة مع مصادر بحث Google.' : 'Get accurate, up-to-date answers grounded in Google Search.'}
                    </p>
                  </div>

                  <form onSubmit={handleAiSearch} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'اسأل عن أي معلومات حديثة...' : 'Ask about any recent topic or news...'}
                      value={searchQueryInput}
                      onChange={(e) => setSearchQueryInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isSearchLoading || !searchQueryInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSearchLoading ? (lang === 'ar' ? 'جارٍ البحث...' : 'Searching...') : (lang === 'ar' ? 'بحث' : 'Search')}
                    </button>
                  </form>

                  {searchResult && (
                    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
                      <p className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">{searchResult}</p>
                      {searchChunks.length > 0 && (
                        <div className="pt-2 border-t border-neutral-800 space-y-1">
                          <span className="text-[10px] font-bold text-neutral-400">
                            {lang === 'ar' ? 'المصادر:' : 'Sources:'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {searchChunks.map((chunk, i) => chunk.web?.uri && (
                              <a
                                key={i}
                                href={chunk.web.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-purple-400 truncate max-w-[220px]"
                              >
                                {chunk.web.title || chunk.web.uri}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Maps Grounding */}
              {aiTab === 'maps' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">
                      {lang === 'ar' ? 'خرائط Google Grounding' : 'Google Maps Grounding'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar' ? 'ابحث عن الأماكن، المعالم، والمواقع الجغرافية.' : 'Search for places, landmarks, and geographic locations.'}
                    </p>
                  </div>

                  <form onSubmit={handleAiMaps} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'ابحث عن مكان أو مطعم أو مدينة...' : 'Search for a place, restaurant or city...'}
                      value={mapsQueryInput}
                      onChange={(e) => setMapsQueryInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isMapsLoading || !mapsQueryInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isMapsLoading ? (lang === 'ar' ? 'جارٍ البحث...' : 'Searching...') : (lang === 'ar' ? 'بحث' : 'Search')}
                    </button>
                  </form>

                  {mapsResult && (
                    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <p className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">{mapsResult}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Image Gen */}
              {aiTab === 'image' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">
                      {lang === 'ar' ? 'توليد الصور بالذكاء الاصطناعي' : 'AI Image Generation'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar' ? 'اكتب وصفاً مفصلاً لتوليد صورة مذهلة باستخدام Gemini.' : 'Describe an image to generate stunning visuals with Gemini.'}
                    </p>
                  </div>

                  <form onSubmit={handleAiImage} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'صف الصورة التي تريد توليدها...' : 'Describe the image you want to generate...'}
                      value={imagePromptInput}
                      onChange={(e) => setImagePromptInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isImageLoading || !imagePromptInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isImageLoading ? (lang === 'ar' ? 'جارٍ التوليد...' : 'Generating...') : (lang === 'ar' ? 'توليد' : 'Generate')}
                    </button>
                  </form>

                  {generatedImageUrl && (
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center space-y-3">
                      <img src={generatedImageUrl} alt="Generated" className="max-h-64 mx-auto rounded-lg object-contain shadow-lg" />
                      <a
                        href={generatedImageUrl}
                        download="divo_ai_image.png"
                        className="inline-block px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors"
                      >
                        {lang === 'ar' ? 'تحميل الصورة' : 'Download Image'}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Veo Video Gen */}
              {aiTab === 'video' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">
                      {lang === 'ar' ? 'توليد الفيديو بواسطة Veo' : 'Veo Video Generation'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar' ? 'توليد مقاطع فيديو سينمائية باستخدام نموذج Veo.' : 'Generate cinematic video clips using Veo.'}
                    </p>
                  </div>

                  <form onSubmit={handleAiVideo} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'صف المشهد السينمائي للفيديو...' : 'Describe cinematic video scene...'}
                      value={videoPromptInput}
                      onChange={(e) => setVideoPromptInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isVideoLoading || !videoPromptInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isVideoLoading ? (lang === 'ar' ? 'جارٍ التوليد...' : 'Generating...') : (lang === 'ar' ? 'توليد فيديو' : 'Generate Video')}
                    </button>
                  </form>

                  {generatedVideoUri && (
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center space-y-3">
                      <video src={generatedVideoUri} controls className="max-h-64 mx-auto rounded-lg shadow-lg" />
                    </div>
                  )}
                </div>
              )}

              {/* Tab 6: Lyria Music Gen */}
              {aiTab === 'music' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">
                      {lang === 'ar' ? 'توليد الموسيقى بواسطة Lyria' : 'Lyria Music Generation'}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      {lang === 'ar' ? 'ولد مقاطع موسيقية فريدة باستخدام نموذج Lyria.' : 'Generate unique music clips using Lyria.'}
                    </p>
                  </div>

                  <form onSubmit={handleAiMusic} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'صف النمط الموسيقي...' : 'Describe music style or mood...'}
                      value={musicPromptInput}
                      onChange={(e) => setMusicPromptInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isMusicLoading || !musicPromptInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isMusicLoading ? (lang === 'ar' ? 'جارٍ التوليد...' : 'Generating...') : (lang === 'ar' ? 'توليد موسيقى' : 'Generate Music')}
                    </button>
                  </form>

                  {generatedMusicAudio && (
                    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-center space-y-3">
                      <audio src={generatedMusicAudio} controls className="mx-auto" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-900 bg-neutral-900/60 flex items-center justify-between text-xs text-neutral-400">
              <span>{lang === 'ar' ? 'مدعوم بواسطة Google Gemini AI SDK' : 'Powered by Google Gemini AI SDK'}</span>
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
