let config = null;

const getWorkflows = ( repo ) => {
	const [name, id, type, title] = repo.split( '|' ),
		githubEndpoint = config.base + `/repos/${config.owner}/${name}/actions/workflows`,
		allFetch = [];

	switch ( type ) {
		case 'deploybot':
		case 'deploybot/github':
			allFetch.push( fetch( config.deploybotBaseURL + `/environments?repository_id=${id}`, getHeaders( true ) )
				.then( response => response.text() )
				.then( response => JSON.parse( response.replaceAll( 'entries', 'workflows' ) ).workflows )
				.then( workflows => {
					return workflows.length > 0 ? workflows
						.map( workflow => {
							const titleModified = title.replaceAll( ' ', '-' ),
								workflowNameModified = workflow.name.replaceAll( ' ', '-' ),
								link = config.deploybotPublicURL + `/${id}-${titleModified}/environments/${workflow.id}-${workflowNameModified}/edit`;

							return getWorkflowRuns( config.owner, id, workflow.id, true )
								.then( data => {
									return {
										id: workflow.id,
										link: link,
										name: workflow.name,
										host: 'Deploybot',
										lastRun: data.length > 0 ? {
											branch: workflow.branch_name,
											commit: data[0].comment ?? '(no commit message)',
											author: data[0].author_name,
											actor: data[0].author_name,
											timestamp: data[0].deployed_at ? new Date( data[0].deployed_at ) : (
												data[0].created_at ? new Date( data[0].created_at ) : null
											)
										} : null
									}
								} );
						} ) : []
				} )
				.then( response => Promise.all( response ) )
			);
		case 'github':
			allFetch.push( fetch( githubEndpoint, getHeaders() )
				.then( response => response.json() )
				.then( data => {
					return data.workflows.length > 0 ? data.workflows
						.map( workflow => {
							const link = workflow.html_url.replace( 'blob/master/.github', 'actions' );

							return getWorkflowRuns( config.owner, name, workflow.id )
								.then( data => {
									return {
										id: workflow.id,
										link: link,
										name: workflow.name,
										host: 'Github',
										lastRun: 'workflow_runs' in data && data.workflow_runs.length > 0 ? {
											branch: data.workflow_runs[0].head_branch,
											commit: data.workflow_runs[0].head_commit.message ?? '(no commit message)',
											author: data.workflow_runs[0].head_commit.author.name,
											actor: data.workflow_runs[0].actor.login,
											timestamp: data.workflow_runs[0].run_started_at ? new Date( data.workflow_runs[0].run_started_at ) : null
										} : null
									}
								} );
						} ) : []
				} )
				.then( response => Promise.all( response ) )
			);
	}

	return Promise.all( allFetch ).then( data => {
		let repos = [];

		data.forEach( repoArray => {
			repos = [...repoArray, ...repos];
		} );

		repos.sort((a, b) => {
			if(a.lastRun && b.lastRun) {
				return b.lastRun.timestamp - a.lastRun.timestamp;
			}
			
			if(a.lastRun && !b.lastRun) {
				return 1;
			}

			return -1;
		});

		return repos;
	} );
};

const getWorkflowRuns = ( owner, repo, workflow, isDeploybot ) => {
	if ( isDeploybot ) {
		return fetch( config.deploybotBaseURL + `/deployments?repository_id=${repo}&environment_id=${workflow}&limit=1`, getHeaders( true ) )
			.then( response => response.text() )
			.then( response => JSON.parse( response.replaceAll( 'entries', 'workflow_runs' ) ).workflow_runs )
	}

	return fetch( config.base + `/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=1&page=1&status=completed`, getHeaders() )
		.then( data => data.json() )
};

const getHeaders = ( isDeploybot ) => {
	if ( isDeploybot ) {
		return {
			'headers': {
				'X-Api-Token': config.deploybotToken,
			}
		}
	}

	return {
		'headers': {
			'Authorization': `token ${config.token}`
		}
	}
};

const getRepositories = ( page, isDeploybot ) => {
	if ( isDeploybot ) {
		/**
		 * Rename entries property to repos because it's a JS function
		 */
		return fetch( config.deploybotBaseURL + '/repositories', getHeaders( true ) )
			.then( response => response.text() )
			.then( response => JSON.parse( response.replaceAll( 'entries', 'repos' ) ).repos )
			.then( response => response.map( repo => {
				return {
					name: repo.name,
					type: 'deploybot',
					id: repo.id,
					title: repo.title
				};
			} ) );
	}

	/**
	 * Get only repos from stokmedia
	 */
	return fetch( config.base + `/user/repos?per_page=100&page=${page}&visibility=private`, getHeaders() )
		.then( response => response.json() )
		.then( response => response.filter( repo => repo.owner.login === config.owner ) )
		.then( response => response.map( repo => {
			return {
				name: repo.name,
				type: 'github',
				id: repo.id,
				title: ''
			};
		} ) );
};

const refreshRepoCache = () => {
	let repos = [];
	const allFetch = [];

	for ( let i = 1; i <= config.maxPage; i++ ) {
		allFetch.push( getRepositories( i ) );
	}

	allFetch.push( getRepositories( 1, true ) );

	return Promise.all( allFetch )
		.then( data => {
			data.forEach( repoArray => {
				repos = [...repoArray, ...repos];
			} );

			repos.sort( ( a, b ) => {
				if ( a.name < b.name ) {
					return -1;
				}
				if ( a.name > b.name ) {
					return 1;
				}
				return 0;
			} );

			/**
			 * Combine repos with the same name
			 */
			const combinedRepos = repos.reduce( ( acc, value ) => {
				if ( value.name in acc ) {
					acc[value.name].type = acc[value.name].type + '/' + value.type
					acc[value.name].id = value.type === 'deploybot' ? value.id : acc[value.name].id;
					acc[value.name].title = value.title ? value.title : acc[value.name].title;
				} else {
					acc[value.name] = { type: value.type, id: value.id, title: value.title };
				}

				acc[value.name].name = value.name;
				acc[value.name].value = value.name + '|' + acc[value.name].id + '|' + acc[value.name].type + '|' + acc[value.name].title;

				return acc;
			}, {} );

			return Object.values( combinedRepos );
		} ).catch( err =>
			console.log( err )
		);
};

chrome.runtime.onMessage.addListener( function ( request, sender, callback ) {
	config = request.config;

	switch ( request.event ) {
		case 'refreshRepoCache':
			refreshRepoCache().then( data => callback( data ) );

			break;

		case 'getWorkflows':
			getWorkflows( request.currentRepo ).then( data => callback( data ) );

			break;
	}

	return true;
} );