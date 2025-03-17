let config = null;

const getWorkflows = (name) => {
	const githubEndpoint = config.base + `/repos/${config.owner}/${name}/actions/workflows`,
		allFetch = [];

	allFetch.push(fetch(githubEndpoint, getHeaders())
		.then(response => response.json())
		.then(data => {
			return data.workflows.length > 0 ? data.workflows
				.filter(workflow => workflow.name !== 'Deploy')
				.map(workflow => {
					const link = workflow.html_url.replace('blob/master/.github', 'actions');

					return getWorkflowRuns(config.owner, name, workflow.id)
						.then(data => {
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
									timestamp: data.workflow_runs[0].run_started_at ? new Date(data.workflow_runs[0].run_started_at) : null
								} : null
							}
						});
				}) : []
		})
		.then(response => Promise.all(response))
	);

	return Promise.all(allFetch).then(data => {
		let repos = [];

		data.forEach(repoArray => {
			repos = [...repoArray, ...repos];
		});

		repos.sort((a, b) => {
			if (a.lastRun && b.lastRun) {
				return b.lastRun.timestamp - a.lastRun.timestamp;
			}

			if (a.lastRun && !b.lastRun) {
				return 1;
			}

			return -1;
		});

		return repos;
	});
};

const getWorkflowRuns = (owner, repo, workflow) => {
	return fetch(config.base + `/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=1&page=1&status=completed`, getHeaders())
		.then(data => data.json())
};

const getHeaders = () => {
	return {
		'headers': {
			'Authorization': `token ${config.token}`
		}
	}
};

const getRepositories = (page) => {
	/**
	 * Get only repos from stokmedia
	 */
	return fetch(config.base + `/user/repos?per_page=100&page=${page}&visibility=private`, getHeaders())
		.then(response => response.json())
		.then(response => response.filter(repo => repo.owner.login === config.owner))
		.then(response => response.filter(repo => {
			/**
			 * Get only repos updated in the last 2 months
			 */
			const now = new Date();
			now.setMonth(now.getMonth() - 2);
			const timestamp = now.getTime();

			return Date.parse(repo.updated_at) >= timestamp;
		}))
		.then(response => response.map(repo => {
			return {
				name: repo.name
			};
		}));
};

const refreshRepoCache = () => {
	let repos = [];
	const allFetch = [];

	for (let i = 1; i <= config.maxPage; i++) {
		allFetch.push(getRepositories(i));
	}

	return Promise.all(allFetch)
		.then(data => {
			data.forEach(repoArray => {
				repos = [...repoArray, ...repos];
			});

			repos.sort((a, b) => {
				if (a.name < b.name) {
					return -1;
				}
				if (a.name > b.name) {
					return 1;
				}
				return 0;
			});

			/**
			 * Combine repos with the same name
			 */
			const combinedRepos = repos.reduce((acc, value) => {
				if (!(value.name in acc)) {
					acc[value.name] = value;
				}

				return acc;
			}, {});

			return Object.values(combinedRepos);
		}).catch(err =>
			console.log(err)
		);
};

chrome.runtime.onMessage.addListener(function (request, sender, callback) {
	config = request.config;

	switch (request.event) {
		case 'refreshRepoCache':
			refreshRepoCache().then(data => callback(data));

			break;

		case 'getWorkflows':
			getWorkflows(request.currentRepo).then(data => callback(data));

			break;
	}

	return true;
});