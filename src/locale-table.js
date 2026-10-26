/*
 * dsh-whale-maid — locale table (generated from locale/zh.json + locale/en.json).
 *
 * The renderer is sandboxed, so the client bundle cannot read locale/*.json at
 * runtime. build.mjs inlines this file into the bundle instead; it must stay a
 * plain script (no import/export) like every other src/*.js file, and it is
 * loaded before src/settings.js and src/panel.js.
 *
 * Keep the keys and values in sync with locale/zh.json and locale/en.json —
 * those two files are the source of truth (this table is generated from them).
 * Templates use {name} placeholders; fill them with dwmFill().
 */

var DWM_LOCALE = {
	zh: {
		"meta.title": "鲸鱼女仆桌宠",
		"meta.description": "DeepSeek Harness 的鲸鱼女仆桌宠：十二个逐帧动作、工作状态联动、成长与成就、天气陪伴。",
		"settings.hint": "鲸鱼女仆桌宠取自 1024Store 插件市场的角色动画。拖动可移动，单击打招呼并展开「喂食 / 玩耍」，闲置会自动发呆、漫步并睡着。",
		"settings.size": "尺寸",
		"settings.size.auto": "自动（110px，窄屏 72px）",
		"settings.size.followDefault": "跟随响应式默认值",
		"settings.speed": "动画速度",
		"settings.bubbleDuration": "气泡停留",
		"settings.language": "气泡语言",
		"settings.language.auto": "跟随界面",
		"settings.language.zh": "中文",
		"settings.language.en": "English",
		"settings.hidden": "隐藏桌宠（留 🐋 唤回）",
		"settings.greeting": "首次出现时打招呼",
		"settings.walk": "自己散步",
		"settings.typewriter": "打字机效果",
		"settings.sleep": "闲置后打瞌睡",
		"settings.previewLine": "预览一句台词",
		"settings.resetPosition": "回到右下角",
		"settings.reset": "恢复默认参数",
		"settings.clearFeeds": "清零投喂计数（当前 {n}）",
		"panel.intro": "陪伴与成长：她会跟着你的工作状态换姿势、在合适的时候开口，也会记住你们一起写代码的每一天。所有数据只存在本机。",
		"panel.hero.achievements": "成就 ",
		"panel.stats.mood": "心情",
		"panel.stats.satiety": "饱食",
		"panel.stats.affinity": "好感",
		"panel.stats.companionship": "陪伴时长",
		"panel.stats.signinStreak": "连续签到",
		"panel.stats.days": " 天",
		"panel.duration.dayHour": "{d} 天 {h} 小时",
		"panel.duration.hourMinute": "{h} 小时 {m} 分",
		"panel.duration.minute": "{m} 分钟",
		"panel.weather.title": "天气陪伴",
		"panel.weather.city": "城市",
		"panel.weather.cityPlaceholder": "城市，例如 北京",
		"panel.weather.refresh": "刷新天气",
		"panel.quests.title": "每日任务",
		"panel.quests.empty": "今天没有任务",
		"panel.quests.done": "任务完成！",
		"panel.quests.claimed": "已领取",
		"panel.quests.claim": "领取",
		"panel.quests.progress": "进行中",
		"panel.signin.title": "本周签到",
		"panel.signin.success": "签到成功",
		"panel.signin.already": "今天已经签过了",
		"panel.signin.button": "打卡签到",
		"panel.achievements.title": "成就",
		"panel.achievements.locked": "（未解锁）",
		"panel.diary.title": "成长日记",
		"panel.diary.empty": "还没有记录",
		"panel.switches.title": "陪伴开关",
		"panel.switches.workLink": "工作状态联动",
		"panel.switches.chip": "状态提示条",
		"panel.switches.zones": "分区点击与关键词反应",
		"panel.switches.care": "主动关怀",
		"panel.switches.idleChat": "主动闲聊",
		"panel.switches.lateNight": "深夜晚安提醒",
		"panel.workSpeech": "工作台词频率",
		"panel.workSpeech.chatty": "话痨（15–40 秒）",
		"panel.workSpeech.quiet": "安静（90–240 秒）",
		"panel.workSpeech.off": "关闭",
		"panel.workHold": "信号中断钉住",
		"panel.try.title": "试一试",
		"panel.try.thinking": "思考中",
		"panel.try.working": "工作中的陪伴",
		"panel.try.done": "完成",
		"panel.try.error": "出错",
		"panel.try.chat": "说一句闲聊",
		"panel.try.care": "试一句关怀",
		"panel.try.growthReset": "成长数据已重置",
		"panel.try.resetGrowth": "重置成长数据",
		"panel.save.title": "存档",
		"panel.save.hint": "导出全部数据（位置、投喂、配置、成长、天气），或粘贴一份存档导入。",
		"panel.save.placeholder": "点「导出」生成存档，或在此粘贴存档 JSON",
		"panel.save.export": "导出",
		"panel.save.exported": "已导出到下面的文本框",
		"panel.save.import": "导入",
		"panel.save.imported": "已导入 {n} 项",
		"panel.save.importFailed": "导入失败：{reason}",
		"panel.save.clear": "清空存档",
		"panel.save.cleared": "已清空 {n} 项",
	},
	en: {
		"meta.title": "Whale Girl Pet",
		"meta.description": "A whale-maid desktop pet for the DeepSeek Harness: twelve sprite animations, work-status link, growth, achievements and a weather companion.",
		"settings.hint": "The whale girl is ported from the 1024Store plugin-market character. Drag to move, click to greet and open Feed / Play; left alone she thinks, wanders and falls asleep.",
		"settings.size": "Size",
		"settings.size.auto": "Auto (110px, 72px when narrow)",
		"settings.size.followDefault": "Use the responsive default",
		"settings.speed": "Animation speed",
		"settings.bubbleDuration": "Bubble duration",
		"settings.language": "Bubble language",
		"settings.language.auto": "Follow the interface",
		"settings.language.zh": "中文",
		"settings.language.en": "English",
		"settings.hidden": "Hide her (keep a 🐋 button)",
		"settings.greeting": "Greet on first appearance",
		"settings.walk": "Wander on her own",
		"settings.typewriter": "Typewriter effect",
		"settings.sleep": "Doze off when idle",
		"settings.previewLine": "Preview a line",
		"settings.resetPosition": "Send her back to the corner",
		"settings.reset": "Reset options",
		"settings.clearFeeds": "Clear the feed counter (now {n})",
		"panel.intro": "Companion mode: she follows what the Harness is doing, speaks up at the right moments, and remembers the days you spent coding together. All data stays on this machine.",
		"panel.hero.achievements": "Achievements ",
		"panel.stats.mood": "Mood",
		"panel.stats.satiety": "Satiety",
		"panel.stats.affinity": "Affinity",
		"panel.stats.companionship": "Time together",
		"panel.stats.signinStreak": "Sign-in streak",
		"panel.stats.days": " d",
		"panel.duration.dayHour": "{d}d {h} h",
		"panel.duration.hourMinute": "{h} h {m} m",
		"panel.duration.minute": "{m} min",
		"panel.weather.title": "Weather",
		"panel.weather.city": "City",
		"panel.weather.cityPlaceholder": "City, e.g. Beijing",
		"panel.weather.refresh": "Refresh",
		"panel.quests.title": "Daily quests",
		"panel.quests.empty": "No quests today",
		"panel.quests.done": "Quest done!",
		"panel.quests.claimed": "Claimed",
		"panel.quests.claim": "Claim",
		"panel.quests.progress": "In progress",
		"panel.signin.title": "This week",
		"panel.signin.success": "Checked in",
		"panel.signin.already": "Already checked in today",
		"panel.signin.button": "Check in",
		"panel.achievements.title": "Achievements",
		"panel.achievements.locked": " (locked)",
		"panel.diary.title": "Diary",
		"panel.diary.empty": "Nothing recorded yet",
		"panel.switches.title": "Companion switches",
		"panel.switches.workLink": "Follow the work status",
		"panel.switches.chip": "Status chip",
		"panel.switches.zones": "Hit zones and keyword reactions",
		"panel.switches.care": "Proactive care",
		"panel.switches.idleChat": "Small talk",
		"panel.switches.lateNight": "Late-night reminder",
		"panel.workSpeech": "Work chatter",
		"panel.workSpeech.chatty": "Chatty (15–40 s)",
		"panel.workSpeech.quiet": "Quiet (90–240 s)",
		"panel.workSpeech.off": "Off",
		"panel.workHold": "Hold after a signal drops",
		"panel.try.title": "Try it",
		"panel.try.thinking": "Thinking",
		"panel.try.working": "Companion while working",
		"panel.try.done": "Done",
		"panel.try.error": "Error",
		"panel.try.chat": "Say something",
		"panel.try.care": "Try a care line",
		"panel.try.growthReset": "Growth data reset",
		"panel.try.resetGrowth": "Reset growth data",
		"panel.save.title": "Save file",
		"panel.save.hint": "Export everything (position, feeds, options, growth, weather), or paste a save to import.",
		"panel.save.placeholder": "Press export, or paste a save JSON here",
		"panel.save.export": "Export",
		"panel.save.exported": "Exported into the box below",
		"panel.save.import": "Import",
		"panel.save.imported": "Imported {n} entries",
		"panel.save.importFailed": "Import failed: {reason}",
		"panel.save.clear": "Clear save",
		"panel.save.cleared": "Cleared {n} entries",
	},
};

