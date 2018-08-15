var ws, attemps, conn = window.location.search.replace('?', '').split(':');

var server = {};
var players = {};

/*server*/
var count_t = qSelAll('.table-t tr th.left data');
var count_ct = qSelAll('.table-ct tr th.left data');

var score_t = qSel('.table-t tr th.score data');
var score_ct = qSel('.table-ct tr th.score data');

var latency_t = qSel('.table-t tr th.latency');
var latency_ct = qSel('.table-ct tr th.latency');

var hostname = qSel('.table-default tr th.left');

/*players*/
var table_t = qSel('.table-t');
var players_t = qSel('.table-t tfoot');

var table_ct = qSel('.table-ct');
var players_ct = qSel('.table-ct tfoot');

var table_sp = qSelAll('.table-default')[1];
var players_sp = qSel('tfoot.table-sp');

/**/
if(conn.length == 2) {
	conn[1] = 65535 - parseInt(conn[1]);

	init();
}

function init() {
	ws = new WebSocket('ws://' + conn[0] + ':' + conn[1]);

	ws.onclose = function(e) {
		if(attemps++ == 10) {
			players = {};
			return update();
		}

		setTimeout(init, 1000);
	};

	ws.onmessage = function(e) {
		attemps = 0;

		if(e.data == 'end') {
			return hostname.innerHTML = 'Changing map';
		}

		var d = e.data.substr(3).split(' '); /*d = data*/

		d = [d.shift(), d.shift(), d.shift(), d.shift(), d.shift(), d.shift(), d.shift(), d.join(' ')];

		if(e.data[0] == 's') {
			server = { t: parseInt(d[3]), ct: parseInt(d[4]), st: parseInt(d[5]), sct: parseInt(d[6]), hostname: d[7] };

			count_t[0].innerHTML = server.t;
			count_t[1].innerHTML = server.t == 1 ? '' : 's';
			count_ct[0].innerHTML = server.ct;
			count_ct[1].innerHTML = server.ct == 1 ? '' : 's';

			score_t.innerHTML = server.st;
			score_ct.innerHTML = server.sct;

			hostname.innerHTML = server.hostname;
		}
		else {
			if(d[1] == '-1') { /*disconnect -> remove*/
				players[d[0]] = false;
			}
			else { /*exists or not -> add/update*/
				players[d[0]] = { id: d[0], n: d[7], a: d[1] == '1', v: d[2] == '1', k: parseInt(d[3]), d: parseInt(d[4]), l: parseInt(d[5]), t: parseInt(d[6]) };
			}

			update();
		}
	};
}

function update() {
	var sorted = [], team = { 0: '', 1: '', 2: '' };

	for(let i in players) players[i] && sorted.push(players[i]);

	sorted.sort(function(a, b) {
		return b.k - a.k || a.d - b.d;
	});

	var latency = [0, 0];

	sorted.forEach(function(d, k) {
		if(d.t) {
			team[d.t] += '<tr><th class="name">' + d.n + '</th><th class="vipdead">' + (d.a ? (d.v ? 'VIP' : '') : 'DEAD') + '</th><th class="status"></th><th class="score">' + d.k + '</th><th class="deaths">' + d.d + '</th><th class="latency">' + (d.l ? d.l : '') + '</th></tr>';

			latency[d.t == 1 ? 0 : 1] += d.l;
		}
		else {
			team[d.t] = '<tr><th class="name">' + d.n + '</th></tr>';
		}
	});

	latency_t.innerHTML = latency[0] ? Math.round(latency[0] / server.t) : '';
	latency_ct.innerHTML = latency[1] ? Math.round(latency[1] / server.ct) : '';

	players_t.innerHTML = team[1];
	table_t.style.display = team[1] ? '' : 'none';

	players_ct.innerHTML = team[2];
	table_ct.style.display = team[2] ? '' : 'none';

	players_sp.innerHTML = team[0];
	table_sp.style.display = team[0] ? '' : 'none';
}

function qSel(arg) { return document.querySelector(arg); }
function qSelAll(arg) { return document.querySelectorAll(arg); }
