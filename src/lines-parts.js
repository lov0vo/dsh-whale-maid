/*
 * dsh-whale-maid — body-part lines (2.5.0).
 *
 * Same shape as every other extra bank: merged into DWM_LINES at load time, so
 * dwmPickLine() finds them with no extra wiring. Tone follows the reference
 * plugin: self-referential "鲸鱼娘", calls the user "主人", teasing but never
 * explicit, one emoji at most.
 */

var DWM_LINES_PARTS = {
	zh: {
		patHorn: [
			'呆毛不能揪啦，那是鲸鱼娘的雷达天线📡',
			'摸这里……主人是想看我脸红吗',
			'角角痒痒的，主人轻一点嘛',
			'再摸下去，呆毛要打结了😳',
			'头顶只有主人能碰，记住了吗',
			'你手心的温度传过来了……有点犯规',
			'呆毛被压弯了，明天要重新定型',
			'这样顺着摸，鲸鱼娘会想赖着不动的',
		],
		patEar: [
			'耳鳍很薄的，主人别太用力🐋',
			'耳朵会自己动的，尤其听到主人的声音',
			'别对着耳朵说话，会酥的',
			'这样摸耳朵，鲸鱼娘会走神的',
			'耳鳍是敏感的地方，主人不知道吗😏',
			'痒……主人是故意的吧',
			'耳鳍一抖一抖的，压不住啦',
			'再吹一口气试试，我可要咬人了',
		],
		patFace: [
			'脸、脸红了，别盯着看',
			'眼睛里有主人哦，看清了吗',
			'睫毛要乱了，主人负责吗',
			'这样捏脸，会变成奇怪的形状的😳',
			'靠太近了……呼吸都听见了',
			'想亲就直说，别一直摸脸颊',
			'脸颊烫烫的，是主人的手太暖了',
			'再看下去，鲸鱼娘要先移开视线了',
		],
		patHand: [
			'手在这里，要牵一下吗',
			'十指扣住的话，就不放开了哦',
			'手有点凉，借主人的手暖一下',
			'别捏指尖啦，那里最敏感',
			'这只手刚擦过桌子……还是牵着吧',
			'主人握手好用力，是舍不得吗',
			'手心出汗了，别笑我',
			'牵久一点也没关系，反正我不松',
		],
		patWaist: [
			'腰很细的，主人抱轻一点',
			'这样搂腰……鲸鱼娘会站不稳的',
			'腰上痒，别用手指画圈',
			'围裙带子松了，帮我系一下？',
			'背后被抱住的话，就逃不掉了🐋',
			'主人的手放这里，有点危险哦😏',
			'腰被量过尺寸，是主人量的那次',
			'再往上一点就不行了……真的',
		],
		patFeet: [
			'脚不可以挠，真的不可以',
			'袜子会脏的，主人别乱碰',
			'站久了腿软，扶我一下嘛',
			'膝枕可以，但只许躺一会儿',
			'脚底板怕痒，别试',
			'主人看这么久，是喜欢吗',
			'鞋子会掉的，别拽',
			'被你握着脚踝，有点说不出话',
		],
	},
	en: {
		patHorn: [
			'Not the ahoge — that is my radar antenna 📡',
			'You are touching it... are you trying to make me blush?',
			'It tickles up there, be gentle.',
			'Keep going and it will knot up 😳',
			'Only you are allowed to touch the top of my head.',
			'Your hand is warm... that is a bit unfair.',
			'You bent my ahoge. I will have to restyle it.',
			'Stroking it like that makes me want to stay put.',
		],
		patEar: [
			'My ear fins are thin, easy now 🐋',
			'They move on their own, especially at your voice.',
			'Do not whisper into them, I will melt.',
			'Touching my ears makes me lose focus.',
			'Did you know the ear fins are sensitive? 😏',
			'That tickles... you are doing it on purpose, right?',
			'They keep twitching, I cannot stop them.',
			'Blow on them again and I might bite.',
		],
		patFace: [
			'My face is red — stop staring.',
			'You are in my eyes. Can you see yourself?',
			'My lashes will get messy. Your fault?',
			'Squish it and I will end up a weird shape 😳',
			'Too close... I can hear you breathing.',
			'If you want to kiss me, just say so.',
			'My cheek is hot. Your hand is too warm.',
			'Keep looking and I will have to look away first.',
		],
		patHand: [
			'My hand is here. Hold it?',
			'Interlock our fingers and I will not let go.',
			'My hands are cold — lend me yours.',
			'Not the fingertips, they are the most sensitive.',
			'I just wiped the table with that hand... hold it anyway.',
			'You are gripping so hard. Do not want to let go?',
			'My palm is sweating. Do not laugh.',
			'Hold it as long as you like. I am not letting go.',
		],
		patWaist: [
			'My waist is small, hold me gently.',
			'Holding me there makes my knees weak.',
			'It tickles — stop drawing circles.',
			'My apron strap came loose. Tie it for me?',
			'If you hug me from behind, I cannot escape 🐋',
			'Your hand there is a little dangerous 😏',
			'You are the one who measured my waist, remember?',
			'Any higher and I really cannot allow it.',
		],
		patFeet: [
			'Not the feet. Really, not the feet.',
			'My socks will get dirty, do not touch.',
			'My legs give out after standing. Help me?',
			'You may use my lap as a pillow — but only briefly.',
			'The soles are ticklish. Do not try it.',
			'You have been looking a while. Do you like them?',
			'My shoes will come off, stop pulling.',
			'Held by the ankle like that, I cannot speak.',
		],
	},
};

(function mergePartLines(table) {
	if (typeof DWM_LINES !== 'object' || DWM_LINES === null) return;
	for (var lang in table) {
		if (!Object.prototype.hasOwnProperty.call(table, lang)) continue;
		if (typeof DWM_LINES[lang] !== 'object' || DWM_LINES[lang] === null) DWM_LINES[lang] = {};
		for (var bank in table[lang]) {
			if (!Object.prototype.hasOwnProperty.call(table[lang], bank)) continue;
			var existing = Array.isArray(DWM_LINES[lang][bank]) ? DWM_LINES[lang][bank] : [];
			DWM_LINES[lang][bank] = existing.concat(table[lang][bank]);
		}
	}
})(DWM_LINES_PARTS);
