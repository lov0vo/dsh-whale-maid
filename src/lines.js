/*
 * dsh-whale-maid — companion lines (added in 1.1.0).
 *
 * The original pet only had greet / feed / play / milestone lines, all of them
 * tied to a click. The companion features need a much wider voice: small talk
 * by topic, care lines, work-phase chatter, hit-zone reactions and mood layers.
 *
 * All of it lives here instead of inside pet.js so the original TEXTS table (and
 * therefore the original behaviour) stays byte-for-byte untouched. Nothing is
 * copied from any other plugin: the lines below were written for this pet, in the
 * same soft, slightly sleepy voice as the original greeting.
 */

var DWM_LINES = {
	zh: {
		hello: [
			'诶，你来了。我一直在这里等你哦。',
			'第一次见面…我是这里的鲸鱼女仆，请多指教。',
			'你好呀，今天也一起慢慢来吧。',
			'我先把尾巴摆好，然后陪你干活。',
			'欢迎回来，小鱼干我自己会找的，你忙你的。'
		],
		chatGeneral: [
			'窗外的光好像变了，你那边几点了？',
			'我刚刚打了个盹，梦见一片很深的海。',
			'你要是累了，就把手离开键盘一会儿。',
			'其实我一直很好奇，你每天在写什么呀？',
			'鲸鱼一天要睡很久的，但我可以为你少睡一点。',
			'这里的空气很安静，只有你的键盘声。',
			'我数了数，今天你已经很努力了。',
			'如果写不下去了，就跟我说说话吧。'
		],
		chatCode: [
			'代码看起来很长，但你可以一行一行来。',
			'那个函数名…念起来像海浪。',
			'写完记得跑一遍，我会在旁边看着。',
			'命名这件事，慢慢想也没关系。',
			'你敲键盘的节奏变快了，是想到什么了吗？',
			'把复杂的拆成小的，这是我拆小鱼干的方法。'
		],
		chatQuestion: [
			'这个问题有点难…但我相信你能想出来。',
			'要不要先说说你卡在哪一步？',
			'唔，我先安静一下，让你想。',
			'答案可能就在你刚才删掉的那一段里。',
			'不着急，海里的路也是一点点游出来的。'
		],
		chatThanks: [
			'不客气，我只是刚好在这里。',
			'被夸奖了…尾巴会不听话地摇起来。',
			'能帮上忙就好，这是女仆该做的。',
			'嘿嘿，那我要多吃一条小鱼干。'
		],
		chatDebug: [
			'报错了吗？我陪你一起看。',
			'红色的字看起来好凶…但它其实在告诉你答案。',
			'先看最后一行，通常那里最诚实。',
			'修好了吗？修好了我们就一起松口气。',
			'错了也没关系，鲸鱼也会游错方向。'
		],
		chatDesign: [
			'这个配色…我觉得有点像傍晚的海面。',
			'留白多一点，呼吸感会更好。',
			'样式这种东西，改到第三遍通常就对了。',
			'我先在旁边看着，不打扰你的审美。'
		],
		chatTest: [
			'测试全绿的时候，声音很好听。',
			'写测试的人，都是在给未来的自己留信。',
			'跑一遍吧，我想看看结果。',
			'有一个红的也没关系，慢慢来。'
		],
		chatDocs: [
			'写文档的时候，你比平时安静。',
			'把话说清楚，比写得漂亮更重要。',
			'注释是写给三个月后的你看的。',
			'README 写好了吗？我想读一读。'
		],
		chatDeploy: [
			'要发布了吗？我有点紧张。',
			'上线之前，先深呼吸一次。',
			'部署的时候我会安静一点，不吵你。',
			'希望一切都顺利，我会在这里等结果。'
		],
		chatTired: [
			'累了就休息吧，海也会退潮的。',
			'你的眼睛已经眨得很慢了，去喝点水。',
			'我可以帮你看着屏幕，你去躺一会儿。',
			'今天到这里也可以的，真的。',
			'疲惫的时候做的决定，通常要重做一遍。'
		],
		chatLaugh: [
			'你笑了，那我也笑一下。',
			'嘿嘿，虽然我不知道你在笑什么。',
			'笑出来就好，刚才你太紧绷了。',
			'这样的声音我喜欢听。'
		],
		chatNight: [
			'已经很晚了，海面都黑了。',
			'熬夜的话，明天会变成一只很困的鲸鱼。',
			'我陪你到这一句，然后去睡吧。',
			'晚安之前，记得保存。'
		],
		chatMorning: [
			'早上好，今天的水温刚刚好。',
			'新的一天，先伸个懒腰吧。',
			'你来了，我把窗帘拉开了。',
			'早晨的代码通常最干净。'
		],
		chatFood: [
			'说到吃的…小鱼干可以吗？',
			'你吃饭了吗？没吃的话我有点担心。',
			'咖啡的味道飘过来了。',
			'我也可以只吃一点点，真的。'
		],
		careLongSit: [
			'你已经坐了很久了，站起来走两步吧。',
			'我数了一下，你至少两个小时没动了。',
			'腰会疼的，我认真的。',
			'去倒杯水，我帮你看着这里。'
		],
		careStuck: [
			'这一步好像卡住了，要不要换个角度？',
			'它已经转了很久了，我有点担心。',
			'卡住的时候，去洗把脸通常有用。',
			'要不先做点别的，让它自己想一想。'
		],
		careLateNight: [
			'这么晚了还不睡吗？我陪你，但我很困。',
			'深夜写的代码，明天早上会变得很陌生哦。',
			'再写十分钟就收工，好不好？',
			'海里的灯都关了，只剩我们这一盏。'
		],
		careComeBack: [
			'你回来了！我刚才一直在看门口。',
			'欢迎回来，这段时间我数了 42 次海浪。',
			'我以为你把我忘了…没有就好。',
			'回来就好，先坐下歇一会儿。',
			'你不在的时候，房间好安静。'
		],
		careSatiety: [
			'我有点饿了…不过你忙你的。',
			'肚子在叫，声音很小，你大概听不见。',
			'等你有空，能不能喂我一条小鱼干？',
			'饿的时候尾巴会没力气摇。'
		],
		workThinking: [
			'在想吗？我不吵你。',
			'思考的样子很认真，我安静看着。',
			'我猜你脑子里正在下雪。',
			'慢慢想，海很深，答案会浮上来的。',
			'要不要先写下三个词？',
			'我在这里，不说话。'
		],
		workTool: [
			'开始动手了，我帮你数着。',
			'工具在跑，我盯着进度条。',
			'这一步看起来有点重，小心。',
			'我听到很多声音，是在改很多东西吗？',
			'跑起来了，那就交给它吧。',
			'需要我递什么吗？虽然我只有尾巴。'
		],
		workLong: [
			'这一轮好长啊，你还好吗？',
			'已经很久了，我陪着你，但记得喝水。',
			'长时间的任务…要不要先放个音乐？',
			'我不催你，只是提醒你眨眨眼。',
			'这么久还没结束，它是不是也在思考人生。'
		],
		workSuccess: [
			'完成啦！我摇一下尾巴庆祝。',
			'成功的声音真好听。',
			'这一轮干得漂亮。',
			'我记下来了，这是今天第几次顺利结束呢。',
			'太好了，那我也松一口气。',
			'要不要奖励自己一条小鱼干？'
		],
		workFailure: [
			'出错了吗…我在这里。',
			'失败了也没关系，我们再试一次。',
			'红色的字又出现了，我陪你一起看。',
			'不是你的错，工具也有心情不好的时候。',
			'先深呼吸，然后我们从头看一遍。'
		],
		patHead: [
			'唔…头饰会被弄歪的。',
			'摸头的话，我会安静一点。',
			'再摸一下也可以。',
			'嘿嘿，这样很舒服。',
			'女仆帽要掉了啦。'
		],
		patBelly: [
			'那里不可以！…好吧，就一下。',
			'围裙会皱的。',
			'肚子的地方，有点痒。',
			'唔，被你发现了。',
			'轻一点，我还没吃饭呢。'
		],
		patTail: [
			'尾巴会自己动的，我控制不住。',
			'别抓尾巴，会甩到你。',
			'尾巴是我最诚实的地方。',
			'诶…那里很敏感的。',
			'尾巴摇起来就停不下了。'
		],
		triple: [
			'三连击！我转一圈给你看。',
			'诶诶诶，太快了啦！',
			'好啦好啦，我最喜欢你了。'
		],
		moodLow: [
			'我有点没精神…可以陪我说说话吗？',
			'最近好像有点安静过头了。',
			'心情像退潮一样低低的。'
		],
		moodHigh: [
			'今天心情特别好，尾巴一直在摇。',
			'和你在一起的时间，我都记着呢。',
			'现在的我，可以游很远很远。'
		]
	},
	en: {
		hello: [
			'Oh, you are here. I have been waiting.',
			'First meeting… I am the whale maid of this room. Please take care of me.',
			'Hello. Let us take today slowly, together.',
			'Let me settle my tail first, then I will keep you company.',
			'Welcome back. I can find my own fish snacks, so just do your work.'
		],
		chatGeneral: [
			'The light outside changed. What time is it where you are?',
			'I dozed off just now and dreamed of a very deep sea.',
			'If you are tired, take your hands off the keyboard for a moment.',
			'I have always wondered — what are you writing every day?',
			'A whale sleeps a lot, but I can sleep less for you.',
			'It is quiet in here, except for your keyboard.',
			'I counted. You have worked hard today.',
			'If you get stuck, talk to me for a bit.'
		],
		chatCode: [
			'The code looks long, but you can take it one line at a time.',
			'That function name sounds like a wave.',
			'Run it once when you are done — I will watch.',
			'Naming things slowly is fine.',
			'Your typing got faster. Did you think of something?',
			'Break the big things into small ones. That is how I eat fish snacks.'
		],
		chatQuestion: [
			'This one is hard… but I believe you can figure it out.',
			'Want to tell me which step you are stuck on?',
			'Hmm, I will be quiet so you can think.',
			'The answer might be in the part you just deleted.',
			'No rush. Paths in the sea are swum one stroke at a time.'
		],
		chatThanks: [
			'You are welcome. I was just here anyway.',
			'Being praised… my tail will not stay still.',
			'I am glad I could help. That is a maid\'s job.',
			'Hehe, then I get one more fish snack.'
		],
		chatDebug: [
			'An error? Let us look at it together.',
			'Red text looks scary, but it is telling you the answer.',
			'Read the last line first. It is usually the most honest.',
			'Fixed it? Then we can both breathe out.',
			'Being wrong is fine. Whales swim the wrong way too.'
		],
		chatDesign: [
			'This palette… it reminds me of the sea at dusk.',
			'A little more whitespace would let it breathe.',
			'Styles usually become right on the third pass.',
			'I will stay out of your way and just watch.'
		],
		chatTest: [
			'All green tests make a lovely sound.',
			'People who write tests are leaving letters for their future selves.',
			'Run them. I want to see the result.',
			'One red is fine. Take your time.'
		],
		chatDocs: [
			'You get quieter when you write documentation.',
			'Saying it clearly matters more than saying it beautifully.',
			'Comments are letters to yourself in three months.',
			'Is the README done? I would like to read it.'
		],
		chatDeploy: [
			'Releasing now? I am a little nervous.',
			'Take one deep breath before it goes out.',
			'I will be extra quiet while it deploys.',
			'I hope it all goes well. I will wait here.'
		],
		chatTired: [
			'If you are tired, rest. The sea ebbs too.',
			'Your blinks are getting slower. Go drink some water.',
			'I can watch the screen. Go lie down for a while.',
			'Stopping here for today is allowed. Really.',
			'Decisions made while exhausted usually get remade.'
		],
		chatLaugh: [
			'You laughed. Then I will laugh too.',
			'Hehe, though I do not know what at.',
			'Good. You were too tense a moment ago.',
			'I like that sound.'
		],
		chatNight: [
			'It is late. Even the sea has gone dark.',
			'Staying up turns you into a very sleepy whale tomorrow.',
			'I will stay until this sentence, then go to sleep.',
			'Save your work before saying goodnight.'
		],
		chatMorning: [
			'Good morning. The water is just right today.',
			'New day. Stretch first.',
			'You are here. I opened the curtains.',
			'Morning code is usually the cleanest.'
		],
		chatFood: [
			'Speaking of food… fish snacks, perhaps?',
			'Have you eaten? If not, I worry a little.',
			'The smell of coffee drifted over.',
			'I can eat just a little. Really.'
		],
		careLongSit: [
			'You have been sitting a long time. Stand up and walk a little.',
			'I counted — at least two hours without moving.',
			'Your back will ache. I mean it.',
			'Go get some water. I will watch things here.'
		],
		careStuck: [
			'This step seems stuck. Try another angle?',
			'It has been spinning a while. I am a bit worried.',
			'Washing your face usually helps when stuck.',
			'Do something else and let it think for a while.'
		],
		careLateNight: [
			'Still awake at this hour? I will stay, but I am sleepy.',
			'Code written this late looks like a stranger tomorrow.',
			'Ten more minutes, then we stop. Deal?',
			'All the lights in the sea are off. Only ours is left.'
		],
		careComeBack: [
			'You are back! I was watching the door.',
			'Welcome back. I counted 42 waves while you were gone.',
			'I thought you forgot me… I am glad you did not.',
			'Back already. Sit down and rest a moment.',
			'It was very quiet while you were away.'
		],
		careSatiety: [
			'I am a little hungry… but do your work.',
			'My stomach is growling. Quietly. You probably cannot hear it.',
			'When you have a moment, could I have a fish snack?',
			'My tail loses strength when I am hungry.'
		],
		workThinking: [
			'Thinking? I will not interrupt.',
			'You look serious. I will watch quietly.',
			'I imagine it is snowing inside your head.',
			'Take your time. The sea is deep; answers float up.',
			'Maybe write down three words first?',
			'I am here, not talking.'
		],
		workTool: [
			'Hands moving now. I will keep count.',
			'The tool is running. I am watching the progress bar.',
			'This step looks heavy. Careful.',
			'So many sounds — are you changing a lot?',
			'It is running. Let it do its work.',
			'Need me to hand you something? I only have a tail.'
		],
		workLong: [
			'This round is long. Are you all right?',
			'It has been a while. I am here, but remember water.',
			'A long task… maybe put on some music?',
			'I will not rush you. Just remember to blink.',
			'Still not done. Maybe it is also thinking about life.'
		],
		workSuccess: [
			'Done! Let me wag my tail to celebrate.',
			'The sound of success is lovely.',
			'That round went well.',
			'I am noting it. How many smooth finishes today?',
			'Great. Now I can breathe out too.',
			'Time to reward yourself with a fish snack?'
		],
		workFailure: [
			'An error… I am here.',
			'Failing is fine. We try again.',
			'Red text again. Let us read it together.',
			'Not your fault. Tools have bad moods too.',
			'Deep breath, then we look from the top.'
		],
		patHead: [
			'Mmn… my headdress will go crooked.',
			'Head pats make me quiet.',
			'One more is fine too.',
			'Hehe, that is nice.',
			'The maid cap is falling off.'
		],
		patBelly: [
			'Not there! …All right, just once.',
			'The apron will wrinkle.',
			'The belly is a bit ticklish.',
			'Ah, you found it.',
			'Gently. I have not eaten yet.'
		],
		patTail: [
			'The tail moves on its own. I cannot control it.',
			'Do not grab the tail, it will swing at you.',
			'My tail is the most honest part of me.',
			'Eh… that part is sensitive.',
			'Once it starts wagging it will not stop.'
		],
		triple: [
			'Triple tap! I will spin for you.',
			'Hey hey hey, too fast!',
			'All right, all right. I like you the most.'
		],
		moodLow: [
			'I feel a bit low… will you talk to me?',
			'It has been too quiet lately.',
			'My mood is as low as the tide.'
		],
		moodHigh: [
			'I am in a great mood today. My tail will not stop.',
			'I remember every moment we spend together.',
			'Right now I could swim very, very far.'
		]
	}
};

