#include <amxmodx>
#include <amxmisc>

#include fakemeta
#include cstrike

#include sockets_async
#include live_scoreboard

new SOCKET:listen, Array:users;

enum _:enum_socket {
	SOCKET:shandle
}

new prev[33][140];
new scores[2];

new saytext;

public plugin_init() {
	register_plugin("Live Scoreboard", "1.0.0", "LuKks");

	listen = socket_create(SOCK_TYPE_TCP, 2);
	
	if(!listen) {
		log_to_file("live_scoreboard.log", "[err] failed to create socket");
		return;
	}

	new port[64];
	get_user_ip(0, port, charsmax(port));
	strtok(port, port, charsmax(port), port, charsmax(port), ':');

	if(socket_bind(listen, "", 65535 - str_to_num(port)) == 0) {
		log_to_file("live_scoreboard.log", "[err] failed to bind");
		return;
	}

	users = ArrayCreate();

	saytext = get_user_msgid("SayText");

	register_forward(FM_ClientDisconnect, "event_disconnect"); // client_disconnect() deprecated and client_disconnected() don't detect bot disconnect :/
	register_event("TeamScore", "event_teamscore", "a");
	register_clcmd("say", "clcmd_say");

	set_task(1.0, "loop", 0, _, _, "b");
}

public plugin_end() {
	socket_all("end");
}

public loop() {
	static data[140];
	static i, ids[32], max;
	static name[64], team, ping, loss, team_count[3];

	//players
	get_players(ids, max, "h"); //poor htlv (later I'll support it)

	for(i = 0; i < max; i++) {
		get_user_name(ids[i], name, 32);
		team = get_user_team(ids[i]);
		get_user_ping(ids[i], ping, loss);

		team == 3 && (team = 0);

		formatex(data, charsmax(data), "p: %d %d %d %d %d %d %d %d %s", ids[i], is_user_alive(ids[i]), cs_get_user_vip(ids[i]), user_has_weapon(ids[i], CSW_C4), get_user_frags(ids[i]), get_user_deaths(ids[i]), ping, team, name);
		
		if(!equal(data, prev[ids[i]])) {
			copy(prev[ids[i]], charsmax(prev[]), data);
			socket_all(data);
		}

		team_count[team]++; //server
	}

	//server
	get_cvar_string("hostname", name, charsmax(name));

	formatex(data, charsmax(data), "s: %d %d %d %d %s", team_count[1], team_count[2], scores[0], scores[1], name);
	
	if(!equal(data, prev[0])) {
		copy(prev[0], charsmax(prev[]), data);
		socket_all(data);
	}

	team_count = { 0, 0, 0 };
}

public event_teamscore() {
	new team[2];
	read_data(1, team, 1);

	scores[team[0] == 'C'] = read_data(2);
}

public event_disconnect(id) {
	if(get_timeleft()) {
		formatex(prev[id], charsmax(prev[]), "p: %d -1", id);
		socket_all(prev[id]);
		copy(prev[id], charsmax(prev[]), "^0");
	}
}

public clcmd_say(id) {
	static msg[192];

	read_args(msg, charsmax(msg));
	remove_quotes(msg);
	trim(msg);
	
	if(msg[0]) {
		format(msg, charsmax(msg), "say: %d %s", id, msg);
		socket_all(msg);
	}

	return PLUGIN_CONTINUE;
}

public socket_all(data[]) {
	for(new i = ArraySize(users) - 1; i >= 0; i--) {
		socket_mask(SOCKET:ArrayGetCell(users, i), data);
	}
}

public fw_sockAccepted(SOCKET:socket, custom_id, SOCKET:client, const ip[], port) {
	/*
	//want limit the max connections? new count_users: Accepted++ and Closed--
	if(count_users > 15000) {
		socket_close(client);
		return;
	}*/

	//there is not a timeout to handshake and maybe add a limitation per ip on array (max 5 conc)
}

public fw_sockClosed(SOCKET:socket, custom_id, error) {
	for(new i = ArraySize(users) - 1; i >= 0; i--) {
		if(SOCKET:ArrayGetCell(users, i) == socket) {
			ArrayDeleteItem(users, i);
		}
	}
}

