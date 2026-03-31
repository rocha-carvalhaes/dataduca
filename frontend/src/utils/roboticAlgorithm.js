/** Alinhado a app/core/robotic_algorithm.py — direção 0=N,1=E,2=S,3=W */

export const CMD = {
  WALK: 'walk',
  LEFT: 'turn_left',
  RIGHT: 'turn_right',
  COLLECT: 'collect',
};

export const PALETTE = [
  { id: CMD.WALK, label: 'Andar', icon: '⬆️' },
  { id: CMD.LEFT, label: 'Esquerda', icon: '⤴️' },
  { id: CMD.RIGHT, label: 'Direita', icon: '⤵️' },
  { id: CMD.COLLECT, label: 'Coletar', icon: '⭐' },
];

const EVENT_PREFIX = {
  [CMD.WALK]: '+walk',
  [CMD.LEFT]: '+turn_left',
  [CMD.RIGHT]: '+turn_right',
  [CMD.COLLECT]: '+collect',
};

function normalizeCmd(raw) {
  if (raw == null || raw === '') return null;
  const c = String(raw).trim().toLowerCase();
  const aliases = {
    forward: CMD.WALK,
    andar: CMD.WALK,
    turnleft: CMD.LEFT,
    left: CMD.LEFT,
    turn_right: CMD.RIGHT,
    right: CMD.RIGHT,
    collect: CMD.COLLECT,
    coletar: CMD.COLLECT,
  };
  const allowed = new Set(Object.values(CMD));
  if (allowed.has(c)) return c;
  const k = c.replace(/_/g, '');
  return aliases[k] ?? null;
}

/**
 * @returns {{ ok: boolean, events: string[], steps: number }}
 */
export function runProgram(commands, scenario) {
  const gridSize = Number(scenario.grid_size || 3);
  const rs = scenario.robot_start || scenario.robotStart || {};
  let x = Number(rs.x ?? 0);
  let y = Number(rs.y ?? 0);
  let direction = Number(rs.direction ?? 0) % 4;

  const starsRaw = scenario.stars || [];
  const starsRemaining = new Set(starsRaw.map((s) => `${s.x},${s.y}`));
  const obstacles = scenario.obstacles || [];
  const obsSet = new Set(obstacles.map((o) => `${o.x},${o.y}`));

  const events = [];
  let steps = 0;

  for (const raw of commands) {
    const cmd = normalizeCmd(raw);
    if (!cmd) continue;
    steps += 1;
    events.push(EVENT_PREFIX[cmd] || `+${cmd}`);

    if (cmd === CMD.LEFT) {
      direction = (direction + 3) % 4;
    } else if (cmd === CMD.RIGHT) {
      direction = (direction + 1) % 4;
    } else if (cmd === CMD.WALK) {
      let nx = x;
      let ny = y;
      if (direction === 0) ny -= 1;
      else if (direction === 1) nx += 1;
      else if (direction === 2) ny += 1;
      else nx -= 1;
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) {
        return { ok: false, events, steps };
      }
      if (obsSet.has(`${nx},${ny}`)) {
        return { ok: false, events, steps };
      }
      x = nx;
      y = ny;
    } else if (cmd === CMD.COLLECT) {
      const key = `${x},${y}`;
      if (starsRemaining.has(key)) starsRemaining.delete(key);
    }
  }

  const ok = starsRemaining.size === 0;
  return { ok, events, steps };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
