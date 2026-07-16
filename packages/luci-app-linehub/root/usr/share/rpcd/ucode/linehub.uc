/*
 * Stage 1 rpcd ucode module. It exposes no UCI data and never returns PPPoE
 * credentials. Runtime counters are intentionally simulated until linehubd
 * owns validated configuration and live state.
 */
return {
	status: {
		call: function(request) {
			return {
				version: '0.1.0-stage1',
				configuration_state: 'offline-validation-only',
				wan_total: 0,
				wan_online: 0,
				ipv4_available: 0,
				ipv6_available: 0
			};
		}
	}
};
