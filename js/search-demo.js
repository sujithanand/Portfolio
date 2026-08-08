(function () {
    const results = [
    {
      title: "Risk: third-party integration delay",
      description: "Matching controls, policies, and questionnaire references across modules.",
      tags: ["Risk", "Questionnaire"],
      categories: ["Risks", "Mitigation"],
      owner: "Alex"
    },
    {
      title: "Control: access revocation policy",
      description: "AI highlights related risks and mitigation actions tied to governance.",
      tags: ["Control", "Governance"],
      categories: ["Controls", "Tasks"],
      owner: "Priya"
    },
    {
      title: "Questionnaire: vendor due diligence",
      description: "Instant context for auditors, policies, and compliance leads.",
      tags: ["Questionnaire", "Compliance"],
      categories: ["Questionnaires", "Compliance"],
      owner: "Liam"
    },
    {
      title: "Policy: incident response playbook",
      description: "Links controls, risks, and governance approvals in one view.",
      tags: ["Policy", "Risk"],
      categories: ["Policies", "Risks"],
      owner: "Sana"
    },
    {
      title: "Control: vendor onboarding",
      description: "Connects relevant questionnaires and compliance checkpoints.",
      tags: ["Control", "Governance"],
      categories: ["Controls", "Tasks"],
      owner: "Ajay"
    }
  ];

  const grid = document.getElementById("result-grid");
  const input = document.getElementById("global-search");
  const recent = document.getElementById("recent-searches");
  const tabs = document.getElementById("result-tabs");
  let currentCategory = "All";

  const recentQueries = ["vendor risk", "fire incident", "questionnaire"];

  function showRecent() {
    if (recent) {
      recent.hidden = false;
    }
    if (grid) {
      grid.classList.add("collapsed");
    }
    if (tabs) tabs.hidden = true;
  }

  function hideRecent() {
    if (recent) {
      recent.hidden = true;
    }
  }

  function showResults() {
    hideRecent();
    if (grid) {
      grid.classList.remove("collapsed");
    }
    if (tabs) {
      tabs.hidden = false;
    }
  }

  function render(items) {
    if (!grid) return;
    grid.innerHTML = items.length
      ? items
          .map(
            (item) => `
      <article class="result-card">
        <h4>${item.title}</h4>
        <p>${item.description}</p>
        <div class="result-meta">
          ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
          <span class="tag">Owner: ${item.owner}</span>
        </div>
      </article>
    `
          )
          .join("")
      : `<p>No results yet. Refine your search.</p>`;
  }

  function upgradeQuery(value) {
    const cleaned = value.trim().toLowerCase();
    return cleaned;
  }

  function filterResults(query, category) {
    return results.filter((item) => {
      const matchesCategory = category === "All" || (item.categories || []).includes(category);
      if (!matchesCategory) return false;
      if (!query) return true;
      const haystack = `${item.title} ${item.description} ${item.tags.join(" ")} ${(item.categories || []).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function handleInput(event) {
    const query = upgradeQuery(event.target.value);
    if (!query) {
      showRecent();
      render([]);
      return;
    }
    render(filterResults(query, currentCategory));
    showResults();
  }

  function handleTabClick(event) {
    if (!(event.target instanceof HTMLElement)) return;
    const tab = event.target.closest(".result-tab");
    if (!tab) return;
    currentCategory = tab.dataset.cat || "All";
    if (tabs) {
      tabs.querySelectorAll(".result-tab").forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
    }
    const query = upgradeQuery(input?.value || "");
    render(filterResults(query, currentCategory));
    showResults();
  }

  if (tabs) {
    tabs.addEventListener("click", handleTabClick);
  }

  if (input) {
    input.addEventListener("input", handleInput);
    input.addEventListener("focus", () => {
      if (!upgradeQuery(input.value)) {
        showRecent();
      }
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!upgradeQuery(input.value)) {
          hideRecent();
          if (grid) grid.classList.add("collapsed");
          if (tabs) tabs.hidden = true;
        }
      }, 150);
    });
  }

  if (recent) {
    recent.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const tag = event.target.closest(".recent-tag");
      if (!tag || !input) return;
      input.value = tag.textContent || "";
      handleInput({ target: input });
    });
  }

  render([]);
})();
