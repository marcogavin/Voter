// Demo-mode poll: fake, local-only vote counts, with a simulated live
// feed so the meters move on their own (like a real event would produce).
// This whole file is the piece that gets replaced once real sync is wired up.

const poll = {
  options: [
    { id: "a", label: "Real-time voting", votes: 12 },
    { id: "b", label: "Q&A with upvotes", votes: 19 },
    { id: "c", label: "Live word cloud", votes: 7 },
  ],
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function totalVotes() {
  return poll.options.reduce((sum, o) => sum + o.votes, 0);
}

function buildRows() {
  const container = document.getElementById("options");
  container.innerHTML = "";

  for (const option of poll.options) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "meter";
    row.dataset.id = option.id;
    row.setAttribute("aria-label", `Vote for ${option.label}`);
    row.innerHTML = `
      <span class="meter-label">${option.label}</span>
      <span class="meter-track">
        <span class="meter-fill"></span>
        <span class="meter-needle"></span>
      </span>
      <span class="meter-pct">0%</span>
    `;
    row.addEventListener("click", () => castVote(option.id));
    container.appendChild(row);
  }

  updateMeters();
}

function updateMeters() {
  const total = totalVotes();

  document.querySelectorAll(".meter").forEach((row) => {
    const option = poll.options.find((o) => o.id === row.dataset.id);
    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);

    row.querySelector(".meter-fill").style.width = pct + "%";
    row.querySelector(".meter-needle").style.left = pct + "%";
    row.querySelector(".meter-pct").textContent = pct + "%";
  });
}

function castVote(optionId) {
  const option = poll.options.find((o) => o.id === optionId);
  option.votes += 1;
  updateMeters();
}

function simulateLiveActivity() {
  if (reduceMotion) return; // don't auto-animate for users who asked not to

  setInterval(() => {
    const option = poll.options[Math.floor(Math.random() * poll.options.length)];
    option.votes += 1;
    updateMeters();
  }, 1800);
}

buildRows();
simulateLiveActivity();