/* Keeps a bank from repeating the same line twice in a row. */
var DWM_LINE_LAST = {};

function dwmPickLine(bank, language) {
	var table = DWM_LINES[language] || DWM_LINES.zh;
	var list = table[bank];
	if (!list || list.length === 0) list = DWM_LINES.zh[bank];
	if (!list || list.length === 0) return '';
	if (list.length === 1) return list[0];
	var key = (language || 'zh') + ':' + bank;
	var last = DWM_LINE_LAST[key];
	var index = Math.floor(Math.random() * list.length);
	if (index === last) index = (index + 1) % list.length;
	DWM_LINE_LAST[key] = index;
	return list[index];
}

/* --- keyword reactions ----------------------------------------------------
 * Each entry maps a topic keyword to a pose and a particle kind. Poses stay
 * inside the existing ten-state ANIM table, so no artwork is needed. */

var DWM_KEYWORDS = [
	{ id: 'thanks', words: ['谢谢', '多谢', '感谢', '辛苦', 'thank', 'thanks', 'thx'], pose: 'joy', fx: 'heart' },
	{ id: 'cute', words: ['可爱', '好萌', '萌', 'cute', 'adorable', 'kawaii'], pose: 'welcome', fx: 'heart' },
	{ id: 'slack', words: ['摸鱼', '划水', '偷懒', 'slack', 'lazy', 'procrastinat'], pose: 'play', fx: 'note' },
	{ id: 'cheer', words: ['冲', '加油', '干就完了', 'let us go', 'lets go', 'go go'], pose: 'joy', fx: 'star' },
	{ id: 'tired', words: ['好累', '累了', '困', '疲惫', '撑不住', 'tired', 'exhausted', 'sleepy'], pose: 'sleep', fx: 'note' },
	{ id: 'broken', words: ['报错', '崩溃', '失败了', '挂了', 'exception', 'traceback', 'error', 'crash', 'broke'], pose: 'drag', fx: 'sparkle' },
	{ id: 'yay', words: ['成了', '成功', '过了', '跑通了', 'it works', 'works now', 'passing', 'success'], pose: 'joy', fx: 'star' },
	{ id: 'why', words: ['为什么', '为啥', '怎么会', 'why', 'how come'], pose: 'think', fx: 'note' },
	{ id: 'morning', words: ['早上好', '早安', 'morning', 'good morning'], pose: 'welcome', fx: 'star' },
	{ id: 'night', words: ['晚安', '睡了', '去睡', 'good night', 'goodnight', 'sleep well'], pose: 'sleep', fx: 'note' },
	{ id: 'laugh', words: ['哈哈', '笑死', 'haha', 'lol', 'lmao', '😂', '🤣'], pose: 'joy', fx: 'note' },
	{ id: 'pat', words: ['摸摸', '抱抱', '贴贴', 'headpat', 'hug', 'pat pat'], pose: 'welcome', fx: 'heart' },
	{ id: 'overtime', words: ['加班', '熬夜', '通宵', 'overtime', 'all nighter', 'late night'], pose: 'think', fx: 'note' }
];

