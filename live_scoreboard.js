let ws, attemps, conn = window.location.search.replace('?', '').split(':');

let CMD_LEN = {
	's': 5,
	'p': 9,
	'say': 2
};

let server = {};
let players = {};
let messages = [];

//say
let clcmd_say = qSel('.clcmd_say');
let input_say = qSel('.clcmd_say input');
let say = qSel('.say');
let timeout_say = -1;

//server
let count_t = qSelAll('.table-t tr th.left data');
let count_ct = qSelAll('.table-ct tr th.left data');

let score_t = qSel('.table-t tr th.score data');
let score_ct = qSel('.table-ct tr th.score data');

let latency_t = qSel('.table-t tr th.latency');
let latency_ct = qSel('.table-ct tr th.latency');

let hostname = qSel('.table-default tr th.left');

//players
let table_t = qSel('.table-t');
let players_t = qSel('.table-t tfoot');

let table_ct = qSel('.table-ct');
let players_ct = qSel('.table-ct tfoot');

let table_sp = qSelAll('.table-default')[1];
let players_sp = qSel('tfoot.table-sp');

//
if(conn.length === 2) {
	conn[1] = 65535 - parseInt(conn[1]);

	init();
}

//detect key to open say and send
window.addEventListener('keypress', function(e) {
	//only check for open say if it's not open
	if(clcmd_say.style.display) {
		//is y?
		if(e.key === 'y' || e.which === 121 || e.charCode === 121) {
			console.log('open say');

			if(ws.readyState === 1) {
				clcmd_say.style.display = '';
				input_say.focus();
			}
		}
	}

	//only check enter when say is open
	if(!clcmd_say.style.display) {
		//is enter?
		if(e.key === 'Enter' || e.which === 13 || e.charCode === 13) {
			let value = input_say.value.trim();

			//socket open and there is value
			if(ws.readyState === 1 && value) {
				ws.send(value);

				/*messages.push({ id: false, text: value, expire: new Date().getTime() + 5000 });

				update_say();*/
			}

			clcmd_say.style.display = 'none';
			input_say.value = '';
		}
	}
});

function init() {
	ws = new WebSocket('ws://' + conn[0] + ':' + conn[1]);

	ws.onclose = function(e) {
		if(attemps++ === 10) {
			players = {};
			update_players();
		}

		setTimeout(init, 1000);
	};

	ws.onmessage = function(e) {
		//attemps = 0;

		if(e.data === 'end') {
			return hostname.innerHTML = 'Changing map';
		}

		let cmd = e.data.split(':')[0];

		//parse data, for example: 'p: 1 0 0 0 0 16 1 name with spaces'
		let d = e.data.substr(e.data.indexOf(':') + 2).split(' '); //[1, 0, 0, 0, 0, 16, 1, 'name', 'with', 'spaces']

		d = d.splice(0, CMD_LEN[cmd] - 1).concat(d.join(' ')) //[1, 0, 0, 0, 0, 16, 1, 'name with spaces']
	
		//data values to int except name (last one)
		for(let i = 0; i < d.length - 1; i++) {
			d[i] = parseInt(d[i]);
		}

		//check for server update
		if(cmd === 's') {
			server = { t: d[0], ct: d[1], score_t: d[2], score_ct: d[3], hostname: d[4] };
			update_server();
			return;
		}
		else if(cmd === 'p') {
			//was player so
			if(d[1] === -1) { //disconnect -> remove
				players[d[0]] = false;
			}
			else { //exists or not -> add/update
				players[d[0]] = {
					id: d[0],
					alive: d[1] === 1,
					vip: d[2] === 1,
					c4: d[3] === 1,
					score: d[4],
					deaths: d[5],
					latency: d[6],
					team: d[7],
					name: d[8]
				};
			}

			update_players();
		}
		else {
			let pl = players[d[0]];

			messages.push({ id: d[0], text: d[1], expire: new Date().getTime() + 5000, alive: pl ? pl.alive : false, team: pl ? pl.team : 0 });

			update_say();
		}
	};
}

function update_server() {
	count_t[0].innerHTML = server.t;
	count_t[1].innerHTML = server.t === 1 ? '' : 's';
	count_ct[0].innerHTML = server.ct;
	count_ct[1].innerHTML = server.ct === 1 ? '' : 's';

	score_t.innerHTML = server.score_t;
	score_ct.innerHTML = server.score_ct;

	hostname.innerHTML = server.hostname;
}

function update_players() {
	let sorted = [], team = ['', '', ''];

	for(let i in players) {
		players[i] && sorted.push(players[i]);
	}

	sorted.sort(function(a, b) {
		return b.score - a.score || a.deaths - b.deaths;
	});

	let latency = [0, 0];

	for(let i = 0; i < sorted.length; i++) {
		let d = sorted[i];

		//in team
		if(d.team) {
			team[d.team] += 
			'<tr>' +
				'<th class="name">' + encodeHTML(d.name) + '</th>' +
				'<th class="status">' + (d.alive ? (d.vip ? 'Vip' : (d.c4 ? 'Bomb' : '')) : 'Dead') + '</th>' +
				'<th class="action"></th>' +
				'<th class="score">' + d.score + '</th>' +
				'<th class="deaths">' + d.deaths + '</th>' +
				'<th class="latency">' + (d.latency ? d.latency : '') + '</th>' +
			'</tr>';

			latency[d.team === 1 ? 0 : 1] += d.latency;
		}
		//specs
		else {
			team[d.team] = '<tr><th class="name">' + encodeHTML(d.name) + '</th></tr>';
		}
	};

	latency_t.innerHTML = latency[0] ? Math.round(latency[0] / server.t) : '';
	latency_ct.innerHTML = latency[1] ? Math.round(latency[1] / server.ct) : '';

	players_t.innerHTML = team[1];
	table_t.style.display = team[1] ? '' : 'none';

	players_ct.innerHTML = team[2];
	table_ct.style.display = team[2] ? '' : 'none';

	players_sp.innerHTML = team[0];
	table_sp.style.display = team[0] ? '' : 'none';
}

function update_say() {
	let out = '';

	for(let i = 0; i < messages.length; i++) {
		//only 5 messages max and must be recents
		if(messages[i].id !== -1 && !players[messages[i].id] || messages.length > 5) {
			messages.splice(i--, 1);
			continue;
		}

		if(messages[i].expire < new Date().getTime()) {
			//only will remove one at time

			messages.splice(i--, 1);

			for(let i = 0; i < messages.length; i++) {
				messages[i].expire = new Date().getTime() + 5000;
			}
			
			continue;
		}

		let pl = players[messages[i].id];
		
		let extra = pl && !messages[i].alive ? (messages[i].team ? '*DEAD* ' : '*SPEC* ') : '';
		let team_color = pl && messages[i].team ? (messages[i].team === 1 ? 't' : 'ct') : 'sp';
		let name = pl ? pl.name : '[Live Web]';

		out += 
			'<div class="say-msg">' +
				extra +
				'<data class="' + team_color + '">' + encodeHTML(name) + '</data>' +
				' : ' + encodeHTML(messages[i].text) +
			'</div>';
	}

	say.innerHTML = out;

	//recall
	clearTimeout(timeout_say);
	timeout_say = setTimeout(update_say, 1000);
}

function qSel(arg) { return document.querySelector(arg); }
function qSelAll(arg) { return document.querySelectorAll(arg); }

function encodeHTML(str) {
	return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
		return '&#' + i.charCodeAt(0) + ';';
	});
}
