import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const SEARCH_LIMIT = 250000;
const DIRECTIONS = [
  { dx: 0, dy: -1, step: 'u', push: 'U' },
  { dx: 0, dy: 1, step: 'd', push: 'D' },
  { dx: -1, dy: 0, step: 'l', push: 'L' },
  { dx: 1, dy: 0, step: 'r', push: 'R' },
];

type Level = {
  width: number;
  height: number;
  floor: Uint8Array;
  goals: number[];
  boxes: number[];
  player: number;
  neighbors: Int32Array[];
};

type Room = { cells: number[]; boxes: number[]; goals: number[] };
type Push = { box: number; direction: number };
type SearchState = {
  boxes: number[];
  player: number;
  parent: number;
  pushBox: number;
  pushDirection: number;
};

function parseLevel(text: string): Level {
  const rows = text.replace(/\r/g, '').split('\n');
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
  if (rows.length === 0) throw new Error('level has no rows');
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const floor = new Uint8Array(width * height);
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = -1;

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const cell = y * width + x;
      if (row[x] === '#') continue;
      floor[cell] = 1;
      if (row[x] === '.' || row[x] === '*' || row[x] === '+') goals.push(cell);
      if (row[x] === '$' || row[x] === '*') boxes.push(cell);
      if (row[x] === '@' || row[x] === '+') player = cell;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) floor[y * width + x] = 0;
    }
  }
  if (player < 0 || boxes.length !== goals.length) throw new Error('level has invalid player or box/goal counts');

  const neighbors = DIRECTIONS.map(() => new Int32Array(width * height).fill(-1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = y * width + x;
      for (let d = 0; d < DIRECTIONS.length; d++) {
        const nx = x + DIRECTIONS[d].dx;
        const ny = y + DIRECTIONS[d].dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) neighbors[d][cell] = ny * width + nx;
      }
    }
  }
  boxes.sort((a, b) => a - b);
  goals.sort((a, b) => a - b);
  return { width, height, floor, goals, boxes, player, neighbors };
}

function computeLive(level: Level): Uint8Array {
  const live = new Uint8Array(level.floor.length);
  const queue = [...level.goals];
  for (const goal of level.goals) live[goal] = 1;
  for (let head = 0; head < queue.length; head++) {
    const destination = queue[head];
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const predecessor = level.neighbors[d][destination];
      if (predecessor < 0 || !level.floor[predecessor] || live[predecessor]) continue;
      const playerStand = level.neighbors[d][predecessor];
      if (playerStand < 0 || !level.floor[playerStand]) continue;
      live[predecessor] = 1;
      queue.push(predecessor);
    }
  }
  return live;
}

