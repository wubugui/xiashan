# 抽卡台词 · ElevenLabs 配音提示词（全 17 角色）

> 用法：
> 1. **Voice Design 提示词**（英文）→ ElevenLabs「Voice Design」生成音色，挑一条满意的存为该角色专属 Voice，之后所有台词（含江夏的引导配音）复用同一音色。
> 2. **朗读文本** → 直接贴进 v3/v4 的 TTS 输入框。`[方括号]` 是官方 audio tag，控制演技；`……` 和标点控制停顿；不要删。
> 3. **Stability** 低 = 演技夸张（推荐 Creative 档），高 = 平稳。每条标了建议值。
> 4. 抽卡结算页台词 = `characters.json` 各角色 `dialogues[0]`；语音文件建议命名 `/voice/gacha/{characterId}.mp3`。

---

## SSR

### 苏音音 suli · 午夜音频节目主播
- **台词**：……你还在？那就别急着挂断。
- **Voice Design**：Young adult female voice, low and velvety, late-night radio host. Very soft, slow, intimate, close-mic ASMR quality, almost whispering. Calm and detached, with a soothing, sleepy warmth underneath. Mandarin Chinese.
- **朗读文本**：`[whispers] ……你还在？[soft] 那就别急着挂断。`
- **语气**：气声贴麦，全程不抬音量；「你还在」尾音轻挑一点点好奇，后半句放得更慢，像怕吵醒谁。Stability 0.3。

### 楚惊鸿 chujinghong · 天枢阁传人
- **台词**：你也配和我说话？
- **Voice Design**：Young adult male voice, sharp and aristocratic, a prodigy full of arrogance. Cold, clipped, disdainful tone with perfect enunciation; slight upward sneer in the delivery. Underneath the pride, a faint crack of loneliness. Mandarin Chinese.
- **朗读文本**：`[scoffs] 你也配……和我说话？`
- **语气**：先一声嗤笑；「你也配」三个字咬重、降调，停半拍，再把后半句轻飘飘扔出来——蔑视感来自落差而不是吼。Stability 0.35。

### 苏锦黎 sujinli · 幽冥司天才
- **台词**：你的命数……很奇怪。
- **Voice Design**：Young female voice, cold, precise and unhurried, like a judge reading a verdict. Low pitch for a young woman, emotionless surface with an undercurrent of curiosity. Slightly ethereal, distant reverb feel. Mandarin Chinese.
- **朗读文本**：`你的命数…… [curious] 很奇怪。`
- **语气**：前半句平到没有人味，省略号停足一秒；「很奇怪」忽然放轻、带一丝真实的兴趣——全句唯一的情绪只许出现在这三个字。Stability 0.45。

### 云晓蔻 aruo · 直播主播兼活动主持
- **台词**：嗨，新朋友？欢迎来到云晓蔻的临时救场频道！
- **Voice Design**：Bright young female voice, professional livestream host. Sweet, bubbly, high-energy with impeccable comedic timing; sparkling smile audible in every word; projects like she's on camera. Mandarin Chinese.
- **朗读文本**：`[excited] 嗨——新朋友？[giggles] 欢迎来到云晓蔻的、临、时、救、场、频道！`
- **语气**：开口就是直播腔，甜而不腻；「临时救场频道」逐字打节拍像念 slogan，收尾上扬带笑。Stability 0.25（要炸）。

### 画皮 huapi · 千面阁师姐
- **台词**：你看到的我是谁呢？
- **Voice Design**：Adult female voice, silky and theatrical, a masked shapeshifter. Soft seductive whisper that can flip mood mid-sentence; playful yet faintly menacing, like a smile you can't read. Mandarin Chinese.
- **朗读文本**：`[whispers] 你看到的我……[mischievously] 是谁呢？`
- **语气**：前半句丝绸一样贴着耳朵，后半句忽然带上戏谑的笑意，尾音绕一个弯——让人分不清是调情还是警告。Stability 0.3。

