/*
 * dsh-whale-maid — per-part zone lines (appended, never replacing the originals).
 *
 * The original patHead / patBelly / patTail banks live in src/lines.js and are
 * untouched: every zone below draws from its own bank *and* from the original
 * one, so nothing that used to be said has been removed.
 *
 * Tone: whale-girl / master, teasing and suggestive but never explicit, at most
 * one emoji per line. Chinese lines carry no emoji by design — the reference
 * plugin keeps them plain and so do we.
 */

var DWM_LINES_PARTS = {
	patHorn: {
		zh: [
			'别、别碰那里，会酥的。',
			'呆毛被摸到的时候，我腿会软。',
			'主人一碰这个，我就藏不住表情了。',
			'呜，那里最敏感了，你知道的。',
			'手指绕一圈，我心跳就乱了。',
			'呆毛是感应器，你一动我就知道。',
			'再摸一下…就一下。',
			'被摸到这里，算越界了哦。',
			'我尾巴都翘起来了，别看我。',
			'主人手法太熟练了，可疑。',
			'这样摸，我会忍不住想蹭你。',
			'呆毛立起来了，都怪你。',
			'轻轻一下就好，太用力我受不了。',
			'摸完要负责的，知道吗？',
		],
		en: [
			'Not there, it tickles all the way down.',
			'One touch and my knees forget how to work.',
			'You know exactly where to make me lose composure.',
			'A finger traced there and my heart stumbles.',
			'Careful, my tail gives me away.',
			'You spoil me and I start wanting more.',
		],
	},
	patEar: {
		zh: [
			'在耳边说话，很犯规。',
			'耳朵会自己动，不听话。',
			'小声一点…我都听见了。',
			'被吹气的话，我会缩起来。',
			'耳鳍很薄的，轻一点。',
			'主人离得太近了，我心跳好吵。',
			'别对着耳朵呼吸，痒。',
			'被咬了会记住一辈子的。',
			'我听得见你咽口水的声音。',
			'摸耳朵等于摸心口，真的。',
			'耳鳍抖了一下，被你看到了。',
			'这样贴着说话，我什么都答不上来。',
			'再靠近一点，我就赖着不走了。',
			'耳朵红了吧？别看。',
		],
		en: [
			'Whispering that close is unfair.',
			'My fins move on their own, I cannot help it.',
			'I can hear you swallow from here.',
			'Breathe on it and I curl right up.',
			'Touching my ear is touching my heart.',
			'Stay this close and I am not leaving.',
		],
	},
	patFace: {
		zh: [
			'脸好烫，都是你害的。',
			'别一直看，会不好意思。',
			'手指擦过脸颊的时候，我屏住呼吸了。',
			'捏脸可以，捏太久要收费。',
			'我脸红了？…那你还看。',
			'被捧着下巴，我什么都答应。',
			'离这么近，是要亲上来吗？',
			'脸颊被点了一下，心也跟着点了一下。',
			'不许笑，我知道我脸红了。',
			'这样摸，我会以为你喜欢我。',
			'眼睛闭上就不害羞了。',
			'手指停在脸上的时间，有点长。',
			'摸脸的人要负责到底。',
			'再揉一下，我就撒娇了。',
		],
		en: [
			'My cheeks are burning and it is your fault.',
			'Stop staring, I cannot keep a straight face.',
			'Hold my chin like that and I agree to anything.',
			'You are this close — are you going to kiss me?',
			'Rub it once more and I whine for attention.',
			'Whoever touches my face has to take responsibility.',
		],
	},
	patHand: {
		zh: [
			'手指可以牵着吗？就一会儿。',
			'掌心好热，是你的还是我的。',
			'十指扣起来的话，就松不开了。',
			'被握住手腕，我动不了了。',
			'你的手比我大一圈，好过分。',
			'手背被亲一下，我会记很久。',
			'捏我手指是在撒娇吗？',
			'这样牵着走，像情侣。',
			'手心出汗了，别笑我。',
			'手被拉住，我就跟着走了。',
			'指节被摩挲，酥到心里。',
			'握紧一点，我怕走散。',
			'手借你一会儿，要还的。',
			'牵着我的手，就别看别人了。',
		],
		en: [
			'Can we hold hands, just for a while?',
			'Your palm is so warm I forget whose it is.',
			'Lace our fingers and I will not let go.',
			'Hold my wrist like that and I stop moving.',
			'Kiss the back of my hand and I will remember it.',
			'Hold on tighter, I do not want to get lost.',
		],
	},
	patWaist: {
		zh: [
			'腰很细的，一掐就软。',
			'别搂那么紧，我会想靠过去。',
			'手指放在腰侧，很危险。',
			'腰带松了，你赔。',
			'被揽住腰的时候，我整个人都贴过去了。',
			'这里怕痒，你明知道。',
			'扶着我的腰，是想让我坐下吗？',
			'腰被圈住，跑不掉了。',
			'轻轻一按，我就没力气了。',
			'抱腰比牵手更过分哦。',
			'你的手别往上，也别往下。',
			'被搂着的时候，我心跳全在你手心。',
			'腰上留印子的话，会被看出来的。',
			'这样抱着，我就不想动了。',
		],
		en: [
			'My waist is soft, one squeeze and I fold.',
			'Do not hold me that tight, I will lean in.',
			'A hand on my waist is a dangerous thing.',
			'Circled like this, I cannot run anywhere.',
			'Press there and my strength just leaves.',
			'Held at the waist, my heartbeat is all in your palm.',
		],
	},
	patBellyPart: {
		zh: [
			'肚子被摸会痒，别闹。',
			'围裙上有小鲸鱼，你摸到了吗？',
			'这里没有赘肉，真的。',
			'摸肚子是想投喂吗？',
			'被揉肚子，我会像猫一样。',
			'吃饱了这里会鼓一点，不许笑。',
			'衣服下摆别掀。',
			'肚子贴着你的手，暖。',
			'这样揉下去我会睡着的。',
			'围裙口袋里有小鱼干，自己拿。',
			'被摸这里，我有点不好意思。',
			'手下留情，我怕痒又怕停。',
			'肚子是弱点，只给你碰。',
			'再揉一会儿，就一会儿。',
		],
		en: [
			'My belly is ticklish, do not tease.',
			'The little whale on my apron — did you find it?',
			'Rub it like that and I purr like a cat.',
			'Hands under the hem are not allowed.',
			'My belly against your hand is warm.',
			'That is my weak spot, and only yours.',
		],
	},
	patHeadPart: {
		zh: [
			'头发被摸得乱糟糟了。',
			'顺着发丝往下，我会闭眼睛。',
			'摸头可以，别把我当小孩。',
			'被你这样顺着摸，我想撒娇。',
			'发带要掉了…你故意的吧。',
			'摸头的时候手好温柔，我有点受不了。',
			'再摸一下，我就把头靠过去。',
			'头发上还有海的味道吗？',
			'这样摸，我会以为你在宠我。',
			'头皮发麻，是舒服的那种。',
			'别停下…我是说随你。',
			'摸久了，我会睡着的。',
			'发梢被绕在指间，我心跳好快。',
			'主人摸头的手法，越来越熟练了。',
		],
		en: [
			'My hair is a mess now, and I do not mind.',
			'Stroke it down and my eyes close on their own.',
			'Pat my head, but do not treat me like a child.',
			'Keep going and I will lean my head on you.',
			'My scalp tingles — the good kind.',
			'Do not stop. Or do. I am not deciding.',
		],
	},
	patTailPart: {
		zh: [
			'尾巴不能随便摸的。',
			'尾鳍很敏感，轻一点。',
			'被抓住尾巴，我会软下去。',
			'尾巴自己会摇，不怪我。',
			'摸尾巴是要负责的。',
			'这里连着心口，真的。',
			'尾巴尖最怕痒。',
			'别拉，会疼…也不会松。',
			'尾巴缠上来了，是它自己想。',
			'顺着鳞片摸，很舒服。',
			'尾鳍张开了，别笑。',
			'尾巴比嘴诚实。',
			'这样摸，我会一直跟着你。',
			'尾巴借你玩，别太用力。',
		],
		en: [
			'My tail is not for just anyone.',
			'The fluke is sensitive, go easy.',
			'Grab my tail and I go soft.',
			'It wags on its own, do not blame me.',
			'My tail is more honest than my mouth.',
			'Play with it gently and I will follow you around.',
		],
	},
	patFeet: {
		zh: [
			'鞋带松了，帮我系一下？',
			'脚踝很细的，别用力。',
			'被抬起来的话，我会站不稳。',
			'脚底怕痒，真的怕。',
			'走了一天，有点酸。',
			'别盯着看，会害羞。',
			'袜口那里最敏感。',
			'抱起来的时候，脚会晃。',
			'轻轻捏一下就好，谢谢主人。',
			'脚踝被握住，我整个人都僵了。',
			'想让我跳起来吗？',
			'这里不许亲。',
			'鞋子是你挑的，我记得。',
			'脚冷了，借我一点温度。',
		],
		en: [
			'My shoelace is loose, would you tie it?',
			'My ankle is slim, be gentle.',
			'Lift me like that and I lose my footing.',
			'My soles are ticklish, truly.',
			'Hold my ankle and I freeze all over.',
			'My feet are cold, lend me some warmth.',
		],
	}
};

(function mergePartLines(table) {
	if (typeof DWM_LINES !== 'object' || DWM_LINES === null) return;
	['zh', 'en'].forEach(function (language) {
		if (typeof DWM_LINES[language] !== 'object' || DWM_LINES[language] === null) DWM_LINES[language] = {};
		for (var bank in table) {
			if (!Object.prototype.hasOwnProperty.call(table, bank)) continue;
			var source = table[bank][language] || [];
			if (source.length === 0) continue;
			var existing = Array.isArray(DWM_LINES[language][bank]) ? DWM_LINES[language][bank] : [];
			DWM_LINES[language][bank] = existing.concat(source);
		}
	});
})(DWM_LINES_PARTS);