function decompose(level: Level, live: Uint8Array): Room[] | null {
  const startY = Math.floor(level.player / level.width);
  const cut = new Uint8Array(level.floor.length);
  for (let x = 0; x < level.width; x++) {
    const cell = startY * level.width + x;
    if (level.floor[cell] && !live[cell]) cut[cell] = 1;
  }
  if (level.boxes.some((box) => cut[box])) return null;

  const visited = new Uint8Array(level.floor.length);
  const rooms: Room[] = [];
  for (let start = 0; start < level.floor.length; start++) {
    if (!level.floor[start] || cut[start] || visited[start]) continue;
    const queue = [start];
    const cells: number[] = [];
    const cellSet = new Set<number>();
    visited[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      cells.push(cell);
      cellSet.add(cell);
      for (let d = 0; d < DIRECTIONS.length; d++) {
        const next = level.neighbors[d][cell];
        if (next < 0 || !level.floor[next] || cut[next] || visited[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    const boxes = level.boxes.filter((box) => cellSet.has(box));
    const goals = level.goals.filter((goal) => cellSet.has(goal));
    if (boxes.length !== goals.length) return null;
    if (boxes.length > 0) rooms.push({ cells, boxes, goals });
  }
  return rooms;
}

function findRegion(
  level: Level,
  start: number,
  blocked: Set<number>,
  marks: Int32Array,
  queue: Int32Array,
  stamp: number,
): number {
  let head = 0;
  let tail = 0;
  let lowest = start;
  marks[start] = stamp;
  queue[tail++] = start;
  while (head < tail) {
    const cell = queue[head++];
    if (cell < lowest) lowest = cell;
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const next = level.neighbors[d][cell];
      if (next < 0 || !level.floor[next] || blocked.has(next) || marks[next] === stamp) continue;
      marks[next] = stamp;
      queue[tail++] = next;
    }
  }
  return lowest;
}

function frozenAt(
  level: Level,
  movedBox: number,
  actualBoxes: Set<number>,
  fixedWalls: Set<number>,
  goals: Set<number>,
): boolean {
  const x = movedBox % level.width;
  const y = Math.floor(movedBox / level.width);
  for (const oy of [y - 1, y]) {
    for (const ox of [x - 1, x]) {
      let filled = true;
      let hasBadBox = false;
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const px = ox + dx;
          const py = oy + dy;
          if (px < 0 || px >= level.width || py < 0 || py >= level.height) continue;
          const cell = py * level.width + px;
          if (level.floor[cell] && !actualBoxes.has(cell) && !fixedWalls.has(cell)) filled = false;
          if (actualBoxes.has(cell) && !goals.has(cell)) hasBadBox = true;
        }
      }
      if (filled && hasBadBox) return true;
    }
  }
  return false;
}

function searchRoom(
  level: Level,
  startBoxes: number[],
  goals: number[],
  player: number,
  fixedBoxes: Set<number>,
  fixedWalls: Set<number>,
  live: Uint8Array,
  label: string,
): { boxes: number[]; pushes: Push[]; states: number } {
  const goalSet = new Set(goals);
  const allGoals = new Set(level.goals);
  const blockedStart = new Set<number>([...fixedBoxes, ...fixedWalls, ...startBoxes]);
  const marks = new Int32Array(level.floor.length);
  const queue = new Int32Array(level.floor.length);
  let stamp = 0;
  const initialLowest = findRegion(level, player, blockedStart, marks, queue, ++stamp);
  const states: SearchState[] = [{ boxes: startBoxes.slice().sort((a, b) => a - b), player, parent: -1, pushBox: -1, pushDirection: -1 }];
  const keys = new Set<string>([`${initialLowest}:${states[0].boxes.join(',')}`]);
  const isSolved = (boxes: number[]): boolean => boxes.every((box) => goalSet.has(box));
  let found = isSolved(states[0].boxes) ? 0 : -1;

  for (let head = 0; found < 0 && head < states.length; head++) {
    const state = states[head];
    const occupied = new Set<number>([...fixedBoxes, ...fixedWalls, ...state.boxes]);
    const currentStamp = ++stamp;
    findRegion(level, state.player, occupied, marks, queue, currentStamp);
    const moves: { box: number; target: number; direction: number }[] = [];
    for (const box of state.boxes) {
      for (let d = 0; d < DIRECTIONS.length; d++) {
        const target = level.neighbors[d][box];
        const stand = level.neighbors[(d ^ 1)][box];
        if (target < 0 || stand < 0 || marks[stand] !== currentStamp || !level.floor[target] || !live[target] || occupied.has(target)) continue;
        moves.push({ box, target, direction: d });
      }
    }

    for (const move of moves) {
      const nextBoxes = state.boxes.filter((box) => box !== move.box).concat(move.target).sort((a, b) => a - b);
      const nextActual = new Set<number>([...fixedBoxes, ...nextBoxes]);
      if (frozenAt(level, move.target, nextActual, fixedWalls, allGoals)) continue;
      const nextBlocked = new Set<number>([...nextActual, ...fixedWalls]);
      const nextPlayer = move.box;
      const nextLowest = findRegion(level, nextPlayer, nextBlocked, marks, queue, ++stamp);
      const key = `${nextLowest}:${nextBoxes.join(',')}`;
      if (keys.has(key)) continue;
      if (states.length >= SEARCH_LIMIT) throw new Error(`${label} exceeded the ${SEARCH_LIMIT}-state search budget`);
      keys.add(key);
      states.push({ boxes: nextBoxes, player: nextPlayer, parent: head, pushBox: move.box, pushDirection: move.direction });
      const child = states.length - 1;
      if (isSolved(nextBoxes)) {
        found = child;
        break;
      }
    }
  }

  if (found < 0) throw new Error(`${label} has no solution within ${SEARCH_LIMIT} states`);
  const pushes: Push[] = [];
  for (let index = found; states[index].parent >= 0; index = states[index].parent) {
    pushes.push({ box: states[index].pushBox, direction: states[index].pushDirection });
  }
  pushes.reverse();
  return { boxes: states[found].boxes, pushes, states: states.length };
}

function walkTo(level: Level, from: number, target: number, blocked: Set<number>): string {
  if (from === target) return '';
  const previous = new Int32Array(level.floor.length).fill(-2);
  const previousDirection = new Int8Array(level.floor.length).fill(-1);
  const queue = new Int32Array(level.floor.length);
  let head = 0;
  let tail = 0;
  previous[from] = -1;
  queue[tail++] = from;
  while (head < tail && previous[target] === -2) {
    const cell = queue[head++];
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const next = level.neighbors[d][cell];
      if (next < 0 || !level.floor[next] || blocked.has(next) || previous[next] !== -2) continue;
      previous[next] = cell;
      previousDirection[next] = d;
      queue[tail++] = next;
    }
  }
  if (previous[target] === -2) throw new Error('internal error: pushing square is unreachable');
  const directions: number[] = [];
  for (let cell = target; cell !== from; cell = previous[cell]) directions.push(previousDirection[cell]);
  directions.reverse();
  return directions.map((direction) => DIRECTIONS[direction].step).join('');
}

