'use strict';
'require rpc';
'require view';

var callStatus = rpc.declare({
	object: 'linehub',
	method: 'status',
	expect: {}
});

function valueOrDash(value) {
	return value === undefined || value === null ? '-' : String(value);
}

return view.extend({
	load: function() {
		return callStatus();
	},

	render: function(status) {
		var rows = [
			[_('LineHub version'), valueOrDash(status.version)],
			[_('Configuration status'), valueOrDash(status.configuration_state)],
			[_('WAN lines'), valueOrDash(status.wan_total)],
			[_('Online lines'), valueOrDash(status.wan_online)],
			[_('IPv4 available lines'), valueOrDash(status.ipv4_available)],
			[_('IPv6 available lines'), valueOrDash(status.ipv6_available)]
		];

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [_('LineHub OS')]),
			E('p', {}, [_('Stage 1 shows simulated, credential-free status only.')]),
			E('div', { 'class': 'cbi-section' }, [
				E('table', { 'class': 'table' }, rows.map(function(row) {
					return E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', 'width': '33%' }, [row[0]]),
						E('td', { 'class': 'td left' }, [row[1]])
					]);
				}))
			])
		]);
	}
});
