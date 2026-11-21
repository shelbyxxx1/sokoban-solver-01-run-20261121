[![make.fun](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/shelbyxxx1/sokoban-solver-01-run-20261121/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/shelbyxxx1/sokoban-solver-01-run-20261121/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)

# Sokoban Solver

A deterministic Sokoban solver using reverse-push reachability, room decomposition, and breadth-first search over pushes. It reconstructs shortest walks between pushes and targets push-optimal solutions.

Bounty: https://make.fun/bounty/sokoban-solver-01-run-20261121

## Run locally

With Node.js 22 or later, provide one directory per level under the input directory; each must contain `level.txt`.

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

The solver writes each answer to `<output>/<id>/solution.txt`. The defaults are `/input` and `/output`.
