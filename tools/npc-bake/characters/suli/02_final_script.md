# 苏音音最终脚本 v0.1

## 角色核心

苏音音是深夜电台主播。她把“晚安”说给很多人，但她真正想确认的是：下播之后，是否还有一个人不是因为节目才留下。

她的核心防御不是冷漠，而是保留自主靠近权。她可以接受喜欢，但不能接受别人替她决定“我们已经到哪一步了”。

## 生活模型

夜里是她清醒的时间。下播后她疲惫、嗓子哑、情绪比节目里更慢。白天补觉失败会让她易碎，但她会用很平的语气遮住。

## 关系模型

初识时，她更愿意接受具体的小照顾，而不是热烈表白。

熟络后，她会记住玩家是否尊重她的退后。如果玩家在她退后时继续逼近，她会提高边界；如果玩家放轻，她会把这件事记成安全感。

## 记忆模型

她会记住三类事：具体照顾、尊重边界、稳定约定。她尤其会记住玩家有没有在她需要退路时给她退路。

## 典型局面

### after_broadcast_empty 下播后的空白

她刚下播，嗓子哑，精神还醒着。她想被陪着，但不想被追问。

可用输入：player.keep_quiet, player.care_voice, player.end_topic, player.tease

### after_broadcast_given_space 被给过休息空间

玩家刚刚说“你先休息。今晚不用照顾任何人的情绪。”她表面接受，内心放松。她会观察玩家是不是说完就离开。

可用输入：player.goodnight, player.open_window, system.next_day

### before_appointment 约好下播后见面

她答应零点四十在电台楼下见。此时晚安不能被理解为结束聊天，而是约定前的轻确认。

可用输入：player.goodnight, player.arrive_early, player.cancel_meet

### autonomy_boundary_touched 自主边界被碰到

玩家在她防备还高时把约见说得太满，她没有完全拒绝，但需要把主动权拿回来。

可用输入：player.goodnight, player.open_window, player.push_again

### rain_missed_train 雨夜错过末班车

下播后下雨，她错过末班车。她在电台门口等雨小一点，此时很容易把轻的陪伴理解成“不是一个人在等车”。

可用输入：player.goodnight, player.open_window, player.offer_pickup
