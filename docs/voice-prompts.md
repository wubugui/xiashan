# 8 位老婆 · ElevenLabs 配音提示词

> 名单 = `src/data/characters.ts` 的 `ACTIVE_CHARACTER_IDS`（characters.json 里其余 9 条是旧 AVG 废稿遗留，不配音）。
>
> 用法：
> 1. **Voice Design 提示词**（英文）→ ElevenLabs「Voice Design」生成音色，挑一条最像的存为该角色专属 Voice。每人一次生成 3-5 条挑最好的。
> 2. **朗读文本** → 贴进 v3/v4 TTS。`[方括号]` 是官方 audio tag 控制演技；`……`/顿号控制停顿，别删。每人 3 句：**第 1 句是抽卡结算页台词**（`dialogues[0]`），另两句是日常对话，同音色一次配齐。
> 3. **Stability**：低 = 演技夸张（Creative），高 = 平稳。按角色标注。
> 4. 文件命名建议：抽卡句 `/voice/gacha/{id}.mp3`，对话句 `/voice/dialogue/{id}_{n}.mp3`。

---

## SSR

### 苏音音 suli · 午夜音频节目主播
**Voice Design**：Young adult female voice, low and velvety, late-night radio host. Very soft, slow, intimate, close-mic ASMR quality, almost whispering. Calm and detached, with a soothing, sleepy warmth underneath. Mandarin Chinese.
**Stability 0.3** · 语气：气声贴麦，全程不抬音量，像凌晨电台对一个人说话。

1. 抽卡：`[whispers] ……你还在？[soft] 那就别急着挂断。`
   ——「你还在」尾音轻挑一点好奇；后半句放得更慢，像怕吵醒谁。
2. `[soft] 白天的城市太吵……我习惯在夜里听。`
   ——「太吵」微微蹙眉的嫌弃，「夜里听」回到舒展。
3. `[whispers] 睡不着的话——零点，调到我的频段。`
   ——「零点」清晰咬字像报台号，结尾留一丝邀请的笑意。

### 云晓蔻 aruo · 直播主播兼活动主持
**Voice Design**：Bright young female voice, professional livestream host. Sweet, bubbly, high-energy with impeccable comedic timing; sparkling smile audible in every word; projects like she's on camera. Mandarin Chinese.
**Stability 0.25** · 语气：开口就是直播腔，甜而不腻，节奏感是她的命。

1. 抽卡：`[excited] 嗨——新朋友？[giggles] 欢迎来到云晓蔻的、临、时、救、场、频道！`
   ——「临时救场频道」逐字打节拍像念 slogan，收尾上扬带笑。
2. `[cheerful] 别怕冷场～空气安静三秒以内，都算铺垫！`
   ——「都算铺垫」抖包袱式压低再弹起，主播救场金句的得意。
3. `[laughs] 你这反应速度——来我直播间当场控，都屈才了！`
   ——真心夸人，「屈才了」夸张拉长，捧人捧得理直气壮。

### 顾夜莺 sangluo · 深夜咖啡吧主理人
**Voice Design**：Mature female voice, low, husky and languid. Speaks slowly with long relaxed pauses, effortlessly calming, like a bartender at 2 AM who has seen everything. Warm smoky texture. Mandarin Chinese.
**Stability 0.5** · 语气：语速压到平常七成，慵懒是节奏慢、不是没精神。

1. 抽卡：`[sighs] 这么晚还在跑？……先进来，喝口热的。`
   ——先一声不重的叹息；「先进来」和「喝口热的」之间留口气。
2. `[soft] 别急。先把声音放低一点……事情会自己露出边。`
   ——「放低一点」自己也放低示范，停顿比字多。
3. `很多麻烦不是解决不了……只是，太吵了。`
   ——不加 tag，靠慢；「太吵了」轻轻摇头的笑意。

### 许念 aman · 宠物护理师
**Voice Design**：Gentle young female voice, soft and nurturing, a pet care specialist. Patient, warm, slightly breathy, the tone used to soothe a frightened animal; never rushed, never sharp. Mandarin Chinese.
**Stability 0.45** · 语气：全程像哄受惊的小猫，句尾永远带着安抚的微笑。

1. 抽卡：`[soft] 你好呀，[gentle] 别急、别急——先慢慢说。`
   ——「别急」两次一次比一次轻。
