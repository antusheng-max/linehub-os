'use strict';
'require rpc';
'require view';

var callOverview = rpc.declare({
	object: 'linehub',
	method: 'overview',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return L.resolveDefault(callOverview(), {
			valid: false,
			counts: {},
			errors: [{
				code: 'linehub.backend.unavailable',
				section: '-',
				option: '-',
				message: _('The LineHub validation backend is unavailable.')
			}]
		});
	},

	render: function(data) {
		var counts = data.counts || {};
		var errors = data.errors || [];
		var summaryRows = [
			[_('Devices'), counts.device || 0],
			[_('VLANs'), counts.vlan || 0],
			[_('PPPoE sessions'), counts.pppoe || 0],
			[_('Line pools'), counts.pool || 0],
			[_('Policies'), counts.policy || 0]
		];
		var errorRows = errors.map(function(error) {
			return [
				error.code || '-',
				error.section || '-',
				error.option || '-',
				error.message || '-'
			];
		});

		return E([], [
			E('h2', {}, _('LineHub OS')),
			E('p', {}, _(
				'This page performs read-only validation of the declarative LineHub UCI configuration. It never applies network changes.'
			)),
			E('div', { 'class': data.valid ? 'alert-message success' : 'alert-message warning' },
				data.valid
					? _('The current LineHub configuration passed offline schema validation.')
					: _('The current LineHub configuration has validation errors. No network changes were attempted.')),
			E('h3', {}, _('Configuration summary')),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Section type')),
					E('th', { 'class': 'th' }, _('Count'))
				])
			].concat(summaryRows.map(function(row) {
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, row[0]),
					E('td', { 'class': 'td' }, String(row[1]))
				]);
			}))),
			E('h3', {}, _('Validation results')),
			errorRows.length
				? E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Rule')),
						E('th', { 'class': 'th' }, _('Section')),
						E('th', { 'class': 'th' }, _('Option')),
						E('th', { 'class': 'th' }, _('Message'))
					])
				].concat(errorRows.map(function(row) {
					return E('tr', { 'class': 'tr' }, row.map(function(cell) {
						return E('td', { 'class': 'td' }, cell);
					}));
				})))
				: E('p', {}, _('No validation errors.'))
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
