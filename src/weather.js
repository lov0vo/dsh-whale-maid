/*
 * dsh-whale-maid — weather companion (added in 1.3.0).
 *
 * Engineering half
 *   - one fetch on startup, then every 30 minutes, plus a cross-day refresh
 *     right after 00:05, plus a manual refresh from the settings panel;
 *   - Open-Meteo only (no key): geocoding-api.open-meteo.com turns a city name
 *     into lat/lon, api.open-meteo.com returns the current weather;
 *   - cache + offline degradation: a failed fetch keeps the previous record, and
 *     a record older than six hours is never spoken about again;
 *   - retry with exponential backoff: 1 minute, 5 minutes, 15 minutes, then stop
 *     (three attempts per cycle);
 *   - everything is a one-way GET. No account, no upload, nothing leaves the
 *     machine except the city name and the coordinates.
 *
 * Embodied half
 *   - weather -> pose (only poses that already exist; the dedicated art is
 *     deferred, see the README section "1.3.0 暂缓项");
 *   - weather -> lines (Chinese only, banks in lines-weather.js);
 *   - weather -> particles (rain / snow / sun dust reuse the FX layer);
 *   - rainy night wins over the plain rain bank;
 *   - a change of weather speaks up on its own.
 */

var KEY_WEATHER = 'dsh-whale-maid:weather';
var DWM_WEATHER_REFRESH_MS = 30 * 60 * 1000;
var DWM_WEATHER_STALE_MS = 6 * 60 * 60 * 1000;
var DWM_WEATHER_RETRY_MS = [60000, 300000, 900000];
var DWM_WEATHER_GEO_MS = 8000;
var DWM_WEATHER_DAY_TICK_MS = 60000;
var DWM_WEATHER_DEFAULT_CITY = '北京';

/* WMO weather code -> bucket. Only the buckets we speak about are listed. */
var DWM_WEATHER_BUCKETS = {
	0: 'clear',
	1: 'clear',
	2: 'cloudy',
	3: 'cloudy',
	45: 'fog',
	48: 'fog',
	51: 'rain',
	53: 'rain',
	55: 'rain',
	56: 'rain',
	57: 'rain',
	61: 'rain',
	63: 'rain',
	65: 'rain',
	66: 'rain',
	67: 'rain',
	71: 'snow',
	73: 'snow',
	75: 'snow',
	77: 'snow',
	80: 'rain',
	81: 'rain',
	82: 'rain',
	85: 'snow',
	86: 'snow',
	95: 'thunder',
	96: 'thunder',
	99: 'thunder',
};

/*
 * bucket -> presentation. `pose` only ever names a state that already exists in
 * the ANIM table: the four dedicated weather poses (umbrella, hunched, shivering,
 * sweating) need new art and are deferred.
 */
var DWM_WEATHER_PRESENTATION = {
	clear: { zh: '晴', en: 'clear', pose: 'joy', fx: 'sparkle', bank: 'weatherClear' },
	cloudy: { zh: '多云', en: 'cloudy', pose: 'think', fx: 'note', bank: 'weatherCloudy' },
	fog: { zh: '雾', en: 'fog', pose: 'think', fx: 'sparkle', bank: 'weatherFog' },
	rain: { zh: '雨', en: 'rain', pose: 'sad', fx: 'rain', bank: 'weatherRain' },
	snow: { zh: '雪', en: 'snow', pose: 'sad', fx: 'snow', bank: 'weatherSnow' },
	thunder: { zh: '雷', en: 'thunder', pose: 'sad', fx: 'rain', bank: 'weatherThunder' },
};

var DWM_WEATHER_STATE = {
	running: false,
	refreshTimer: null,
	dayTimer: null,
	retryTimer: null,
	attempts: 0,
	inflight: false,
	lastDayKey: '',
};

function dwmWeatherCity() {
	var options = readOptions();
	var city = typeof options.city === 'string' ? options.city.trim() : '';
	return city === '' ? DWM_WEATHER_DEFAULT_CITY : city;
}

function dwmWeatherRead() {
	var record = readJSON(KEY_WEATHER);
	if (!record || typeof record !== 'object') return null;
	if (!Number.isFinite(Number(record.at))) return null;
	return {
		at: Number(record.at),
		city: typeof record.city === 'string' ? record.city : '',
		lat: Number(record.lat),
		lon: Number(record.lon),
		code: Number(record.code),
		tempC: Number(record.tempC),
		isDay: record.isDay !== false,
		bucket: typeof record.bucket === 'string' ? record.bucket : 'cloudy',
		seenDate: typeof record.seenDate === 'string' ? record.seenDate : '',
	};
}

