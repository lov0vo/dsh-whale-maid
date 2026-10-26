/*
 * dsh-whale-maid — weather lines (added in 1.3.0).
 *
 * Chinese only on purpose: the weather companion was requested in Chinese and a
 * machine translation of these short lines would read worse than no translation.
 * `dwmPickLine` already falls back to the Chinese table when a language has no
 * bank, so an English UI simply shows the Chinese line instead of nothing.
 *
 * 7 banks x 9 lines = 63 lines.
 */

var DWM_LINES_WEATHER = {
	weatherClear: [
		'出太阳了，把被子拿出去晒晒吧。',
		'天这么晴，心情也跟着亮起来了。',
		'阳光正好，主人要不要出去走走？',
		'晴天的风是暖的，我闻到了。',
		'这么好的天气，适合偷懒五分钟。',
		'太阳晒得我有点想睡午觉。',
		'天空蓝得像刚洗过一样。',
		'晴天也要记得喝水，别光顾着忙。',
		'我把窗帘拉开了一点点，光进来了。',
	],
	weatherCloudy: [
		'云把太阳藏起来了，有点闷。',
		'阴天最适合安安静静地写代码。',
		'天灰灰的，我给你讲个笑话吧？',
		'多云转晴，说不定一会儿就亮了。',
		'这种天气，泡杯茶刚刚好。',
		'云飘得很快，像在赶路。',
		'阴天不出门也没关系，我陪着你。',
		'外面有点闷，记得开窗透气。',
		'天不亮也不暗，正好发呆。',
	],
	weatherRain: [
		'下雨了，出门记得带伞。',
		'雨声很好听，像在给我打拍子。',
		'下雨天适合待在屋里，我陪你。',
		'雨点敲窗户，一下一下的。',
		'别淋湿了，湿衣服会感冒的。',
		'雨天路滑，走路慢一点。',
		'下雨了，把窗户关小一点吧。',
		'我听着雨声，忽然很想撒娇。',
		'雨这么大，主人今天别加班了。',
	],
	weatherSnow: [
		'下雪了，外面白白的。',
		'雪天很冷，多穿一件再出门。',
		'雪花落在窗上，一下就化了。',
		'下雪天最适合喝热的东西。',
		'主人，你的手冷不冷？',
		'雪把声音都吸走了，好安静。',
		'我想在雪地上踩出脚印。',
		'雪天路滑，小心别摔。',
		'雪停了之后会更冷，注意保暖。',
	],
	weatherThunder: [
		'打雷了，我有点怕，靠近你一点。',
		'雷声好大，我把耳朵捂住了。',
		'打雷的时候别站在窗边。',
		'闪电一亮，我就缩了一下。',
		'雷雨天，把电器拔掉更安全。',
		'轰隆一声，我尾巴都炸了。',
		'别怕，雷打完就晴了。',
		'打雷了，主人你在吗？',
		'这种天气，我一步都不想离开你。',
	],
	weatherFog: [
		'起雾了，外面看不太清。',
		'雾里的路灯像一颗颗糖。',
		'有雾的时候开车要慢一点。',
		'白茫茫的，像在云里走路。',
		'雾天空气潮，记得关窗。',
		'我看不清远处，但看得清你。',
		'雾一会儿就散了，别急。',
		'这种天气，声音都变得很近。',
		'起雾了，出门注意安全。',
	],
	weatherRainyNight: [
		'雨夜的灯特别温柔。',
		'这么晚了还在忙吗？听会儿雨吧。',
		'雨夜适合早点睡，我陪你。',
		'窗外在下雨，屋里很安静。',
		'雨夜别熬太晚，明天还要早起。',
		'我数着雨声，数着数着就困了。',
		'雨夜的路灯下，水洼在发亮。',
		'这种夜，适合什么都不做。',
		'雨还在下，你也该休息了。',
	],
};

var DWM_LINES_BOND = {
	zh: {
		bondL3: ['我们好像更熟一点了。', '这个动作，只给熟的人看。', '羁绊 Lv3 解锁：我学会眨眼啦。'],
		bondL5: ['鲸汐守护者——这个称号我收下了。', '从今天起，我是你的守护者。'],
		bondL7: ['彩蛋时间！这个保留节目，只此一家。', '嘘——这是 Lv7 才有的秘密。'],
	},
	en: {
		bondL3: ['We are a little closer now.', 'This move is only for people I know.', 'Bond Lv3: I learned to wink.'],
		bondL5: ['Tide Guardian — I accept the title.', 'From today, I am your guardian.'],
		bondL7: ['Easter egg time! Reserved showing, one house only.', 'Shh — this secret needs Lv7.'],
	},
};

(function mergeBondLines(table) {
	if (typeof DWM_LINES !== 'object' || DWM_LINES === null) return;
	var langs = ['zh', 'en'];
	for (var l = 0; l < langs.length; l++) {
		var lang = langs[l];
		if (typeof DWM_LINES[lang] !== 'object' || DWM_LINES[lang] === null) DWM_LINES[lang] = {};
		var banks = table[lang];
		for (var bank in banks) {
			if (!Object.prototype.hasOwnProperty.call(banks, bank)) continue;
			var existing = Array.isArray(DWM_LINES[lang][bank]) ? DWM_LINES[lang][bank] : [];
			DWM_LINES[lang][bank] = existing.concat(banks[bank]);
		}
	}
})(DWM_LINES_BOND);

(function mergeWeatherLines(table) {
	if (typeof DWM_LINES !== 'object' || DWM_LINES === null) return;
	if (typeof DWM_LINES.zh !== 'object' || DWM_LINES.zh === null) DWM_LINES.zh = {};
	for (var bank in table) {
		if (!Object.prototype.hasOwnProperty.call(table, bank)) continue;
		var existing = Array.isArray(DWM_LINES.zh[bank]) ? DWM_LINES.zh[bank] : [];
		DWM_LINES.zh[bank] = existing.concat(table[bank]);
	}
})(DWM_LINES_WEATHER);