/** Active UI language ('zh' | 'en'); mirrors dwmUiLanguage(). */
function dwmLocaleLanguage() {
	try {
		return resolveLanguage(readOptions().language);
	} catch (error) {
		return 'zh';
	}
}

/**
 * Look a key up in the active language table.
 * Falls back to the zh/en argument pair (the same text the old inline label()
 * used) when the language table or the key is missing, so the UI never shows a
 * raw key. Pass key = null for data-driven text that has no table entry (quest
 * names, achievements, diary lines and bond titles come from src/growth.js):
 * the zh/en pair is then simply selected by the active language.
 */
function dwmT(key, fallbackZh, fallbackEn) {
	var language = dwmLocaleLanguage();
	var table = DWM_LOCALE[language];
	var hasKey = key !== null && key !== undefined && table && Object.prototype.hasOwnProperty.call(table, key);
	var value = hasKey ? table[key] : null;
	if (typeof value === 'string' && value !== '') return value;
	var primary = language === 'zh' ? fallbackZh : fallbackEn;
	var secondary = language === 'zh' ? fallbackEn : fallbackZh;
	if (typeof primary === 'string' && primary !== '') return primary;
	if (typeof secondary === 'string') return secondary;
	return key === null || key === undefined ? '' : String(key);
}

/** Fill {name} placeholders in a locale template; unknown names are left alone. */
function dwmFill(template, values) {
	if (template === undefined || template === null) return '';
	return String(template).replace(/\{(\w+)\}/g, function (match, name) {
		var value = values ? values[name] : undefined;
		return value === undefined || value === null ? match : String(value);
	});
}
