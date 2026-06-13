import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingScreen from '@/components/LoadingScreen';
import VideoPlayer from '@/components/VideoPlayer';
import DevPanel from '@/components/DevPanel';
import AudioPermissionGate from '@/components/AudioPermissionGate';
import Home from '@/pages/Home';
import Story from '@/pages/Story';
import Gacha from '@/pages/Gacha';
import Collection from '@/pages/Collection';
import CharacterDetail from '@/pages/CharacterDetail';
import Phone from '@/pages/Phone';
import VideoGallery from '@/pages/VideoGallery';
import Minigame from '@/pages/Minigame';
import Shop from '@/pages/Shop';
import BondGallery from '@/pages/BondGallery';
import BackgroundMusicControl from '@/components/BackgroundMusicControl';
import { getVideoById } from '@/data/videos';
import { assetUrl } from '@/lib/assets';

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen bg-[#050914]">
      <BackgroundMusicControl />
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Story />} />
        <Route path="/gacha" element={<Gacha />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/bonds" element={<BondGallery />} />
        <Route path="/character/:id" element={<CharacterDetail />} />
        <Route path="/phone" element={<Phone />} />
        <Route path="/videos" element={<VideoGallery />} />
        <Route path="/minigame" element={<Minigame />} />
        <Route path="/shop" element={<Shop />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [assetsReady, setAssetsReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const introVideo = getVideoById('intro');
  const introSrc = assetUrl(introVideo?.src);

  return (
    <ErrorBoundary>
      {audioReady && (
        <Router>
          <AppContent />
        </Router>
      )}
      <AnimatePresence>
        {!assetsReady && (
          <LoadingScreen
            onComplete={() => {
              setAssetsReady(true);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {assetsReady && !audioReady && (
          <AudioPermissionGate
            onComplete={() => {
              setAudioReady(true);
              setShowIntro(Boolean(introSrc));
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {audioReady && showIntro && introSrc && (
          <VideoPlayer
            key="startup-intro"
            src={introSrc}
            onEnd={() => setShowIntro(false)}
          />
        )}
      </AnimatePresence>
      <DevPanel />
    </ErrorBoundary>
  );
}
