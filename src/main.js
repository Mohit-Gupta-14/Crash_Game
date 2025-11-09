(function () {
    'use strict';

    const canvasWrap = document.getElementById('canvas-wrap');
    const balanceEl = document.getElementById('balance');
    const betEl = document.getElementById('bet');
    const btnPlace = document.getElementById('btnPlace');
    const btnCash = document.getElementById('btnCash');
    const multiplierEl = document.getElementById('multiplier');
    const statusEl = document.getElementById('status');
    const roundEl = document.getElementById('round');

    const START_BALANCE = 1000;
    let balance = START_BALANCE;
    let bet = 0;
    let multiplier = 1.0;
    let crashAt = null;
    let roundActive = false;
    let placed = false;
    let playerCashed = false;
    let placedThisRound = 0;

    const restartDelay = 1500;
    let restartTimerId = null;

    const app = new PIXI.Application({
        backgroundAlpha: 0,
        resizeTo: canvasWrap,
        antialias: true
    });

    canvasWrap.appendChild(app.view);
    const container = new PIXI.Container();
    app.stage.addChild(container);

    const bg = new PIXI.Graphics();
    container.addChild(bg);

    const style = new PIXI.TextStyle({
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 48,
        fill: '#b6f0ff',
        fontWeight: '700'
    });

    const txt = new PIXI.Text('x1.00', style);
    txt.anchor.set(0.5);
    container.addChild(txt);

    const graph = new PIXI.Graphics();
    const bar = new PIXI.Graphics();
    container.addChild(graph);
    container.addChild(bar);

    function drawBackground() {
        const w = app.renderer.width;
        const h = app.renderer.height;
        bg.clear();
        bg.beginFill(0x071126, 0.3);
        bg.drawRect(0, 0, w, h);
        bg.endFill();
        bg.lineStyle(1, 0x12324a, 0.06);
        for (let x = 0; x < w; x += 40) bg.lineTo(x, h);
        for (let y = 0; y < h; y += 40) bg.lineTo(w, y);
    }

    drawBackground();

    function layout() {
        const w = app.renderer.width;
        const h = app.renderer.height;
        txt.x = w * 0.5;
        txt.y = h * 0.18;
        drawBar(0);
    }

    window.addEventListener('resize', layout);
    layout();

    const graphPoints = [];

    function drawGraphPoint(m) {
        const w = Math.max(100, app.renderer.width - 60);
        const h = Math.max(80, app.renderer.height * 0.55);
        const safeM = Number.isFinite(m) && m > 0 ? m : 1;
        const safeCrash = Number.isFinite(crashAt) && crashAt > 1 ? crashAt : 2;
        let norm = Math.log(safeM) / Math.log(safeCrash);
        if (!Number.isFinite(norm) || isNaN(norm)) norm = 0;
        const x = Math.min(w, (graphPoints.length / 200) * w);
        const y = h - Math.min(h, norm * h);
        graphPoints.push({ x, y });
        if (graphPoints.length > 400) graphPoints.shift();
        graph.clear();
        graph.lineStyle(1, 0x142a3a, 0.06);
        for (let gx = 0; gx < w; gx += 50) graph.lineTo(gx, h);
        for (let gy = 0; gy < h; gy += 40) graph.lineTo(w, gy);
        graph.lineStyle(3, 0x5fe2ff, 1);
        graph.moveTo(0, h);
        graphPoints.forEach(p => graph.lineTo(p.x, p.y));
    }

    function drawBar(progress) {
        const w = app.renderer.width;
        const h = app.renderer.height;
        bar.clear();
        bar.lineStyle(2, 0x123b56, 0.2);
        bar.drawRoundedRect(30, h - 60, Math.max(10, w - 60), 16, 8);
        bar.beginFill(0x2b8df7, 0.9);
        bar.drawRoundedRect(
            30,
            h - 60,
            (Math.max(10, w - 60)) * Math.max(0, Math.min(1, progress)),
            16,
            8
        );
        bar.endFill();
    }

    function genCrash() {
        const r = Math.random();
        const crash = Math.max(1.0, Math.floor((1 / (1 - r)) * 100) / 100);
        return Math.min(crash, 500);
    }

    function scheduleNextRound(delayMs) {
        if (restartTimerId) clearTimeout(restartTimerId);
        restartTimerId = setTimeout(() => {
            restartTimerId = null;
            startRound();
        }, delayMs || restartDelay);
    }

    app.ticker.add(delta => {
        if (!roundActive) return;
        if (!Number.isFinite(delta) || delta <= 0) delta = 1 / 60;
        const growthPerFrame = 0.004;
        if (!Number.isFinite(multiplier) || multiplier <= 0) multiplier = 1.0;
        multiplier *= 1 + growthPerFrame * delta;
        if (!Number.isFinite(multiplier)) multiplier = 1.0;
        txt.text = 'x' + multiplier.toFixed(2);
        if (multiplierEl) multiplierEl.textContent = txt.text;
        drawGraphPoint(multiplier);
        if (crashAt && multiplier >= crashAt) {
            roundActive = false;
            playerBust();
            scheduleNextRound(restartDelay);
        }
        const progress = crashAt ? Math.min(1, multiplier / crashAt) : 0;
        drawBar(progress);
    });

    if (btnPlace) {
        btnPlace.addEventListener('click', () => {
            const value = Number(betEl.value);
            if (!value || value <= 0) return;
            if (value > balance) return;
            bet = value;
            placed = true;
            placedThisRound = bet;
        });
    }

    if (btnCash) btnCash.addEventListener('click', () => { if (roundActive) cashOut(); });

    function startRound() {
        clearTimeout(restartTimerId);
        multiplier = 1.0;
        graphPoints.length = 0;
        crashAt = genCrash();
        roundActive = true;
        playerCashed = false;
        if (placed) placedThisRound = bet;
        if (roundEl) roundEl.textContent = 'Running';
        if (statusEl) statusEl.textContent = 'Round started';
    }

    function playerBust() {
        if (statusEl) {
            statusEl.textContent = `You Lost 💥 (Crashed at x${crashAt.toFixed(2)})`;
            statusEl.style.color = '#ff4444';
        }
        if (roundEl) roundEl.textContent = 'Busted';
        if (placed && !playerCashed) {
            balance -= placedThisRound;
            if (balanceEl) balanceEl.textContent = balance.toFixed(2);
        }
        placed = false;
        playerCashed = false;
    }

    function cashOut() {
        if (!placed || playerCashed) return;
        const payout = bet * multiplier;
        balance += payout - bet;
        playerCashed = true;
        roundActive = false;
        if (balanceEl) balanceEl.textContent = balance.toFixed(2);
        if (statusEl) {
            statusEl.textContent = `You Won 🎉 Cashed out x${multiplier.toFixed(2)} for $${payout.toFixed(2)}`;
            statusEl.style.color = '#4eff74';
        }
        if (roundEl) roundEl.textContent = 'Cashed Out';
        placed = false;
        scheduleNextRound(restartDelay);
    }

    if (balanceEl) balanceEl.textContent = balance.toFixed(2);
    if (statusEl) statusEl.textContent = 'Waiting to start...';
    if (roundEl) roundEl.textContent = 'Waiting';

    scheduleNextRound(2000);

    app.view?.addEventListener('dblclick', () => { if (!roundActive) startRound(); });

    window._pixiCrash = {
        _getState: () => ({ balance, bet, multiplier, crashAt, roundActive, placed, playerCashed }),
        _setRandom: fn => { if (typeof fn === 'function') Math.random = fn; },
        _forceStart: () => { placed = true; bet = bet || 1; startRound(); }
    };
})();
