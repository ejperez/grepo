
const config = {
	token: "",
	base: "https://api.github.com",
	maxPage: 3,
	owner: "stokmedia",
	deploybotToken: "",
	deploybotBaseURL: "https://stokmedia.deploybot.com/api/v1",
	deploybotPublicURL: "https://stokmedia.deploybot.com"
};

const refreshWorkflows = () => {
	const currentRepo = document.getElementById("js-repos").value;

	const loader = document.getElementById("js-loading"),
		workflowsContainer = document.getElementById("js-workflows");

	loader.classList.remove("d-none");
	workflowsContainer.classList.add("d-none");

	chrome.storage.local.set({ "current_repo": currentRepo }, function () {
		chrome.runtime.sendMessage({ config: config, event: "getWorkflows", currentRepo: currentRepo })
			.then(response => {
				renderWorkflows(response);
				loader.classList.add("d-none");
				workflowsContainer.classList.remove("d-none");
			});
	});
};

const renderWorkflows = (workflows) => {
	document.getElementById("js-workflows").innerHTML = workflows.filter(workflow => workflow.lastRun)
		.sort((a, b) => {
			if (a.lastRun.timestamp > b.lastRun.timestamp) {
				return 1;
			} else if (a.lastRun.timestamp > b.lastRun.timestamp) {
				return -1;
			}

			return 0;
		})
		.map(workflow => {
			const timestamp = workflow.lastRun.timestamp ? moment(workflow.lastRun.timestamp).fromNow() : "(date not available)",
				newName = workflow.name.replaceAll("Deployment - ", "");

			return `<a href="${workflow.link}" class="list-group-item list-group-item-action overflow-x-hidden text-nowrap" title="View deployment">
				<span class="fw-bold">${newName}</span>						
				<span class="badge text-bg-primary">${workflow.lastRun.branch}</span>
				<span>Ran by <span class="fst-italic">${workflow.lastRun.actor}</span> <span class="fw-bold">${timestamp}</span></span>
				<div class="fst-italic">${workflow.lastRun.commit}</div>
			</a>`;
		}).join("");
};

const renderRepoList = () => {
	chrome.storage.local.get(["repos", "current_repo"], function (items) {
		let repos = items.repos,
			currentRepo = items.current_repo;

		if (!repos) {
			return;
		}

		document.getElementById("js-repos").innerHTML = '<option value="" disabled selected>Select a repo</option>' + repos
			.map(repo => {
				return `<option ${currentRepo === repo.value ? "selected" : ""} value="${repo.value}">${repo.name} (${repo.type})</option>`
			})
			.join("");

		if (currentRepo) {
			refreshWorkflows(currentRepo);
		}
	});
};

const checkSettings = () => {
	chrome.storage.local.get(["github_token", "deploybot_token", "repos"], function (items) {
		document.getElementById("js-token").value = items.github_token && items.deploybot_token ? items.github_token + "|" + items.deploybot_token : "";
		config.token = items.github_token;
		config.deploybotToken = items.deploybot_token;

		if (config.token) {
			document.getElementById("js-repos-container").classList.remove("d-none");
			document.getElementById("js-no-repos-container").classList.add("d-none");
		} else {
			document.getElementById("js-repos-container").classList.add("d-none");
			document.getElementById("js-no-repos-container").classList.remove("d-none");
		}
	});
};

const saveSettings = () => {
	const token = document.getElementById("js-token").value;
	const tokenSplitted = token.split("|");

	config.token = tokenSplitted[0];
	config.deploybotToken = tokenSplitted[1];

	chrome.storage.local.set({ "github_token": tokenSplitted[0], "deploybot_token": tokenSplitted[1] }, function () {
		showMesage("Settings saved!");
		checkSettings();
	});
};

const refreshRepoCache = () => {
	chrome.runtime.sendMessage({ config: config, event: "refreshRepoCache" })
		.then(response => {
			chrome.storage.local.set({ repos: response }, () => {
				showMesage("Repo cache updated!");
				renderRepoList();
			});
		});
};

const showMesage = (message) => {
	document.getElementById("js-message").innerText = message;

	setTimeout(() => {
		document.getElementById("js-message").innerText = "";
	}, 2000);
};

window.onload = () => {
	checkSettings();
	renderRepoList();

	const repos = document.getElementById("js-repos");

	repos.addEventListener("change", refreshWorkflows);
	repos.focus();

	document.getElementById("js-refresh-repos").addEventListener("click", refreshRepoCache);
	document.getElementById("js-save-settings").addEventListener("click", saveSettings);
}