public fw_sockReadable(SOCKET:socket, custom_id) {
	new data[2048], len;

	len = socket_recv(socket, data, charsmax(data));
	
	if(len < 1) {
		socket_close(socket); //len == -1 ? "recv error" : "recv no data"
		return;
	}

	//search socket
	new index = -1;

	for(new i = ArraySize(users) - 1; i >= 0; i--) {
		if(SOCKET:ArrayGetCell(users, i) == socket) {
			index = i;
			break;
		}
	}

	//if the socket is not initialized
	if(index == -1) {
		//handshake
		new handshake[128];
		new error = socket_handshake(data, handshake, charsmax(handshake));

		if(error) { // == 1 ? "key not found" : "key incorrect size"
			socket_close(socket);
			return;
		}

		socket_send(socket, handshake);

		//add socket to loop list
		ArrayPushCell(users, socket);

		//send instantly on connect
		for(new i = 0; i < 33; i++) {
			strlen(prev[i]) && socket_mask(socket, prev[i]);
		}

		return;
	}

	//socket already connected so is sending data
	socket_unmask(data);

	trim(data);

	if(!data[0]) {
		return;
	}

	//search for one valid char because for some reason when close the tab the browser send some strange chars
	len = strlen(data);

	for(new i = 0; i < len; i++) {
		if(data[i] > 31 && data[i] < 127) {
			replace_all(data, len, "^1", "");
			replace_all(data, len, "^3", "");
			replace_all(data, len, "^4", "");

			print(0, 33, "^3[Live Web] : ^1%s", data);

			format(data, charsmax(data), "say: -1 %s", data);
			socket_all(data);
			break;
		}
	}
}

//
stock socket_handshake(headers[], out[], size) {
	new start = containi(headers, "Sec-WebSocket-Key: ");

	if(start < 0)	return 1;

	new key[61];

	for(new i = start + 19, c, len = strlen(headers); i < len; i++) {
		if(c > 60) return 2;

		if(headers[i] == 13 && i + 1 < len && headers[i + 1] == 10) { //\r && \n
			break;
		}

		key[c++] = headers[i];
	}

	add(key, 60, "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", 36);

	if(strlen(key) != 60) return 2;

	new hash[40];
	SHA1_Data(key, 60, hash);

	BASE64_Encode(hash, 20, key, 60);

	formatex(out, size, "HTTP/1.1 101 Switching Protocols^r^nConnection:Upgrade^r^nSec-WebSocket-Accept: %s^r^nUpgrade:websocket^r^n^r^n", key);
	return 0;
}

stock socket_mask(SOCKET:socket, data[]) {
	static bytes[2048], offset = 0;

	new len = strlen(data);
	bytes[0] = 129;

	if(len < 126) {
		bytes[1] = len;
		offset = 2;
	}
	else if(len < 65536) {
		bytes[1] = 126;
		bytes[2] = len >> 8 & 255;
		bytes[3] = len & 255;
		offset = 4;
	}
	else {
		bytes[1] = 127;
		bytes[2] = len >> 56 & 255;
		bytes[3] = len >> 48 & 255;
		bytes[4] = len >> 40 & 255;
		bytes[5] = len >> 32 & 255;
		bytes[6] = len >> 24 & 255;
		bytes[7] = len >> 16 & 255;
		bytes[8] = len >> 8 & 255;
		bytes[9] = len & 255;
		offset = 10;
	}

	for(new i = 0; i < len; i++) {
		bytes[offset + i] = data[i];
	}

	socket_send(socket, bytes, offset + len);
}

stock socket_unmask(bytes[]) {
	static mask[4], i, offset;

	mask[0] = bytes[1] & 127; //len (actually is not part of mask, just reusing purpose)
	
	offset = 2;
	if(mask[0]/*len*/ == 126) offset = 4;
	else if(mask[0]/*len*/ == 127) offset = 10;
	
	for(i = 0; i < 4; i++) {
		mask[i] = bytes[offset + i];
	}

	offset += 4;
	for(i = 0; bytes[offset]; i++) {
		bytes[i] = bytes[offset++] ^ mask[i % 4];
	}
	
	bytes[i] = '^0';
}

stock print(id, color, message[], any:...) {
	static msg[256];
	vformat(msg, charsmax(msg), message, 4);
	
	message_begin(id ? MSG_ONE : MSG_ALL, saytext, { 0, 0, 0 }, id);
	write_byte(color ? color : 33);
	write_string(msg);
	message_end();
}
