"use strict";

const byId = id => document.getElementById(id);
const money = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = new Intl.NumberFormat("en", {
    minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero",
});
const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

function display(id, value, unit, { showSign = true } = {}) {
    const element = byId(id);
    element.textContent = value === null ? "—" : (showSign ? signed : money).format(value) + unit;
    element.classList.toggle("positive", showSign && value > 0);
    element.classList.toggle("negative", showSign && value < 0);
}

function chart(points) {
    const canvas = byId("curve");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    const values = points.map(point => point.equity);
    const floor = Math.floor(Math.min(...values)) - 1;
    const ceiling = Math.ceil(Math.max(...values)) + 1;
    const left = 58;
    const right = width - 10;
    const y = value => 10 + (ceiling - value) / (ceiling - floor) * (height - 22);

    ctx.font = "12px system-ui";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#334147";
    ctx.fillStyle = "#aab9be";
    for (let i = 0; i < 4; i++) {
        const value = ceiling - i * (ceiling - floor) / 3;
        ctx.fillText(money.format(value), 0, y(value));
        ctx.beginPath();
        ctx.moveTo(left, y(value));
        ctx.lineTo(right, y(value));
        ctx.stroke();
    }
    ctx.strokeStyle = "#82e2bf";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, i) => {
        const x = left + i / Math.max(1, points.length - 1) * (right - left);
        if (i === 0) ctx.moveTo(x, y(point.equity));
        else ctx.lineTo(x, y(point.equity));
    });
    ctx.stroke();
    canvas.setAttribute("aria-label",
        `Realised account growth from ${money.format(values[0])} to ${money.format(values.at(-1))} USDC`);
}

function renderResults(data) {
    display("balance", data.account_balance, " USDC", { showSign: false });
    display("change", data.account_change, " USDC");
    display("change-pct", data.account_change_pct, "%");
    display("realised", data.realised_pnl, " USDC");
    display("return", data.realised_return_pct, "%");
    byId("count").textContent = data.closed_trades;
    const wins = data.wins === 1 ? "win" : "wins";
    const losses = data.losses === 1 ? "loss" : "losses";
    byId("outcomes").textContent = `${data.wins} ${wins} · ${data.losses} ${losses}`;
    byId("balance-note").textContent = `Snapshot after confirmed trade #${data.closed_trades}`;
    byId("chart-end").textContent = `Trade #${data.closed_trades}`;
    byId("update").textContent = `Last updated ${date.format(new Date(data.updated_at))} UTC`;

    for (const trade of data.recent_trades) {
        const item = document.createElement("li");
        const title = document.createElement("div");
        const market = document.createElement("strong");
        const pnl = document.createElement("span");
        const prices = document.createElement("small");
        const times = document.createElement("small");
        title.className = "trade-title";
        market.textContent = `#${trade.trade_number} · ${trade.market} ${trade.side}`;
        pnl.textContent = signed.format(trade.realised_pnl) + " USDC";
        pnl.className = trade.realised_pnl > 0 ? "positive" : trade.realised_pnl < 0 ? "negative" : "";
        const price = new Intl.NumberFormat("en", { maximumFractionDigits: 6 });
        prices.textContent = `Entry ${price.format(trade.entry_price)} · Exit ${price.format(trade.exit_price)} USDC`;
        times.textContent = `Opened ${date.format(new Date(trade.opened_at))} · Closed ${date.format(new Date(trade.closed_at))} UTC`;
        title.append(market, pnl);
        item.append(title, prices, times);
        byId("trades").append(item);
    }
    chart(data.realised_equity);
    window.addEventListener("resize", () => chart(data.realised_equity));
}

if (typeof document !== "undefined") {
    fetch("public_stats.json")
        .then(response => {
            if (!response.ok) throw new Error("Snapshot unavailable");
            return response.json();
        })
        .then(renderResults)
        .catch(() => { byId("update").textContent = "Published results are unavailable."; });
}
