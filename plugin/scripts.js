
const config = {
	token: '',
	base: 'https://api.github.com',
	maxPage: 3,
	owner: 'stokmedia',
	deploybotToken: '',
	deploybotBaseURL: 'https://stokmedia.deploybot.com/api/v1',
	deploybotPublicURL: 'https://stokmedia.deploybot.com'
};

const refreshWorkflows = () => {
	const currentRepo = document.getElementById( 'js-repos' ).value;

	chrome.storage.local.set( { 'current_repo': currentRepo }, function () {
		chrome.runtime.sendMessage( { config: config, event: 'getWorkflows', currentRepo: currentRepo } )
			.then( response => {
				renderWorkflows( response );
			} );
	} );
};

const renderWorkflows = ( workflows ) => {
	document.getElementById( 'js-workflows' ).innerHTML = workflows.map( workflow => {
		let html = '<li><h3>' + workflow.name + '</h3>';

		if ( workflow.lastRun ) {
			const timestamp = workflow.lastRun.timestamp ? moment( workflow.lastRun.timestamp ).fromNow() : '(date not available)';

			html += '<span>Branch: ' + workflow.lastRun.branch + '</span><br>' +
				'<span>Commit: ' + workflow.lastRun.commit + ' by ' + workflow.lastRun.author + '</span><br>' +
				'<span>Run by: ' + workflow.lastRun.actor +
				' ' + timestamp + '</span><br><br>' +
				'<a href="' + workflow.link + '" target="_blank">View</a>';
		} else {
			html += '<span>No workflow runs</span>'
		}

		html += '</li>';

		return html;
	} ).join( '' );
};

const renderRepoList = () => {
	chrome.storage.local.get( ['repos', 'current_repo'], function ( items ) {
		let repos = items.repos,
			currentRepo = items.current_repo;

		if ( !repos ) {
			return;
		}

		document.getElementById( 'js-repos' ).innerHTML = '<option value="" disabled selected>Select a repo</option>' + repos
			.map( repo => {
				return `<option ${currentRepo === repo.value ? 'selected' : ''} value="${repo.value}">${repo.name} (${repo.type})</option>`
			} )
			.join( '' );

		if ( currentRepo ) {
			refreshWorkflows( currentRepo );
		}
	} );
};

const checkSettings = () => {
	chrome.storage.local.get( ['github_token', 'deploybot_token', 'repos'], function ( items ) {
		document.getElementById( 'js-token' ).value = items.github_token && items.deploybot_token ? items.github_token + '|' + items.deploybot_token : '';
		config.token = items.github_token;
		config.deploybotToken = items.deploybot_token;
	} );
};

const saveSettings = () => {
	const token = document.getElementById( 'js-token' ).value;
	const tokenSplitted = token.split( '|' );

	config.token = tokenSplitted[0];
	config.deploybotToken = tokenSplitted[1];

	chrome.storage.local.set( { 'github_token': tokenSplitted[0], 'deploybot_token': tokenSplitted[1] }, function () {
		showMesage( 'Settings saved!' );
	} );
};

const refreshRepoCache = () => {
	chrome.runtime.sendMessage( { config: config, event: 'refreshRepoCache' } )
		.then( response => {
			chrome.storage.local.set( { repos: response }, () => {
				showMesage( 'Repo cache updated!' )
			} );
		} );
};

const showMesage = ( message ) => {
	document.getElementById( 'js-message' ).innerText = message;
};

window.onload = () => {
	checkSettings();
	renderRepoList();

	document.getElementById( 'js-refresh-repos' ).addEventListener( 'click', refreshRepoCache );
	document.getElementById( 'js-repos' ).addEventListener( 'change', refreshWorkflows );
	document.getElementById( 'js-save-settings' ).addEventListener( 'click', saveSettings );
}