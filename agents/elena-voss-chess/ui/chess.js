(() => {
  const PIECES = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
  };
  const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const NAMES = {
    P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king",
    p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king"
  };

  const START = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
  ];

  const state = {
    board: cloneBoard(START),
    turn: "w",
    selected: null,
    legal: [],
    history: [],
    lastMove: null,
    gameOver: false
  };

  const boardEl = document.getElementById("board");
  const moveList = document.getElementById("moveList");
  const coachText = document.getElementById("coachText");
  const turnBadge = document.getElementById("turnBadge");

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function isWhite(piece) {
    return Boolean(piece) && piece === piece.toUpperCase();
  }

  function colorOf(piece) {
    if (!piece) return null;
    return isWhite(piece) ? "w" : "b";
  }

  function squareName(r, c) {
    return `${String.fromCharCode(97 + c)}${8 - r}`;
  }

  function findKing(board, color) {
    const target = color === "w" ? "K" : "k";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === target) return { r, c };
      }
    }
    return null;
  }

  function attackedBy(board, r, c, byColor) {
    const enemyPawn = byColor === "w" ? "P" : "p";
    const pawnDir = byColor === "w" ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = r + pawnDir;
      const pc = c + dc;
      if (inBounds(pr, pc) && board[pr][pc] === enemyPawn) return true;
    }

    const knight = byColor === "w" ? "N" : "n";
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc] === knight) return true;
    }

    const king = byColor === "w" ? "K" : "k";
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] === king) return true;
      }
    }

    const rays = [
      { dirs: [[0,1],[0,-1],[1,0],[-1,0]], pieces: byColor === "w" ? ["R","Q"] : ["r","q"] },
      { dirs: [[1,1],[1,-1],[-1,1],[-1,-1]], pieces: byColor === "w" ? ["B","Q"] : ["b","q"] }
    ];
    for (const ray of rays) {
      for (const [dr, dc] of ray.dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const piece = board[nr][nc];
          if (piece) {
            if (ray.pieces.includes(piece)) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }
    return false;
  }

  function inCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return true;
    return attackedBy(board, king.r, king.c, color === "w" ? "b" : "w");
  }

  function pushSlide(board, from, dirs, moves, color) {
    for (const [dr, dc] of dirs) {
      let r = from.r + dr;
      let c = from.c + dc;
      while (inBounds(r, c)) {
        const target = board[r][c];
        if (!target) moves.push({ r, c, capture: false });
        else {
          if (colorOf(target) !== color) moves.push({ r, c, capture: true });
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }

  function rawMoves(board, from) {
    const piece = board[from.r][from.c];
    if (!piece) return [];
    const color = colorOf(piece);
    const type = piece.toUpperCase();
    const moves = [];

    if (type === "P") {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const one = { r: from.r + dir, c: from.c };
      if (inBounds(one.r, one.c) && !board[one.r][one.c]) {
        moves.push({ ...one, capture: false });
        const two = { r: from.r + dir * 2, c: from.c };
        if (from.r === startRow && !board[two.r][two.c]) moves.push({ ...two, capture: false });
      }
      for (const dc of [-1, 1]) {
        const cr = from.r + dir;
        const cc = from.c + dc;
        if (inBounds(cr, cc) && board[cr][cc] && colorOf(board[cr][cc]) !== color) {
          moves.push({ r: cr, c: cc, capture: true });
        }
      }
    } else if (type === "N") {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const r = from.r + dr;
        const c = from.c + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (!target || colorOf(target) !== color) moves.push({ r, c, capture: Boolean(target) });
      }
    } else if (type === "B") {
      pushSlide(board, from, [[1,1],[1,-1],[-1,1],[-1,-1]], moves, color);
    } else if (type === "R") {
      pushSlide(board, from, [[1,0],[-1,0],[0,1],[0,-1]], moves, color);
    } else if (type === "Q") {
      pushSlide(board, from, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], moves, color);
    } else if (type === "K") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const r = from.r + dr;
          const c = from.c + dc;
          if (!inBounds(r, c)) continue;
          const target = board[r][c];
          if (!target || colorOf(target) !== color) moves.push({ r, c, capture: Boolean(target) });
        }
      }
    }
    return moves;
  }

  function applyOnBoard(board, from, to) {
    const next = cloneBoard(board);
    const piece = next[from.r][from.c];
    next[to.r][to.c] = piece;
    next[from.r][from.c] = null;
    if (piece && piece.toUpperCase() === "P" && (to.r === 0 || to.r === 7)) {
      next[to.r][to.c] = isWhite(piece) ? "Q" : "q";
    }
    return next;
  }

  function legalMoves(board, from) {
    const piece = board[from.r][from.c];
    if (!piece) return [];
    const color = colorOf(piece);
    return rawMoves(board, from).filter((move) => !inCheck(applyOnBoard(board, from, move), color));
  }

  function allLegalMoves(board, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (colorOf(board[r][c]) !== color) continue;
        legalMoves(board, { r, c }).forEach((to) => moves.push({ from: { r, c }, to }));
      }
    }
    return moves;
  }

  function pieceValue(piece) {
    return piece ? (VALUES[piece.toLowerCase()] || 0) : 0;
  }

  function isHanging(board, r, c, color) {
    const piece = board[r][c];
    if (!piece || colorOf(piece) !== color) return false;
    const enemy = color === "w" ? "b" : "w";
    if (!attackedBy(board, r, c, enemy)) return false;
    // Simple: attacked and not defended counts as hanging; also if lower-value attacker exists.
    if (!attackedBy(board, r, c, color)) return true;
    return false;
  }

  function findHangings(board, color) {
    const list = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isHanging(board, r, c, color)) {
          list.push({ r, c, piece: board[r][c], value: pieceValue(board[r][c]) });
        }
      }
    }
    return list.sort((a, b) => b.value - a.value);
  }

  function evaluateMove(board, move) {
    const beforeHang = findHangings(board, "w").reduce((sum, item) => sum + item.value, 0);
    const captured = board[move.to.r][move.to.c];
    const next = applyOnBoard(board, move.from, move.to);
    const afterHang = findHangings(next, "w");
    const hangValue = afterHang.reduce((sum, item) => sum + item.value, 0);
    let score = pieceValue(captured) * 10;
    score -= Math.max(0, hangValue - beforeHang) * 12;
    // Mild center preference.
    score += (4 - (Math.abs(move.to.r - 3.5) + Math.abs(move.to.c - 3.5))) * 0.2;
    if (inCheck(next, "b")) score += 1.4;
    return { score, next, captured, hangings: afterHang };
  }

  function bestWhiteMove(board) {
    const moves = allLegalMoves(board, "w");
    let best = null;
    for (const move of moves) {
      const evaled = evaluateMove(board, move);
      if (!best || evaled.score > best.eval.score) best = { move, eval: evaled };
    }
    return best;
  }

  function explainMistake(board, from, to, captured) {
    const played = evaluateMove(board, { from, to });
    const best = bestWhiteMove(board);
    const movedPiece = board[from.r][from.c];
    const movedName = NAMES[movedPiece] || "piece";
    const dest = squareName(to.r, to.c);
    const playedFrom = squareName(from.r, from.c);

    const betterLine = () => {
      if (!best) return null;
      const betterFrom = squareName(best.move.from.r, best.move.from.c);
      const betterTo = squareName(best.move.to.r, best.move.to.c);
      const betterPiece = NAMES[board[best.move.from.r][best.move.from.c]] || "piece";
      if (best.eval.captured) {
        const prize = NAMES[best.eval.captured] || "piece";
        return {
          action: `move your ${betterPiece} from ${betterFrom} to ${betterTo} and take the ${prize}`,
          reason: "that capture wins material safely"
        };
      }
      return {
        action: `move your ${betterPiece} from ${betterFrom} to ${betterTo}`,
        reason: "that keeps your pieces safer and more useful"
      };
    };

    // Hung piece after the move.
    const newHangs = played.hangings.filter((item) => item.value >= 3);
    if (newHangs.length) {
      const victim = newHangs[0];
      const victimName = NAMES[victim.piece] || "piece";
      const victimSq = squareName(victim.r, victim.c);
      const better = betterLine();
      if (better) {
        return `You should have ${better.action}, because ${better.reason}. Your ${movedName} to ${dest} left your ${victimName} on ${victimSq} free to take.`;
      }
      return `You should have protected your ${victimName} on ${victimSq}, because after ${movedName} from ${playedFrom} to ${dest} it is free for Black to take.`;
    }

    // Missed a clearly better idea.
    if (best && played.score < best.eval.score - 2.2) {
      const better = betterLine();
      if (better) {
        return `You should have ${better.action}, because ${better.reason}. Moving your ${movedName} to ${dest} was weaker.`;
      }
    }

    // Generally poor move.
    if (played.score < -2) {
      const better = betterLine();
      if (better) {
        return `You should have ${better.action}, because ${better.reason}. Your ${movedName} to ${dest} gives Black an easy reply.`;
      }
      return `You should have checked whether Black can take something for free after this, because your ${movedName} to ${dest} leaves you open.`;
    }

    return null;
  }

  function pick(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  let cachedVoices = [];
  function refreshVoices() {
    if (!window.speechSynthesis) return;
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }
  refreshVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  function pickElenaVoice() {
    refreshVoices();
    const english = cachedVoices.filter((voice) => /^en(-|_)/i.test(voice.lang) || /^en$/i.test(voice.lang));
    const named = english.find((voice) => /samantha|karen|moira|victoria|fiona|susan|zira|female|salli|joanna|ivy/i.test(voice.name));
    return named || english.find((voice) => /en-US/i.test(voice.lang)) || english[0] || cachedVoices[0] || null;
  }

  function speakMistake(text) {
    if (!window.speechSynthesis || !text) return;
    const clean = String(text).replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.9;
    utter.pitch = 1;
    utter.volume = 1;
    const voice = pickElenaVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }

  function showNote(message) {
    coachText.textContent = message;
  }

  function teachMistake(message) {
    showNote(message);
    speakMistake(message);
  }

  function applyMove(from, to) {
    const piece = state.board[from.r][from.c];
    const captured = state.board[to.r][to.c];
    state.board = applyOnBoard(state.board, from, to);
    state.lastMove = { from, to };
    state.history.push({
      san: `${PIECES[piece]} ${squareName(from.r, from.c)} → ${squareName(to.r, to.c)}${captured ? " ×" : ""}`
    });
    state.turn = state.turn === "w" ? "b" : "w";
    state.selected = null;
    state.legal = [];
    return captured;
  }

  function teacherMove() {
    if (state.gameOver || state.turn !== "b") return;
    const moves = allLegalMoves(state.board, "b");
    if (!moves.length) {
      endGame(inCheck(state.board, "b") ? "Checkmate. You win." : "Stalemate.");
      return;
    }
    moves.sort((a, b) => {
      const sa = evaluateMove(state.board, a).score + Math.random() * 0.2;
      const sb = evaluateMove(state.board, b).score + Math.random() * 0.2;
      // For Black, flip material sense lightly by using same helper on mirrored goals.
      return sb - sa;
    });
    // Prefer capturing / checking simply.
    let choice = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const next = applyOnBoard(state.board, move.from, move.to);
      let score = pieceValue(state.board[move.to.r][move.to.c]) * 10;
      if (inCheck(next, "w")) score += 2;
      score += Math.random() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        choice = move;
      }
    }
    applyMove(choice.from, choice.to);
    // Do not narrate Elena's moves — coaching is only about the user's mistakes.
    updateStatus();
    render();
    const replies = allLegalMoves(state.board, "w");
    if (!replies.length) {
      endGame(inCheck(state.board, "w") ? "Checkmate. I win this one — new game when ready." : "Stalemate.");
    }
  }

  function endGame(message) {
    state.gameOver = true;
    showNote(message);
    turnBadge.textContent = "Game over";
  }

  function updateStatus() {
    if (state.gameOver) return;
    const check = inCheck(state.board, state.turn);
    turnBadge.textContent = `${state.turn === "w" ? "White" : "Black"} to move${check ? " · check" : ""}`;
  }

  function renderLabels() {
    document.getElementById("topFiles").innerHTML = "abcdefgh".split("").map((f) => `<span>${f}</span>`).join("");
    document.getElementById("bottomFiles").innerHTML = "abcdefgh".split("").map((f) => `<span>${f}</span>`).join("");
    document.getElementById("leftRanks").innerHTML = [8,7,6,5,4,3,2,1].map((r) => `<span>${r}</span>`).join("");
  }

  function render() {
    renderLabels();
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const square = document.createElement("button");
        square.type = "button";
        square.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
        const piece = state.board[r][c];
        if (piece) {
          const span = document.createElement("span");
          span.className = "piece";
          span.textContent = PIECES[piece];
          square.appendChild(span);
        }
        if (state.selected && state.selected.r === r && state.selected.c === c) square.classList.add("selected");
        const legal = state.legal.find((m) => m.r === r && m.c === c);
        if (legal) {
          square.classList.add("legal");
          if (legal.capture) square.classList.add("capture");
        }
        if (state.lastMove && ((state.lastMove.from.r === r && state.lastMove.from.c === c) || (state.lastMove.to.r === r && state.lastMove.to.c === c))) {
          square.classList.add("last");
        }
        const king = findKing(state.board, state.turn);
        if (!state.gameOver && king && king.r === r && king.c === c && inCheck(state.board, state.turn)) {
          square.classList.add("check");
        }
        square.addEventListener("click", () => onSquareClick(r, c));
        boardEl.appendChild(square);
      }
    }
    moveList.innerHTML = state.history.map((move) => `<li>${move.san}</li>`).join("") || "<li>No moves yet</li>";
  }

  function onSquareClick(r, c) {
    if (state.gameOver || state.turn !== "w") return;
    const piece = state.board[r][c];

    if (state.selected) {
      const move = state.legal.find((m) => m.r === r && m.c === c);
      if (move) {
        const from = { ...state.selected };
        const to = { r, c };
        const capturedBefore = state.board[to.r][to.c];
        const mistake = explainMistake(state.board, from, to, capturedBefore);
        applyMove(from, to);
        if (mistake) teachMistake(mistake);
        else showNote("Your move looks fine. Keep going.");
        updateStatus();
        render();
        setTimeout(teacherMove, 380);
        return;
      }
    }

    if (piece && colorOf(piece) === "w") {
      state.selected = { r, c };
      state.legal = legalMoves(state.board, { r, c });
      render();
      return;
    }

    state.selected = null;
    state.legal = [];
    render();
  }

  function newGame() {
    state.board = cloneBoard(START);
    state.turn = "w";
    state.selected = null;
    state.legal = [];
    state.history = [];
    state.lastMove = null;
    state.gameOver = false;
    showNote("You play White. If you make a mistake, I’ll say what you should have done and why.");
    updateStatus();
    render();
  }

  function hint() {
    if (state.gameOver || state.turn !== "w") return;
    const best = bestWhiteMove(state.board);
    if (!best) return;
    const from = squareName(best.move.from.r, best.move.from.c);
    const to = squareName(best.move.to.r, best.move.to.c);
    const piece = NAMES[state.board[best.move.from.r][best.move.from.c]] || "piece";
    const reason = best.eval.captured
      ? "that capture is the clearest gain right now"
      : "that move keeps your position safer";
    teachMistake(`You should move your ${piece} from ${from} to ${to}, because ${reason}.`);
    state.selected = best.move.from;
    state.legal = legalMoves(state.board, best.move.from);
    render();
  }

  document.getElementById("newGameBtn").addEventListener("click", newGame);
  document.getElementById("hintBtn").addEventListener("click", hint);
  newGame();
})();
