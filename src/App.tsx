import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import NavBar from '@/components/NavBar';
import VideoPlayer from '@/components/VideoPlayer';
import Home from '@/pages/Home';
import Story from '@/pages/Story';
import Gacha from '@/pages/Gacha';
import Collection from '@/pages/Collection';
import CharacterDetail from '@/pages/CharacterDetail';
import Phone from '@/pages/Phone';
import VideoGallery from '@/pages/VideoGallery';
import Minigame from '@/pages/Minigame';
import Shop from '@/pages/Shop';
import { assetUrl } from '@/lib/assets';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCounts = usePlayerStore((s) => s.unreadCounts);
  const totalUnread = unreadCounts.wechat + unreadCounts.sms + unreadCounts.call;

  // 开场 intro 视频：每次启动游戏播放一次（同一会话内不重复播放）
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('xiashan_intro_played'));

  const handleIntroEnd = () => {
    sessionStorage.setItem('xiashan_intro_played', '1');
    setShowIntro(false);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  // 根据路径确定当前标签
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/shop')) return 'shop';
    if (path.startsWith('/gacha')) return 'gacha';
    if (path.startsWith('/collection') || path.startsWith('/character')) return 'collection';
    if (path.startsWith('/phone')) return 'phone';
    return 'shop';
  };

  // 首页不显示导航栏
  const showNavBar = location.pathname !== '/';

  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'shop':
        navigate('/shop');
        break;
      case 'gacha':
        navigate('/gacha');
        break;
      case 'collection':
        navigate('/collection');
        break;
      case 'phone':
        navigate('/phone');
        break;
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Story />} />
        <Route path="/gacha" element={<Gacha />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/character/:id" element={<CharacterDetail />} />
        <Route path="/phone" element={<Phone />} />
        <Route path="/videos" element={<VideoGallery />} />
        <Route path="/minigame" element={<Minigame />} />
        <Route path="/shop" element={<Shop />} />
      </Routes>

      {/* 底部导航栏 */}
      {showNavBar && (
        <NavBar
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
          unreadCount={totalUnread}
        />
      )}

      {/* 开场 intro 视频 */}
      {showIntro && <VideoPlayer src={assetUrl('/video/intro.mp4')!} onEnd={handleIntroEnd} />}
    </div>
  );
}

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <AppContent />
    </Router>
  );
}