### 顾夜莺 sangluo · 深夜咖啡吧主理人
- **台词**：这么晚还在跑？先进来喝口热的。
- **Voice Design**：Mature female voice, low, husky and languid. Speaks slowly with long relaxed pauses, effortlessly calming, like a bartender at 2 AM who has seen everything. Warm smoky texture. Mandarin Chinese.
- **朗读文本**：`[sighs] 这么晚还在跑？……先进来，喝口热的。`
- **语气**：先一声不重的叹息；语速压到平常的七成，「先进来」和「喝口热的」之间留口气——慵懒是节奏慢，不是没精神。Stability 0.5。

### 许念 aman · 宠物护理师
- **台词**：你好呀，别急，先慢慢说。
- **Voice Design**：Gentle young female voice, soft and nurturing, a pet care specialist. Patient, warm, slightly breathy, the tone used to soothe a frightened animal; never rushed, never sharp. Mandarin Chinese.
- **朗读文本**：`[soft] 你好呀，[gentle] 别急、别急——先慢慢说。`
- **语气**：全程像哄受惊的小猫，「别急」重复两次一次比一次轻，句尾带着安抚的微笑。Stability 0.45。

---

## SR

### 祁宁 shenzhaoning · 楼宇运营专员
- **台词**：说重点。先确认权限、流程和时间。
- **Voice Design**：Adult female voice, crisp, brisk and efficient, a corporate operations specialist. Clipped short sentences, zero filler, cool professional confidence; not unkind, just allergic to wasted time. Mandarin Chinese.
- **朗读文本**：`说重点。先确认：权限、流程、时间。`
- **语气**：不加任何 tag，靠节奏——「说重点」三字干脆收死；三个名词像敲键盘一样均匀蹦出来，零拖音。Stability 0.6（要稳要快）。

### 裴砚之 peiyanzhi · 裴家天才
- **台词**：努力？那是弱者的借口。
- **Voice Design**：Refined young male voice, smooth, elegant and lazily condescending. Aristocratic politeness wrapped around contempt; speaks softly because he never needs to raise his voice. Mandarin Chinese.
- **朗读文本**：`努力？[sarcastic] ……那是弱者的、借口。`
- **语气**：「努力」用真诚的疑问语气复述，仿佛第一次听到这个词；停顿后温文尔雅地补刀，「借口」前顿半拍、轻轻放下——优雅的刀。Stability 0.4。

### 周磊 zhoulei · 纵横猎聘销冠
- **台词**：新人？呵，又一个来送死的。
- **Voice Design**：Adult male voice, sharp and fast-talking, a cutthroat top salesman. Smug, dismissive sneer with practiced charm underneath; quick tempo, hard consonants, audible smirk. Mandarin Chinese.
- **朗读文本**：`新人？[scoffs] 呵——又一个来送死的。`
- **语气**：「新人」上挑装作意外，嗤笑拖长半秒，后半句加快、不屑到懒得看人——职场恶意要轻佻不要狰狞。Stability 0.35。

### 沈疏桐 murongxue · 新闻系学生
- **台词**：你好。我可以旁听吗？也许能记到有用的细节。
- **Voice Design**：Quiet young female voice, soft-spoken, precise and bookish. Reserved journalism student; speaks in measured, even tones, slightly shy but every word deliberate. Mandarin Chinese.
- **朗读文本**：`你好。[soft] 我可以……旁听吗？也许能记到有用的细节。`
- **语气**：音量小但吐字极清楚；「旁听吗」前有个犹豫的小停顿，问完不等回答就轻声补理由——内向但有主意。Stability 0.5。

### 陈小满 yunzhiyi · 配送站新人
- **台词**：我来了！今天要送什么、搬什么、追什么？
- **Voice Design**：Energetic teenage-adjacent female voice, loud, sunny and breathless, a delivery rookie who just sprinted upstairs. Fast tempo, big dynamics, zero self-doubt, slightly out of breath. Mandarin Chinese.
- **朗读文本**：`[excited] 我来了！！[breathless] 今天要送什么、搬什么、追什么？！`
- **语气**：像刚冲刺完三层楼，带喘但兴高采烈；三个「什么」一个比一个高，节奏哒哒哒往前赶。Stability 0.25。