function makeMoves(
  level: Level,
  initialBoxes: number[],
  player: number,
  pushes: Push[],
  fixedBoxes: Set<number>,
  fixedWalls: Set<number>,
): { moves: string; player: number; boxes: number[] } {
  let currentPlayer = player;
  const boxes = initialBoxes.slice().sort((a, b) => a - b);
  let moves = '';
  for (const push of pushes) {
    const direction = DIRECTIONS[push.direction];
    const stand = level.neighbors[push.direction ^ 1][push.box];
    const blocked = new Set<number>([...fixedBoxes, ...fixedWalls, ...boxes]);
    moves += walkTo(level, currentPlayer, stand, blocked);
    moves += direction.push;
    const index = boxes.indexOf(push.box);
    if (index < 0) throw new Error('internal error: push path does not match box positions');
    boxes.splice(index, 1);
    boxes.push(level.neighbors[push.direction][push.box]);
    boxes.sort((a, b) => a - b);
    currentPlayer = push.box;
  }
  return { moves, player: currentPlayer, boxes };
}

function solve(text: string, id: string): string {
  const level = parseLevel(text);
  const live = computeLive(level);
  const rooms = decompose(level, live);
  if (rooms === null) {
    const result = searchRoom(level, level.boxes, level.goals, level.player, new Set(), new Set(), live, `${id} whole level`);
    return makeMoves(level, level.boxes, level.player, result.pushes, new Set(), new Set()).moves;
  }

  const movableBoxes = new Set(level.boxes);
  const finishedGoalWalls = new Set<number>();
  let player = level.player;
  let output = '';
  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
    const room = rooms[roomIndex];
    const roomBoxes = room.boxes.slice().sort((a, b) => a - b);
    const roomBoxSet = new Set(roomBoxes);
    const fixedBoxes = new Set<number>();
    for (const box of movableBoxes) if (!roomBoxSet.has(box)) fixedBoxes.add(box);
    const result = searchRoom(level, roomBoxes, room.goals, player, fixedBoxes, finishedGoalWalls, live, `${id} room ${roomIndex + 1}`);
    const replay = makeMoves(level, roomBoxes, player, result.pushes, fixedBoxes, finishedGoalWalls);
    output += replay.moves;
    player = replay.player;
    for (const box of roomBoxes) movableBoxes.delete(box);
    for (const goal of room.goals) finishedGoalWalls.add(goal);
  }
  return output;
}

for (const id of readdirSync(INPUT_DIR).sort()) {
  const moves = solve(readFileSync(join(INPUT_DIR, id, 'level.txt'), 'utf8'), id);
  if (Buffer.byteLength(moves, 'utf8') + 1 > 65536) throw new Error(`${id} solution exceeds 65536 bytes`);
  const directory = join(OUTPUT_DIR, id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'solution.txt'), `${moves}\n`, 'utf8');
}
