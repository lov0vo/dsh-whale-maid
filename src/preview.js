/*
 * dsh-whale-maid — preview gallery (2.0.0).
 *
 * Twelve animation states plus every portrait that shipped in POSES, as a
 * clickable grid, so the whole art set can be inspected without waiting for
 * the scene that happens to use it.
 */

var DWM_PREVIEW_STATES = [
	['idle', '待机'], ['joy', '开心'], ['eat', '吃东西'], ['play', '玩耍'],
	['welcome', '欢迎'], ['drag', '被拖'], ['think', '思考'], ['work', '工作'],
	['sad', '沮丧'], ['sleep', '睡觉'], ['wake', '醒来'], ['walk', '走路'],
	['wink', '眨眼'],
];

var DWM_PREVIEW_POSE_LABELS = {
	waiting: '期待', curious: '好奇', teasing: '逗你', afk: '发呆', blush: '害羞',
	angry: '生气', star: '星星', night: '深夜', wink: '眨眼', bold: '自信',
	abstract: '漂浮', sweep: '扫地', workSlack: '摸鱼', workRam: '狂敲键盘',
	coolShades: '墨镜', balanceLow: '站不稳', workPat: '被摸头',
	success: '成功', celebrate: '庆祝',
};

function dwmPreviewPlayState(name) {
	dwmForceState(name, 3000);
}

function dwmPreviewPlayPose(name) {
	var image = dwmPoseImage(name);
	if (!image) {
		dwmSpeak('这张姿势图还没进包：' + name, 'error', 'important');
		return;
	}
	dwmPortraitShow({ context: name, pose: name, image: image, state: null }, 4000, true);
	dwmSpeak(DWM_PREVIEW_POSE_LABELS[name] || name, 'normal', 'important');
}

function dwmPreviewCell(label, sub, onPick) {
	return h(
		'button',
		{
			key: 'cell-' + label + '-' + sub,
			type: 'button',
			className: 'dwm-preview-cell',
			onClick: onPick,
			title: label + ' / ' + sub,
			style: {
				display: 'inline-flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: '2px',
				minWidth: '64px',
				padding: '6px 8px',
				cursor: 'pointer',
				borderRadius: '8px',
				border: '1px solid var(--dsw-alias-border-l2, #e2e4ea)',
				background: 'var(--dsw-alias-bg-layer-2, #fff)',
				color: 'var(--dsw-alias-label-primary, #1c1f26)',
				font: 'inherit',
			},
		},
		h('span', { style: { fontSize: '13px' } }, label),
		h('span', { style: { fontSize: '11px', opacity: 0.6 } }, sub),
	);
}

function PosePreviewPanel() {
	var poses = typeof dwmPoseList === 'function' ? dwmPoseList() : [];
	var stateCells = DWM_PREVIEW_STATES.map(function (pair) {
		return dwmPreviewCell(pair[1], pair[0], function () { dwmPreviewPlayState(pair[0]); });
	});
	var poseCells = poses.map(function (name) {
		return dwmPreviewCell(DWM_PREVIEW_POSE_LABELS[name] || name, name, function () { dwmPreviewPlayPose(name); });
	});
	return h(
		'div',
		{ className: 'dwm-settings-group' },
		h('h3', { style: { margin: '0 0 4px', fontSize: '14px' } }, '动作与姿势预览'),
		h('p', { style: { margin: '0 0 8px', fontSize: '12px', opacity: 0.65 } }, '点一下就在桌面上播一次，持续 3–4 秒。'),
		h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' } }, stateCells),
		h('div', { style: { fontSize: '12px', opacity: 0.65, margin: '0 0 6px' } }, '姿势立绘（' + poses.length + ' 张）'),
		h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, poseCells),
	);
}