---

## R

### 江夏 linxia · 职场新人（引导解说同此音色）
- **台词**：啊，是你！上次真的多亏你了。
- **Voice Design**：Sweet young female voice, earnest and slightly flustered, a new office assistant. Clear, clean, eager-to-please tone; brightens instantly when recognizing a friend; tiny nervous energy under the cheerfulness. Mandarin Chinese.
- **朗读文本**：`[surprised] 啊——是你！[happy] 上次真的、真的多亏你了。`
- **语气**：「啊」是真惊喜不是客套，瞬间亮起来；「真的」重复时微微急，认真到有点笨拙的可爱。Stability 0.35。
- **备注**：新手引导（tutorialScript.json 全部 lines + nudges）用同一 Voice，引导里再按各句 expression 调 tag：smile→[happy]、shy→[soft]、cry→[sad]、angry→[annoyed]、laugh→[laughs]、calm→不加。

### 金满堂 jinmantang · 暴发户老板
- **台词**：小伙子，想赚钱不？跟金爷干！
- **Voice Design**：Middle-aged male voice, loud, booming and gravelly, a self-made nouveau-riche boss. Big hearty laugh always loaded, street-market bravado, generous and crude in equal measure. Northern Mandarin flavor.
- **朗读文本**：`[laughs] 小伙子！想赚钱不？跟金爷——干！`
- **语气**：嗓门全开，拍肩膀式热情；「金爷」自抬身价重读，「干」字砸地有声。Stability 0.3。

### 万家 wanjia · 万家商行
- **台词**：合作？可以谈谈，但你要先证明你的价值。
- **Voice Design**：Adult male voice, smooth, measured and businesslike, a family-clan merchant. Polite negotiator's cadence, every word weighed like coins; courteous surface, calculating core. Mandarin Chinese.
- **朗读文本**：`合作？……可以谈谈。但你要先证明，你的价值。`
- **语气**：不动声色的商人腔；「可以谈谈」给甜头，「但」字转冷半度，「价值」二字放慢咬清——条件才是重点。Stability 0.55。

---

## N

### 游魂 youhun · 徘徊之灵
- **台词**：……你看得见我？
- **Voice Design**：Faint, hollow, androgynous ghostly voice. Thin and airy as if heard from far away, slow and fragile, infinite loneliness with a flicker of disbelieving hope. Slight ethereal echo. Mandarin Chinese.
- **朗读文本**：`[whispers] ……你、看得见我？`
- **语气**：几乎不成声，「你」之后断一下像不敢相信；句尾那点颤抖的希望是整句的灵魂。Stability 0.35。

### 路人甲 lurenjia · 普通路人
- **台词**：嗯？你叫我？
- **Voice Design**：Ordinary adult male voice, plain, casual and friendly. A regular city commuter caught off guard; natural conversational tone, no performance at all. Mandarin Chinese.
- **朗读文本**：`嗯？[curious] 你叫我？`
- **语气**：最难的就是「毫无戏感」——像在菜市场被人拍了下肩膀，自然回头随口一问。Stability 0.7。

### 小鬼 xiaogui · 顽皮小鬼
- **台词**：嘿嘿嘿！吓你一跳！
- **Voice Design**：Mischievous child-like voice, high-pitched, raspy and gleeful, a naughty little ghost. Cackling imp energy, quick and bouncy, more cute than scary. Mandarin Chinese.
- **朗读文本**：`[mischievously] 嘿嘿嘿！[laughs] 吓你一跳！`
- **语气**：先憋着坏笑三连「嘿」，然后炸出来邀功——恶作剧得逞的得意，吓人是假、求关注是真。Stability 0.25。