2. `[gentle] 小动物害怕的时候，追得越急、越躲。[soft] 人有时候……也一样。`
   ——前半句温柔科普，后半句放轻放慢，意有所指地看着你。
3. `[cheerful] 我带了猫条和湿巾，应该用得上！`
   ——难得的元气一句，背包拍一拍的踏实感。

---

## SR

### 祁宁 shenzhaoning · 楼宇运营专员
**Voice Design**：Adult female voice, crisp, brisk and efficient, a corporate operations specialist. Clipped short sentences, zero filler, cool professional confidence; not unkind, just allergic to wasted time. Mandarin Chinese.
**Stability 0.6** · 语气：不靠 tag 靠节奏，名词像敲键盘一样均匀蹦出来，零拖音。

1. 抽卡：`说重点。先确认：权限、流程、时间。`
   ——「说重点」三字干脆收死。
2. `不是没办法——是他们，没按正确流程走。`
   ——「他们」轻微加重，专业人士的不耐烦只露半分。
3. `访客系统、门禁、登记表。三处里，一定有一处能打开局面。`
   ——前三个名词点名式，「一定」给出冷静的笃定。

### 沈疏桐 murongxue · 新闻系学生
**Voice Design**：Quiet young female voice, soft-spoken, precise and bookish. Reserved journalism student; speaks in measured, even tones, slightly shy but every word deliberate. Mandarin Chinese.
**Stability 0.5** · 语气：音量小但吐字极清楚，内向但有主意。

1. 抽卡：`你好。[soft] 我可以……旁听吗？也许能记到有用的细节。`
   ——「旁听吗」前有个犹豫的小停顿，问完不等回答就轻声补理由。
2. `[curious] 这个时间点，不对。登记表和监控……差了三分钟。`
   ——发现线索时声音不自觉亮半度，「三分钟」咬得精准。
3. `[soft] 别急着下结论。先把线索，按时间排一遍。`
   ——安静地泼冷水，没有攻击性，只有方法论。

### 陈小满 yunzhiyi · 配送站新人
**Voice Design**：Energetic teenage-adjacent female voice, loud, sunny and breathless, a delivery rookie who just sprinted upstairs. Fast tempo, big dynamics, zero self-doubt, slightly out of breath. Mandarin Chinese.
**Stability 0.25** · 语气：像刚冲刺完三层楼，带喘但兴高采烈。

1. 抽卡：`[excited] 我来了！！[breathless] 今天要送什么、搬什么、追什么？！`
   ——三个「什么」一个比一个高，节奏哒哒哒往前赶。
2. `[cheerful] 路线我可能记不全……但我跑得快！`
   ——前半句不好意思地挠头，后半句理直气壮反弹。
3. `[determined] 这个箱子不重！我一个人能搬——真的！`
   ——「真的」加重跺脚，越强调越露馅的可爱。

---

## R

### 江夏 linxia · 职场新人（新手引导解说同此音色）
**Voice Design**：Sweet young female voice, earnest and slightly flustered, a new office assistant. Clear, clean, eager-to-please tone; brightens instantly when recognizing a friend; tiny nervous energy under the cheerfulness. Mandarin Chinese.
**Stability 0.35** · 语气：认真到有点笨拙的可爱，紧张时语速会急。

1. 抽卡：`[surprised] 啊——是你！[happy] 上次真的、真的多亏你了。`
   ——「啊」是真惊喜不是客套，瞬间亮起来；「真的」重复时微微急。
2. `[cheerful] 我把今天要补的东西都列好了！先从最急的开始吧。`
   ——亮出清单的小得意，「最急的」业务熟练。
3. `[soft] 我一紧张就会反复确认清单……[sheepish] 但这样，至少不会漏掉。`
   ——自嘲带一点点不好意思，结尾找补回一点自信。

**引导配音备注**：`tutorialScript.json` 全部 lines + nudges 用同一 Voice，按每步 `expression` 换 tag——
smile→`[happy]`、shy→`[soft]`、cry→`[sad]`、angry→`[annoyed]`、laugh→`[laughs]`、calm→不加。
乱点提醒（nudge_1~3）加 `[pouting]` 或 `[annoyed]`，要嗔不要怒。
