import { useNavigate } from 'react-router-dom';
import LinkGame from '@/components/minigames/LinkGame';

/**
 * 小游戏 = 连连看（打烊后的理货时间）。
 * 入口（首页「星夜小憩」）直接进游戏，不再有选择菜单。
 */
export default function Minigame() {
  const navigate = useNavigate();
  return <LinkGame onExit={() => navigate('/')} />;
}