function dwmWeatherWrite(record) {
	if (!record) return;
	writeJSON(KEY_WEATHER, record);
}

function dwmWeatherBucketLabel(bucket, language) {
	var presentation = DWM_WEATHER_PRESENTATION[bucket];
	if (!presentation) return bucket;
	return language === 'en' ? presentation.en : presentation.zh;
}

function dwmWeatherHttp(url) {
	if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
	return fetch(url, { method: 'GET', headers: { accept: 'application/json' } }).then(function (response) {
		if (!response.ok) throw new Error('HTTP ' + response.status);
		return response.json();
	});
}

function dwmWeatherGeocode(city) {
	var url =
		'https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' +
		encodeURIComponent(city);
	return dwmWeatherHttp(url).then(function (data) {
		var hit = data && Array.isArray(data.results) ? data.results[0] : null;
		if (!hit) throw new Error('geocode miss');
		return { lat: Number(hit.latitude), lon: Number(hit.longitude), city: hit.name || city };
	});
}

/* Resolve a place: system geolocation first, the configured city as fallback. */
function dwmWeatherLocate() {
	var geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
	if (!geo || typeof geo.getCurrentPosition !== 'function') return Promise.reject(new Error('no geolocation'));
	return new Promise(function (resolve, reject) {
		var settled = false;
		var timer = setTimeout(function () {
			if (settled) return;
			settled = true;
			reject(new Error('geolocation timeout'));
		}, DWM_WEATHER_GEO_MS);
		geo.getCurrentPosition(
			function (position) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				resolve({ lat: position.coords.latitude, lon: position.coords.longitude, city: '' });
			},
			function () {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				reject(new Error('geolocation denied'));
			},
			{ timeout: DWM_WEATHER_GEO_MS, maximumAge: 10 * 60 * 1000 },
		);
	});
}

function dwmWeatherForecast(place) {
	var url =
		'https://api.open-meteo.com/v1/forecast?latitude=' +
		place.lat +
		'&longitude=' +
		place.lon +
		'&current=temperature_2m,weather_code,is_day&timezone=auto';
	return dwmWeatherHttp(url).then(function (data) {
		var current = data && data.current ? data.current : null;
		if (!current) throw new Error('no current weather');
		var code = Number(current.weather_code);
		var bucket = DWM_WEATHER_BUCKETS[code] || 'cloudy';
		return {
			at: dwmNow(),
			city: place.city || '',
			lat: place.lat,
			lon: place.lon,
			code: code,
			tempC: Number(current.temperature_2m),
			isDay: Number(current.is_day) === 1,
			bucket: bucket,
			seenDate: '',
		};
	});
}

/* Which bank answers for this record: a rainy night gets its own bank. */
function dwmWeatherBank(record) {
	var presentation = DWM_WEATHER_PRESENTATION[record.bucket];
	var bank = presentation ? presentation.bank : 'weatherCloudy';
	if (record.bucket === 'rain' && (!record.isDay || dwmIsLateNight())) bank = 'weatherRainyNight';
	return bank;
}

function dwmWeatherSpeak(record) {
	if (!record) return false;
	if (dwmNow() - record.at > DWM_WEATHER_STALE_MS) return false;
	var language = dwmUiLanguage();
	var line = dwmPickLine(dwmWeatherBank(record), language);
	if (!line) return false;
	return dwmSpeak(line, 'info');
}

/*
 * React to a fresh record. Speaks when the weather changed or when this bucket
 * has not been mentioned today yet; then nudges the pose and the particles.
 */
function dwmWeatherReact(record, previous) {
	if (!record) return;
	if (dwmNow() - record.at > DWM_WEATHER_STALE_MS) return;
	var changed = previous !== null && previous.bucket !== record.bucket;
	var mark = dwmDayKey(new Date()) + ':' + record.bucket;
	var firstToday = record.seenDate !== mark;
	if (changed || firstToday) {
		dwmWeatherSpeak(record);
		record.seenDate = mark;
		dwmWeatherWrite(record);
	}
	dwmWeatherApplyLook(record);
}

function dwmWeatherApplyLook(record) {
	var presentation = DWM_WEATHER_PRESENTATION[record.bucket];
	if (!presentation) return;
	var companion = dwmReadCompanion();
	if (companion.workLink === false) return;
	var phase = DWM_RUNTIME.work && DWM_RUNTIME.work.phase;
	if (phase && phase !== 'idle' && phase !== 'ready') return; // the work pose wins
	dwmForceState(presentation.pose, 2600);
	dwmFx(presentation.fx, 3);
}