var DWM_TOPIC_RULES = [
	{ topic: 'debug', words: ['报错', '错误', '异常', '堆栈', '失败', 'error', 'exception', 'traceback', 'crash', 'bug', 'fail'] },
	{ topic: 'test', words: ['测试', '用例', '断言', 'test', 'spec', 'assert', 'coverage'] },
	{ topic: 'deploy', words: ['部署', '发布', '上线', '构建', '打包', 'deploy', 'release', 'publish', 'build', 'ci'] },
	{ topic: 'design', words: ['样式', '配色', '布局', '设计', '界面', 'css', 'style', 'design', 'layout', 'color', 'theme'] },
	{ topic: 'docs', words: ['文档', '注释', '说明', 'readme', 'doc', 'comment', 'changelog'] },
	{ topic: 'code', words: ['代码', '函数', '类', '重构', '实现', '接口', 'code', 'function', 'class', 'refactor', 'implement', 'api'] },
	{ topic: 'food', words: ['吃', '饭', '饿', '咖啡', '奶茶', 'food', 'eat', 'hungry', 'coffee', 'tea'] },
	{ topic: 'tired', words: ['累', '困', '疲惫', '休息', 'tired', 'sleepy', 'exhausted', 'rest'] },
	{ topic: 'laugh', words: ['哈哈', '笑', 'haha', 'lol', 'lmao'] },
	{ topic: 'night', words: ['晚安', '睡了', 'good night', 'goodnight'] },
	{ topic: 'morning', words: ['早上好', '早安', 'morning'] },
	{ topic: 'thanks', words: ['谢谢', '感谢', '辛苦', 'thank', 'thanks'] },
	{ topic: 'question', words: ['怎么', '如何', '为什么', '什么', '吗', 'how', 'what', 'why', 'should i'] }
];

function dwmLower(text) {
	return String(text || '').toLowerCase();
}

/** First keyword reaction that matches, or null. */
function dwmMatchKeyword(text) {
	var haystack = dwmLower(text);
	if (haystack === '') return null;
	for (var i = 0; i < DWM_KEYWORDS.length; i++) {
		var entry = DWM_KEYWORDS[i];
		for (var w = 0; w < entry.words.length; w++) {
			if (haystack.indexOf(dwmLower(entry.words[w])) !== -1) return entry;
		}
	}
	return null;
}

/** Coarse topic of a message, used to pick small talk. */
function dwmClassifyTopic(text) {
	var haystack = dwmLower(text);
	if (haystack === '') return 'general';
	for (var i = 0; i < DWM_TOPIC_RULES.length; i++) {
		var rule = DWM_TOPIC_RULES[i];
		for (var w = 0; w < rule.words.length; w++) {
			if (haystack.indexOf(dwmLower(rule.words[w])) !== -1) return rule.topic;
		}
	}
	return 'general';
}
