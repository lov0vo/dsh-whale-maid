/*
 * dsh-whale-maid — city picker (2.2.0).
 *
 * Self-contained so it does not depend on the companion panel internals: a
 * status line, a search box and a candidate list. Picking a candidate writes
 * the city, refreshes the weather and confirms with a bubble.
 */

function dwmCityStatusText() {
	var record = typeof dwmWeatherRead === "function" ? dwmWeatherRead() : null;
	if (!record || !record.city) return "还没有天气数据，先选一个城市。";
	var parts = [record.city];
	if (typeof record.tempC === "number") parts.push(Math.round(record.tempC) + "°C");
	if (record.precision === "coordinates") parts.push("（仅坐标）");
	else if (record.precision === "city") parts.push("（市级）");
	return parts.join(" · ");
}

function WeatherCityPicker() {
	var queryState = useState("");
	var query = queryState[0];
	var setQuery = queryState[1];
	var listState = useState([]);
	var candidates = listState[0];
	var setCandidates = listState[1];
	var noteState = useState("");
	var note = noteState[0];
	var setNote = noteState[1];

	function search() {
		var text = typeof query === "string" ? query.trim() : "";
		if (text === "") { setCandidates([]); setNote("请输入城市名，例如「杭州」或「朝阳区」。"); return; }
		setNote("查询中…");
		if (typeof dwmWeatherCandidates !== "function") { setNote("当前版本不支持候选查询。"); return; }
		dwmWeatherCandidates(text).then(function (rows) {
			setCandidates(rows);
			setNote(rows.length === 0 ? "没找到匹配的城市，试试加省份，例如「浙江 杭州」。" : "点一个候选项即可生效。");
		});
	}

	function pick(candidate) {
		var next = normalizeOptions(Object.assign({}, readOptions(), { city: candidate.label }));
		writeJSON(KEY_OPTIONS, next);
		if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
		if (typeof dwmWeatherRefresh === "function") dwmWeatherRefresh();
		setCandidates([]);
		setNote("已切换到 " + candidate.label);
		dwmSpeak("已切换到 " + candidate.label, "important");
	}

	var rows = candidates.map(function (candidate) {
		return h("button", {
			key: "cand-" + candidate.label + candidate.lat,
			type: "button",
			onClick: function () { pick(candidate); },
			style: {
				display: "block", width: "100%", textAlign: "left", margin: "0 0 4px",
				padding: "6px 10px", cursor: "pointer", font: "inherit", borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2, #e2e4ea)",
				background: "var(--dsw-alias-bg-layer-2, #fff)",
				color: "var(--dsw-alias-label-primary, #1c1f26)",
			},
		}, candidate.label);
	});

	return h("div", { className: "dwm-settings-group" },
		h("p", { style: { margin: "0 0 6px", fontSize: "12px", opacity: 0.7 } }, dwmCityStatusText()),
		h("div", { style: { display: "flex", gap: "6px", marginBottom: "6px" } },
			h("input", {
				type: "text",
				value: query,
				onChange: function (event) { setQuery(event && event.target ? event.target.value : ""); },
				onKeyDown: function (event) { if (event && event.key === "Enter") search(); },
				placeholder: "城市不对？输入城市名回车，从候选里选",
				style: {
					flex: "1 1 auto", padding: "6px 10px", font: "inherit", borderRadius: "8px",
					border: "1px solid var(--dsw-alias-border-l2, #e2e4ea)",
					background: "var(--dsw-alias-bg-layer-1, #fff)",
					color: "var(--dsw-alias-label-primary, #1c1f26)",
				},
			}),
			h("button", { type: "button", onClick: search, style: { padding: "6px 12px", cursor: "pointer", font: "inherit", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2, #e2e4ea)", background: "var(--dsw-alias-bg-layer-2, #fff)", color: "var(--dsw-alias-label-primary, #1c1f26)" } }, "查询"),
		),
		note === "" ? null : h("p", { style: { margin: "0 0 6px", fontSize: "12px", opacity: 0.7 } }, note),
		rows,
	);
}