function dwmWeatherScheduleRetry(reason) {
	if (DWM_WEATHER_STATE.attempts >= DWM_WEATHER_RETRY_MS.length) return;
	var delay = DWM_WEATHER_RETRY_MS[DWM_WEATHER_STATE.attempts];
	DWM_WEATHER_STATE.attempts += 1;
	if (DWM_WEATHER_STATE.retryTimer !== null) clearTimeout(DWM_WEATHER_STATE.retryTimer);
	DWM_WEATHER_STATE.retryTimer = setTimeout(function () {
		DWM_WEATHER_STATE.retryTimer = null;
		dwmWeatherRefresh(reason + ':retry');
	}, delay);
}

function dwmWeatherRefresh(reason) {
	if (DWM_WEATHER_STATE.inflight) return Promise.resolve(null);
	DWM_WEATHER_STATE.inflight = true;
	var city = dwmWeatherCity();
	return dwmWeatherLocate()
		.catch(function () {
			return dwmWeatherGeocode(city);
		})
		.then(dwmWeatherForecast)
		.then(function (record) {
			DWM_WEATHER_STATE.inflight = false;
			DWM_WEATHER_STATE.attempts = 0;
			if (DWM_WEATHER_STATE.retryTimer !== null) {
				clearTimeout(DWM_WEATHER_STATE.retryTimer);
				DWM_WEATHER_STATE.retryTimer = null;
			}
			var previous = dwmWeatherRead();
			dwmWeatherWrite(record);
			dwmWeatherReact(record, previous);
			return record;
		})
		.catch(function () {
			DWM_WEATHER_STATE.inflight = false;
			dwmWeatherScheduleRetry(reason || 'refresh');
			return null;
		});
}

function dwmWeatherDescribe(record, language) {
	if (!record) return language === 'en' ? 'No weather yet' : '还没有天气数据';
	var label = dwmWeatherBucketLabel(record.bucket, language);
	var city = record.city === '' ? (language === 'en' ? 'my location' : '当前位置') : record.city;
	var temp = Number.isFinite(record.tempC) ? Math.round(record.tempC) + '°C' : '';
	return city + ' · ' + label + (temp === '' ? '' : ' · ' + temp);
}

function dwmWeatherStart() {
	if (DWM_WEATHER_STATE.running) return dwmWeatherStop;
	DWM_WEATHER_STATE.running = true;
	DWM_WEATHER_STATE.lastDayKey = dwmDayKey(new Date());
	dwmWeatherRefresh('startup');
	DWM_WEATHER_STATE.refreshTimer = setInterval(function () {
		dwmWeatherRefresh('interval');
	}, DWM_WEATHER_REFRESH_MS);
	DWM_WEATHER_STATE.dayTimer = setInterval(function () {
		var today = dwmDayKey(new Date());
		if (today === DWM_WEATHER_STATE.lastDayKey) return;
		DWM_WEATHER_STATE.lastDayKey = today;
		dwmWeatherRefresh('cross-day');
	}, DWM_WEATHER_DAY_TICK_MS);
	function onVisible() {
		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
		var record = dwmWeatherRead();
		if (record !== null && dwmNow() - record.at < DWM_WEATHER_REFRESH_MS) return;
		dwmWeatherRefresh('visible');
	}
	if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
	return function () {
		if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
		dwmWeatherStop();
	};
}

function dwmWeatherStop() {
	DWM_WEATHER_STATE.running = false;
	if (DWM_WEATHER_STATE.refreshTimer !== null) clearInterval(DWM_WEATHER_STATE.refreshTimer);
	if (DWM_WEATHER_STATE.dayTimer !== null) clearInterval(DWM_WEATHER_STATE.dayTimer);
	if (DWM_WEATHER_STATE.retryTimer !== null) clearTimeout(DWM_WEATHER_STATE.retryTimer);
	DWM_WEATHER_STATE.refreshTimer = null;
	DWM_WEATHER_STATE.dayTimer = null;
	DWM_WEATHER_STATE.retryTimer = null;
	DWM_WEATHER_STATE.inflight = false;
	DWM_WEATHER_STATE.attempts = 0;
}

function dwmWeatherForget() {
	try {
		window.localStorage.removeItem(KEY_WEATHER);
	} catch (error) {
		/* ignore */
	}
}
