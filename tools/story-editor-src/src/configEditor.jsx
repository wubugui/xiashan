import { useEffect, useState } from 'react';

const rarityKeys = ['SSR', 'SR', 'R', 'N'];
const pityKeys = ['SSR', 'SR'];
const rewardLabels = {
  story_node_complete: '完成剧情节点',
  chapter_complete: '完成章节',
  daily_login: '每日登录',
  face_slap_success: '打脸成功',
  phone_interaction: '手机互动',
  first_time_character: '首次获得角色',
};

function GachaForm({ gacha, onChange, onSave, message }) {
  const rateSum = rarityKeys.reduce((sum, key) => sum + Number(gacha.rates?.[key] ?? 0), 0);
  const sumOk = Math.abs(rateSum - 1) < 1e-6;
  function patch(next) {
    onChange({ ...gacha, ...next });
  }
  function patchRates(key, value) {
    patch({ rates: { ...gacha.rates, [key]: value } });
  }
  function patchPity(key, value) {
    patch({ pity: { ...gacha.pity, [key]: value } });
  }
  return (
    <div className="entity-form">
      <div className="entity-form-header">
        <strong>抽卡配置 (gacha)</strong>
        {message.text && <div className={message.ok ? 'message ok' : 'message error'}>{message.text}</div>}
        <button type="button" className="primary" onClick={onSave}>保存抽卡配置</button>
      </div>
      <div className="kv-grid">
        <div className="form-field"><label>单抽花费 (singleCost)</label><input type="number" value={gacha.singleCost ?? 0} onChange={(event) => patch({ singleCost: Number(event.target.value) })} /></div>
        <div className="form-field"><label>十连花费 (tenCost)</label><input type="number" value={gacha.tenCost ?? 0} onChange={(event) => patch({ tenCost: Number(event.target.value) })} /></div>
      </div>

      <div className="rule-editor" style={{ marginTop: 14 }}>
        <div className="rule-head">
          <label>稀有度概率 (rates)</label>
          <span className={sumOk ? 'message ok' : 'message error'} style={{ padding: '2px 8px' }}>合计 {rateSum.toFixed(4)} {sumOk ? '✓' : '（应为 1）'}</span>
        </div>
        <div className="kv-grid">
          {rarityKeys.map((key) => (
            <div className="form-field" key={key}>
              <label>{key}</label>
              <input type="number" step={0.01} value={gacha.rates?.[key] ?? 0} onChange={(event) => patchRates(key, Number(event.target.value))} />
            </div>
          ))}
        </div>
      </div>

      <div className="rule-editor" style={{ marginTop: 14 }}>
        <div className="rule-head"><label>保底次数 (pity)</label></div>
        <div className="kv-grid">
          {pityKeys.map((key) => (
            <div className="form-field" key={key}>
              <label>{key}</label>
              <input type="number" value={gacha.pity?.[key] ?? 0} onChange={(event) => patchPity(key, Number(event.target.value))} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RewardsForm({ rewards, onChange, onSave, message }) {
  const keys = Object.keys({ ...rewardLabels, ...rewards });
  function patch(key, value) {
    onChange({ ...rewards, [key]: value });
  }
  return (
    <div className="entity-form">
      <div className="entity-form-header">
        <strong>奖励数值 (rewards)</strong>
        {message.text && <div className={message.ok ? 'message ok' : 'message error'}>{message.text}</div>}
        <button type="button" className="primary" onClick={onSave}>保存奖励数据</button>
      </div>
      <div className="kv-grid">
        {keys.map((key) => (
          <div className="form-field" key={key}>
            <label>{rewardLabels[key] || key} <span className="muted">{key}</span></label>
            <input type="number" value={rewards[key] ?? 0} onChange={(event) => patch(key, Number(event.target.value))} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConfigEditor() {
  const [gacha, setGacha] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [gachaMessage, setGachaMessage] = useState({ text: '', ok: true });
  const [rewardsMessage, setRewardsMessage] = useState({ text: '', ok: true });

  useEffect(() => {
    fetch('/api/content').then((r) => r.json()).then((content) => {
      setGacha(content.gacha);
      setRewards(content.rewards);
    });
  }, []);

  async function saveGacha() {
    const response = await fetch('/api/gacha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(gacha),
    }).then((r) => r.json());
    if (!response.ok) {
      setGachaMessage({ text: (response.issues || [response.error]).join('\n'), ok: false });
      return;
    }
    setGachaMessage({ text: '已保存。', ok: true });
  }

  async function saveRewards() {
    const response = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rewards),
    }).then((r) => r.json());
    if (!response.ok) {
      setRewardsMessage({ text: (response.issues || [response.error]).join('\n'), ok: false });
      return;
    }
    setRewardsMessage({ text: '已保存。', ok: true });
  }

  if (!gacha || !rewards) return <div className="loading">加载中...</div>;

  return (
    <div className="list-editor" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <GachaForm gacha={gacha} onChange={setGacha} onSave={saveGacha} message={gachaMessage} />
      <div style={{ borderLeft: '1px solid #26324a' }}>
        <RewardsForm rewards={rewards} onChange={setRewards} onSave={saveRewards} message={rewardsMessage} />
      </div>
    </div>
  );
}
