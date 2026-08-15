// Demo-mode poll: fake, local-only vote counts.
// This file is the one piece that gets swapped out later for real sync.

const poll = {
  options: [
    { id: "a", label: "Real-time voting", votes: 12 },
    { id: "b", label: "Q&A with upvotes", votes: 19 },
    { id: "c", label: "Live word cloud", votes: 7 },
  ],
};

let hasVoted = false;

function totalVotes() {
  return poll.options.reduce((sum, o) => sum + o.votes, 0);
}

function render() {
  const container = document.getElementById("options");
  const total = totalVotes();
  container.innerHTML = "";

  for (const option of poll.options) {
    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);

    const btn = document.createElement("button");
    btn.className = "option";
    btn.innerHTML = `
      <span class="fill" style="width:${hasVoted ? pct : 0}%"></span>
      <span class="label">
        <span>${option.label}</span>
        <span>${hasVoted ? pct + "%" : ""}</span>
      </span>
    `;
    btn.addEventListener("click", () => vote(option.id));
    container.appendChild(btn);
  }
}

function vote(optionId) {
  if (hasVoted) return; // one vote per device in this demo
  const option = poll.options.find((o) => o.id === optionId);
  option.votes += 1;
  hasVoted = true;
  render();
}

render();
