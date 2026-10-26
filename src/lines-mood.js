/*
 * dsh-whale-maid — five-tier mood lines (added in 1.4.0).
 *
 * The plugin used to have two mood banks (`moodLow` / `moodHigh`) picked at
 * 30 / 80. Five tiers read much better, so this file adds the three missing
 * banks; `moodLow` and `moodHigh` stay exactly as they were so nothing that
 * already referenced them changes meaning.
 *
 *   tier 0  moodVeryLow   0 - 14
 *   tier 1  moodLow      15 - 39   (existing)
 *   tier 2  moodMid      40 - 59
 *   tier 3  moodHigh     60 - 89   (existing)
 *   tier 4  moodVeryHigh 90 - 100
 */

var DWM_LINES_MOOD = {
	zh: {
		moodVeryLow: [
			'我今天有点提不起劲……',
			'是不是我哪里做得不好？',
			'让我安静一会儿好吗。',
			'尾巴都垂下来了。',
			'我好想被抱一下。',
			'什么都不想做……',
			'你会不会不要我了？',
			'心里闷闷的。',
			'我想躲到桌子底下。',
			'今天先不勉强自己了。',
		],
		moodMid: [
			'平平淡淡的一天也不错。',
			'我在，你说什么我都听着。',
			'今天想喝点甜的。',
			'没什么事，就是看看你。',
			'这样安静地待着挺好的。',
			'我数了数窗外的云。',
			'有点困，但还不想睡。',
			'你忙你的，我不吵你。',
			'心情像一杯温水。',
			'慢慢来，不着急。',
		],
		moodVeryHigh: [
			'今天开心得想转圈！',
			'尾巴摇得停不下来！',
			'我超级超级喜欢你！',
			'感觉什么都能做到！',
			'要不要一起蹦两下？',
			'心里像放了小烟花。',
			'我把最好的心情分你一半。',
			'今天的我闪闪发光！',
			'想给你一个大大的拥抱！',
			'就这样一直开心下去吧！',
		],
	},
	en: {
		moodVeryLow: [
			'I am feeling really low today...',
			'Did I do something wrong?',
			'Let me be quiet for a while, okay?',
			'Even my tail is drooping.',
			'I really want a hug.',
			'I do not want to do anything...',
			'You will not leave me, right?',
			'My chest feels heavy.',
			'I want to hide under the desk.',
			'I will not push myself today.',
		],
		moodMid: [
			'A plain, ordinary day is fine too.',
			'I am here, I will listen to whatever you say.',
			'I feel like something sweet today.',
			'Nothing much, just looking at you.',
			'Staying quiet like this is nice.',
			'I counted the clouds outside.',
			'A little sleepy, but not ready to sleep.',
			'Do your work, I will not interrupt.',
			'My mood is like a cup of warm water.',
			'Take it slow, no rush.',
		],
		moodVeryHigh: [
			'I am so happy I could spin around!',
			'My tail will not stop wagging!',
			'I like you so, so much!',
			'I feel like I can do anything!',
			'Want to hop around together?',
			'Little fireworks are going off inside me.',
			'I am sharing my best mood with you.',
			'I am sparkling today!',
			'I want to give you a big hug!',
			'Let us stay this happy!',
		],
	},
};

(function mergeMoodLines(table) {
	if (typeof DWM_LINES !== 'object' || DWM_LINES === null) return;
	var languages = ['zh', 'en'];
	for (var i = 0; i < languages.length; i += 1) {
		var lang = languages[i];
		if (typeof DWM_LINES[lang] !== 'object' || DWM_LINES[lang] === null) DWM_LINES[lang] = {};
		var banks = table[lang];
		for (var bank in banks) {
			if (!Object.prototype.hasOwnProperty.call(banks, bank)) continue;
			var existing = Array.isArray(DWM_LINES[lang][bank]) ? DWM_LINES[lang][bank] : [];
			DWM_LINES[lang][bank] = existing.concat(banks[bank]);
		}
	}
})(DWM_LINES_MOOD);
